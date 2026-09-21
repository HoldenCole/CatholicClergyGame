import type { GameState, Npc } from '@/types';
import { religiousOrder } from '@/content/religious';
import { applyEffects } from '@/engine/effects';
import { currentHouse } from './house';

/**
 * Friendship as a spiritual good. E3 §7.2: for an order whose mechanics
 * give close-friend slots (the Augustinians), the player keeps a few deep
 * bonds with brothers that work almost like a second spiritual director.
 * Friends in other houses cost AP to keep; a transfer that splits them
 * hurts more than anything else in the game. Tunables are invented.
 */
export const FRIENDSHIP = {
  /** Regard a brother must have for him before a friendship can be named. */
  minRegard: 40,
  /** AP a week to keep a friend who lives elsewhere. */
  distantAp: 0.5,
  /** Weekly regard drift: near friends deepen; far friends fade unless the hours are paid. */
  near: 0.25,
  far: -0.35,
  /** A friendship ends when regard falls under this. */
  lapse: 20,
  /** Piety drain multiplier per close friend in the same house. */
  pietyPerNear: -0.06,
  /** What a transfer that leaves friends behind costs. */
  split: [{ target: 'stat', key: 'piety', delta: -3 }, { target: 'strain', key: '', delta: 6 }],
  /** A crisis survived with a friend near is survived better. */
  crisisBonus: 0.5,
} as const;

/** How many close friends this man may have: the order's number, or none. */
export function friendSlots(state: Pick<GameState, 'religious'>): number {
  const r = state.religious;
  return r ? religiousOrder(r.order).mechanics.closeFriendSlots ?? 0 : 0;
}

export function friendsOf(state: GameState): Npc[] {
  return (state.religious?.closeFriendIds ?? []).map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active');
}

function houseOf(n: Npc): string | undefined {
  return n.tags.find((t) => t.startsWith('house:'))?.slice(6);
}

/** Friends in the house now, and friends elsewhere. */
export function friendsNearAndFar(state: GameState): { near: Npc[]; far: Npc[] } {
  const here = state.religious?.houseId;
  const all = friendsOf(state);
  return { near: all.filter((n) => houseOf(n) === here), far: all.filter((n) => houseOf(n) !== here) };
}

export function mayBefriend(state: GameState, npcId: string): { ok: boolean; why: string } {
  const slots = friendSlots(state);
  if (!slots) return { ok: false, why: 'The order keeps no such bonds' };
  const n = state.npcs[npcId];
  if (!n || n.status !== 'active' || !n.tags.includes('friar')) return { ok: false, why: 'Not a brother of the province' };
  if (state.religious?.closeFriendIds?.includes(npcId)) return { ok: false, why: 'Already a friend' };
  if ((state.religious?.closeFriendIds?.length ?? 0) >= slots) return { ok: false, why: 'No room for another' };
  if (n.relationship < FRIENDSHIP.minRegard) return { ok: false, why: 'He does not know you well enough yet' };
  return { ok: true, why: '' };
}

/** Name a brother a close friend. */
export function befriend(state: GameState, npcId: string): GameState {
  const r = state.religious;
  if (!r || !mayBefriend(state, npcId).ok) return state;
  const n = state.npcs[npcId]!;
  return {
    ...state,
    religious: { ...r, closeFriendIds: [...(r.closeFriendIds ?? []), npcId] },
    flags: { ...state.flags, 'friend:named': state.clock.week },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `${n.title} ${n.name.first} ${n.name.last} became a close friend.` }],
  };
}

/** AP the week owes to friends who live elsewhere. */
export function friendshipLoad(state: GameState): number {
  if (!friendSlots(state)) return 0;
  return friendsNearAndFar(state).far.length * FRIENDSHIP.distantAp;
}

/** Piety drain multiplier from friends at the table: a second director. */
export function friendPietyFactor(state: GameState): number {
  if (!friendSlots(state) || !currentHouse(state)) return 1;
  return Math.max(0.7, 1 + friendsNearAndFar(state).near.length * FRIENDSHIP.pietyPerNear);
}

/** One week: near friends deepen, far ones fade, and a bond that has faded is gone. */
export function friendshipWeek(state: GameState): GameState {
  const r = state.religious;
  if (!r?.closeFriendIds?.length) return state;
  const { near, far } = friendsNearAndFar(state);
  const npcs = { ...state.npcs };
  for (const n of near) npcs[n.id] = { ...n, relationship: Math.min(100, n.relationship + FRIENDSHIP.near) };
  for (const n of far) npcs[n.id] = { ...n, relationship: Math.max(-100, n.relationship + FRIENDSHIP.far) };
  const kept = r.closeFriendIds.filter((id) => (npcs[id]?.relationship ?? 0) >= FRIENDSHIP.lapse && npcs[id]?.status === 'active');
  let next: GameState = { ...state, npcs, religious: { ...r, closeFriendIds: kept } };
  for (const id of r.closeFriendIds) if (!kept.includes(id)) {
    const n = state.npcs[id];
    next = { ...next, flags: { ...next.flags, 'friend:lapsed': state.clock.week }, career: [...next.career, { week: state.clock.week, kind: 'note', text: `The friendship with ${n ? `${n.title} ${n.name.first} ${n.name.last}` : 'a brother'} lapsed, by distance and silence.` }] };
  }
  return next;
}

/** A transfer that leaves close friends behind: the thing that should hurt most. */
export function splitFriends(state: GameState, fromHouseId: string): GameState {
  const r = state.religious;
  if (!r?.closeFriendIds?.length || !friendSlots(state)) return state;
  const left = friendsOf(state).filter((n) => houseOf(n) === fromHouseId).length;
  if (!left) return state;
  let next = state;
  for (let i = 0; i < left; i++) next = applyEffects(next, [...FRIENDSHIP.split], {}, 'a friend left behind');
  return { ...next, flags: { ...next.flags, 'friend:split': next.clock.week } };
}
