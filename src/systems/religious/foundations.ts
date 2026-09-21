import type { GameState, Letter, OrderHouse, ReligiousHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';
import { orderDef } from '@/content/houses';
import { dateOf } from '@/engine/time';
import { PROVINCE } from '@/generation/province';
import { currentHouse, membersOf } from './house';
import { worldOf } from './transfer';

/**
 * Closures and foundations, seen from the province. E3 §3.14. A province
 * that shrinks closes a house: its men go to other houses, and if it held
 * a parish the parish goes back to the diocese with a diocesan pastor,
 * which the diocese notices. A province that grows founds one where it has
 * none. Both are the provincial's decisions: a scene of his makes them
 * through the `province` effect, and when he is another man the year rolls
 * them. Both are written into the diocese's own list of houses, so a
 * diocesan campaign in that diocese sees the friars come or go. Tunables
 * are invented.
 */
export const FOUNDATIONS = {
  /** Chance a year a shrinking province closes its smallest house, when it is under the kind's floor. */
  closeChance: 0.18,
  /** Chance a year a growing province founds a house in a diocese of its territory that has none. */
  foundChance: 0.12,
  /** Men sent to a foundation. */
  foundSize: [3, 5] as [number, number],
} as const;

/** The diocese's own list of houses: what its pastors and bishop see. */
function setDioceseHouses(state: GameState, dioceseId: string, fn: (houses: ReligiousHouse[]) => ReligiousHouse[]): GameState {
  const world = worldOf(state, dioceseId);
  if (!world) return state;
  const next = { ...world, diocese: { ...world.diocese, visible: { ...world.diocese.visible, houses: fn(world.diocese.visible.houses ?? []) } } };
  if (state.world?.diocese.presetId === dioceseId) return { ...state, world: next };
  return { ...state, territory: { ...(state.territory ?? {}), [dioceseId]: next } };
}

/** The house's entry in the diocese's list, when the base game's order matches. */
function dioceseHouseFor(state: GameState, house: OrderHouse): ReligiousHouse | undefined {
  const r = state.religious;
  if (!r) return undefined;
  const orderId = religiousOrder(r.order).houseOrderId;
  return (worldOf(state, house.dioceseId)?.diocese.visible.houses ?? []).find((h) => h.order === orderId);
}

/**
 * Close a house. Its men go to the province's other houses; a parish it
 * held goes back to the diocese under a diocesan priest; the diocese's
 * list loses a house; the flags say so for both campaigns' scenes. The
 * player, if he lived there, is left for the year's consultation to move.
 */
export function closeHouse(state: GameState, houseId: string, rng: Rng): { state: GameState; line: string } {
  const r = state.religious;
  const house = state.orderHouses?.[houseId];
  const province = state.province;
  if (!r || !house || !province || !state.orderHouses) return { state, line: '' };
  const week = state.clock.week;
  const others = Object.values(state.orderHouses).filter((h) => h.id !== houseId && h.provinceId === province.id).sort((a, b) => a.id.localeCompare(b.id));
  if (!others.length) return { state, line: '' };
  const npcs = { ...state.npcs };
  const houses = { ...state.orderHouses };
  // The men go where there is room, the novices to the novitiate.
  for (const id of house.memberIds) {
    const n = npcs[id];
    if (!n || n.status !== 'active') continue;
    const wants = n.tags.includes('vows:novice') ? others.find((h) => h.kind === 'novitiate') : undefined;
    const target = wants ?? others.reduce((best, h) => (membersOf({ ...state, npcs } as GameState, h).length < membersOf({ ...state, npcs } as GameState, best).length ? h : best), others[0]!);
    npcs[id] = { ...n, tags: n.tags.filter((t) => !t.startsWith('house:') && t !== 'prior').concat(`house:${target.id}`) };
    houses[target.id] = { ...houses[target.id]!, memberIds: [...houses[target.id]!.memberIds, id] };
  }
  // A parish held goes back to the diocese.
  let next: GameState = { ...state, npcs, orderHouses: houses };
  let handedBack = '';
  if (house.parishId) {
    const world = worldOf(next, house.dioceseId);
    const parish = world?.parishes.find((p) => p.id === house.parishId);
    if (world && parish) {
      const prior = npcs[house.priorId];
      if (prior) npcs[prior.id] = { ...prior, tags: prior.tags.filter((t) => t !== `pastor:${parish.id}`) };
      const priests = Object.values(npcs).filter((n) => n.status === 'active' && n.role === 'priest' && n.tags.includes(`diocese:${house.dioceseId}`)).sort((a, b) => a.id.localeCompare(b.id));
      const free = priests.filter((n) => !n.tags.some((t) => t.startsWith('pastor:')));
      // A priest without a parish; failing that, a neighbouring pastor holds two, as dioceses do.
      const newPastor = free.length ? rng.pick(free) : priests.length ? rng.pick(priests) : undefined;
      if (newPastor) npcs[newPastor.id] = { ...newPastor, tags: [...newPastor.tags, `pastor:${parish.id}`] };
      parish.pastorId = newPastor?.id ?? parish.pastorId;
      handedBack = ` ${parish.name} goes back to the diocese${newPastor ? `, under ${newPastor.title} ${newPastor.name.last}` : ''}.`;
      next = { ...next, npcs };
    }
  }
  delete houses[houseId];
  next = { ...next, orderHouses: houses, province: { ...province, houseIds: province.houseIds.filter((id) => id !== houseId) } };
  const seen = dioceseHouseFor(state, house);
  if (seen) next = setDioceseHouses(next, house.dioceseId, (hs) => hs.filter((h) => h.id !== seen.id));
  const flags = { ...next.flags, [`house_closed:${house.dioceseId}`]: week, 'province:closed_a_house': week, ...(house.parishId ? { [`parish_handed_back:${house.dioceseId}`]: week } : {}) };
  if (r.houseId === houseId) flags['house_closed:mine'] = week;
  const line = `The province has closed ${house.name}.${handedBack} Its men are in the other houses by Advent.`;
  next = { ...next, flags, career: [...next.career, { week, kind: 'note', text: line }] };
  return { state: next, line };
}

function houseNameFor(rng: Rng, state: GameState, kind: OrderHouse['kind']): string {
  const order = religiousOrder(state.religious!.order);
  const pool = kind === 'school' ? order.houseNames.school : order.houseNames.priory;
  const taken = new Set(Object.values(state.orderHouses ?? {}).map((h) => h.name));
  const free = pool.filter((n) => !taken.has(n));
  return rng.pick(free.length ? free : pool);
}

/**
 * Found a house in a diocese of the territory. Three to five men come from
 * the fullest houses; a parish house takes a parish of the diocese; the
 * diocese's list gains a house; the flags say so.
 */
export function foundHouse(state: GameState, dioceseId: string, kind: 'priory' | 'parish', rng: Rng): { state: GameState; line: string } {
  const r = state.religious;
  const province = state.province;
  if (!r || !province || !state.orderHouses) return { state, line: '' };
  const week = state.clock.week;
  const order = religiousOrder(r.order);
  const houses = { ...state.orderHouses };
  const npcs = { ...state.npcs };
  const n = rng.int(...FOUNDATIONS.foundSize);
  const donors = Object.values(houses).filter((h) => h.kind !== 'novitiate' && h.kind !== 'studium').sort((a, b) => membersOf(state, b).length - membersOf(state, a).length || a.id.localeCompare(b.id));
  const sent: string[] = [];
  for (const donor of donors) {
    for (const id of membersOf(state, donor).filter((m) => m.tags.includes('vows:solemn') && !m.tags.includes('prior') && m.id !== 'player').map((m) => m.id)) {
      if (sent.length >= n) break;
      sent.push(id);
      houses[donor.id] = { ...houses[donor.id]!, memberIds: houses[donor.id]!.memberIds.filter((x) => x !== id) };
    }
    if (sent.length >= n) break;
  }
  if (sent.length < 3) return { state, line: '' };
  const id = `${province.id}:house${week}`;
  const priorId = sent.sort((a, b) => (npcs[a]!.birthYear - npcs[b]!.birthYear) || a.localeCompare(b))[Math.floor(sent.length / 2)]!;
  for (const m of sent) npcs[m] = { ...npcs[m]!, tags: npcs[m]!.tags.filter((t) => !t.startsWith('house:')).concat(`house:${id}`, ...(m === priorId ? ['prior'] : [])) };
  const name = houseNameFor(rng, state, kind);
  const house: OrderHouse = { id, provinceId: province.id, dioceseId, name, kind, memberIds: sent, priorId, cohesion: 60, observance: 55, alignment: Math.max(-100, Math.min(100, Math.round(rng.gaussian() * 20))), works: kind === 'parish' ? ['parish'] : ['priory_church', 'preaching'], budget: Math.round(PROVINCE.members[kind][0] * 30_000) };
  let next: GameState = { ...state, npcs, orderHouses: { ...houses, [id]: house }, province: { ...province, houseIds: [...province.houseIds, id] } };
  let parishLine = '';
  if (kind === 'parish') {
    const world = worldOf(next, dioceseId);
    const taken = new Set(Object.values(next.orderHouses!).map((h) => h.parishId).filter(Boolean));
    const pool = (world?.parishes ?? []).filter((p) => !p.cathedral && !taken.has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
    const parish = pool.length ? rng.pick(pool) : undefined;
    if (parish) {
      const old = Object.values(next.npcs).find((x) => x.tags.includes(`pastor:${parish.id}`));
      const npcs2 = { ...next.npcs };
      if (old) npcs2[old.id] = { ...old, tags: old.tags.filter((t) => t !== `pastor:${parish.id}`).concat('priest') };
      npcs2[priorId] = { ...npcs2[priorId]!, tags: [...npcs2[priorId]!.tags, `pastor:${parish.id}`] };
      parish.pastorId = priorId;
      next = { ...next, npcs: npcs2, orderHouses: { ...next.orderHouses!, [id]: { ...house, parishId: parish.id } } };
      parishLine = ` The bishop has entrusted ${parish.name} to the order.`;
    }
  }
  // The diocese's own list gains a house, in the base game's terms.
  const base = orderDef(order.houseOrderId);
  if (base) {
    const seen: ReligiousHouse = { id: `house:${order.houseOrderId}:${week}`, name, order: base.id, orderLabel: base.label, members: base.members as ReligiousHouse['members'], charism: 'active', alignment: house.alignment, setting: 'city', size: sent.length, line: `${name}, a new foundation of ${base.label}: ${sent.length} ${base.members} in a house the province bought, with a chapel the bishop blessed.`, foundedWeek: week, ...(base.institute ? { instituteId: base.institute } : {}) };
    next = setDioceseHouses(next, dioceseId, (hs) => [...hs, seen]);
  }
  const flags = { ...next.flags, [`house_founded:${dioceseId}`]: week, 'province:founded_a_house': week };
  const line = `The province has founded ${name} in ${worldOf(next, dioceseId)?.diocese.visible.name ?? 'a diocese of the territory'}: ${sent.length} men sent from the fuller houses.${parishLine}`;
  return { state: { ...next, flags, career: [...next.career, { week, kind: 'note', text: line }] }, line };
}

/** The house the provincial would close: the smallest under its floor, never the curia, the player's last. */
export function houseToClose(state: GameState): OrderHouse | undefined {
  const p = state.province;
  if (!p || !state.orderHouses) return undefined;
  const mine = state.religious?.houseId;
  const candidates = Object.values(state.orderHouses)
    .filter((h) => h.provinceId === p.id && h.kind !== 'curia' && h.kind !== 'novitiate' && h.kind !== 'studium')
    .map((h) => ({ h, n: membersOf(state, h).length, floor: PROVINCE.members[h.kind][0] }))
    .filter((x) => x.n < x.floor)
    .sort((a, b) => (a.h.id === mine ? 1 : 0) - (b.h.id === mine ? 1 : 0) || a.n - b.n || a.h.id.localeCompare(b.h.id));
  return candidates[0]?.h;
}

/** A diocese of the territory with no house of the province. */
export function dioceseToFound(state: GameState, rng: Rng): string | undefined {
  const p = state.province;
  if (!p || !state.orderHouses) return undefined;
  const housed = new Set(Object.values(state.orderHouses).map((h) => h.dioceseId));
  const free = p.dioceseIds.filter((d) => !housed.has(d)).sort();
  // Every diocese housed: a second house in one of them, as provinces do in their cities.
  return free.length ? rng.pick(free) : p.dioceseIds.length ? rng.pick([...p.dioceseIds].sort()) : undefined;
}

/** The year, when the provincial is another man: a shrinking province closes, a growing one founds. The friar reads it as a letter. */
export function provinceYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const p = state.province;
  if (!r || !p || state.mode.kind !== 'clock' || r.office?.office === 'provincial') return state;
  const title = religiousOrder(r.order).governance.provincialTitle;
  const year = dateOf(state.clock).year;
  if (p.trajectory === 'shrinking' && rng.derive('close').chance(FOUNDATIONS.closeChance)) {
    const house = houseToClose(state);
    if (house && house.id !== r.houseId) {
      const closed = closeHouse(state, house.id, rng.derive('closing'));
      const letter: Letter = { sort: 'provincial', title: `The ${title} closes a house`, body: [closed.line, house.dioceseId === state.world?.diocese.presetId ? 'It is this diocese: the deanery has noticed, and the bishop\'s office has written to ask what the order means by it.' : 'The province is smaller by a door, and the men who lived there are at other tables now.'], week: state.clock.week };
      return { ...closed.state, mode: { kind: 'letter', letter } };
    }
  }
  if (p.trajectory === 'growing' && rng.derive('found').chance(FOUNDATIONS.foundChance)) {
    const did = dioceseToFound(state, rng.derive('where'));
    if (did) {
      const founded = foundHouse(state, did, rng.derive('kind').chance(0.5) ? 'parish' : 'priory', rng.derive('founding'));
      if (founded.line) {
        const letter: Letter = { sort: 'provincial', title: `The ${title} founds a house`, body: [founded.line, `The chapter voted it in ${year}; the men are chosen; the bishop there is glad, or says he is.`], week: state.clock.week };
        return { ...founded.state, mode: { kind: 'letter', letter } };
      }
    }
  }
  return state;
}

/** For a scene's `province` effect: the provincial's own decision, made from the room he is in. */
export function provinceEffect(state: GameState, key: string, value: string | undefined, rng: Rng): GameState {
  if (key === 'close_house') {
    const house = value && state.orderHouses?.[value] ? state.orderHouses[value] : houseToClose(state) ?? Object.values(state.orderHouses ?? {}).filter((h) => h.id !== state.religious?.houseId && h.kind !== 'curia').sort((a, b) => membersOf(state, a).length - membersOf(state, b).length)[0];
    return house ? closeHouse(state, house.id, rng).state : state;
  }
  if (key === 'found_house') {
    const did = value && state.province?.dioceseIds.includes(value) ? value : dioceseToFound(state, rng) ?? currentHouse(state)?.dioceseId;
    return did ? foundHouse(state, did, 'priory', rng).state : state;
  }
  return state;
}
