import type { GameState } from '@/types';
import { officeDef, officeDefs } from '@/content/parish';
import { offerById } from '@/content/offers';

/**
 * Diocesan offices held alongside a parish: the vocations office, the
 * tribunal, worship, the cathedral's calendar, the deanery. Two routes put a
 * man in one, a chancery letter (an offer whose acceptance sets an
 * `office:` flag) or the bishop's choice at a board (a commitment with
 * offerId `office:<id>`). Either way the office is one man's for its
 * term: it drops when he is moved, and he does not hold the same one twice.
 * Requested in playtesting.
 */

/** The `office:` flag a commitment carries, if it is an office at all. */
export function officeFlagOf(offerId: string): string | null {
  if (offerId.startsWith('office:')) return officeDef(offerId.slice(7))?.flag ?? null;
  const def = offerById(offerId);
  return def?.accept.effects.find((e) => e.target === 'flag' && e.key.startsWith('office:') && e.value === true)?.key ?? null;
}

/** The flag that remembers an office once held, so it is not offered again. */
export function heldFlag(flag: string): string {
  return `held:${flag}`;
}

/** Whether the man holds this office now, or has held it. */
export function holdsOrHeld(state: GameState, officeId: string): boolean {
  const def = officeDef(officeId);
  if (!def) return false;
  if (state.flags[def.flag] || state.flags[heldFlag(def.flag)]) return true;
  return state.commitments.some((c) => officeFlagOf(c.offerId) === def.flag);
}

/** An office's term ends, kept or not: the flag comes off and the record keeps it. */
export function releaseOfficeFlag(state: GameState, flag: string): GameState {
  const flags: GameState['flags'] = { ...state.flags };
  delete flags[flag];
  flags[heldFlag(flag)] = true;
  return { ...state, flags };
}

/** A man who is moved leaves his offices behind: the chancery gives them to someone who stays put. */
export function dropOffices(state: GameState): GameState {
  let next = state;
  for (const c of state.commitments) {
    const flag = officeFlagOf(c.offerId);
    if (!flag) continue;
    const label = officeDefs.find((o) => o.flag === flag)?.label ?? c.label;
    next = releaseOfficeFlag({ ...next, commitments: next.commitments.filter((x) => x !== c) }, flag);
    next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `${label} went to another man when you were moved.` }] };
  }
  return next;
}
