import type { GameState, HouseKind, Npc, OrderHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { dateOf } from '@/engine/time';
import { priorDeskDefs, religiousOrder, type HouseBuildDef } from '@/content/religious';
import { friar, PROVINCE } from '@/generation/province';
import { installSuperior } from './chapter';
import { currentHouse, membersOf, playerIsPrior, setHouse } from './house';
import { topReputations } from './reputations';
import { foundationOf } from './foundationYear';

/**
 * Houses that live: men enter, die, and leave every year, the money comes
 * in and goes out, and a prior builds. E3 §3.2 and §9.5, generalized from
 * the foundation's model to every house of the province. A house draws
 * vocations on its kind, its works, its observance and cohesion, what it
 * has built, and its prior's name; a monastery that a good man keeps well
 * fills, as they did. Tunables are invented.
 */
export const GROWTH = {
  /** Vocations a year a house of the kind draws at the middle of every dial, before the province's trajectory. */
  base: { priory: 0.7, studium: 0.35, novitiate: 0.25, parish: 0.6, school: 0.8, mission: 0.4, curia: 0.3 } as Record<HouseKind, number>,
  trajectory: { growing: 1.35, stable: 1, shrinking: 0.6 } as Record<'growing' | 'stable' | 'shrinking', number>,
  /** Each work beyond the first, and each building, adds this much. */
  perWork: 0.15,
  perBuilding: 0.08,
  /** The vocations weekend, in the year it was held. */
  drive: 1.5,
  /** A full house draws less: the draw is scaled by how much room is left, to this power. */
  roomPower: 0.5,
  /** Beds beyond the kind's usual: what the wings add. */
  capacityOver: 4,
  /** Deaths a year by age band; leaving a year by vows. */
  death: { 85: 0.18, 75: 0.07, 65: 0.02, 0: 0.004 } as Record<number, number>,
  leave: { novice: 0.1, simple: 0.05, youngSolemn: 0.008 },
  /** Dollars a year each work brings a house, and what each man costs. */
  income: { parish: 140_000, school: 260_000, priory_church: 70_000, preaching: 50_000, teaching: 40_000, chaplaincy: 60_000, mission: 25_000, formation: 0, curia: 0 } as Record<string, number>,
  costPerMan: 28_000,
  /** The province pays for its students and novices, per man. */
  formationSubsidy: 30_000,
  /** A grant toward a build: the share, the base chance, and what moves it. */
  grant: { share: 0.5, base: 0.35, perSuperiors: 0.002, flush: 0.25, shrinking: -0.15, everyWeeks: 52 },
} as const;

export function buildDef(id: string): HouseBuildDef | undefined {
  return priorDeskDefs.builds.find((b) => b.id === id);
}

/** Beds in the house: the kind's usual, a little over, and the wings. */
export function capacityOf(house: OrderHouse): number {
  const wings = (house.buildings ?? []).reduce((n, id) => n + (buildDef(id)?.adds?.capacity ?? 0), 0);
  return PROVINCE.members[house.kind][1] + GROWTH.capacityOver + wings;
}

/** The draw of the prior's own name: a founder's reputations for the player, a man's presence for an NPC. */
function priorDraw(state: GameState, house: OrderHouse): number {
  if (playerIsPrior(state, house)) {
    const c = state.character;
    return topReputations(state).slice(0, 2).reduce((a, r) => a + r.value, 0) / 400 + (c ? c.stats.charisma / 250 : 0);
  }
  const prior = state.npcs[house.priorId];
  return prior ? (prior.stats.charisma + prior.stats.piety) / 500 : 0;
}

/** The vocations a house draws a year. */
export function expectedHouseVocations(state: GameState, house: OrderHouse): number {
  const p = state.province;
  if (!p) return 0;
  const members = membersOf(state, house).length + (state.religious?.houseId === house.id ? 1 : 0);
  const room = Math.max(0, 1 - members / capacityOf(house));
  const works = 1 + Math.max(0, new Set(house.works).size - 1) * GROWTH.perWork + (house.buildings?.length ?? 0) * GROWTH.perBuilding + (house.buildings ?? []).reduce((n, id) => n + (buildDef(id)?.vocations ?? 0), 0);
  const observance = 0.7 + (house.observance / 100) * 0.6;
  const cohesion = 0.75 + (house.cohesion / 100) * 0.5;
  const drive = typeof house.purse?.vocations_drive === 'number' && state.clock.week - house.purse.vocations_drive < 52 ? GROWTH.drive : 1;
  return GROWTH.base[house.kind] * GROWTH.trajectory[p.trajectory] * works * observance * cohesion * drive * (1 + priorDraw(state, house)) * Math.pow(room, GROWTH.roomPower);
}

/** What the house earns and spends in a year. */
export function houseMoney(state: GameState, house: OrderHouse): { income: number; cost: number } {
  const members = membersOf(state, house);
  const n = members.length + (state.religious?.houseId === house.id ? 1 : 0);
  const formed = members.filter((m) => m.tags.includes('vows:novice') || m.tags.includes('vows:simple')).length;
  const works = [...new Set(house.works)].reduce((v, w) => v + (GROWTH.income[w] ?? 30_000), 0);
  const built = (house.buildings ?? []).reduce((v, id) => v + (buildDef(id)?.income ?? 0), 0);
  return { income: works + built + formed * GROWTH.formationSubsidy, cost: n * GROWTH.costPerMan };
}

function ageOf(state: GameState, n: Npc): number {
  return dateOf(state.clock).year - n.birthYear;
}

function deathChance(age: number): number {
  const bands = Object.keys(GROWTH.death).map(Number).sort((a, b) => b - a);
  for (const b of bands) if (age >= b) return GROWTH.death[b]!;
  return 0;
}

/** One house's year: the men who come, die, and leave; the money; a prior lost replaced. */
function houseYear(state: GameState, house0: OrderHouse, rng: Rng): { state: GameState; lines: string[] } {
  const r = state.religious!;
  const p = state.province!;
  const order = religiousOrder(r.order);
  const week = state.clock.week;
  const year = dateOf(state.clock).year;
  const lines: string[] = [];
  let next = state;
  let house = house0;
  const mine = r.houseId === house.id;
  const npcs = { ...next.npcs };
  let died = 0;
  let left = 0;
  let lostPrior = false;
  // Deaths and departures.
  for (const m of membersOf(next, house)) {
    const age = ageOf(next, m);
    if (rng.derive(`death:${m.id}`).chance(deathChance(age))) {
      npcs[m.id] = { ...m, status: 'dead', tags: m.tags.filter((t) => t !== 'prior') };
      died += 1;
      if (m.id === house.priorId) lostPrior = true;
      if (mine) lines.push(`${m.title} ${m.name.first} ${m.name.last} died, ${age}, in the house; the necrology has him now.`);
      continue;
    }
    const leaveChance = m.tags.includes('vows:novice') ? GROWTH.leave.novice : m.tags.includes('vows:simple') ? GROWTH.leave.simple : age < 45 ? GROWTH.leave.youngSolemn : 0;
    if (leaveChance && rng.derive(`leave:${m.id}`).chance(leaveChance)) {
      npcs[m.id] = { ...m, status: 'left', tags: m.tags.filter((t) => t !== 'prior') };
      left += 1;
      if (m.id === house.priorId) lostPrior = true;
      if (mine) lines.push(`${m.title} ${m.name.first} ${m.name.last} left the order, ${m.tags.includes('vows:novice') ? 'in the novitiate' : m.tags.includes('vows:simple') ? 'before solemn vows' : 'after years in vows'}.`);
    }
  }
  const gone = new Set(Object.keys(npcs).filter((id) => npcs[id]!.status !== 'active' && house.memberIds.includes(id)));
  house = { ...house, memberIds: house.memberIds.filter((id) => !gone.has(id)) };
  next = { ...next, npcs, orderHouses: { ...next.orderHouses!, [house.id]: house } };
  // Vocations: the house's own draw; the men go to the novitiate and come home professed, credited to the house.
  const expected = expectedHouseVocations(next, house);
  const count = Math.floor(expected) + (rng.derive('vocation').chance(expected - Math.floor(expected)) ? 1 : 0);
  if (count > 0) {
    const novitiate = Object.values(next.orderHouses ?? {}).find((h) => h.kind === 'novitiate' && h.provinceId === p.id);
    const target = house.kind === 'novitiate' || !novitiate ? house : novitiate;
    const npcs2 = { ...next.npcs };
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const n = friar(rng.derive(`vocation:${i}`), order, { id: house.id, alignment: house.alignment, kind: house.kind }, year, `${week}_${i}`, 'novice', 0);
      const npc: Npc = { ...n, tags: n.tags.filter((t) => !t.startsWith('house:')).concat(`house:${target.id}`, `vocation_of:${house.id}`, `entered:${week}`) };
      npcs2[npc.id] = npc;
      ids.push(npc.id);
    }
    const houses = { ...next.orderHouses!, [target.id]: { ...next.orderHouses![target.id]!, memberIds: [...next.orderHouses![target.id]!.memberIds, ...ids] } };
    next = { ...next, npcs: npcs2, orderHouses: houses, province: { ...next.province!, friarIds: [...next.province!.friarIds, ...ids] } };
    house = houses[house.id]!;
    if (mine) lines.push(`${count === 1 ? 'A man' : `${count} men`} entered through the house this year${target.id === house.id ? '' : ', and went to the novitiate'}.`);
  }
  // Men who came through this house come home once professed.
  {
    const npcs3 = { ...next.npcs };
    const houses3 = { ...next.orderHouses! };
    for (const n of Object.values(npcs3)) {
      if (n.status !== 'active' || !n.tags.includes(`vocation_of:${house.id}`) || !n.tags.includes('vows:simple')) continue;
      const at = n.tags.find((t) => t.startsWith('house:'))?.slice('house:'.length);
      if (at && at !== house.id && houses3[at]?.kind === 'novitiate' && membersOf(next, houses3[house.id]!).length < capacityOf(houses3[house.id]!)) {
        npcs3[n.id] = { ...n, tags: n.tags.filter((t) => !t.startsWith('house:')).concat(`house:${house.id}`) };
        houses3[at] = { ...houses3[at]!, memberIds: houses3[at]!.memberIds.filter((x) => x !== n.id) };
        houses3[house.id] = { ...houses3[house.id]!, memberIds: [...houses3[house.id]!.memberIds, n.id] };
      }
    }
    next = { ...next, npcs: npcs3, orderHouses: houses3 };
    house = houses3[house.id]!;
  }
  // Vows advance for the men who entered through any house: a year to simple vows, five more to solemn.
  {
    const npcs4 = { ...next.npcs };
    let changed = false;
    for (const id of house.memberIds) {
      const n = npcs4[id];
      if (!n || n.status !== 'active') continue;
      const entered = n.tags.find((t) => t.startsWith('entered:'));
      if (!entered) continue;
      const years = (week - Number(entered.slice('entered:'.length))) / 52;
      if (n.tags.includes('vows:novice') && years >= 1) { npcs4[id] = { ...n, tags: n.tags.map((t) => (t === 'vows:novice' ? 'vows:simple' : t)) }; changed = true; }
      else if (n.tags.includes('vows:simple') && years >= 6) { npcs4[id] = { ...n, title: n.tags.includes('lay_brother') ? 'Br.' : 'Fr.', tags: n.tags.map((t) => (t === 'vows:simple' ? 'vows:solemn' : t)) }; changed = true; }
    }
    if (changed) next = { ...next, npcs: npcs4 };
  }
  // The money.
  const { income, cost } = houseMoney(next, house);
  let budget = house.budget + income - cost;
  if (budget < 0) {
    // The province carries a house in the red, and remembers whose it was.
    next = { ...next, province: { ...next.province!, finances: { ...next.province!.finances, balance: next.province!.finances.balance + budget } } };
    if (playerIsPrior(next, house)) {
      next = applyEffects(next, [{ target: 'reputation', key: 'superiors', delta: -2 }], {}, 'a house the province had to carry');
      lines.push(`The house ran short by $${Math.abs(budget).toLocaleString()} and the province made it up, and the council noticed.`);
    }
    budget = 0;
  }
  house = { ...house, budget: Math.round(budget), grew: { year, entered: count, died, left, income, cost } };
  next = setHouse(next, house);
  // A prior lost: the eldest solemnly professed priest holds the house until the chapter.
  if (lostPrior) {
    const heir = membersOf(next, house).filter((m) => m.tags.includes('vows:solemn') && m.title === 'Fr.').sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
    if (heir) {
      next = installSuperior(next, 'prior', house.id, heir.id);
      if (mine) lines.push(`${heir.title} ${heir.name.last} holds the house as prior until the chapter.`);
    }
  }
  return { state: next, lines };
}

