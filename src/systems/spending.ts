import type { GameState, SpendDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { spendDef, spendDefs } from '@/content/parish';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { controlsMoney } from './finance';
import { describeUnmet } from './doors';
import { parishGroups } from './groups';
import { WEEK } from './week';

/** Invented. */
export const SPENDING = {
  /** Weeks of running costs kept back before any spend. */
  reserveWeeks: 8,
  /** Funding a group: cash per point of vitality, and the most it gives. */
  groupPerPoint: 400,
  groupMaxPoints: 25,
  /** The endowment: mean yearly return and its spread, drawn weekly. */
  investReturnMean: 0.05,
  investReturnSpread: 0.12,
  /** Who may invest: a business head, a credential, or the administration for it. */
  investAdministration: 60,
} as const;

export interface SpendAvailability {
  def: SpendDef;
  standing: boolean;
  available: boolean;
  why: string | null;
}

function record(state: GameState) {
  return state.world?.parishes.find((p) => p.id === state.parish?.parishId);
}

/** Cash the parish can spend and still meet its bills. */
export function spendable(state: GameState): number {
  const parish = state.parish;
  const rec = record(state);
  if (!parish || !rec || !controlsMoney(state)) return 0;
  const reserve = Math.round(rec.weeklyCollections * WEEK.runningCostShare * SPENDING.reserveWeeks);
  return Math.max(0, parish.finance.cash - reserve);
}

export function spendAvailability(state: GameState): SpendAvailability[] {
  const parish = state.parish;
  return spendDefs.map((def) => {
    const standing = !!parish?.finance.funds?.[def.id];
    if (!parish || !controlsMoney(state)) return { def, standing, available: false, why: "The pastor's to spend" };
    if (standing) return { def, standing, available: false, why: 'Standing' };
    if (parish.finance.debt > 0) return { def, standing, available: false, why: 'The debt comes first' };
    if (def.requires && !evaluateAll(def.requires, state)) {
      const why = def.requires.map((c) => describeUnmet(c, state)).find((w): w is string => !!w) ?? 'not here';
      return { def, standing, available: false, why: `needs ${why}` };
    }
    if (spendable(state) < def.cost) return { def, standing, available: false, why: `Not enough in hand; $${def.cost.toLocaleString()} with two months kept back` };
    return { def, standing, available: true, why: null };
  });
}

/** Buy a one-time spend or set up a fund. */
export function spend(state: GameState, id: string): GameState {
  const a = spendAvailability(state).find((x) => x.def.id === id);
  if (!a?.available || !state.parish) throw new Error(a?.why ?? 'unavailable');
  const def = a.def;
  const finance = { ...state.parish.finance, cash: state.parish.finance.cash - def.cost };
  if (def.kind === 'fund') finance.funds = { ...(finance.funds ?? {}), [id]: state.clock.week };
  let next: GameState = { ...state, parish: { ...state.parish, finance } };
  next = applyEffects(next, def.effects);
  return { ...next, career: [...next.career, { week: next.clock.week, kind: 'project', text: `${def.label}: $${def.cost.toLocaleString()} from the parish.` }] };
}

export function closeFund(state: GameState, id: string): GameState {
  const funds = { ...(state.parish?.finance.funds ?? {}) };
  if (!state.parish || !funds[id]) return state;
  delete funds[id];
  return { ...state, parish: { ...state.parish, finance: { ...state.parish.finance, funds } } };
}

/** Put money to a group: vitality bought at a price, and a leader who knows who paid. */
export function fundGroup(state: GameState, groupId: string, amount: number): GameState {
  const g = state.groups[groupId];
  if (!g || !state.parish) throw new Error('no such group');
  if (!controlsMoney(state)) throw new Error("The pastor's to spend");
  const pay = Math.max(0, Math.min(Math.round(amount), spendable(state), SPENDING.groupMaxPoints * SPENDING.groupPerPoint));
  if (pay <= 0) return state;
  const points = Math.min(SPENDING.groupMaxPoints, pay / SPENDING.groupPerPoint);
  const leader = state.npcs[g.leaderId];
  return {
    ...state,
    parish: { ...state.parish, finance: { ...state.parish.finance, cash: state.parish.finance.cash - pay } },
    groups: { ...state.groups, [groupId]: { ...g, vitality: Math.min(100, g.vitality + points) } },
    npcs: leader ? { ...state.npcs, [leader.id]: { ...leader, relationship: Math.min(100, leader.relationship + points / 3) } } : state.npcs,
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Put $${pay.toLocaleString()} behind ${g.name}.` }],
  };
}

/** Whether the man may invest the parish's money: a business past, the paper for it, or the head for it. */
export function mayInvest(state: GameState): { ok: boolean; why: string | null } {
  if (!controlsMoney(state)) return { ok: false, why: "The pastor's to spend" };
  const c = state.character!;
  const ok = !!state.flags['career:accountant'] || !!state.flags['career:management'] || !!state.flags['field:business'] || !!state.flags['field:finance'] || c.credentials.includes('MBA') || c.credentials.includes('partial_cpa') || c.stats.administration >= SPENDING.investAdministration;
  return ok ? { ok: true, why: null } : { ok: false, why: 'Nobody would trust you with it: a business past, an MBA, or the administration for it' };
}

export function invest(state: GameState, amount: number): GameState {
  const may = mayInvest(state);
  if (!may.ok || !state.parish) throw new Error(may.why ?? 'unavailable');
  if (state.parish.finance.debt > 0) throw new Error('The debt comes first');
  const pay = Math.max(0, Math.min(Math.round(amount), spendable(state)));
  if (pay <= 0) return state;
  const f = state.parish.finance;
  return {
    ...state,
    parish: { ...state.parish, finance: { ...f, cash: f.cash - pay, endowment: (f.endowment ?? 0) + pay } },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Invested $${pay.toLocaleString()} of the parish's money.` }],
  };
}

export function withdraw(state: GameState, amount: number): GameState {
  if (!state.parish || !controlsMoney(state)) return state;
  const f = state.parish.finance;
  const take = Math.max(0, Math.min(Math.round(amount), f.endowment ?? 0));
  if (take <= 0) return state;
  return { ...state, parish: { ...state.parish, finance: { ...f, cash: f.cash + take, endowment: (f.endowment ?? 0) - take } } };
}

/** One week: the funds draw their upkeep and do their work; the endowment moves with the market. */
export function spendingWeek(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const parish = state.parish;
  if (!parish) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  let f = { ...parish.finance };
  const funds = { ...(f.funds ?? {}) };
  for (const id of Object.keys(funds)) {
    const def = spendDef(id);
    if (!def) { delete funds[id]; continue; }
    const upkeep = def.upkeep ?? 0;
    if (f.cash < upkeep) {
      delete funds[id];
      lines.push(`${def.label} ran dry; the parish could not keep it up.`);
      continue;
    }
    f = { ...f, cash: f.cash - upkeep };
    if (def.weekly?.length) next = applyEffects(next, def.weekly);
  }
  f.funds = funds;
  if ((f.endowment ?? 0) > 0) {
    const yearly = SPENDING.investReturnMean + rng.derive(`market:${state.clock.week}`).gaussian() * SPENDING.investReturnSpread;
    f.endowment = Math.max(0, Math.round((f.endowment ?? 0) * (1 + yearly / 52)));
  }
  return { state: { ...next, parish: { ...next.parish!, finance: f } }, lines };
}

/** Groups of the parish a pastor could put money behind. */
export function fundableGroups(state: GameState) {
  return parishGroups(state).filter((g) => !g.suppressed && !g.hostile);
}
