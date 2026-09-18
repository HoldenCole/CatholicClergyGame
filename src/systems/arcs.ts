import type { ActiveArc, ArcDef, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { arcDef, arcDefs } from '@/content/arcs';
import { evaluateAll } from '@/engine/conditions';

/**
 * Arcs: the things that happen over years. DESIGN.md §12.5.
 *
 * A scene is a week and an arc is a decade. One opens on its own when the man
 * and the parish are right for it, runs a stage at a time with real gaps, ends
 * when its last stage resolves or when a choice ends it early, and the sheets
 * can say at any moment what is running in this man's life. Numbers invented.
 */
export const ARCS = {
  /** Weeks between rolls for a new arc opening. */
  everyWeeks: 13,
  /** The chance one opens at a roll, when there is room for it. */
  chance: 0.35,
  /** Arcs running at once. More than this and a life is a soap opera. */
  maxOpen: 2,
  /** Weeks before the first stage of a new arc. */
  firstStage: [2, 10] as [number, number],
} as const;

export function openArcs(state: GameState): ActiveArc[] {
  return (state.arcs ?? []).filter((a) => a.endedWeek === undefined);
}

export function arcOf(state: GameState, id: string): ActiveArc | undefined {
  return (state.arcs ?? []).find((a) => a.id === id);
}

function withArc(state: GameState, arc: ActiveArc): GameState {
  const rest = (state.arcs ?? []).filter((a) => a.id !== arc.id);
  return { ...state, arcs: [...rest, arc] };
}

/** Whether this arc could open here, now, for this man. */
export function arcEligible(state: GameState, def: ArcDef): boolean {
  if (!def.phase.includes(state.phase)) return false;
  // An arc happens once in a life: a man does not bury the same family twice.
  if (arcOf(state, def.id)) return false;
  return evaluateAll(def.requires ?? [], state);
}

/** A quarter passes: something may begin. */
export function maybeOpenArc(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  if (openArcs(state).length >= ARCS.maxOpen) return { state, line: null };
  if (!rng.chance(ARCS.chance)) return { state, line: null };
  const pool = arcDefs.filter((d) => arcEligible(state, d));
  if (!pool.length) return { state, line: null };
  const def = rng.weighted(pool, (d) => d.weight);
  const first = def.stages[0];
  if (!first) return { state, line: null };
  const arc: ActiveArc = {
    id: def.id,
    stage: 0,
    dueWeek: state.clock.week + rng.int(ARCS.firstStage[0], ARCS.firstStage[1]),
    startedWeek: state.clock.week,
    ...(def.travels ? {} : state.assignment ? { parishId: state.assignment.parishId } : {}),
  };
  return { state: withArc(state, arc), line: null };
}

/** The arc whose next stage is due this week, and the scene it brings. */
export function dueArc(state: GameState): { arc: ActiveArc; def: ArcDef; eventId: string } | null {
  for (const arc of openArcs(state)) {
    const def = arcDef(arc.id);
    const stage = def?.stages[arc.stage];
    if (!def || !stage) continue;
    if (state.clock.week < arc.dueWeek) continue;
    // An arc that belongs to a parish waits for nobody once the man has gone.
    if (arc.parishId && state.assignment?.parishId !== arc.parishId) continue;
    if (stage.requires && !evaluateAll(stage.requires, state)) continue;
    return { arc, def, eventId: stage.event };
  }
  return null;
}

/** That stage has been played: the arc moves on, or it is finished. */
export function advanceArc(state: GameState, id: string, rng: Rng): GameState {
  const arc = arcOf(state, id);
  const def = arcDef(id);
  if (!arc || !def || arc.endedWeek !== undefined) return state;
  const next = arc.stage + 1;
  const stage = def.stages[next];
  if (!stage) return endArc(state, id, 'done');
  return withArc(state, { ...arc, stage: next, dueWeek: state.clock.week + rng.int(stage.after[0], stage.after[1]) });
}

/** It is over, however it went. */
export function endArc(state: GameState, id: string, outcome: string): GameState {
  const arc = arcOf(state, id);
  if (!arc || arc.endedWeek !== undefined) return state;
  const def = arcDef(id);
  return {
    ...withArc(state, { ...arc, endedWeek: state.clock.week, outcome }),
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `${def?.title ?? id}: ${outcome}.` }],
  };
}

/** A choice said to hold it, jump it, or end it. Called by the effects engine. */
export function moveArc(state: GameState, id: string, value: string, rng: Rng): GameState {
  const arc = arcOf(state, id);
  const def = arcDef(id);
  if (!arc || !def) return state;
  if (value.startsWith('hold:')) {
    const weeks = Number(value.slice('hold:'.length)) || 52;
    return withArc(state, { ...arc, dueWeek: state.clock.week + weeks });
  }
  if (value === 'advance') return advanceArc(state, id, rng);
  const jump = def.stages.findIndex((s) => s.id === value);
  if (jump >= 0) {
    const stage = def.stages[jump]!;
    return withArc(state, { ...arc, stage: jump, dueWeek: state.clock.week + rng.int(stage.after[0], stage.after[1]) });
  }
  return endArc(state, id, value);
}

/**
 * A man is moved. An arc that belongs to a parish ends with the parish; one
 * that belongs to him goes in the car.
 */
export function arcsOnMove(state: GameState): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  for (const arc of openArcs(next)) {
    if (!arc.parishId || arc.parishId === state.assignment?.parishId) continue;
    const def = arcDef(arc.id);
    next = endArc(next, arc.id, 'left');
    if (def) lines.push(`${def.title} stays where it was: you are not there to see how it comes out, and nobody will write to tell you.`);
  }
  return { state: next, lines };
}

/** What is running in this man's life, for the sheets. */
export function arcLines(state: GameState): { title: string; line: string; years: number }[] {
  return openArcs(state)
    .map((a) => ({ arc: a, def: arcDef(a.id) }))
    .filter((x): x is { arc: ActiveArc; def: ArcDef } => !!x.def)
    .map(({ arc, def }) => ({ title: def.title, line: def.line, years: Math.max(0, Math.round((state.clock.week - arc.startedWeek) / 52)) }));
}

/** Every arc that has ever run, for the record and the ending. */
export function arcHistory(state: GameState): { title: string; outcome: string; years: number }[] {
  return (state.arcs ?? [])
    .filter((a) => a.endedWeek !== undefined)
    .map((a) => ({ def: arcDef(a.id), a }))
    .filter((x): x is { def: ArcDef; a: ActiveArc } => !!x.def)
    .map(({ def, a }) => ({ title: def.title, outcome: a.outcome ?? 'ended', years: Math.max(1, Math.round(((a.endedWeek ?? 0) - a.startedWeek) / 52)) }));
}
