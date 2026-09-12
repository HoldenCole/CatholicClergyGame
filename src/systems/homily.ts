import type { GameState, HomilyDef } from '@/types';
import { homilyDef, homilyDefs } from '@/content/parish';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { describeUnmet } from './doors';

/** Requested in playtesting; numbers invented. */
export const HOMILY = {
  /** A month between changes: a homily is a course, not a remark. */
  changeEveryWeeks: 4,
} as const;

export interface HomilyAvailability {
  def: HomilyDef;
  current: boolean;
  available: boolean;
  why: string | null;
}

export function currentHomily(state: GameState): HomilyDef | undefined {
  return homilyDef(state.parish?.homily?.topic ?? 'readings');
}

/** Weeks until the homily may change again, 0 when it may. */
export function weeksUntilChange(state: GameState): number {
  const set = state.parish?.homily?.setWeek;
  if (set === undefined) return 0;
  return Math.max(0, HOMILY.changeEveryWeeks - (state.clock.week - set));
}

export function homilyAvailability(state: GameState): HomilyAvailability[] {
  const current = state.parish?.homily?.topic ?? 'readings';
  const wait = weeksUntilChange(state);
  return homilyDefs.map((def) => {
    if (def.id === current) return { def, current: true, available: false, why: 'What you are preaching now' };
    if (!state.parish) return { def, current: false, available: false, why: 'No pulpit' };
    if (def.requires && !evaluateAll(def.requires, state)) return { def, current: false, available: false, why: `needs ${def.requires.map((c) => describeUnmet(c, state)).find((w): w is string => !!w) ?? 'something else'}` };
    if (wait > 0) return { def, current: false, available: false, why: `Give it ${wait} more week${wait === 1 ? '' : 's'}; a homily is a course, not a remark` };
    return { def, current: false, available: true, why: null };
  });
}

export function setHomily(state: GameState, topic: string): GameState {
  const a = homilyAvailability(state).find((x) => x.def.id === topic);
  if (!a?.available || !state.parish) throw new Error(a?.why ?? 'not now');
  return {
    ...state,
    parish: { ...state.parish, homily: { topic, setWeek: state.clock.week } },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Took up a month of homilies on ${a.def.label.toLowerCase()}.` }],
  };
}

/** The week: the homily's standing effects, under its own name. */
export function homilyWeek(state: GameState): { state: GameState; collections: number } {
  const def = currentHomily(state);
  if (!def || !state.parish) return { state, collections: 0 };
  return { state: applyEffects(state, def.weekly, {}, `the homily on ${def.label.toLowerCase()}`), collections: def.collections ?? 0 };
}
