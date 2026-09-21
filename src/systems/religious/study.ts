import type { GameState, HorariumKey, Quality } from '@/types';
import type { Rng } from '@/engine/rng';
import { doctrinalTopics, religiousOrder } from '@/content/religious';
import { currentHouse, nudgeHouse, priorOf } from './house';

/**
 * The life of the mind as an order's data shapes it. E3 §6.2: study
 * protected by a discount, dispensations from the common life for study, a
 * portable preaching reputation, and the Veritas amplification of public
 * doctrinal positions. Every one of these is a mechanics flag on the order;
 * nothing here tests the key. Tunables are invented.
 */
export const STUDY = {
  /** What a dispensation lifts. */
  dispensedFrom: ['hours', 'common_table'] as HorariumKey[],
  /** Weeks a dispensation runs when granted. */
  weeks: 52,
  /** The brothers cover for him: what it costs a week while it runs. */
  weekly: { community: -0.35, cohesion: -0.12 },
  /** Base chance the prior grants it, before his regard and the house's cohesion. */
  ease: 0.55,
  /** Preaching reputation: what an invested Sunday adds, what a mission or retreat adds, and the weekly fade when none of it happens. */
  preaching: { invested: 0.2, standard: 0.04, mission: 6, retreat: 3, fade: 0.03, known: 60 },
} as const;

/** Study AP for this man: an order's discount, else full. */
export function studyApFactor(state: Pick<GameState, 'religious'>): number {
  const r = state.religious;
  if (!r) return 1;
  return 1 - (religiousOrder(r.order).mechanics.studyApDiscount ?? 0);
}

/** How much a public position on this topic counts: the order's multiplier on doctrinal matters. */
export function positionWeight(state: Pick<GameState, 'religious'>, topic: string): number {
  const r = state.religious;
  if (!r) return 1;
  const m = religiousOrder(r.order).mechanics.doctrinalVolumeMultiplier;
  if (!m || !doctrinalTopics.includes(topic)) return 1;
  return m;
}

export function mayAskDispensation(state: GameState): { ok: boolean; why: string } {
  const r = state.religious;
  if (!r) return { ok: false, why: 'Not a religious' };
  if (!religiousOrder(r.order).mechanics.studyDispensation) return { ok: false, why: 'The order does not dispense for study' };
  if (r.dispensed && r.dispensed.untilWeek > state.clock.week) return { ok: false, why: 'Already dispensed' };
  if (!currentHouse(state)) return { ok: false, why: 'No house' };
  const last = state.flags['dispensation:asked'];
  if (typeof last === 'number' && state.clock.week - last < 26) return { ok: false, why: 'Asked already this half-year' };
  return { ok: true, why: '' };
}

export function dispensationChance(state: GameState): number {
  const prior = priorOf(state);
  const house = currentHouse(state);
  if (!prior || !house) return 0;
  let p: number = STUDY.ease + (prior.relationship / 100) * 0.3 + ((house.cohesion - 50) / 100) * 0.2;
  if (state.phase === 'study') p += 0.2;
  return Math.max(0.05, Math.min(0.95, p));
}

/** Petition the prior to be dispensed from the common life for study. */
export function askDispensation(state: GameState, rng: Rng): { state: GameState; granted: boolean; line: string } {
  const may = mayAskDispensation(state);
  if (!may.ok) return { state, granted: false, line: may.why };
  const r = state.religious!;
  const granted = rng.chance(dispensationChance(state));
  const flags = { ...state.flags, 'dispensation:asked': state.clock.week };
  if (!granted) return { state: { ...state, flags }, granted, line: 'The prior says the house needs you in choir more than the library needs you at all.' };
  const dispensed = { from: [...STUDY.dispensedFrom], untilWeek: state.clock.week + STUDY.weeks };
  return { state: { ...state, flags: { ...flags, 'dispensation:granted': state.clock.week }, religious: { ...r, dispensed } }, granted, line: 'Dispensed from the Hours and the table for a year, for the work. The brothers will cover, and they will remember it.' };
}

/** One week under a dispensation: the brothers cover, at a cost; it lapses when its time is up. */
export function dispensationWeek(state: GameState): GameState {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r?.dispensed || !house) return state;
  if (r.dispensed.untilWeek <= state.clock.week) {
    const { dispensed: _d, ...rest } = r;
    return { ...state, religious: rest };
  }
  const c = state.character;
  let next = state;
  if (c) next = { ...next, character: { ...c, reputation: { ...c.reputation, community: Math.max(-100, (c.reputation.community ?? 0) + STUDY.weekly.community) } } };
  return nudgeHouse(next, house.id, { cohesion: STUDY.weekly.cohesion });
}

/** The preaching reputation, 0..100, for an order whose mechanics keep one. */
export function preachingOf(state: Pick<GameState, 'religious'>): number | undefined {
  const r = state.religious;
  if (!r || !religiousOrder(r.order).mechanics.preachingReputation) return undefined;
  // The order's own preaching reputation and the portable one of §8 are one thing seen from two sides.
  return Math.max(r.preachingReputation ?? 0, r.reputations?.preacher ?? 0);
}

function setPreaching(state: GameState, value: number): GameState {
  const r = state.religious!;
  const v = Math.max(0, Math.min(100, Math.round(value * 100) / 100));
  const known = v >= STUDY.preaching.known;
  const flags = { ...state.flags };
  if (known && !flags['preacher:known']) flags['preacher:known'] = state.clock.week;
  return { ...state, flags, religious: { ...r, preachingReputation: v } };
}

/** One week: the Sunday homily as given grows it; nothing given lets it fade. */
export function preachingWeek(state: GameState, sundayQuality?: Quality): GameState {
  const now = preachingOf(state);
  if (now === undefined) return state;
  const q = sundayQuality ?? state.parish?.routine.obligations.sunday_masses;
  const gain = q === 'invested' ? STUDY.preaching.invested : q === 'standard' ? STUDY.preaching.standard : 0;
  return setPreaching(state, gain > 0 ? now + gain : now - STUDY.preaching.fade);
}

/** A parish mission or a retreat preached: the thing that travels. */
export function preachingEvent(state: GameState, kind: 'mission' | 'retreat'): GameState {
  const now = preachingOf(state);
  if (now === undefined) return state;
  return setPreaching(state, now + STUDY.preaching[kind]);
}
