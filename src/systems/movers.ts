import type { ConstituencyKey, Effect, GameState, StatKey } from '@/types';
import { STAT_KEYS } from '@/types';
import { WEEK } from './week';
import { careOf } from './week';
import { averageVitality } from './groups';
import { currentParish, frictionOf, LITURGY } from './liturgy';
import { fundBonuses, spendWords } from './spending';
import { spendDef } from '@/content/parish';
import { seasonOf } from '@/engine/time';

/** One thing that moved a number (a constituency's opinion, a stat, alignment), kept for a quarter so the man can see why. */
export interface Mover {
  week: number;
  key: string;
  delta: number;
  why: string;
}

/** The keys a mover can carry: a constituency, a stat, or alignment. */
export type MoverKey = ConstituencyKey | StatKey | 'alignment';

const MOVER_TARGETS = new Set(['reputation', 'stat', 'alignment']);

/** How long the reasons are kept. */
export const MOVERS_WEEKS = 13;

/** Write the reputation, stat, and alignment effects of a batch to the ledger of reasons. */
export function noteMovers(state: GameState, effects: Effect[], why: string): GameState {
  const moves = effects.filter((e) => MOVER_TARGETS.has(e.target) && (e.delta ?? 0) !== 0);
  if (!moves.length) return state;
  const week = state.clock.week;
  const movers = [...(state.movers ?? []), ...moves.map((e) => ({ week, key: e.target === 'alignment' ? 'alignment' : e.key, delta: e.delta ?? 0, why }))];
  return { ...state, movers };
}

/** One move noted directly, for code that does not go through effects. */
export function noteMover(state: GameState, key: MoverKey, delta: number, why: string): GameState {
  if (!delta) return state;
  return { ...state, movers: [...(state.movers ?? []), { week: state.clock.week, key, delta, why }] };
}

/** The difference between two stat sheets, noted under one reason. */
export function noteStatChange(state: GameState, before: Record<StatKey, number>, after: Record<StatKey, number>, why: string): GameState {
  let next = state;
  for (const k of STAT_KEYS) {
    const d = after[k] - before[k];
    if (Math.abs(d) > 1e-9) next = noteMover(next, k, d, why);
  }
  return next;
}

/** Drop reasons older than the quarter. */
export function trimMovers(state: GameState): GameState {
  const movers = (state.movers ?? []).filter((m) => state.clock.week - m.week < MOVERS_WEEKS);
  return movers.length === (state.movers?.length ?? 0) ? state : { ...state, movers };
}

export interface Reason {
  label: string;
  amount: number;
}

/** What moved one number this quarter, largest first, like reasons summed. */
export function explainKey(state: GameState, key: MoverKey, floor = 0.5): Reason[] {
  const sums = new Map<string, number>();
  for (const m of state.movers ?? []) {
    if (m.key !== key || state.clock.week - m.week >= MOVERS_WEEKS) continue;
    sums.set(m.why, (sums.get(m.why) ?? 0) + m.delta);
  }
  return [...sums.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((r) => Math.abs(r.amount) >= floor)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 6);
}

export function explainReputation(state: GameState, key: ConstituencyKey): Reason[] {
  return explainKey(state, key);
}

/** Stats move by tenths; a reason worth a tenth of a point is worth showing. */
export function explainStat(state: GameState, key: StatKey): Reason[] {
  return explainKey(state, key, 0.1);
}

export function explainAlignment(state: GameState): Reason[] {
  return explainKey(state, 'alignment', 0.5);
}

/** One line for a tooltip or a sheet: the quarter's reasons, or that nothing moved. */
export function reasonsLine(reasons: Reason[], decimals = 0): string {
  return reasons.length ? `This quarter: ${reasons.map((r) => `${r.label} ${r.amount > 0 ? '+' : ''}${r.amount.toFixed(decimals)}`).join(', ')}.` : 'Nothing has moved it this quarter.';
}

/** Where the pews are heading and what pulls them, in points of attendance. */
export function explainAttendance(state: GameState): { target: number; now: number; reasons: Reason[] } {
  const c = state.character;
  const parish = state.parish;
  if (!c || !parish) return { target: 0, now: 0, reasons: [] };
  const rec = currentParish(state);
  const groups = (averageVitality(state) - 50) / 50;
  const care = careOf(state);
  const friction = rec ? frictionOf(rec) : 0;
  const mass = friction < LITURGY.tolerance ? LITURGY.pullWhenFitting * (1 - friction / LITURGY.tolerance) : LITURGY.pullPerFriction * (friction - LITURGY.tolerance);
  const parts: Reason[] = [
    { label: 'the rolls, before anything', amount: 0.4 },
    { label: 'what the people think of you', amount: c.reputation.parishioners / 400 },
    { label: 'your presence', amount: c.stats.charisma / 600 },
    { label: 'hours with the people', amount: WEEK.careAttendance * care },
    { label: 'the groups', amount: WEEK.groupsAttendance * groups },
    { label: 'the Mass as set', amount: mass },
  ];
  for (const id of Object.keys(parish.finance.funds ?? {})) {
    const def = spendDef(id);
    if (def?.pull) parts.push({ label: spendWords(state, def).label, amount: def.pull });
  }
  const raw = parts.reduce((n, p) => n + p.amount, 0);
  const target = Math.min(0.9, Math.max(0.15, raw));
  return { target, now: parish.attendance, reasons: parts.map((p) => ({ label: p.label, amount: Math.round(p.amount * 1000) / 10 })).filter((p) => p.label.startsWith('the rolls') || Math.abs(p.amount) >= 0.05) };
}

/** What the plate comes to and why. */
export function explainCollections(state: GameState): { usual: number; factors: Reason[]; costs: Reason[] } {
  const parish = state.parish;
  const rec = currentParish(state);
  if (!parish || !rec) return { usual: 0, factors: [], costs: [] };
  const season = seasonOf(state.clock);
  const bonuses = fundBonuses(state);
  const factors: Reason[] = [
    { label: 'the pews against the usual 45%', amount: Math.round((parish.attendance / 0.45) * 100) / 100 },
    { label: `the season (${season.replace('_', ' ')})`, amount: WEEK.collectionSeason[season] },
  ];
  if (bonuses.collections) factors.push({ label: 'the standing programs', amount: Math.round((1 + bonuses.collections) * 100) / 100 });
  const costs: Reason[] = [
    { label: 'running costs', amount: -Math.round(rec.weeklyCollections * WEEK.runningCostShare) },
    { label: 'the debt', amount: -Math.round((parish.finance.debt * WEEK.debtRateAnnual) / 52) },
    { label: 'the assessment, spread', amount: -Math.round(rec.assessment / 52) },
  ];
  return { usual: rec.weeklyCollections, factors, costs: costs.filter((c) => c.amount !== 0) };
}
