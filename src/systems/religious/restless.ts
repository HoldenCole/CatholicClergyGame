import type { GameState, StatKey } from '@/types';
import { religiousOrder } from '@/content/religious';

/**
 * The restless heart. E3 §7.2: for an order whose mechanics say so (the
 * Augustinians), piety swings wider both ways, deep drops come more easily,
 * and a survived crisis raises the ceiling: the man who has come through
 * a dark period ends higher than he started. Conversion as a pattern, not
 * an event. Tunables are invented.
 */
export const RESTLESS = {
  /** Multiplier on every piety movement, up or down. */
  swing: 1.35,
  /** Piety under this is a crisis; over this, survived. */
  crisisBelow: 25,
  survivedAbove: 45,
  /** Each survived crisis: the ceiling rises this much, to a cap, and piety takes this much at once. */
  ceilingPerCrisis: 5,
  ceilingCap: 20,
  survivedGain: 4,
  /** Positive piety gains are multiplied by 1 + ceiling / this. */
  ceilingScale: 50,
} as const;

function restless(state: Pick<GameState, 'religious'>): boolean {
  const r = state.religious;
  return !!r && !!religiousOrder(r.order).mechanics.pietyCeilingRaisedByCrisis;
}

/** The raised ceiling, 0..cap. */
export function pietyCeiling(state: Pick<GameState, 'religious' | 'flags'>): number {
  return Number(state.flags['restless:ceiling'] ?? 0);
}

/** Multiplier on a stat effect from a scene or a system: piety swings wider for the restless, and gains climb higher once a crisis is survived. */
export function statDeltaFactor(state: Pick<GameState, 'religious' | 'flags'>, key: StatKey, delta: number): number {
  if (key !== 'piety' || !restless(state)) return 1;
  const swing: number = RESTLESS.swing;
  return delta > 0 ? swing * (1 + pietyCeiling(state) / RESTLESS.ceilingScale) : swing;
}

/** Multiplier on the weekly piety drain. */
export function restlessPietyFactor(state: Pick<GameState, 'religious'>): number {
  return restless(state) ? RESTLESS.swing : 1;
}

/** One week: a crisis is noted when piety goes under the line, and survived when it comes back over. */
export function restlessWeek(state: GameState): GameState {
  const c = state.character;
  if (!c || !restless(state)) return state;
  const inCrisis = state.flags['restless:crisis'] !== undefined;
  if (!inCrisis && c.stats.piety < RESTLESS.crisisBelow) {
    return { ...state, flags: { ...state.flags, 'restless:crisis': state.clock.week }, career: [...state.career, { week: state.clock.week, kind: 'note', text: 'A dark stretch: the heart restless, and the Office said without hearing it.' }] };
  }
  if (inCrisis && c.stats.piety >= RESTLESS.survivedAbove) {
    const ceiling = Math.min(RESTLESS.ceilingCap, pietyCeiling(state) + RESTLESS.ceilingPerCrisis);
    const flags: GameState['flags'] = { ...state.flags, 'restless:ceiling': ceiling, 'restless:survived': state.clock.week, 'restless:crises': Number(state.flags['restless:crises'] ?? 0) + 1 };
    delete flags['restless:crisis'];
    return { ...state, flags, character: { ...c, stats: { ...c.stats, piety: Math.min(100, c.stats.piety + RESTLESS.survivedGain) } }, career: [...state.career, { week: state.clock.week, kind: 'note', text: 'Out the other side of it, and higher than before: the restless heart, resting a while.' }] };
  }
  return state;
}