/** Every house of the province, a year. The player's house's lines go to his record and the sheet. */
export function provinceGrowthYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r || !state.province || !state.orderHouses) return state;
  let next = state;
  const lines: string[] = [];
  for (const house of Object.values(state.orderHouses).filter((h) => h.provinceId === r.provinceId).sort((a, b) => a.id.localeCompare(b.id))) {
    // A foundation of the player's line keeps its own model.
    if (foundationOf(next, house.id)) continue;
    const current = next.orderHouses?.[house.id];
    if (!current) continue;
    const res = houseYear(next, current, rng.derive(`house:${house.id}`));
    next = res.state;
    lines.push(...res.lines);
  }
  if (lines.length) next = { ...next, career: [...next.career, ...lines.map((text) => ({ week: next.clock.week, kind: 'note' as const, text }))] };
  return next;
}

// ---- Building ----

export interface BuildOffer {
  def: HouseBuildDef;
  available: boolean;
  why: string;
}

export function buildOffers(state: GameState): BuildOffer[] {
  const house = currentHouse(state);
  if (!house) return [];
  const mine = playerIsPrior(state, house);
  const men = membersOf(state, house).length + 1;
  return priorDeskDefs.builds.map((def) => {
    if (house.buildings?.includes(def.id)) return { def, available: false, why: 'Built' };
    if (!mine) return { def, available: false, why: 'The prior decides this' };
    if (house.build) return { def, available: false, why: 'One thing at a time' };
    if (def.requires.kinds && !def.requires.kinds.includes(house.kind)) return { def, available: false, why: 'Not for this kind of house' };
    if (def.requires.works && !def.requires.works.some((w) => house.works.includes(w))) return { def, available: false, why: 'The house has no such work' };
    if (def.requires.notWorks && def.requires.notWorks.some((w) => house.works.includes(w))) return { def, available: false, why: 'The house has it already' };
    if (def.requires.men && men < def.requires.men) return { def, available: false, why: `${def.requires.men} men before the house can carry it` };
    if (def.cost > house.budget) return { def, available: false, why: `The house has $${house.budget.toLocaleString()} of the $${def.cost.toLocaleString()}; ask the province for a grant, or wait` };
    return { def, available: true, why: '' };
  });
}

