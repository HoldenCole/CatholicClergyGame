import type { Effect, GameState, Npc, OrderHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { provincialDeskDefs } from '@/content/religious';
import { PROVINCE } from '@/generation/province';
import { closeHouse } from './foundations';
import { buildDef } from './growth';
import { membersOf, nudgeHouse, playerIsProvincial, setHouse } from './house';

/**
 * The provincial's desk. E3 §3.1, §3.7, §3.14, built in the friar round
 * (Q3): while the player governs the province he sends men, visits houses,
 * closes one under its floor, levies the purses, writes to the general, and
 * sells what a house no longer fills. Every act is data in
 * content/religious/provincialDesk.json; the tunables here are invented.
 */
export const PROVINCIAL_DESK = {
  /** A man sent by letter: what he thinks of the provincial who sent him, and the house he leaves. */
  move: { regard: -3, cohesion: -1 },
  /** A visitation: the house tidies toward the province's custom, and a cohesive house is warmed by the visit. */
  visit: { custom: 50, observanceToward: 3, cohesionWarm: 2, cohesionCold: -1, cohesiveAt: 55, regardPerMan: 1 },
  /** The general's subsidy: a base chance, and what the order's regard adds. */
  general: { base: 0.35, perOrder: 0.005, floor: 0.1, ceiling: 0.9 },
  /** The province's money, in words. */
  money: { sound: 1_000_000, tight: 0 },
} as const;

export type ProvincialTarget = 'none' | 'house' | 'man_and_house' | 'house_under_floor' | 'house_with_building';

export interface ProvincialActDef {
  id: string;
  label: string;
  blurb: string;
  target: ProvincialTarget;
  cooldownWeeks: number;
  effects?: Effect[];
  share?: number;
  amount?: number;
  line: string;
}

export interface ProvincialActOffer {
  def: ProvincialActDef;
  available: boolean;
  why: string;
  /** Weeks until it can be done again, when the cooldown holds. */
  weeksLeft: number;
}

export function provincialActDefs(): ProvincialActDef[] {
  return provincialDeskDefs.acts;
}

function flagKey(id: string): string {
  return `provincial:act:${id}`;
}

/** The province's houses, the curia first, for the sheet and the targets. */
export function provincialHouses(state: GameState): OrderHouse[] {
  const p = state.province;
  if (!p || !state.orderHouses) return [];
  return Object.values(state.orderHouses).filter((h) => h.provinceId === p.id).sort((a, b) => (b.kind === 'curia' ? 1 : 0) - (a.kind === 'curia' ? 1 : 0) || a.name.localeCompare(b.name));
}

/** The houses under the floor for their kind, the ones a provincial could close. */
export function housesUnderFloor(state: GameState): OrderHouse[] {
  return provincialHouses(state).filter((h) => h.kind !== 'curia' && h.kind !== 'novitiate' && h.kind !== 'studium' && membersOf(state, h).length < PROVINCE.members[h.kind][0]);
}

/** The solemnly professed men of the province a provincial could send, by house. */
export function provincialMen(state: GameState): { npc: Npc; house: OrderHouse }[] {
  const out: { npc: Npc; house: OrderHouse }[] = [];
  for (const house of provincialHouses(state)) {
    for (const npc of membersOf(state, house)) {
      if (npc.id === 'player' || !npc.tags.includes('vows:solemn') || npc.id === house.priorId) continue;
      out.push({ npc, house });
    }
  }
  return out.sort((a, b) => a.npc.name.last.localeCompare(b.npc.name.last) || a.npc.id.localeCompare(b.npc.id));
}

export function moneyWord(balance: number): string {
  return balance >= PROVINCIAL_DESK.money.sound ? 'sound' : balance >= PROVINCIAL_DESK.money.tight ? 'tight' : balance >= -3_000_000 ? 'in the red' : 'in crisis';
}

/** Which acts are his this week, and why not. */
export function provincialActs(state: GameState): ProvincialActOffer[] {
  const mine = playerIsProvincial(state) && !state.study;
  const week = state.clock.week;
  return provincialActDefs().map((def) => {
    const last = state.flags[flagKey(def.id)];
    const since = typeof last === 'number' ? week - last : Infinity;
    const weeksLeft = Math.max(0, def.cooldownWeeks - since);
    if (!mine) return { def, available: false, why: 'The desk is the provincial\'s', weeksLeft: 0 };
    if (weeksLeft > 0) return { def, available: false, why: `Done lately; again in ${weeksLeft} week${weeksLeft === 1 ? '' : 's'}`, weeksLeft };
    if (def.target === 'house_under_floor' && !housesUnderFloor(state).length) return { def, available: false, why: 'No house is under the floor for its kind', weeksLeft: 0 };
    if (def.target === 'house_with_building' && !provincialHouses(state).some((h) => h.buildings?.length)) return { def, available: false, why: 'No house has a wing to sell', weeksLeft: 0 };
    if (def.target === 'man_and_house' && (!provincialMen(state).length || provincialHouses(state).length < 2)) return { def, available: false, why: 'No one to send, or nowhere to send him', weeksLeft: 0 };
    return { def, available: true, why: '', weeksLeft: 0 };
  });
}

function fill(line: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.split(`{${k}}`).join(v), line);
}

