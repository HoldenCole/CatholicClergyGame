import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { seedRumour } from './talk';

/**
 * Former parishes that remember (D6). Every parish he leaves keeps a
 * standing that drifts back toward what the bonds hold, its people write
 * through the mailbag to ask him back, and what became of the parish after
 * him becomes talk in the deanery. Numbers invented.
 */
export const FORMER = {
  /** The standing drifts toward the bonds' worth by this much a year. */
  driftPerYear: 3,
  bondWorth: 4,
  bondCap: 40,
  /** Collections this far below, or above, the week he left, and the men say so. */
  declineAt: 0.8,
  thrivesAt: 1.25,
  /** Years before the parish's fortunes are read as its own and not his. */
  readYears: 6,
} as const;

/** Written the week he leaves: the standing, and the numbers as they stood. */
export function rememberParish(state: GameState): GameState {
  const pid = state.assignment?.parishId;
  const p = pid ? state.world?.parishes.find((x) => x.id === pid) : undefined;
  const c = state.character;
  if (!p || !c) return state;
  const entry = { name: p.name, leftWeek: state.clock.week, standing: Math.round(c.reputation.parishioners), collections: p.weeklyCollections, households: p.households };
  return { ...state, formerParishes: { ...(state.formerParishes ?? {}), [p.id]: entry } };
}

/** The bonds he holds with the people of that parish. */
function bondsAt(state: GameState, pid: string): number {
  return Object.values(state.npcs).filter((n) => n.tags.includes(`parish:${pid}`)).reduce((s, n) => s + (n.bonds ?? []).filter((b) => b.kind !== 'quarreled').length, 0);
}

/** Once a year: the standing settles toward the bonds, and the parish's fortunes since become talk. */
export function formerParishesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const former = state.formerParishes;
  if (!former || !state.world || !state.character) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  const out: NonNullable<GameState['formerParishes']> = {};
  for (const [pid, f] of Object.entries(former)) {
    if (pid === state.assignment?.parishId) { out[pid] = f; continue; }
    const rest = Math.min(FORMER.bondCap, bondsAt(state, pid) * FORMER.bondWorth);
    const gap = rest - f.standing;
    const standing = f.standing + Math.sign(gap) * Math.min(Math.abs(gap), FORMER.driftPerYear);
    let entry = { ...f, standing };
    const p = state.world.parishes.find((x) => x.id === pid);
    const years = (state.clock.week - f.leftWeek) / 52;
    if (p && !f.said && years >= 1 && years <= FORMER.readYears && f.collections > 0) {
      const ratio = p.weeklyCollections / f.collections;
      if (ratio <= FORMER.declineAt) {
        entry = { ...entry, said: 'decline' };
        next = seedRumour(next, rng.derive(`former:${pid}`), 'former_decline', { parish: p.name });
        lines.push(`${p.name}, which you left, is going under, and the men who know both of you have opinions about whose fault that is.`);
      } else if (ratio >= FORMER.thrivesAt) {
        entry = { ...entry, said: 'thrives' };
        next = seedRumour(next, rng.derive(`former:${pid}`), 'former_thrives', { parish: p.name });
        lines.push(`${p.name}, which you left, is thriving under the man who came after you, which is said either way.`);
      }
    }
    out[pid] = entry;
  }
  return { state: { ...next, formerParishes: out }, lines };
}

/** The review's row: how the parishes before hold him. */
export function formerReviewLine(state: GameState): string | null {
  const former = Object.entries(state.formerParishes ?? {}).filter(([pid]) => pid !== state.assignment?.parishId);
  if (!former.length) return null;
  const word = (s: number) => (s >= 50 ? 'remembers you warmly' : s >= 20 ? 'remembers you' : s > -20 ? 'has mostly forgotten you' : 'remembers you, and not kindly');
  return former.slice(-4).map(([, f]) => `${f.name} ${word(f.standing)}`).join('; ') + '.';
}