/** Begin a build: the money goes out now, the building comes in its time. */
export function startBuild(state: GameState, id: string): { state: GameState; line: string } {
  const offer = buildOffers(state).find((o) => o.def.id === id);
  const house = currentHouse(state);
  if (!offer?.available || !house) return { state, line: offer?.why ?? 'No house' };
  const week = state.clock.week;
  const next = setHouse(state, { ...house, budget: house.budget - offer.def.cost, build: { id, startWeek: week, endWeek: week + offer.def.weeks } });
  return { state: { ...next, career: [...next.career, { week, kind: 'note', text: `Began to ${offer.def.label.toLowerCase()} at ${house.name}: $${offer.def.cost.toLocaleString()}, ${Math.round(offer.def.weeks / 52 * 10) / 10} years.` }] }, line: `The architect comes on Tuesday. ${offer.def.blurb}` };
}

/** Ask the province for a grant toward the dearest build the house cannot afford: half of it, when the council says yes. */
export function mayAskGrant(state: GameState): { ok: boolean; why: string } {
  const house = currentHouse(state);
  if (!house || !playerIsPrior(state, house)) return { ok: false, why: 'The prior asks' };
  if (house.build) return { ok: false, why: 'A build is under way' };
  if (typeof house.grantAsked === 'number' && state.clock.week - house.grantAsked < GROWTH.grant.everyWeeks) return { ok: false, why: 'Asked already this year' };
  return { ok: true, why: '' };
}