function nameOf(n: Npc): string {
  return `${n.title ? `${n.title} ` : ''}${n.name.first} ${n.name.last}`;
}

/** A man sent from one house to another: the membership, his house tag, his regard for the man who sent him. */
function sendMan(state: GameState, npcId: string, houseId: string): { state: GameState; line: string } {
  const npc = state.npcs[npcId];
  const to = state.orderHouses?.[houseId];
  if (!npc || !to || !state.orderHouses) return { state, line: '' };
  const from = Object.values(state.orderHouses).find((h) => h.memberIds.includes(npcId));
  if (!from || from.id === to.id) return { state, line: '' };
  const houses = { ...state.orderHouses };
  houses[from.id] = { ...from, memberIds: from.memberIds.filter((id) => id !== npcId), officers: Object.fromEntries(Object.entries(from.officers ?? {}).filter(([, id]) => id !== npcId)) };
  houses[to.id] = { ...to, memberIds: [...to.memberIds, npcId] };
  const npcs = { ...state.npcs, [npcId]: { ...npc, relationship: Math.max(-100, npc.relationship + PROVINCIAL_DESK.move.regard), tags: npc.tags.filter((t) => !t.startsWith('house:')).concat(`house:${to.id}`) } };
  let next: GameState = { ...state, npcs, orderHouses: houses };
  next = nudgeHouse(next, from.id, { cohesion: PROVINCIAL_DESK.move.cohesion });
  return { state: next, line: '' };
}

/** What three days in a house find, in a line. */
function findingOf(state: GameState, house: OrderHouse): string {
  const n = membersOf(state, house).length;
  const coh = house.cohesion >= 65 ? 'a house that likes itself' : house.cohesion >= 45 ? 'a house with two tables at dinner' : 'a house that eats in silence and not the good kind';
  const obs = house.observance >= 65 ? 'the Office sung and the silence kept' : house.observance >= 45 ? 'the Office in common most days' : 'Vespers when enough men are home';
  const money = house.budget < 0 ? 'the books in the red' : house.budget < 50_000 ? 'the books thin' : 'the books sound';
  const old = membersOf(state, house).filter((m) => state.clock.week / 52 + 2010 - m.birthYear >= 70).length;
  return `${n} men, ${coh}, ${obs}, ${money}${old >= n / 2 ? ', and more than half of them past seventy' : ''}.`;
}

