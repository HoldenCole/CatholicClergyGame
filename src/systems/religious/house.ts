import type { GameState, Npc, OrderHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';

/**
 * The house: where a friar lives, and the peer group he cannot escape.
 * E3 §3.2. Cohesion is how well the community actually lives together;
 * observance how strictly the common life is kept. Both drift weekly toward
 * what the members and the player's own keeping of the horarium make of
 * them. Tunables are invented.
 */
export const HOUSE = {
  /** Weekly pull of cohesion and observance toward their resting points. */
  drift: 0.04,
  /** The rest cohesion tends to, before the men: mid-range. */
  cohesionRest: 55,
  /** A house of many alignments rests lower. */
  splitPenalty: 18,
  /** A house that keeps the observance rests a little higher: shared prayer binds. */
  observanceBond: 0.12,
  /** Piety decay multiplier at cohesion 0 and at cohesion 100 for an order whose mechanics say cohesion modulates piety. */
  pietyAtLow: 1.35,
  pietyAtHigh: 0.7,
  /** On a transfer, this much of the standing with the house carries to the next one. E3 §3.9. */
  communityCarry: 0.3,
} as const;

export function currentHouse(state: GameState): OrderHouse | undefined {
  const id = state.religious?.houseId;
  return id ? state.orderHouses?.[id] : undefined;
}

export function houseById(state: GameState, id: string): OrderHouse | undefined {
  return state.orderHouses?.[id];
}

export function membersOf(state: GameState, house: Pick<OrderHouse, 'memberIds'>): Npc[] {
  return house.memberIds.map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active');
}

export function priorOf(state: GameState, house?: OrderHouse): Npc | undefined {
  const h = house ?? currentHouse(state);
  return h ? state.npcs[h.priorId] : undefined;
}

/** How spread the house's men are on the line, 0..1. */
function spread(members: Npc[]): number {
  if (members.length < 2) return 0;
  const mean = members.reduce((a, m) => a + m.alignment, 0) / members.length;
  const sd = Math.sqrt(members.reduce((a, m) => a + (m.alignment - mean) ** 2, 0) / members.length);
  return Math.min(1, sd / 45);
}

/** Where cohesion settles for this house, from its men and its observance. */
export function cohesionRest(state: GameState, house: OrderHouse): number {
  const members = membersOf(state, house);
  return Math.max(10, Math.min(95, HOUSE.cohesionRest - spread(members) * HOUSE.splitPenalty + (house.observance - 50) * HOUSE.observanceBond));
}

export function setHouse(state: GameState, house: OrderHouse): GameState {
  return { ...state, orderHouses: { ...(state.orderHouses ?? {}), [house.id]: house } };
}

/** Move a house's cohesion or observance by a delta, clamped. */
export function nudgeHouse(state: GameState, houseId: string, delta: { cohesion?: number; observance?: number }): GameState {
  const house = houseById(state, houseId);
  if (!house) return state;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return setHouse(state, { ...house, cohesion: clamp(house.cohesion + (delta.cohesion ?? 0)), observance: clamp(house.observance + (delta.observance ?? 0)) });
}

/** One week: the house drifts toward its rest, with a little noise so no two weeks are the same. */
export function houseWeek(state: GameState, rng: Rng): GameState {
  const house = currentHouse(state);
  if (!house) return state;
  const rest = cohesionRest(state, house);
  const cohesion = house.cohesion + (rest - house.cohesion) * HOUSE.drift + rng.float(-0.6, 0.6);
  const observance = house.observance + rng.float(-0.4, 0.4);
  return setHouse(state, { ...house, cohesion: Math.max(0, Math.min(100, Math.round(cohesion * 100) / 100)), observance: Math.max(0, Math.min(100, Math.round(observance * 100) / 100)) });
}

/**
 * For an order whose mechanics say so (the Augustinians), the house's
 * cohesion modulates every member's piety decay: high cohesion slows it,
 * low cohesion speeds it. 1 otherwise. E3 §7.2.
 */
export function cohesionPietyFactor(state: GameState): number {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house) return 1;
  if (!religiousOrder(r.order).mechanics.cohesionModulatesPiety) return 1;
  const t = house.cohesion / 100;
  return HOUSE.pietyAtLow + (HOUSE.pietyAtHigh - HOUSE.pietyAtLow) * t;
}

const KIND_WORD: Record<OrderHouse['kind'], string> = {
  priory: 'a priory',
  studium: 'the house of studies',
  novitiate: 'the novitiate',
  parish: 'a small community at the parish',
  school: 'the community at the school',
  mission: 'a mission',
  curia: "the provincial's house",
};

function cohesionWord(c: number): string {
  if (c >= 75) return 'a house that likes itself';
  if (c >= 55) return 'a house that gets on well enough';
  if (c >= 35) return 'a house with two tables at dinner';
  return 'a house where the silence at supper is not the Rule';
}

function observanceWord(o: number): string {
  if (o >= 75) return 'the Hours sung, the habit worn, the silence kept';
  if (o >= 50) return 'the Office in common most days and the habit for Mass';
  if (o >= 30) return 'Vespers when enough men are home';
  return 'a common life that is mostly a common address';
}

/** How the house feels, for the letter, the sheet, and the digest. */
export function houseLine(state: GameState, house: OrderHouse): string {
  const n = membersOf(state, house).length;
  return `${house.name}, ${KIND_WORD[house.kind]} of ${n} men: ${cohesionWord(house.cohesion)}, ${observanceWord(house.observance)}.`;
}