export function grantChance(state: GameState, def: HouseBuildDef): number {
  const p = state.province;
  const c = state.character;
  if (!p || !c) return 0;
  let chance: number = GROWTH.grant.base + (c.reputation.superiors ?? 0) * GROWTH.grant.perSuperiors;
  if (p.finances.balance > def.cost * 2) chance += GROWTH.grant.flush;
  if (p.trajectory === 'shrinking') chance += GROWTH.grant.shrinking;
  return Math.max(0.05, Math.min(0.9, chance));
}

export function askGrant(state: GameState, id: string, rng: Rng): { state: GameState; granted: boolean; line: string } {
  const may = mayAskGrant(state);
  const def = buildDef(id);
  const house = currentHouse(state);
  if (!may.ok || !def || !house || !state.province) return { state, granted: false, line: may.why };
  const week = state.clock.week;
  const granted = rng.chance(grantChance(state, def));
  const amount = Math.round(def.cost * GROWTH.grant.share);
  let next = setHouse(state, { ...house, grantAsked: week, ...(granted ? { budget: house.budget + amount } : {}) });
  if (granted) next = { ...next, province: { ...next.province!, finances: { ...next.province!.finances, balance: next.province!.finances.balance - amount } } };
  next = { ...next, career: [...next.career, { week, kind: 'note', text: granted ? `The province granted $${amount.toLocaleString()} toward ${def.label.toLowerCase()}.` : `Asked the province for a grant toward ${def.label.toLowerCase()}; the council said not this year.` }] };
  return { state: next, granted, line: granted ? `The council votes it in an afternoon, which means the provincial had decided in the morning: $${amount.toLocaleString()} toward ${def.label.toLowerCase()}.` : 'The council says the province has three houses asking and one purse, and that yours is not the poorest. Next year.' };
}

/** One week of a build: when its time is up, the building stands and does what it does. */
export function buildWeek(state: GameState): { state: GameState; line: string | null } {
  const house = currentHouse(state);
  const b = house?.build;
  if (!house || !b || state.clock.week < b.endWeek) return { state, line: null };
  const def = buildDef(b.id);
  const { build: _b, ...rest } = house;
  let done: OrderHouse = { ...rest, buildings: [...(house.buildings ?? []), b.id] };
  if (def?.adds?.work && !done.works.includes(def.adds.work)) done = { ...done, works: [...done.works, def.adds.work] };
  let next = setHouse(state, done);
  if (!def) return { state: next, line: null };
  if (def.house) next = setHouse(next, { ...done, cohesion: Math.max(0, Math.min(100, done.cohesion + (def.house.cohesion ?? 0))), observance: Math.max(0, Math.min(100, done.observance + (def.house.observance ?? 0))) });
  if (playerIsPrior(next, house) && def.effects.length) next = applyEffects(next, def.effects, {}, def.label.toLowerCase());
  next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `${house.name}: ${def.label.toLowerCase()}, finished.` }] };
  return { state: next, line: def.line };
}
