import type { GameState, ReligiousAssignment, World } from '@/types';
import { HOUSE, houseById, houseLine } from './house';
import { defaultHorarium } from './horarium';
import { splitFriends } from './friendship';

/**
 * Reassignment across dioceses. E3 §3.1: each assignment places the friar
 * in a new diocese with a new bishop and new laity and mostly fresh local
 * standing; standing with the province, the order, and Rome persists. The
 * province's other dioceses are kept as he left them, so a return finds the
 * pastor he quarrelled with still there.
 */
export const TRANSFER = {
  /** What carries of the local standings on a move. */
  carry: { community: HOUSE.communityCarry, local_bishop: 0, laity: 0 },
} as const;

/** The diocese a house sits in, as the state holds it now: the current world or a stashed one. */
export function worldOf(state: GameState, dioceseId: string): World | undefined {
  if (state.world?.diocese.presetId === dioceseId) return state.world;
  return state.territory?.[dioceseId];
}

/**
 * Move to a house. The current diocese goes back to the territory as it is;
 * the house's diocese comes out of it; the local standings reset by the
 * carry table; the posting is recorded. Same diocese: nothing swaps.
 */
export function moveToHouse(state: GameState, houseId: string, work: string, opts: { dual?: boolean; grace?: ReligiousAssignment['grace'] } = {}): GameState {
  const r = state.religious;
  const house = houseById(state, houseId);
  if (!r || !house) throw new Error(`no house ${houseId}`);
  const week = state.clock.week;
  let next = state;
  if (next.world && next.world.diocese.presetId !== house.dioceseId) {
    const incoming = next.territory?.[house.dioceseId];
    if (!incoming) throw new Error(`no diocese ${house.dioceseId} in the territory`);
    const territory = { ...(next.territory ?? {}) };
    territory[next.world.diocese.presetId] = next.world;
    delete territory[house.dioceseId];
    const flags = { ...next.flags };
    for (const k of Object.keys(flags)) if (k.startsWith('diocese:')) delete flags[k];
    flags[`diocese:${house.dioceseId}`] = true;
    next = { ...next, world: incoming, territory, flags };
    // The standings that belong to a place.
    const c = next.character;
    if (c) {
      const rep = { ...c.reputation };
      for (const [key, carry] of Object.entries(TRANSFER.carry) as ['community' | 'local_bishop' | 'laity', number][]) rep[key] = Math.round((rep[key] ?? 0) * carry) || 0;
      next = { ...next, character: { ...c, reputation: rep } };
    }
  } else if (r.houseId !== houseId) {
    // A new house in the same diocese: the house standing resets, the bishop and the people stay.
    const c = next.character;
    if (c) next = { ...next, character: { ...c, reputation: { ...c.reputation, community: Math.round((c.reputation.community ?? 0) * TRANSFER.carry.community) || 0 } } };
  }
  // Friends left behind: for an order that keeps such bonds, the move that hurts most. E3 §7.2.
  if (r.houseId !== houseId) next = splitFriends(next, r.houseId);
  const assignments = r.assignments.map((a, i) => (i === r.assignments.length - 1 && a.endWeek === undefined ? { ...a, endWeek: week } : a));
  const posting: ReligiousAssignment = { houseId, dioceseId: house.dioceseId, work, startWeek: week, ...(opts.dual ? { dual: true } : {}), ...(opts.grace ? { grace: opts.grace } : {}) };
  // An office of the house stays with the house; a local work stays with the diocese. E3 §3.10.
  const { houseOffice: _office, apostolate, ...kept } = r;
  const keepsWork = apostolate && apostolate.dioceseId === house.dioceseId;
  next = {
    ...next,
    religious: { ...kept, ...(keepsWork ? { apostolate } : {}), houseId, horarium: r.houseId === houseId ? r.horarium : defaultHorarium(), assignments: [...assignments, posting] },
    career: [...next.career, { week, kind: 'assignment', text: `Sent to ${house.name}${work === 'parish' ? ', for the parish' : work === 'school' ? ', for the school' : work === 'formation' ? ', for the formation house' : work === 'teaching' ? ', to teach' : ''}. ${houseLine(next, house)}` }],
  };
  return next;
}

/** The posting he holds now. */
export function currentPosting(state: GameState): ReligiousAssignment | undefined {
  return state.religious?.assignments.find((a) => a.endWeek === undefined);
}
