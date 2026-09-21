import type { GameState, Npc, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { milesAcross, milesBetween, nearestParishes } from '@/systems/map';
import { DEANERY } from '@/systems/deanery';
import { currentHouse } from './house';
import { currentPosting } from './transfer';

/**
 * The deanery for a friar pastor. E3 §3.12. A parish entrusted to the order
 * is a parish of the diocese: it sits in a deanery, its pastor goes to the
 * deanery meeting in a habit, and the diocese's priests form a view of him
 * (`diocesan_clergy`). The base game's deanery is the parish loop's; this
 * one hangs on the posting and is formed the week he arrives. Tunables
 * are invented.
 */
export const FRIAR_DEANERY = {
  /** Years ordained and regard before the bishop names a religious pastor dean, rarely. */
  deanYears: 12,
  deanRegard: 25,
  deanChance: 0.15,
  /** Weekly drift of the presbyterate's view toward the people's, slowly: they hear what his people say. */
  drift: 0.01,
} as const;

/** The parish of the diocese he is pastor or curate of, when the posting is one. */
export function friarParish(state: GameState): Parish | undefined {
  const house = currentHouse(state);
  const posting = currentPosting(state);
  if (!house?.parishId || posting?.work !== 'parish') return undefined;
  return state.world?.parishes.find((p) => p.id === house.parishId);
}

/** Whether he is the parish's pastor (the house's prior) or a curate of it. */
export function friarRole(state: GameState): 'pastor' | 'parochial_vicar' | null {
  const house = currentHouse(state);
  if (!friarParish(state) || !house) return null;
  return house.priorId === 'player' || state.religious?.office?.office === 'prior' ? 'pastor' : 'parochial_vicar';
}

function pastorOf(state: GameState, parishId: string): Npc | undefined {
  return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${parishId}`) && n.id !== 'player');
}

/**
 * Form the deanery around the order's parish and take the posting as an
 * assignment, so the parish's people and neighbours resolve. Nothing of the
 * base parish loop starts: `state.parish` stays empty.
 */
export function formFriarDeanery(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const parish = friarParish(state);
  const world = state.world;
  if (!r || !parish || !world) return state;
  if (r.deanery?.id === `deanery:${parish.id}` && state.assignment?.parishId === parish.id) return state;
  const members = nearestParishes(world.parishes, parish, milesAcross(world), DEANERY.size);
  const priests = members.map((p) => pastorOf(state, p.id)).filter((n): n is Npc => !!n);
  const ordainedAt = state.flags.ordination_week;
  const years = typeof ordainedAt === 'number' ? (state.clock.week - ordainedAt) / 52 : 0;
  const role = friarRole(state) ?? 'parochial_vicar';
  const playerDean = role === 'pastor' && years >= FRIAR_DEANERY.deanYears && (state.character?.reputation.diocesan_clergy ?? 0) >= FRIAR_DEANERY.deanRegard && rng.chance(FRIAR_DEANERY.deanChance);
  const candidates = [...priests].sort((a, b) => a.birthYear - b.birthYear || (a.id < b.id ? -1 : 1));
  const dean = playerDean ? null : (candidates[0] ?? null);
  const deanery = { id: `deanery:${parish.id}`, deanId: dean?.id ?? '', priestIds: priests.map((n) => n.id), parishIds: members.map((p) => p.id) };
  const flags = { ...state.flags, 'deanery:member': true, 'deanery:friar': true, 'deanery:dean': playerDean, [`role:${role}`]: true };
  const week = state.clock.week;
  const assignment = { parishId: parish.id, role, startWeek: week, letter: '', reasons: ['the provincial sent you to the parish the order holds'] };
  const career = [...state.career, { week, kind: 'note' as const, text: `${parish.name} sits in a deanery of ${members.length + 1}${dean ? `; ${dean.title} ${dean.name.last} is dean` : playerDean ? '; the bishop named you dean' : ''}.` }];
  return { ...state, flags, career, assignment, religious: { ...r, deanery } };
}

/** He has left the parish: the deanery and the assignment go with it. */
export function leaveFriarDeanery(state: GameState): GameState {
  const r = state.religious;
  if (!r?.deanery && !state.assignment) return state;
  if (!r) return state;
  const { deanery: _d, ...rest } = r;
  const flags = { ...state.flags };
  for (const k of ['deanery:member', 'deanery:friar', 'deanery:dean', 'role:pastor', 'role:parochial_vicar']) delete flags[k];
  return { ...state, assignment: null, flags, religious: rest };
}

/** The week: form or drop the deanery as the posting says; the presbyterate hears what the people say. */
export function friarDeaneryWeek(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r || !state.flags.ordained) return state;
  const parish = friarParish(state);
  if (!parish) return r.deanery || state.assignment ? leaveFriarDeanery(state) : state;
  let next = formFriarDeanery(state, rng);
  const c = next.character;
  if (c && next.religious?.deanery) {
    const laity = c.reputation.laity ?? 0;
    const clergy = c.reputation.diocesan_clergy ?? 0;
    const delta = (laity - clergy) * FRIAR_DEANERY.drift;
    if (Math.abs(delta) > 0.01) next = applyEffects(next, [{ target: 'reputation', key: 'diocesan_clergy', delta }], {}, 'what the deanery hears of his parish');
  }
  return next;
}

export interface FriarDeaneryPriest {
  npc: Npc;
  parish: Parish;
  miles: number;
  dean: boolean;
}

/** The priests of the deanery, nearest first, for the sheet and the asks. */
export function friarDeaneryPriests(state: GameState): FriarDeaneryPriest[] {
  const d = state.religious?.deanery;
  const world = state.world;
  const here = friarParish(state);
  if (!d || !world || !here) return [];
  return d.priestIds
    .map((id) => state.npcs[id])
    .filter((n): n is Npc => !!n && n.status === 'active')
    .map((npc) => ({ npc, parish: world.parishes.find((p) => npc.tags.includes(`pastor:${p.id}`))!, miles: 0, dean: npc.id === d.deanId }))
    .filter((x) => !!x.parish)
    .map((x) => ({ ...x, miles: milesBetween(here, x.parish, milesAcross(world)) }))
    .sort((a, b) => a.miles - b.miles);
}
