import type { GameState, Npc, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { nearestParishes, milesBetween, milesAcross } from './map';
import { noteMover } from './movers';
import { deaneryRivalStands } from './openings';

/** Requested in playtesting; numbers invented. */
export const DEANERY = {
  /** Parishes in a deanery besides one's own. */
  size: 5,
  /** Regard a neighbor needs before he will trade cover. */
  coverRegard: 10,
  /** What a standing trade of cover does a week: regard for the partner, and a block of the week back. */
  coverRegardPerWeek: 0.15,
  coverRelief: 1,
  /** A pastor this many years ordained may be named dean when the deanery forms. */
  deanYears: 12,
  deanChance: 0.4,
  /** The chance an opening is one a neighbor is said to want. */
  rivalChance: 0.35,
} as const;

function pastorOf(state: GameState, parishId: string): Npc | undefined {
  return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${parishId}`));
}

/** The deanery around a parish: its neighbors, their pastors, and a dean. Formed when an assignment starts. */
export function formDeanery(state: GameState, rng: Rng): GameState {
  const world = state.world;
  const parish = world?.parishes.find((p) => p.id === state.assignment?.parishId);
  if (!world || !parish || !state.parish) return state;
  const members = nearestParishes(world.parishes, parish, milesAcross(world), DEANERY.size);
  const priests = members.map((p) => pastorOf(state, p.id)).filter((n): n is Npc => !!n);
  const own = pastorOf(state, parish.id);
  const ordainedAt = state.flags.ordination_week;
  const years = typeof ordainedAt === 'number' ? (state.clock.week - ordainedAt) / 52 : 0;
  const playerDean = state.assignment?.role === 'pastor' && years >= DEANERY.deanYears && rng.chance(DEANERY.deanChance);
  const candidates = [...priests, ...(own && state.assignment?.role !== 'pastor' ? [own] : [])].sort((a, b) => a.birthYear - b.birthYear || (a.id < b.id ? -1 : 1));
  const dean = playerDean ? null : (candidates[0] ?? null);
  const deanery = { id: `deanery:${parish.id}`, deanId: dean?.id ?? '', priestIds: priests.map((n) => n.id), parishIds: members.map((p) => p.id) };
  const flags = { ...state.flags, 'deanery:member': true, 'deanery:dean': playerDean };
  const career = playerDean ? [...state.career, { week: state.clock.week, kind: 'note' as const, text: 'The bishop named you dean.' }] : state.career;
  return { ...state, flags, career, parish: { ...state.parish, deanery } };
}

type Deanery = NonNullable<GameState['parish']>['deanery'] & object;

function withCover(d: Deanery, npcId: string | null): Deanery {
  const { coverId: _drop, ...rest } = d;
  void _drop;
  return npcId ? { ...rest, coverId: npcId } : rest;
}

export interface DeaneryPriest {
  npc: Npc;
  parish: Parish;
  miles: number;
  dean: boolean;
}

/** The priests of the deanery, nearest first. */
export function deaneryPriests(state: GameState): DeaneryPriest[] {
  const d = state.parish?.deanery;
  const world = state.world;
  const here = world?.parishes.find((p) => p.id === state.assignment?.parishId);
  if (!d || !world || !here) return [];
  return d.priestIds
    .map((id) => state.npcs[id])
    .filter((n): n is Npc => !!n && n.status === 'active')
    .map((npc) => {
      const parish = world.parishes.find((p) => npc.tags.includes(`pastor:${p.id}`))!;
      return { npc, parish, miles: milesBetween(here, parish, milesAcross(world)), dean: npc.id === d.deanId };
    })
    .filter((x) => !!x.parish)
    .sort((a, b) => a.miles - b.miles);
}

export function coverAvailability(state: GameState, npcId: string): { ok: boolean; why: string | null } {
  const npc = state.npcs[npcId];
  if (!npc || !state.parish?.deanery?.priestIds.includes(npcId)) return { ok: false, why: 'Not in the deanery' };
  if (npc.relationship < DEANERY.coverRegard) return { ok: false, why: `${npc.title} ${npc.name.last} does not know you well enough to trust you with his Masses` };
  return { ok: true, why: null };
}

/** Trade cover with a neighbor, or stop. */
export function setCover(state: GameState, npcId: string | null): GameState {
  if (!state.parish?.deanery) return state;
  if (npcId) {
    const may = coverAvailability(state, npcId);
    if (!may.ok) throw new Error(may.why ?? 'not now');
  }
  const npc = npcId ? state.npcs[npcId] : undefined;
  return {
    ...state,
    parish: { ...state.parish, deanery: withCover(state.parish.deanery, npcId) },
    flags: { ...state.flags, 'deanery:cover': !!npcId },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: npc ? `Trading cover with ${npc.title} ${npc.name.last}: his Masses when he is away, yours when you are.` : 'Stopped trading cover.' }],
  };
}

/** The week: a standing trade warms the partner, slowly. */
export function deaneryWeek(state: GameState): GameState {
  const rival = deaneryRivalStands(state);
  if (!!state.flags['deanery:rival'] !== rival) state = { ...state, flags: { ...state.flags, 'deanery:rival': rival } };
  const id = state.parish?.deanery?.coverId;
  const npc = id ? state.npcs[id] : undefined;
  if (!npc || npc.status !== 'active') {
    return id ? { ...state, parish: { ...state.parish!, deanery: withCover(state.parish!.deanery!, null) }, flags: { ...state.flags, 'deanery:cover': false } } : state;
  }
  const c = state.character!;
  const rep = { ...c.reputation, brother_priests: Math.min(100, c.reputation.brother_priests + 0.05) };
  return noteMover(
    { ...state, character: { ...c, reputation: rep }, npcs: { ...state.npcs, [npc.id]: { ...npc, relationship: Math.min(100, npc.relationship + DEANERY.coverRegardPerWeek) } } },
    'brother_priests',
    0.05,
    `trading cover with ${npc.title} ${npc.name.last}`,
  );
}

/** Blocks of the week a neighbor's cover gives back. */
export function coverRelief(state: GameState): number {
  return state.parish?.deanery?.coverId ? DEANERY.coverRelief : 0;
}
