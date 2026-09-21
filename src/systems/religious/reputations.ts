import type { GameState, IdentityDef, ReputationDef, ReputationKey } from '@/types';
import { REPUTATION_KEYS } from '@/types';
import { identityDefs, reputationDefs } from '@/content/religious';

/**
 * What a friar is known for. E3 §8. A reputation is a portable 0..100 value
 * that survives every transfer: built slowly by repeated discretionary work
 * (spends.ts), reinforced by scenes, gated by stats, and decaying only when
 * wholly unused. Two high reputations make an identity; the highest make
 * the man legible to an electorate (§8.3). Tunables are invented.
 */
export const REPUTATIONS = {
  /** A reputation may exceed the average of its gate stats by this much before it is a liability. */
  gateHeadroom: 15,
  /** Weekly fade when a reputation had no work behind it this week. */
  fade: 0.04,
  /** Below this it is not known at all. */
  known: 40,
  high: 65,
  /** An identity needs both of its reputations at least this high. */
  identityFloor: 55,
  /** Legibility: the top reputation carries most of it. */
  legibility: { top: 0.85, second: 0.35, floor: 15 },
} as const;

export function reputationDef(key: ReputationKey): ReputationDef {
  const d = reputationDefs.find((r) => r.id === key);
  if (!d) throw new Error(`no reputation ${key}`);
  return d;
}

export function reputationOf(state: Pick<GameState, 'religious'>, key: ReputationKey): number {
  return state.religious?.reputations?.[key] ?? 0;
}

/** The stat ceiling a reputation cannot outrun: the mean of its gates plus a little. */
export function reputationCap(state: GameState, key: ReputationKey): number {
  const c = state.character;
  if (!c) return 0;
  const gates = reputationDef(key).gates;
  const mean = gates.reduce((n, k) => n + c.stats[k], 0) / Math.max(1, gates.length);
  return Math.min(100, mean + REPUTATIONS.gateHeadroom);
}

/** Reputations from highest, with their values. */
export function topReputations(state: Pick<GameState, 'religious'>): { key: ReputationKey; value: number }[] {
  return REPUTATION_KEYS.map((key) => ({ key, value: reputationOf(state, key) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

export function reputationWord(v: number): string {
  if (v >= 85) return 'the one they name';
  if (v >= REPUTATIONS.high) return 'well known';
  if (v >= REPUTATIONS.known) return 'known';
  if (v >= 20) return 'a little known';
  return 'not known';
}

/** The identities his reputations make now, strongest first. */
export function identitiesOf(state: Pick<GameState, 'religious'>): IdentityDef[] {
  return identityDefs
    .filter((d) => d.mix.every((k) => reputationOf(state, k) >= REPUTATIONS.identityFloor))
    .sort((a, b) => Math.min(...b.mix.map((k) => reputationOf(state, k))) - Math.min(...a.mix.map((k) => reputationOf(state, k))));
}

/** How the province would describe him in one phrase, or null when it could not. */
export function phraseOf(state: Pick<GameState, 'religious'>): string | null {
  const id = identitiesOf(state)[0];
  if (id) return id.label.toLowerCase();
  const top = topReputations(state)[0];
  return top && top.value >= REPUTATIONS.known ? reputationDef(top.key).phrase : null;
}

/** Legibility from reputations, 0..100: what the electors can say of him. E3 §8.3. */
export function legibilityFromReputations(state: Pick<GameState, 'religious'>): number {
  const [a, b] = topReputations(state);
  const l = REPUTATIONS.legibility;
  let v = l.floor + (a?.value ?? 0) * l.top + (b?.value ?? 0) * l.second;
  for (const id of identitiesOf(state)) v -= id.legibilityPenalty ?? 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** The provincial's reading of how a man's reputations fit a house's work, 0..100. */
export function reputationFit(state: Pick<GameState, 'religious'>, work: string): number {
  let fit = 0;
  for (const { key, value } of topReputations(state)) fit += value * (reputationDef(key).works[work] ?? 0);
  for (const id of identitiesOf(state)) fit += id.assignmentBias?.[work] ?? 0;
  return Math.max(0, Math.min(100, Math.round(fit)));
}

/** Piety decay multiplier from identities: the one they line up for is protected. */
export function identityPietyFactor(state: Pick<GameState, 'religious'>): number {
  return identitiesOf(state).reduce((f, id) => f * (id.pietyDecayFactor ?? 1), 1);
}

/** Add to a reputation, held under its stat cap, and recompute identities and flags. */
export function gainReputation(state: GameState, key: ReputationKey, delta: number): GameState {
  const r = state.religious;
  if (!r) return state;
  const cap = reputationCap(state, key);
  const now = reputationOf(state, key);
  const next = Math.max(0, Math.min(delta > 0 ? Math.max(now, cap) : 100, now + delta));
  return refreshReputationFlags({ ...state, religious: { ...r, reputations: { ...(r.reputations ?? {}), [key]: Math.round(next * 100) / 100 } } });
}

/** The flags scenes read: rep:<key>:known|high, rep:overshoot:<key>, identity:<id>; and the identities list. */
export function refreshReputationFlags(state: GameState): GameState {
  const r = state.religious;
  if (!r) return state;
  const flags = { ...state.flags };
  for (const key of REPUTATION_KEYS) {
    const v = reputationOf(state, key);
    const cap = reputationCap(state, key);
    const set = (k: string, on: boolean) => { if (on) flags[k] = true; else delete flags[k]; };
    set(`rep:${key}:known`, v >= REPUTATIONS.known);
    set(`rep:${key}:high`, v >= REPUTATIONS.high);
    // A reputation you did not earn: it has outrun the stats behind it. E3 §8.3.
    set(`rep:overshoot:${key}`, v >= REPUTATIONS.known && v > cap);
  }
  const ids = identitiesOf(state).map((d) => d.id);
  for (const d of identityDefs) { if (ids.includes(d.id)) flags[`identity:${d.id}`] = true; else delete flags[`identity:${d.id}`]; }
  return { ...state, flags, religious: { ...r, identities: ids } };
}

/** The week: reputations with no work behind them fade a little. `worked` names the ones the week's spends fed. */
export function reputationsFade(state: GameState, worked: Set<ReputationKey>): GameState {
  const r = state.religious;
  if (!r?.reputations) return state;
  let next = state;
  for (const key of REPUTATION_KEYS) {
    const v = reputationOf(next, key);
    if (v <= 0 || worked.has(key)) continue;
    next = { ...next, religious: { ...next.religious!, reputations: { ...next.religious!.reputations, [key]: Math.round(Math.max(0, v - REPUTATIONS.fade) * 100) / 100 } } };
  }
  return refreshReputationFlags(next);
}
