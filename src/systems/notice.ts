import type { GameState } from '@/types';
import { sinceArrival } from './trajectory';
import { careOf } from './week';
import { currentParish, frictionOf } from './liturgy';

/** A well-run parish draws families from outside it. Requested in playtesting; numbers invented. */
export const NOTICE = {
  everyWeeks: 13,
  /** Trajectory score, care, and friction that count as well run. */
  scoreAtLeast: 2,
  careAtLeast: 0.45,
  frictionAtMost: 0.3,
  /** Households that register from elsewhere, as a share, each quarter it is noticed. */
  growth: [0.01, 0.03] as const,
  publicRep: 2,
  chanceryRep: 1,
} as const;

export interface Notice {
  wellRun: boolean;
  reasons: string[];
}

/** Whether the parish reads as well run right now, and why. */
export function readNotice(state: GameState): Notice {
  const parish = currentParish(state);
  const traj = sinceArrival(state);
  if (!parish || !traj || !state.parish) return { wellRun: false, reasons: [] };
  const reasons: string[] = [];
  if (traj.score >= NOTICE.scoreAtLeast) reasons.push('the parish is coming along');
  if (careOf(state) >= NOTICE.careAtLeast) reasons.push('the priest is seen');
  if (frictionOf(parish) <= NOTICE.frictionAtMost) reasons.push('the Mass is the one the people wanted');
  if (state.parish.attendance >= 0.55) reasons.push('the pews are full');
  return { wellRun: reasons.length >= 3, reasons };
}

/** Once a quarter: if the parish is well run, families register from elsewhere and the town and the chancery hear of it. */
export function noticeQuarter(state: GameState, rng: { float(a: number, b: number): number; pick<T>(xs: T[]): T }): { state: GameState; line: string | null } {
  if (!state.parish || state.parish.weeksServed === 0 || state.parish.weeksServed % NOTICE.everyWeeks !== 0) return { state, line: null };
  const n = readNotice(state);
  if (!n.wellRun) return { state, line: null };
  const parish = currentParish(state)!;
  const share = rng.float(NOTICE.growth[0], NOTICE.growth[1]);
  const added = Math.max(5, Math.round(parish.households * share));
  const others = state.world!.parishes.filter((p) => p.id !== parish.id && p.kind !== 'rural');
  const from = others.length ? rng.pick(others) : null;
  const parishes = state.world!.parishes.map((p) => (p.id === parish.id ? { ...p, households: p.households + added, weeklyCollections: Math.round(p.weeklyCollections * (1 + share)), noticed: (p.noticed ?? 0) + 1 } : p));
  const c = state.character!;
  const rep = { ...c.reputation, public: Math.min(100, c.reputation.public + NOTICE.publicRep), chancery: Math.min(100, c.reputation.chancery + NOTICE.chanceryRep) };
  const line = from ? `${added} households registered this quarter, a good few of them from ${from.name}, whose pastor has noticed.` : `${added} households registered this quarter from outside the parish.`;
  return { state: { ...state, world: { ...state.world!, parishes }, character: { ...c, reputation: rep }, flags: { ...state.flags, parish_noticed: (Number(state.flags.parish_noticed) || 0) + 1 } }, line };
}
