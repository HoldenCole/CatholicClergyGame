import type { GameState, Parish, Project, ProjectDef, ProjectType } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import projects from '@/content/parish/projects.json';
import type { Effect } from '@/types';

export const projectDefs = projects as ProjectDef[];

export function projectDef(type: ProjectType): ProjectDef {
  return projectDefs.find((p) => p.type === type)!;
}

export function availableProjects(state: GameState): { def: ProjectDef; available: boolean; why: string | null }[] {
  const parish = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  return projectDefs.map((def) => {
    if (state.assignment?.role !== 'pastor') return { def, available: false, why: 'Only a pastor decides this' };
    if (state.project) return { def, available: false, why: 'One project at a time' };
    if (def.requires?.school && (!parish || parish.school === 'none')) return { def, available: false, why: 'No school' };
    if (def.requires?.debt && (!parish || (state.parish?.finance.debt ?? 0) <= 0)) return { def, available: false, why: 'No debt to retire' };
    return { def, available: true, why: null };
  });
}

export function startProject(state: GameState, type: ProjectType): GameState {
  const a = availableProjects(state).find((p) => p.def.type === type);
  if (!a?.available) throw new Error(a?.why ?? 'unavailable');
  const def = a.def;
  const parishId = state.parish!.parishId;
  const project: Project = {
    type,
    parishId,
    startWeek: state.clock.week,
    endWeek: state.clock.week + def.weeks,
    apPerWeek: def.apPerWeek,
    costPerWeek: Math.round(def.cost / def.weeks),
    stalledWeeks: 0,
  };
  return { ...state, project, career: [...state.career, { week: state.clock.week, kind: 'project', text: `Began: ${def.label.toLowerCase()} at {parish}.` }] };
}

/** Completion effects on the parish record and the player. Invented, following DESIGN 8.3. */
function completionEffects(type: ProjectType): Effect[] {
  switch (type) {
    case 'renovation':
    case 'restoration':
      return [{ target: 'reputation', key: 'parishioners', delta: 12 }, { target: 'reputation', key: 'chancery', delta: 5 }, { target: 'reputation', key: 'traditional_bloc', delta: type === 'restoration' ? 8 : 0 }];
    case 'debt_retirement':
      return [{ target: 'reputation', key: 'chancery', delta: 12 }, { target: 'stat', key: 'administration', delta: 4 }];
    case 'save_school':
      return [{ target: 'reputation', key: 'parishioners', delta: 15 }, { target: 'reputation', key: 'public', delta: 6 }];
    case 'close_school':
      return [{ target: 'reputation', key: 'parishioners', delta: -12 }, { target: 'reputation', key: 'chancery', delta: 10 }, { target: 'honesty', key: '', delta: 2 }];
    case 'liturgical_change':
      return [{ target: 'outspokenness', key: '', delta: 8 }];
    case 'found_mission':
      return [{ target: 'reputation', key: 'parishioners', delta: 8 }, { target: 'reputation', key: 'public', delta: 6 }, { target: 'archetype', key: 'missionary', delta: 2 }];
    case 'capital_campaign':
      return [{ target: 'money', key: 'cash', delta: 450000 }, { target: 'reputation', key: 'parishioners', delta: -4 }, { target: 'reputation', key: 'chancery', delta: 6 }];
  }
}

/** One week of the project: money out, and completion when the weeks are served. */
export function projectWeek(state: GameState): { state: GameState; line: string | null } {
  const p = state.project;
  if (!p || !state.parish || !state.world) return { state, line: null };
  if (p.parishId !== state.parish.parishId) return { state: { ...state, project: null }, line: 'The project did not survive your transfer.' };
  let next = state;
  let project = p;
  if (p.costPerWeek > 0) {
    if (next.parish!.finance.cash >= p.costPerWeek) next = applyEffects(next, [{ target: 'money', key: 'cash', delta: -p.costPerWeek }]);
    else project = { ...project, stalledWeeks: project.stalledWeeks + 1, endWeek: project.endWeek + 1 };
  } else if (p.type === 'debt_retirement') {
    const pay = Math.min(next.parish!.finance.debt, Math.max(0, Math.round(next.parish!.finance.cash * 0.08)));
    next = { ...next, parish: { ...next.parish!, finance: { ...next.parish!.finance, cash: next.parish!.finance.cash - pay, debt: next.parish!.finance.debt - pay } } };
  }
  if (next.clock.week < project.endWeek) return { state: { ...next, project }, line: null };

  const def = projectDef(p.type);
  next = applyEffects(next, completionEffects(p.type));
  const world = next.world!;
  const parishes = applyProjectToParishes(world.parishes, p, next.character!.alignment);
  const debt = p.type === 'debt_retirement' ? 0 : next.parish!.finance.debt;
  return {
    state: {
      ...next,
      project: null,
      world: { ...world, parishes },
      parish: { ...next.parish!, finance: { ...next.parish!.finance, debt } },
      career: [...next.career, { week: next.clock.week, kind: 'project', text: `Finished: ${def.label.toLowerCase()} at {parish}.` }],
    },
    line: `${def.label} is done.`,
  };
}

/** What a finished project does to the parish record, whoever finishes it. */
function applyProjectToParishes(parishes: Parish[], p: Project, alignment: number): Parish[] {
  return parishes.map((parish) => {
    if (parish.id !== p.parishId) return parish;
    switch (p.type) {
      case 'renovation':
        return { ...parish, buildings: { ...parish.buildings, church: 95, hall: Math.max(parish.buildings.hall, 70) } };
      case 'restoration':
        return { ...parish, buildings: { ...parish.buildings, church: 100 }, alignment: Math.max(-100, parish.alignment - 10) };
      case 'save_school':
        return { ...parish, school: 'open' as const, buildings: { ...parish.buildings, school: Math.max(parish.buildings.school ?? 0, 70) } };
      case 'close_school':
        return { ...parish, school: 'none' as const, buildings: { ...parish.buildings, school: null } };
      case 'liturgical_change':
        return { ...parish, alignment: Math.max(-100, Math.min(100, parish.alignment + Math.sign(alignment) * 15)) };
      case 'found_mission':
        return { ...parish, households: parish.households + 150 };
      default:
        return parish;
    }
  });
}

/** DESIGN 8.3: how likely a successor is to keep a project, invented. */
export const HANDOFF = { base: 0.35, perProgress: 0.45 } as const;

/**
 * On transfer, a project survives only if the successor keeps it. The
 * further along it is, the likelier; if kept, he finishes it and the
 * parish gets the building, the school, or the mission, though not the
 * standing the man who began it would have had.
 */
export function handoffProject(state: GameState, rng: Rng): { state: GameState; kept: boolean | null } {
  const p = state.project;
  if (!p || !state.world || !state.parish || p.parishId !== state.parish.parishId) return { state, kept: null };
  const def = projectDef(p.type);
  const progress = Math.min(1, Math.max(0, (state.clock.week - p.startWeek) / Math.max(1, p.endWeek - p.startWeek)));
  const kept = rng.chance(HANDOFF.base + HANDOFF.perProgress * progress);
  const note = (text: string): GameState => ({ ...state, career: [...state.career, { week: state.clock.week, kind: 'project', text }] });
  if (!kept) return { state: { ...note(`Abandoned by your successor: ${def.label.toLowerCase()} at {parish}.`), project: null }, kept };
  const parishes = applyProjectToParishes(state.world.parishes, p, state.character!.alignment);
  return { state: { ...note(`Your successor kept ${def.label.toLowerCase()} at {parish} and finished it.`), world: { ...state.world, parishes }, project: null }, kept };
}
