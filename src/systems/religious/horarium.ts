import type { Effect, GameState, HorariumKey, Quality } from '@/types';
import { HORARIUM_KEYS } from '@/types';
import { horariumDef, horariumDefs, religiousOrder } from '@/content/religious';
import { applyEffects } from '@/engine/effects';
import { currentHouse, nudgeHouse } from './house';

/**
 * The horarium: the common life's mandatory AP, taken before any assignment
 * work. E3 §3.3. The quality dial is the base game's; an order's mechanics
 * can raise a line (the Dominicans' choral office) and a dispensation can
 * lift one. Tunables are invented.
 */
export const HORARIUM = {
  /** The standing cost of the minimum is multiplied by this at observance 100, on a visible line. */
  visibleAtHigh: 1.8,
  /** How much of a dispensed line's AP is still owed: a dispensed man attends some. */
  dispensedShare: 0.25,
} as const;

export function defaultHorarium(): Record<HorariumKey, Quality> {
  return { hours: 'standard', conventual_mass: 'standard', common_table: 'standard', house_chapter: 'standard' };
}

/** AP one line takes at a quality for this man: the order's extra on the Hours, and a dispensation's relief. */
export function horariumAp(state: Pick<GameState, 'religious'>, key: HorariumKey, quality: Quality): number {
  const r = state.religious;
  if (!r) return 0;
  const def = horariumDef(key);
  const base = def.ap[quality] ?? def.ap.standard;
  const extra = key === 'hours' ? (religiousOrder(r.order).mechanics.choralOfficeExtraAp ?? 0) : 0;
  const ap = base + extra;
  const dispensed = r.dispensed && r.dispensed.from.includes(key);
  return Math.round((dispensed ? ap * HORARIUM.dispensedShare : ap) * 4) / 4;
}

/** The week's mandatory floor from the common life alone. */
export function horariumLoad(state: Pick<GameState, 'religious' | 'clock'>): number {
  const r = state.religious;
  if (!r) return 0;
  return HORARIUM_KEYS.reduce((n, k) => n + horariumAp(state, k, r.horarium[k]), 0);
}

export function setHorarium(state: GameState, key: HorariumKey, quality: Quality): GameState {
  const r = state.religious;
  if (!r) return state;
  const def = horariumDef(key);
  const q: Quality = quality === 'invested' && def.ap.invested === null ? 'standard' : quality;
  return { ...state, religious: { ...r, horarium: { ...r.horarium, [key]: q } } };
}

/** The lines and what they cost this week, for the sheet. */
export function horariumRows(state: GameState): { key: HorariumKey; label: string; quality: Quality; ap: number; blurb: string; dispensed: boolean }[] {
  const r = state.religious;
  if (!r) return [];
  return horariumDefs.map((def) => ({
    key: def.key,
    label: def.label,
    quality: r.horarium[def.key],
    ap: horariumAp(state, def.key, r.horarium[def.key]),
    blurb: def.blurb[r.horarium[def.key]],
    dispensed: !!r.dispensed?.from.includes(def.key),
  }));
}

/**
 * One week of the common life kept as he keeps it: the minimum costs
 * standing with the house, its cohesion, and piety, more visibly where the
 * observance is high; the invested level gives a little back.
 */
export function horariumWeek(state: GameState): GameState {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house || !state.character) return state;
  const effects: Effect[] = [];
  let cohesion = 0;
  for (const def of horariumDefs) {
    const q = r.horarium[def.key];
    const e = def.effects[q];
    const dispensed = r.dispensed?.from.includes(def.key);
    // A dispensed man's absence is licensed: the brothers cover, and it costs him less at the table but not nothing.
    const scale = dispensed && q === 'min' ? 0.4 : 1;
    const visible = def.visible && q === 'min' ? 1 + ((HORARIUM.visibleAtHigh - 1) * house.observance) / 100 : 1;
    if (e.community) effects.push({ target: 'reputation', key: 'community', delta: e.community * scale * visible });
    if (e.piety) effects.push({ target: 'stat', key: 'piety', delta: e.piety * scale });
    cohesion += e.cohesion * scale;
  }
  let next = effects.length ? applyEffects(state, effects, {}, 'the common life as kept') : state;
  if (cohesion) next = nudgeHouse(next, house.id, { cohesion });
  return next;
}
