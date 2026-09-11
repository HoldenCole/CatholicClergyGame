import type { GameState, ParishSnapshot } from '@/types';
import { averageVitality } from './groups';

/** Quarterly readings. Invented. */
export const TRAJECTORY = { everyWeeks: 13, keep: 40 } as const;

export function takeSnapshot(state: GameState): ParishSnapshot | null {
  const parish = state.parish;
  const rec = state.world?.parishes.find((p) => p.id === parish?.parishId);
  if (!parish || !rec) return null;
  const b = rec.buildings;
  const parts = [b.church, b.rectory, b.hall, ...(b.school === null ? [] : [b.school])];
  return {
    week: state.clock.week,
    attendance: parish.attendance,
    collections: parish.finance.averageCollection,
    debt: parish.finance.debt,
    groups: averageVitality(state),
    buildings: parts.reduce((a, c) => a + c, 0) / parts.length,
    households: rec.households,
  };
}

export interface TrendRow {
  label: string;
  then: string;
  now: string;
  /** -1 worse, 0 same, +1 better. */
  sign: -1 | 0 | 1;
}

export interface Trajectory {
  weeks: number;
  rows: TrendRow[];
  /** One word for the whole. */
  verdict: string;
  score: number;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
function money(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}
function sign(delta: number, dead: number): -1 | 0 | 1 {
  return delta > dead ? 1 : delta < -dead ? -1 : 0;
}

/** The parish since he arrived, in rows the sheet can print, and a verdict. */
export function sinceArrival(state: GameState): Trajectory | null {
  const then = state.parish?.arrival;
  const now = takeSnapshot(state);
  if (!then || !now) return null;
  const rows: TrendRow[] = [
    { label: 'Attendance', then: pct(then.attendance), now: pct(now.attendance), sign: sign(now.attendance - then.attendance, 0.01) },
    { label: 'Collections', then: `${money(then.collections)} a week`, now: `${money(now.collections)} a week`, sign: sign((now.collections - then.collections) / Math.max(1, then.collections), 0.03) },
    { label: 'Debt', then: money(then.debt), now: money(now.debt), sign: sign(then.debt - now.debt, Math.max(1000, then.debt * 0.02)) },
    { label: 'The groups', then: vitalityWord(then.groups), now: vitalityWord(now.groups), sign: sign(now.groups - then.groups, 4) },
    { label: 'The buildings', then: buildingWord(then.buildings), now: buildingWord(now.buildings), sign: sign(now.buildings - then.buildings, 3) },
  ];
  if (now.households !== then.households) rows.push({ label: 'Households', then: then.households.toLocaleString(), now: now.households.toLocaleString(), sign: sign(now.households - then.households, 0) });
  const score = rows.reduce((n, r) => n + r.sign, 0);
  const weeks = state.clock.week - then.week;
  const verdict =
    weeks < 8 ? 'Too soon to say' :
    score >= 3 ? 'Turning around' : score >= 1 ? 'Coming along' : score === 0 ? 'Holding' : score >= -2 ? 'Slipping' : 'Going under';
  return { weeks, rows, verdict, score };
}

export function vitalityWord(v: number): string {
  return v >= 70 ? 'thriving' : v >= 40 ? 'steady' : v >= 15 ? 'declining' : 'dying';
}
export function buildingWord(v: number): string {
  return v >= 75 ? 'sound' : v >= 50 ? 'fair' : v >= 30 ? 'tired' : 'failing';
}
