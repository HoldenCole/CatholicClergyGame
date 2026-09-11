import type { GameState, ProblemFixDef } from '@/types';
import { problemFix } from '@/content/parish';
import { applyEffects } from '@/engine/effects';

/** A vicar needs the pastor's leave to run with something. Invented. */
export const PROBLEMS = { pastorLeave: 15 } as const;

export interface WorkAvailability {
  fix: ProblemFixDef | null;
  available: boolean;
  why: string | null;
}

/** Whether the man may begin work on the parish's problem, and what it would be. */
export function workAvailability(state: GameState): WorkAvailability {
  const parish = state.parish;
  const record = state.world?.parishes.find((p) => p.id === parish?.parishId);
  if (!parish || !record) return { fix: null, available: false, why: null };
  if (record.problem === 'none') return { fix: null, available: false, why: 'Nothing is on fire. Enjoy it.' };
  const fix = problemFix(record.problem) ?? null;
  if (!fix) return { fix: null, available: false, why: 'Nothing to be done about it but live with it.' };
  if (parish.work) return { fix, available: false, why: 'Already in hand' };
  if (parish.role === 'parochial_vicar') {
    const pastor = state.npcs[record.pastorId];
    if (pastor && pastor.relationship < PROBLEMS.pastorLeave) return { fix, available: false, why: `${pastor.title} ${pastor.name.last} would not hear of it. Earn his trust first.` };
  }
  return { fix, available: true, why: null };
}

export function startWork(state: GameState): GameState {
  const a = workAvailability(state);
  if (!a.available || !a.fix || !state.parish) throw new Error(a.why ?? 'unavailable');
  const work = { problem: a.fix.problem, startWeek: state.clock.week, endWeek: state.clock.week + a.fix.weeks, apPerWeek: a.fix.apPerWeek };
  return {
    ...state,
    parish: { ...state.parish, work },
    career: [...state.career, { week: state.clock.week, kind: 'project', text: `Began to ${a.fix.label.toLowerCase()}.` }],
  };
}

export function stopWork(state: GameState): GameState {
  if (!state.parish?.work) return state;
  return { ...state, parish: { ...state.parish, work: null } };
}

/** One week of the work: cash drawn, and when it ends the problem is gone. */
export function workWeek(state: GameState): { state: GameState; line: string | null } {
  const parish = state.parish;
  const work = parish?.work;
  if (!parish || !work) return { state, line: null };
  const fix = problemFix(work.problem);
  if (!fix) return { state: { ...state, parish: { ...parish, work: null } }, line: null };
  const weekly = Math.round(fix.cost / fix.weeks);
  let next: GameState = { ...state, parish: { ...parish, finance: { ...parish.finance, cash: parish.finance.cash - weekly } } };
  if (next.clock.week < work.endWeek) return { state: next, line: null };
  next = applyEffects(next, fix.effects);
  const parishes = next.world!.parishes.map((p) => (p.id === parish.parishId ? { ...p, problem: 'none' } : p));
  next = {
    ...next,
    world: { ...next.world!, parishes },
    parish: { ...next.parish!, work: null },
    flags: { ...next.flags, [`fixed:${work.problem}`]: true },
    career: [...next.career, { week: next.clock.week, kind: 'project', text: `${fix.label}: done. ${fix.outcome.split('.')[0]}.` }],
  };
  return { state: next, line: fix.outcome };
}
