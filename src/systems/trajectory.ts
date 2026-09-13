import type { GameState, ParishSnapshot } from '@/types';
import { averageVitality, parishGroups, vitalityBand } from './groups';
import { explainAttendance, explainCollections } from './movers';
import { planWeek } from './week';

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

/** The kinds of parish nobody asks for: turning one is remembered. */
export const HARD_KINDS = new Set(['difficult', 'struggling_urban', 'rural']);

/** Whether the parish was dying when he came: a hard kind, or the numbers themselves at arrival. */
export function wasDying(state: GameState): boolean {
  const rec = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  const then = state.parish?.arrival;
  if (!rec || !then) return false;
  return HARD_KINDS.has(rec.kind) || then.attendance <= 0.25 || then.groups < 20 || then.debt >= 750_000;
}

/** Turnaround credit, 0..1: a dying parish, a year in, turning around. */
export function turnaroundOf(state: GameState): number {
  const traj = sinceArrival(state);
  if (!traj || !wasDying(state) || traj.weeks < 52) return 0;
  return traj.score >= 3 ? 1 : traj.score >= 1 ? 0.5 : 0;
}

/** Weeks after the turnaround lands before the bishop's own letter comes. */
export const TURNAROUND_LETTER_WEEKS = 6;

export interface Driver {
  label: string;
  lines: string[];
}

function signed(n: number, unit = ''): string {
  return `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}${unit}`;
}

/** What is moving each row, in words a pastor can act on. */
export function driversOf(state: GameState): Driver[] {
  const parish = state.parish;
  const rec = state.world?.parishes.find((p) => p.id === parish?.parishId);
  if (!parish || !rec || !state.character) return [];
  const pews = explainAttendance(state);
  const up = pews.reasons.filter((r) => r.amount > 0 && !r.label.startsWith('the rolls')).sort((a, b) => b.amount - a.amount).slice(0, 3);
  const down = pews.reasons.filter((r) => r.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 2);
  const plate = explainCollections(state);
  const lifts = plate.factors.filter((f) => f.amount > 1).map((f) => `${f.label} ×${f.amount}`);
  const drags = plate.factors.filter((f) => f.amount < 1).map((f) => `${f.label} ×${f.amount}`);
  const plan = planWeek(state);
  const groupHours = plan.discretionary.groups ?? 0;
  const groups = parishGroups(state);
  const thriving = groups.filter((g) => vitalityBand(g.vitality) === 'thriving').length;
  const dying = groups.filter((g) => vitalityBand(g.vitality) === 'dying').length;
  const then = parish.arrival;
  const paid = then ? Math.max(0, then.debt - parish.finance.debt) : 0;
  const projects = state.career.filter((e) => e.kind === 'project' && !/the Mass/.test(e.text) && (!then || e.week >= then.week)).length;
  return [
    { label: 'Attendance', lines: [`Heading to ${Math.round(pews.target * 100)}%.`, ...(up.length ? [`Lifting it: ${up.map((r) => `${r.label} ${signed(r.amount, ' pts')}`).join(', ')}.`] : []), ...(down.length ? [`Dragging it: ${down.map((r) => `${r.label} ${signed(r.amount, ' pts')}`).join(', ')}.`] : [])] },
    { label: 'Collections', lines: [`The usual is $${plate.usual.toLocaleString()} a week${lifts.length ? `, lifted by ${lifts.join(', ')}` : ''}${drags.length ? `, dragged by ${drags.join(', ')}` : ''}.`] },
    { label: 'Debt', lines: [paid > 0 ? `$${Math.round(paid).toLocaleString()} paid down since you came, from the spending sheet.` : 'Nothing paid down yet; the spending sheet is where that happens.'] },
    { label: 'The groups', lines: [`${groupHours ? `${groupHours} block${groupHours === 1 ? '' : 's'} a week on them` : 'No hours on them this week'}; ${thriving} thriving, ${dying} dying. Hours, and a leader who is listened to, are what move them.`] },
    { label: 'The buildings', lines: [projects ? `${projects} project${projects === 1 ? '' : 's'} since you came; each one is a building that stops falling.` : 'No projects yet; a project on the parish sheet is the only thing that mends a roof.'] },
  ];
}

/** A hard parish turned around, a year in: the chancery hears, once, and it goes in the file. */
export function turnaroundStep(state: GameState): { state: GameState; line: string | null } {
  const pid = state.parish?.parishId;
  if (!pid || turnaroundOf(state) < 1 || state.flags[`turnaround:${pid}`]) return { state, line: null };
  const rec = state.world?.parishes.find((p) => p.id === pid);
  const c = state.character!;
  const rep = { ...c.reputation, chancery: Math.min(100, c.reputation.chancery + 6), brother_priests: Math.min(100, c.reputation.brother_priests + 3) };
  const next: GameState = {
    ...state,
    character: { ...c, reputation: rep, traits: c.traits.includes('turned a parish around') ? c.traits : [...c.traits, 'turned a parish around'] },
    flags: { ...state.flags, [`turnaround:${pid}`]: true, turned_a_parish: true, 'turnaround:letter_week': state.clock.week + TURNAROUND_LETTER_WEEKS },
    movers: [...(state.movers ?? []), { week: state.clock.week, key: 'chancery', delta: 6, why: 'the parish nobody wanted, turning around' }, { week: state.clock.week, key: 'brother_priests', delta: 3, why: 'the parish nobody wanted, turning around' }],
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `The chancery noticed: ${rec?.name ?? 'the parish'} is turning around under you.` }],
  };
  return { state: next, line: `The vicar for clergy mentioned ${rec?.name ?? 'the parish'} at a meeting, by name, as a parish that is turning around. It went in the file that matters.` };
}

export function vitalityWord(v: number): string {
  return v >= 70 ? 'thriving' : v >= 40 ? 'steady' : v >= 15 ? 'declining' : 'dying';
}
export function buildingWord(v: number): string {
  return v >= 75 ? 'sound' : v >= 50 ? 'fair' : v >= 30 ? 'tired' : 'failing';
}