/** The provincial acts. The province reads it the same week. */
export function provincialAct(state: GameState, id: string, target: { npcId?: string; houseId?: string }, rng: Rng): { state: GameState; line: string } {
  const offer = provincialActs(state).find((o) => o.def.id === id);
  if (!offer?.available || !state.province || !state.orderHouses) return { state, line: offer?.why ?? '' };
  const def = offer.def;
  const week = state.clock.week;
  let next: GameState = { ...state, flags: { ...state.flags, [flagKey(id)]: week } };
  let line = def.line;
  const p = next.province!;
  if (def.target === 'man_and_house') {
    const npc = target.npcId ? next.npcs[target.npcId] : undefined;
    const house = target.houseId ? next.orderHouses![target.houseId] : undefined;
    if (!npc || !house) return { state, line: 'Name a man and a house.' };
    next = sendMan(next, npc.id, house.id).state;
    line = fill(line, { man: nameOf(npc), house: house.name });
  } else if (def.target === 'house') {
    const house = target.houseId ? next.orderHouses![target.houseId] : undefined;
    if (!house) return { state, line: 'Name a house.' };
    const v = PROVINCIAL_DESK.visit;
    const toward = house.observance < v.custom ? Math.min(v.observanceToward, v.custom - house.observance) : house.observance > v.custom ? -Math.min(v.observanceToward, house.observance - v.custom) : 0;
    next = nudgeHouse(next, house.id, { observance: toward, cohesion: house.cohesion >= v.cohesiveAt ? v.cohesionWarm : v.cohesionCold });
    const npcs = { ...next.npcs };
    for (const m of membersOf(next, house)) npcs[m.id] = { ...m, relationship: Math.max(-100, Math.min(100, m.relationship + (house.cohesion >= v.cohesiveAt ? v.regardPerMan : -v.regardPerMan))) };
    next = { ...next, npcs, flags: { ...next.flags, [`provincial:visited:${house.id}`]: week } };
    line = fill(line, { house: house.name, finding: findingOf(state, house) });
  } else if (def.target === 'house_under_floor') {
    const house = target.houseId ? next.orderHouses![target.houseId] : housesUnderFloor(next)[0];
    if (!house || !housesUnderFloor(next).some((h) => h.id === house.id)) return { state, line: 'Only a house under its floor can be closed.' };
    const closed = closeHouse(next, house.id, rng.derive(`close:${week}`));
    next = closed.state;
    line = fill(line, { closing: closed.line });
  } else if (def.id === 'levy_houses') {
    let total = 0;
    for (const house of provincialHouses(next)) {
      const take = Math.max(0, Math.round(house.budget * (def.share ?? 0.1)));
      if (!take) continue;
      total += take;
      next = setHouse(next, { ...next.orderHouses![house.id]!, budget: house.budget - take });
    }
    next = { ...next, province: { ...next.province!, finances: { ...next.province!.finances, balance: next.province!.finances.balance + total } } };
    line = fill(line, { amount: total.toLocaleString() });
  } else if (def.id === 'ask_general') {
    const g = PROVINCIAL_DESK.general;
    const order = next.character?.reputation.order ?? 0;
    const chance = Math.max(g.floor, Math.min(g.ceiling, g.base + Math.max(0, order) * g.perOrder));
    const granted = rng.derive(`general:${week}`).chance(chance);
    if (granted) next = { ...next, province: { ...next.province!, finances: { ...next.province!.finances, balance: next.province!.finances.balance + (def.amount ?? 0) } } };
    line = fill(line, { answer: granted ? `The general's answer came in six weeks, with $${(def.amount ?? 0).toLocaleString()} and a paragraph about the province's books that you will read twice.` : 'The general\'s answer came in six weeks: a paragraph about the province\'s books, and no money. He has other provinces.' });
  } else if (def.target === 'house_with_building') {
    const house = target.houseId ? next.orderHouses![target.houseId] : provincialHouses(next).find((h) => h.buildings?.length);
    if (!house?.buildings?.length) return { state, line: 'That house has nothing to sell.' };
    const buildingId = house.buildings[house.buildings.length - 1]!;
    const built = buildDef(buildingId);
    const amount = Math.round((built?.cost ?? 0) * (def.share ?? 0.6));
    next = setHouse(next, { ...house, buildings: house.buildings.slice(0, -1) });
    next = nudgeHouse(next, house.id, { cohesion: -5 });
    next = { ...next, province: { ...next.province!, finances: { ...next.province!.finances, balance: next.province!.finances.balance + amount } } };
    line = fill(line, { house: house.name, building: built?.label.toLowerCase() ?? buildingId, amount: amount.toLocaleString() });
  }
  if (def.effects?.length) next = applyEffects(next, def.effects, {}, `the provincial's desk: ${def.label.toLowerCase()}`);
  void p;
  next = { ...next, career: [...next.career, { week, kind: 'note', text: line }] };
  return { state: next, line };
}
