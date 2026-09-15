import type { GameState } from '@/types';
import { officeDef, officeDefs } from '@/content/parish';
import { offerById } from '@/content/offers';

/**
 * Diocesan offices held alongside a parish: the vocations office, the
 * tribunal, worship, the cathedral's calendar, the deanery. Two routes put a
 * man in one, a chancery letter (an offer whose acceptance sets an
 * `office:` flag) or the bishop's choice at a board (a commitment with
 * offerId `office:<id>`). Either way the office is one man's for its
 * term and he does not hold the same one twice. Moved within the diocese he
 * is asked whether to keep it; sent away, to Rome or a posting, it goes to
 * someone who stays. Requested in playtesting.
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

/** Whether a letter to this parish is a move: the parish he holds, or the one whose tenure just closed, is another. */
export function isMoveTo(state: GameState, parishId: string): boolean {
  if (state.parish) return state.parish.parishId !== parishId;
  const last = [...(state.tenures ?? [])].reverse().find((t) => t.kind === 'parish' && t.endWeek === state.clock.week);
  return !!last && last.parishId !== parishId;
}

/** The offices the man holds now, by label. */
export function officesHeld(state: GameState): string[] {
  return state.commitments.map((c) => officeFlagOf(c.offerId)).filter((f): f is string => !!f).map((f) => officeDefs.find((o) => o.flag === f)?.label ?? f.slice(7).replace(/_/g, ' '));
}

function endOffices(state: GameState, line: (label: string) => string): GameState {
  let next = state;
  for (const c of state.commitments) {
    const flag = officeFlagOf(c.offerId);
    if (!flag) continue;
    const label = officeDefs.find((o) => o.flag === flag)?.label ?? c.label;
    next = releaseOfficeFlag({ ...next, commitments: next.commitments.filter((x) => x !== c) }, flag);
    next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: line(label) }] };
  }
  return next;
}

/** Sent away, to Rome or a posting: the offices go to men who stay in the diocese. */
export function dropOffices(state: GameState): GameState {
  return endOffices(state, (label) => `${label} went to another man when you left.`);
}

/** Moved within the diocese, and asked: he hands the office on rather than carry it to the new parish. */
export function handOnOffices(state: GameState): GameState {
  return endOffices(state, (label) => `${label}: handed on when you were moved, at your own asking.`);
}

/** Moved within the diocese, and asked: he keeps the office alongside the new parish. */
export function keepOffices(state: GameState): GameState {
  const held = officesHeld(state);
  if (held.length === 0) return state;
  return { ...state, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Kept ${held.map((h) => h.toLowerCase()).join(' and ')} alongside the new parish.` }] };
}
