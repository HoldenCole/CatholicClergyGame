import type { GameState } from '@/types';
import { WEEK } from './week';

/** Paying down the parish debt by hand. DESIGN §8.2; the reserve is invented. */
export const FINANCE = {
  /** Weeks of running costs the parish keeps in hand before a payment. */
  reserveWeeks: 8,
} as const;

function record(state: GameState) {
  return state.world?.parishes.find((p) => p.id === state.parish?.parishId);
}

/** Who holds the checkbook. A vicar does not. */
export function controlsMoney(state: GameState): boolean {
  const role = state.assignment?.role;
  return role === 'pastor' || role === 'administrator';
}

/** The most the parish can pay this week and still meet its bills. */
export function debtPayable(state: GameState): number {
  const parish = state.parish;
  const rec = record(state);
  if (!parish || !rec || !controlsMoney(state)) return 0;
  const reserve = Math.round(rec.weeklyCollections * WEEK.runningCostShare * FINANCE.reserveWeeks);
  return Math.max(0, Math.min(parish.finance.debt, parish.finance.cash - reserve));
}

/** Pay the diocese or the bank. Clamped to what is payable; a note goes in the file. */
export function payDebt(state: GameState, amount: number): GameState {
  const parish = state.parish;
  if (!parish) return state;
  const pay = Math.max(0, Math.min(Math.round(amount), debtPayable(state)));
  if (pay <= 0) return state;
  const debt = parish.finance.debt - pay;
  const text = debt <= 0 ? `Paid off the parish debt: $${pay.toLocaleString()}, the last of it.` : `Paid $${pay.toLocaleString()} against the parish debt; $${debt.toLocaleString()} remains.`;
  return {
    ...state,
    parish: { ...parish, finance: { ...parish.finance, cash: parish.finance.cash - pay, debt } },
    career: [...state.career, { week: state.clock.week, kind: 'note', text }],
    ...(debt <= 0 ? { flags: { ...state.flags, debt_free: true } } : {}),
  };
}
