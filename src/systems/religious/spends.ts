import type { Effect, GameState, ReputationKey, FriarSpendDef, StatKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { religiousOrder, spendDefs } from '@/content/religious';
import { seminaryActivities } from '@/content/seminary';
import { seminaryActivityOffered, setSeminaryActivity } from '@/systems/seminaryWeek';
import { applyStat } from '@/systems/stats';
import { currentHouse, nudgeHouse } from './house';
import { friarLoad, BISHOP_ASKS } from './bishopAsks';
import { statDeltaFactor } from './restless';
import { studyApFactor } from './study';
import { gainReputation, reputationsFade } from './reputations';

/**
 * The friar's discretionary week. E3 §3.3. After the horarium, the office,
 * the work, the friends, and the asks, what is left of the week is his, and
 * he gives it to study, the box, the pulpit, the hospital, the poor, the
 * night office. Each spend builds stats a little, a reputation slowly (under
 * its stat cap), and standing; Sunday supply pays the house; observance moves
 * his own against the house's. Tunables are invented.
 */
export const SPENDS = {
  /** Free blocks a week before anything else is taken. */
  weekBlocks: BISHOP_ASKS.weekBlocks,
  /** A block of study for a Dominican costs less: the order's discount, from the order's mechanics. */
  studyIds: ['study', 'research'],
  /** His own observance rests toward the house's when nothing moves it. */
  observanceRest: 0.02,
  /** Friction between his observance and the house's: standing with the house per week per ten points of gap, either way. */
  gapFriction: 0.02,
} as const;

export function spendDef(id: string): FriarSpendDef | undefined {
  return spendDefs.find((s) => s.id === id);
}

export function spendsOf(state: Pick<GameState, 'religious'>): Record<string, number> {
  return state.religious?.spends ?? {};
}

/** Blocks a spend takes this week: study for an order that protects it is discounted. */
export function spendCost(state: GameState, id: string, ap: number): number {
  const factor = (SPENDS.studyIds as readonly string[]).includes(id) ? studyApFactor(state) : 1;
  return Math.round(ap * factor * 4) / 4;
}

export function spendsUsed(state: GameState): number {
  return Object.entries(spendsOf(state)).reduce((n, [id, ap]) => n + spendCost(state, id, ap), 0);
}

/** The blocks that are his this week. */
export function spendBudget(state: GameState): number {
  return Math.max(0, Math.round((SPENDS.weekBlocks - friarLoad(state)) * 4) / 4);
}

/** Whether a spend is on offer: a priest's work, a house that teaches, the stats it needs. */
export function spendOffered(state: GameState, def: FriarSpendDef): { ok: boolean; why: string } {
  const c = state.character;
  if (!c) return { ok: false, why: '' };
  if (def.needs === 'ordained' && !state.flags.ordained) return { ok: false, why: 'After ordination' };
  if (def.credential && !c.credentials.includes(def.credential)) return { ok: false, why: 'Not learned' };
  if (def.needs === 'teaching_or_school') {
    const house = currentHouse(state);
    const teaches = !!house && (house.works.includes('teaching') || house.works.includes('school') || house.works.includes('formation')) || state.religious?.apostolate?.id === 'seminary_faculty' || state.religious?.apostolate?.id === 'diocesan_school' || state.religious?.apostolate?.id === 'campus_ministry';
    if (!teaches) return { ok: false, why: 'Not from this house' };
  }
  for (const [k, v] of Object.entries(def.requires ?? {})) if (c.stats[k as StatKey] < (v ?? 0)) return { ok: false, why: `Needs more ${k}` };
  return { ok: true, why: '' };
}

/** Give a spend so many blocks a week; clamped to its maximum and to what is left. */
export function setSpend(state: GameState, id: string, ap: number): GameState {
  const r = state.religious;
  const def = spendDef(id);
  if (!r || !def || !spendOffered(state, def).ok) return state;
  const others = spendsUsed({ ...state, religious: { ...r, spends: { ...spendsOf(state), [id]: 0 } } });
  const room = Math.max(0, spendBudget(state) - others);
  const factor = (SPENDS.studyIds as readonly string[]).includes(id) ? studyApFactor(state) : 1;
  const max = Math.min(def.maxAp, Math.floor(room / factor + 1e-6));
  const next = Math.max(0, Math.min(max, Math.round(ap)));
  const spends = { ...spendsOf(state), [id]: next };
  if (next === 0) delete spends[id];
  return { ...state, religious: { ...r, spends } };
}

/** The flag that says the order's default week has been given, so a week he clears stays cleared. */
export const DEFAULT_SPENDS_FLAG = 'friar_spends_defaulted';

/**
 * A newly ordained friar is not handed an empty week: the order gives him
 * its usual one (OrderDef.mechanics.defaultSpends), clamped to what the week
 * leaves, and he rearranges it from the Week sheet. Once, ever.
 */
export function defaultSpends(state: GameState): GameState {
  const r = state.religious;
  if (!r || !state.flags.ordained || state.flags[DEFAULT_SPENDS_FLAG]) return state;
  let next: GameState = { ...state, flags: { ...state.flags, [DEFAULT_SPENDS_FLAG]: true } };
  if (Object.keys(spendsOf(state)).length > 0) return next;
  for (const [id, ap] of Object.entries(religiousOrder(r.order).mechanics.defaultSpends ?? {})) next = setSpend(next, id, ap);
  return next;
}

/** The flag that says the order's default free hours in formation have been given. */
export const DEFAULT_ROUTINE_FLAG = 'friar_routine_defaulted';

/**
 * A novice is not handed empty free hours either: the order's usual ones
 * (OrderDef.mechanics.defaultFormationRoutine), each only where it is offered
 * and within the hours there are. Once; hours he clears stay cleared.
 */
export function defaultFormationRoutine(state: GameState): GameState {
  const r = state.religious;
  const sem = state.seminary;
  if (!r || !sem || state.flags.ordained || state.flags[DEFAULT_ROUTINE_FLAG]) return state;
  let next: GameState = { ...state, flags: { ...state.flags, [DEFAULT_ROUTINE_FLAG]: true } };
  if (Object.keys(sem.routine ?? {}).length > 0) return next;
  for (const [id, hours] of Object.entries(religiousOrder(r.order).mechanics.defaultFormationRoutine ?? {})) {
    const def = seminaryActivities.find((a) => a.id === id);
    if (def && seminaryActivityOffered(next, def)) next = setSeminaryActivity(next, id, hours);
  }
  return next;
}

/** For the sheet: what a spend builds, in words. */
export function spendBuilds(def: FriarSpendDef): string {
  const parts: string[] = [];
  for (const k of Object.keys(def.stats ?? {})) parts.push(k);
  for (const k of Object.keys(def.reputations ?? {})) parts.push(k.replace(/_/g, ' '));
  return parts.slice(0, 3).join(', ');
}

/** One week of what he chose. Returns the digest line, if any. */
export function spendsWeek(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !state.flags.ordained) return { state, line: null };
  const spends = Object.entries(spendsOf(state)).filter(([id, ap]) => ap > 0 && spendDef(id));
  // Over budget after a move or an ask: trim from the last spend down.
  let budget = spendBudget(state);
  let next = state;
  const kept: [string, number][] = [];
  for (const [id, ap] of spends) {
    const cost = spendCost(next, id, ap);
    if (cost <= budget) { kept.push([id, ap]); budget -= cost; }
    else { const fit = Math.max(0, Math.floor(budget)); if (fit > 0) { kept.push([id, fit]); budget -= spendCost(next, id, fit); } }
  }
  if (kept.length !== spends.length || kept.some(([id, ap]) => spendsOf(state)[id] !== ap)) next = { ...next, religious: { ...next.religious!, spends: Object.fromEntries(kept) } };
  const worked = new Set<ReputationKey>();
  let stats = { ...c.stats };
  const effects: Effect[] = [];
  let observance = 0;
  let cohesion = 0;
  let money = 0;
  let strain = 0;
  const lines: string[] = [];
  const recent = new Set(state.digest.slice(-2).flatMap((d) => d.lines.flatMap((l) => l.split(/(?<=\.) /))));
  for (const [id, ap] of kept) {
    const def = spendDef(id)!;
    for (const [k, rate] of Object.entries(def.stats ?? {}) as [StatKey, number][]) stats = applyStat(stats, k, rate * ap * statDeltaFactor(next, k, rate * ap));
    for (const [k, rate] of Object.entries(def.reputations ?? {}) as [ReputationKey, number][]) { worked.add(k); next = gainReputation({ ...next, character: { ...next.character!, stats } }, k, rate * ap); }
    for (const [k, rate] of Object.entries(def.standing ?? {})) effects.push({ target: 'reputation', key: k, delta: (rate ?? 0) * ap });
    observance += (def.observance ?? 0) * ap;
    cohesion += (def.cohesion ?? 0) * ap;
    money += (def.money ?? 0) * ap;
    strain += (def.strain ?? 0) * ap;
    // A line the Record still shows from the last weeks is not said again while there is another.
    const fresh = def.digest.filter((l) => !recent.has(l));
    const from = fresh.length ? fresh : def.digest;
    if (from.length) lines.push(from[rng.int(0, from.length - 1)]!);
  }
  next = { ...next, character: { ...next.character!, stats } };
  if (strain) effects.push({ target: 'strain', key: '', delta: strain });
  if (effects.length) next = applyEffects(next, effects, {}, 'the week that was his');
  const house = currentHouse(next);
  if (house && cohesion) next = nudgeHouse(next, house.id, { cohesion });
  // His own observance: what he did moves it, and it rests toward the house's; the gap rubs both ways.
  const mine = next.religious!.observance ?? house?.observance ?? 50;
  const rest = house?.observance ?? 50;
  const moved = Math.max(0, Math.min(100, mine + observance + (rest - mine) * SPENDS.observanceRest));
  next = { ...next, religious: { ...next.religious!, observance: Math.round(moved * 100) / 100 } };
  const gap = Math.abs(moved - rest);
  if (gap >= 10) next = applyEffects(next, [{ target: 'reputation', key: 'community', delta: -SPENDS.gapFriction * (gap / 10) }], {}, moved > rest ? 'stricter than the house' : 'laxer than the house');
  if (money && next.province) next = { ...next, province: { ...next.province, finances: { ...next.province.finances, balance: next.province.finances.balance + money } } };
  next = reputationsFade(next, worked);
  // A week with none of the hours given still has a line, as the parish's does: the bell, and the hours that went nowhere.
  if (!lines.length && kept.length === 0 && spendBudget(next) > 0) lines.push(QUIET_LINES[rng.int(0, QUIET_LINES.length - 1)]!);
  return { state: next, line: lines.length ? lines.join(' ') : null };
}

const QUIET_LINES = [
  'The bell, the office, and the work; the hours that were yours went nowhere in particular.',
  'The week was the house\'s. The free blocks were not given to anything, and the province does not count them.',
  'Office, table, work, Compline. What was left over was left over.',
];
