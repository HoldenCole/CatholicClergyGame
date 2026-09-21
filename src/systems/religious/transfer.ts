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
  carry: { community: HOUSE.communityCarry, local_bishop: 0, laity: 0, diocesan_clergy: 0 },
  /** The bishop's file. E3 §3.1: what a diocese he returns to remembers, by whether the same bishop still sits, less each year away. */
  file: { sameBishop: 0.85, newBishop: 0.3, laity: 0.6, perYear: 0.05, floorSame: 0.35, floorNew: 0.1, floorLaity: 0.2 },
} as const;

/** What a diocese remembers of him on his return, from the file. */
export function fileCarry(state: GameState, dioceseId: string, incoming: World): { local_bishop: number; laity: number; diocesan_clergy: number; sameBishop: boolean; years: number } | null {
  const file = state.religious?.dioceseFile?.[dioceseId];
  if (!file) return null;
  const years = Math.max(0, (state.clock.week - file.leftWeek) / 52);
  const sameBishop = incoming.diocese.hidden.bishop.npcId === file.bishopId;
  const f = TRANSFER.file;
  const bishopShare = sameBishop ? Math.max(f.floorSame, f.sameBishop - f.perYear * years) : Math.max(f.floorNew, f.newBishop - f.perYear * years * 0.5);
  const laityShare = Math.max(f.floorLaity, f.laity - f.perYear * years);
  return { local_bishop: Math.round(file.local_bishop * bishopShare) || 0, laity: Math.round(file.laity * laityShare) || 0, diocesan_clergy: Math.round((file.diocesan_clergy ?? 0) * laityShare) || 0, sameBishop, years };
}

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
    // The file: what this diocese will remember of him, and what the next one does.
    const leaving = next.world.diocese.presetId;
    const c0 = next.character;
    const dioceseFile = { ...(r.dioceseFile ?? {}) };
    if (c0) dioceseFile[leaving] = { local_bishop: c0.reputation.local_bishop ?? 0, laity: c0.reputation.laity ?? 0, diocesan_clergy: c0.reputation.diocesan_clergy ?? 0, bishopId: next.world.diocese.hidden.bishop.npcId, leftWeek: week };
    const remembered = fileCarry({ ...next, religious: { ...r, dioceseFile } }, house.dioceseId, incoming);
    next = { ...next, world: incoming, territory, flags, religious: { ...next.religious!, dioceseFile } };
    // The standings that belong to a place: reset, unless the place remembers him.
    const c = next.character;
    if (c) {
      const rep = { ...c.reputation };
      for (const [key, carry] of Object.entries(TRANSFER.carry) as ['community' | 'local_bishop' | 'laity' | 'diocesan_clergy', number][]) rep[key] = Math.round((rep[key] ?? 0) * carry) || 0;
      if (remembered) {
        rep.local_bishop = remembered.local_bishop;
        rep.laity = remembered.laity;
        rep.diocesan_clergy = remembered.diocesan_clergy;
      }
      next = { ...next, character: { ...c, reputation: rep } };
    }
    if (remembered) {
      const word = remembered.local_bishop >= 15 ? 'warmly' : remembered.local_bishop <= -15 ? 'and not kindly' : 'a little';
      next = { ...next, career: [...next.career, { week, kind: 'note', text: `Back in ${incoming.diocese.visible.name} after ${Math.max(1, Math.round(remembered.years))} year${Math.round(remembered.years) === 1 ? '' : 's'}: ${remembered.sameBishop ? 'the same bishop, who remembers you' : 'a new bishop, who has read your file'} ${word}.` }] };
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
  const { houseOffice: _office, apostolate, ...kept } = next.religious!;
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
