import type { Foundation, GameState, Letter, Npc, ReputationKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { charterOption, foundationWorkDefs, religiousOrder } from '@/content/religious';
import { friar } from '@/generation/province';
import { deliverLetter } from '@/systems/review';
import { charterDiff, charterFactors, readingOf, reviseCharter, dialLabel } from './charter';
import { closeHouse, foundHouse } from './foundations';
import { bishopWarmth, foundationSites } from './founding';
import { membersOf } from './house';
import { topReputations } from './reputations';
import { worldOf } from './transfer';

/**
 * A foundation over the years: vocations arrive on the house's character
 * and the founder's name; the men take vows; works are added; the house
 * builds reputations of its own; the money comes in and goes out; the
 * province recalls men in a shortage and a hostile bishop or an empty
 * choir can kill it; a successor revises the charter; a house grown large
 * sends out a daughter under an heir. E3 §9.5–9.7. Tunables are invented.
 */
export const FOUNDATION_YEAR = {
  /** Vocations a year at the middle of every dial, before the founder and the place. */
  baseVocations: 0.55,
  /** A house of formation forms its own; otherwise the novice goes to the novitiate and counts as the house's. */
  formsAt: 8,
  /** Years from novice to simple vows, and to solemn. */
  simpleAfter: 1,
  solemnAfter: 5,
  /** What a man costs the house a year, against the works' income. */
  costPerMan: 28_000,
  /** House reputations: fade a year when unfed, and the founder's own reputations feed the house's while he is prior. */
  fade: 2,
  founderShare: 0.06,
  /** Failure a year: base, and the terms that raise it; the young house is more exposed. */
  fail: { base: 0.02, thin: 0.14, hostileBishop: 0.1, broke: 0.1, recalled: 0.06, youngFactor: 1.6, youngYears: 5 },
  /** The province recalls a man from the house in a shortage. */
  recallChance: 0.18,
  /** A successor revises a dial a year, when his reading differs. */
  reviseChance: 0.3,
  /** Houses alive under the founder's line before the cluster is a vicariate. */
  vicariateAt: 4,
  /** Men sent out with a daughter house. */
  daughterSize: [4, 6] as [number, number],
} as const;

export function foundationOf(state: GameState, houseId: string): Foundation | undefined {
  return state.religious?.foundations?.find((f) => f.houseId === houseId);
}

/** The house the player founded and is prior of now, if any. */
export function myFoundation(state: GameState): Foundation | undefined {
  const r = state.religious;
  return r?.foundations?.find((f) => f.status === 'alive' && r.office?.office === 'prior' && r.office.bodyId === f.houseId);
}

function setFoundation(state: GameState, f: Foundation): GameState {
  const r = state.religious!;
  return { ...state, religious: { ...r, foundations: (r.foundations ?? []).map((x) => (x.houseId === f.houseId ? f : x)) } };
}

/** The vocations a house draws a year: the charter, the works, the place, the founder's name, and the house's own. */
export function expectedVocations(state: GameState, f: Foundation): number {
  const factors = charterFactors(f.charter);
  const site = foundationSites(state).find((s) => s.dioceseId === f.dioceseId);
  const climate = 0.6 + ((site?.climate ?? 50) / 100) * 0.8;
  const works = f.works.reduce((v, id) => v + (foundationWorkDefs.find((w) => w.id === id)?.vocations ?? 0), 0);
  const houseName = Math.max(0, ...Object.values(f.reputations).map((v) => v ?? 0)) / 150;
  const founder = state.religious?.office?.office === 'prior' && state.religious.office.bodyId === f.houseId ? topReputations(state).slice(0, 2).reduce((a, r) => a + r.value, 0) / 400 : 0;
  return FOUNDATION_YEAR.baseVocations * factors.vocations * climate * (1 + works) * (1 + houseName + founder);
}

/** Heirs: solemnly professed men of the house who came to the order through it. */
export function heirsOf(state: GameState, f: Foundation): Npc[] {
  const house = state.orderHouses?.[f.houseId];
  if (!house) return [];
  return membersOf(state, house).filter((m) => f.vocationIds.includes(m.id) && m.tags.includes('vows:solemn') && !m.tags.includes('prior')).sort((a, b) => a.id.localeCompare(b.id));
}

/** Whether the house can send out a daughter, and why not. E3 §9.6. */
export function canSendDaughter(state: GameState, f: Foundation): { ok: boolean; why?: string } {
  const house = state.orderHouses?.[f.houseId];
  if (!house || f.status !== 'alive') return { ok: false, why: 'The house is closed.' };
  const n = membersOf(state, house).length + (state.religious?.houseId === f.houseId ? 1 : 0);
  const at = charterFactors(f.charter).daughterAt;
  if (n < at) return { ok: false, why: `${at} men before a daughter house can go out; the house has ${n}.` };
  if (!heirsOf(state, f).length) return { ok: false, why: 'No man formed here is yet in solemn vows to lead it.' };
  if (!(state.religious?.office?.office === 'prior' && state.religious.office.bodyId === f.houseId)) return { ok: false, why: 'Only the prior sends men out.' };
  return { ok: true };
}

/** Add a work to the house: the men, the money, and what it does from then on. E3 §9.5. */
export function addFoundationWork(state: GameState, houseId: string, workId: string): GameState {
  const f = foundationOf(state, houseId);
  const def = foundationWorkDefs.find((w) => w.id === workId);
  const house = state.orderHouses?.[houseId];
  if (!f || !def || !house || f.works.includes(workId) || f.status !== 'alive') return state;
  const men = membersOf(state, house).length + 1;
  if (men < def.men || f.budget < def.cost) return state;
  if (def.needsUniversity && !worldOf(state, f.dioceseId)?.diocese.visible.institutions.includes('catholic_university')) return state;
  const next = setFoundation(state, { ...f, works: [...f.works, workId], budget: f.budget - def.cost });
  return { ...next, orderHouses: { ...next.orderHouses, [houseId]: { ...house, works: [...house.works, workId] } }, flags: { ...next.flags, [`foundation:work:${workId}`]: state.clock.week }, career: [...next.career, { week: state.clock.week, kind: 'note', text: `${house.name} opened ${def.label.toLowerCase()}.` }] };
}

/** Send out a daughter house under an heir: it inherits his reading of the charter, not yours. E3 §9.6. */
export function sendDaughter(state: GameState, houseId: string, heirId: string, dioceseId: string, rng: Rng): { state: GameState; line: string } {
  const f = foundationOf(state, houseId);
  const heir = state.npcs[heirId];
  if (!f || !heir || !canSendDaughter(state, f).ok || !heirsOf(state, f).some((h) => h.id === heirId)) return { state, line: '' };
  const charter = { ...readingOf(heir, f.charter), writtenWeek: state.clock.week };
  const factors = charterFactors(charter);
  const kind = charterOption('primaryWork', charter.primaryWork).houseKind ?? 'priory';
  const founded = foundHouse(state, dioceseId, kind, rng, { priorId: heirId, fromHouseId: houseId, size: FOUNDATION_YEAR.daughterSize, observance: factors.observance, alignment: charter.alignment, works: [charter.primaryWork], budget: Math.round(f.budget * 0.3) });
  if (!founded.line) return { state, line: '' };
  const newId = Object.keys(founded.state.orderHouses ?? {}).find((id) => !(state.orderHouses ?? {})[id])!;
  const daughter: Foundation = { houseId: newId, dioceseId, foundedWeek: state.clock.week, charter, daughterOf: houseId, heirId, vocationIds: [], works: [], reputations: {}, budget: Math.round(f.budget * 0.3), status: 'alive', revisions: [] };
  const diff = charterDiff(f.charter, charter);
  let next = setFoundation(founded.state, { ...f, budget: f.budget - Math.round(f.budget * 0.3) });
  next = { ...next, religious: { ...next.religious!, foundations: [...(next.religious!.foundations ?? []), daughter] }, flags: { ...next.flags, 'foundation:daughter': state.clock.week, [`foundation:daughters`]: Number(next.flags['foundation:daughters'] ?? 0) + 1 } };
  const line = `${founded.line} ${heir.title} ${heir.name.last} leads it${diff.length ? `, and reads the charter his own way: ${diff.map((d) => `${dialLabel(d.dial).toLowerCase()} ${d.to.replace(/_/g, ' ')}`).join(', ')}` : ', and has taken the charter with him word for word'}.`;
  return { state: { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: line }] }, line };
}

function advanceVows(state: GameState, f: Foundation): GameState {
  const npcs = { ...state.npcs };
  const week = state.clock.week;
  let changed = false;
  for (const id of f.vocationIds) {
    const n = npcs[id];
    if (!n || n.status !== 'active') continue;
    const entered = Number(n.tags.find((t) => t.startsWith('entered:'))?.slice('entered:'.length) ?? week);
    const years = (week - entered) / 52;
    if (n.tags.includes('vows:novice') && years >= FOUNDATION_YEAR.simpleAfter) { npcs[id] = { ...n, tags: n.tags.map((t) => (t === 'vows:novice' ? 'vows:simple' : t)) }; changed = true; }
    else if (n.tags.includes('vows:simple') && years >= FOUNDATION_YEAR.solemnAfter) { npcs[id] = { ...n, title: n.tags.includes('lay_brother') ? 'Br.' : 'Fr.', tags: n.tags.map((t) => (t === 'vows:simple' ? 'vows:solemn' : t)) }; changed = true; }
  }
  return changed ? { ...state, npcs } : state;
}

/** One foundation's year. */
function foundationYearOne(state: GameState, f0: Foundation, rng: Rng): { state: GameState; lines: string[] } {
  const r = state.religious!;
  const p = state.province!;
  const house = state.orderHouses?.[f0.houseId];
  if (!house || f0.status !== 'alive') return { state, lines: [] };
  const week = state.clock.week;
  const order = religiousOrder(r.order);
  const year = 2010 + Math.floor(week / 52);
  const lines: string[] = [];
  let f = f0;
  let next = advanceVows(state, f);
  const iAmPrior = r.office?.office === 'prior' && r.office.bodyId === f.houseId;
  const factors = charterFactors(f.charter);
  // Vocations.
  const expected = expectedVocations(next, f);
  const count = Math.floor(expected) + (rng.derive('vocation').chance(expected - Math.floor(expected)) ? 1 : 0);
  if (count > 0) {
    const forms = membersOf(next, house).length >= (factors.formsAt ?? FOUNDATION_YEAR.formsAt) || f.works.includes('novitiate');
    const novitiate = Object.values(next.orderHouses ?? {}).find((h) => h.kind === 'novitiate' && h.provinceId === p.id);
    const target = forms || !novitiate ? house : novitiate;
    const npcs = { ...next.npcs };
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const n = friar(rng.derive(`vocation:${i}`), order, { id: f.houseId, alignment: f.charter.alignment, kind: house.kind }, year, `${week}_${i}`, 'novice', 0);
      const npc: Npc = { ...n, relationship: n.relationship + 15, tags: n.tags.filter((t) => !t.startsWith('house:')).concat(`house:${target.id}`, `vocation_of:${f.houseId}`, `entered:${week}`) };
      npcs[npc.id] = npc;
      ids.push(npc.id);
    }
    const houses = { ...next.orderHouses!, [target.id]: { ...next.orderHouses![target.id]!, memberIds: [...next.orderHouses![target.id]!.memberIds, ...ids] } };
    next = { ...next, npcs, orderHouses: houses, province: { ...next.province!, friarIds: [...next.province!.friarIds, ...ids] } };
    f = { ...f, vocationIds: [...f.vocationIds, ...ids] };
    lines.push(`${count === 1 ? 'A man' : `${count} men`} entered through ${house.name} this year${forms ? ', and the house forms them' : ', and went to the novitiate'}.`);
  }
  // Men who came through the novitiate come home once professed.
  const npcs2 = { ...next.npcs };
  const houses2 = { ...next.orderHouses! };
  for (const id of f.vocationIds) {
    const n = npcs2[id];
    if (!n || n.status !== 'active' || !n.tags.includes('vows:simple')) continue;
    const at = n.tags.find((t) => t.startsWith('house:'))?.slice('house:'.length);
    if (at && at !== f.houseId && houses2[at]?.kind === 'novitiate') {
      npcs2[id] = { ...n, tags: n.tags.filter((t) => !t.startsWith('house:')).concat(`house:${f.houseId}`) };
      houses2[at] = { ...houses2[at]!, memberIds: houses2[at]!.memberIds.filter((x) => x !== id) };
      houses2[f.houseId] = { ...houses2[f.houseId]!, memberIds: [...houses2[f.houseId]!.memberIds, id] };
    }
  }
  next = { ...next, npcs: npcs2, orderHouses: houses2 };
  // Reputations of the house: the charter's, the works', and the founder's while he is prior; the rest fades.
  const reps: Partial<Record<ReputationKey, number>> = { ...f.reputations };
  const fed = new Set<ReputationKey>();
  for (const [k, v] of Object.entries(factors.reputations)) { reps[k as ReputationKey] = Math.min(100, (reps[k as ReputationKey] ?? 0) + (v ?? 0)); fed.add(k as ReputationKey); }
  for (const id of f.works) for (const [k, v] of Object.entries(foundationWorkDefs.find((w) => w.id === id)?.reputations ?? {})) { reps[k as ReputationKey] = Math.min(100, (reps[k as ReputationKey] ?? 0) + (v ?? 0)); fed.add(k as ReputationKey); }
  if (iAmPrior) for (const { key, value } of topReputations(next).slice(0, 2)) { reps[key] = Math.min(100, (reps[key] ?? 0) + value * FOUNDATION_YEAR.founderShare); fed.add(key); }
  for (const k of Object.keys(reps) as ReputationKey[]) if (!fed.has(k)) reps[k] = Math.max(0, (reps[k] ?? 0) - FOUNDATION_YEAR.fade);
  // Money.
  const members = membersOf(next, houses2[f.houseId]!).length + (r.houseId === f.houseId ? 1 : 0);
  const income = factors.income + f.works.reduce((v, id) => v + (foundationWorkDefs.find((w) => w.id === id)?.income ?? 0), 0);
  const budget = Math.round(f.budget + income - members * FOUNDATION_YEAR.costPerMan);
  f = { ...f, reputations: reps, budget };
  // The province recalls a man in a shortage.
  let recalled = false;
  if (p.trajectory === 'shrinking' && members > 3 && rng.derive('recall').chance(FOUNDATION_YEAR.recallChance)) {
    const h = houses2[f.houseId]!;
    const pool = membersOf(next, h).filter((m) => m.tags.includes('vows:solemn') && !m.tags.includes('prior')).sort((a, b) => a.id.localeCompare(b.id));
    const curia = Object.values(houses2).find((x) => x.id === p.curiaHouseId) ?? Object.values(houses2).find((x) => x.id !== f.houseId);
    if (pool.length && curia) {
      const gone = rng.derive('who').pick(pool);
      const npcs3 = { ...next.npcs, [gone.id]: { ...gone, tags: gone.tags.filter((t) => !t.startsWith('house:')).concat(`house:${curia.id}`) } };
      houses2[f.houseId] = { ...h, memberIds: h.memberIds.filter((x) => x !== gone.id) };
      houses2[curia.id] = { ...curia, memberIds: [...curia.memberIds, gone.id] };
      next = { ...next, npcs: npcs3, orderHouses: houses2 };
      recalled = true;
      lines.push(`The province, short everywhere, recalled ${gone.title} ${gone.name.last} from ${house.name}.`);
    }
  }
  // Friction with the province's fault line: the side the house sits away from dislikes it, and the house's cohesion rests lower for it.
  const lean = p.factions.progressive - p.factions.observant;
  const rubs = (factors.friction.progressive > 0 && lean > 10) || (factors.friction.observant > 0 && lean < -10);
  // Failure: an empty choir, a hostile bishop, no money, and the young house most of all.
  const warmth = bishopWarmth(next, f.dioceseId);
  const young = (week - f.foundedWeek) / 52 < FOUNDATION_YEAR.fail.youngYears;
  let risk = FOUNDATION_YEAR.fail.base;
  if (members < 4) risk += FOUNDATION_YEAR.fail.thin;
  if (warmth <= -20) risk += FOUNDATION_YEAR.fail.hostileBishop;
  if (budget < -FOUNDATION_YEAR.costPerMan * 2) risk += FOUNDATION_YEAR.fail.broke;
  if (recalled) risk += FOUNDATION_YEAR.fail.recalled;
  if (young) risk *= FOUNDATION_YEAR.fail.youngFactor;
  if (rng.derive('fail').chance(risk)) {
    const why = members < 4 ? 'the vocations never came and the men were needed elsewhere' : warmth <= -20 ? 'the bishop who invited the order was replaced by one who resents it, and he found the means' : budget < 0 ? 'the money ran out' : 'the province could not hold it';
    const closed = closeHouse(next, f.houseId, rng.derive('close'));
    const failed: Foundation = { ...f, status: 'failed', failedWeek: week, failedWhy: why };
    let out = setFoundation(closed.state, failed);
    out = { ...out, flags: { ...out.flags, 'foundation:failed': week, ...(iAmPrior ? { 'foundation:failed:mine': week } : {}) } };
    if (iAmPrior) { const { office: _o, ...rest } = out.religious!; out = { ...out, religious: { ...rest, termsServed: [...rest.termsServed, { office: 'prior', startWeek: r.office!.startWeek, endWeek: week }] } }; }
    const letter: Letter = { sort: 'provincial', title: `${house.name} is closed`, body: [`${house.name}, founded ${Math.round((week - f.foundedWeek) / 52)} year${Math.round((week - f.foundedWeek) / 52) === 1 ? '' : 's'} ago, is closed: ${why}. ${closed.line}`, iAmPrior ? 'You are to be assigned by the year\'s consultation like anyone else. The charter is in the province archive, where things go that did not happen.' : 'You read it in the provincial\'s letter, two paragraphs, the second about something else.'], week };
    return { state: deliverLetter(out, letter), lines: [`${house.name} is closed: ${why}.`] };
  }
  // A successor revises the charter, when his reading differs; the founder's is kept when it does not.
  const prior = next.npcs[houses2[f.houseId]!.priorId];
  // A charter the chapter voted, or one written to be kept, stays a successor's hand a little.
  if (!iAmPrior && prior && rng.derive('revise').chance(Math.max(0.02, FOUNDATION_YEAR.reviseChance - factors.keeps))) {
    const reading = readingOf(prior, f.charter);
    const diff = charterDiff(f.charter, reading);
    if (diff.length) {
      const d = diff[0]!;
      next = setFoundation(next, f);
      next = reviseCharter(next, f.houseId, d.dial, d.to, prior.id);
      f = foundationOf(next, f.houseId)!;
      next = { ...next, flags: { ...next.flags, 'foundation:revised': week, [`foundation:revised:${d.dial}`]: week } };
      lines.push(`At ${house.name}, ${prior.title} ${prior.name.last} has changed the charter: ${dialLabel(d.dial).toLowerCase()}, ${d.from.replace(/_/g, ' ')} to ${d.to.replace(/_/g, ' ')}.`);
    } else if (!next.flags['foundation:kept']) {
      next = { ...next, flags: { ...next.flags, 'foundation:kept': week } };
    }
  }
  if (rubs && !iAmPrior) next = { ...next, flags: { ...next.flags, 'foundation:rubs': week } };
  next = setFoundation(next, f);
  const cohesionRest = factors.cohesion - (rubs ? 6 : 0);
  const h = next.orderHouses![f.houseId]!;
  next = { ...next, orderHouses: { ...next.orderHouses, [f.houseId]: { ...h, cohesion: Math.round(h.cohesion + (cohesionRest - h.cohesion) * 0.2) } } };
  return { state: next, lines };
}

/** Every foundation of the founder's line, a year. The lines go to the founder as a letter when something happened. */
export function foundationsYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r?.foundations?.length || !state.province) return state;
  let next = state;
  const lines: string[] = [];
  for (const f of r.foundations) {
    const res = foundationYearOne(next, foundationOf(next, f.houseId) ?? f, rng.derive(`foundation:${f.houseId}`));
    next = res.state;
    lines.push(...res.lines);
  }
  const week = next.clock.week;
  const alive = (next.religious?.foundations ?? []).filter((f) => f.status === 'alive');
  const mine = alive.find((f) => !f.daughterOf);
  if (mine) {
    const y = Math.floor((week - mine.foundedWeek) / 52);
    next = { ...next, flags: { ...next.flags, 'foundation:years': y, 'foundation:prior': r.office?.office === 'prior' && r.office.bodyId === mine.houseId ? week : false, ...(y >= 5 ? { 'foundation:years:5': true } : {}), ...(y >= 10 ? { 'foundation:years:10': true } : {}), ...(y >= 20 ? { 'foundation:years:20': true } : {}), ...(mine.vocationIds.length ? { 'foundation:first_vocation': true } : {}) } };
  }
  if (alive.length >= FOUNDATION_YEAR.vicariateAt && !next.flags.vicariate) {
    next = { ...next, flags: { ...next.flags, vicariate: week }, career: [...next.career, { week, kind: 'promotion', text: `The houses of your line are erected as a vicariate of the province.` }] };
    next = deliverLetter(next, { sort: 'provincial', title: 'A vicariate', body: [`${alive.length} houses stand in your line: the one you founded and the ones your men founded from it. The chapter has erected them as a vicariate, with a vicar of their own and a seat at the province's table. Rome has been told.`, 'It took forty years and it will outlive you, which was the point.'], week });
  }
  if (lines.length && !alive.some((f) => r.office?.office === 'prior' && r.office.bodyId === f.houseId)) {
    next = deliverLetter(next, { sort: 'provincial', title: 'News of the houses', body: lines, week });
  } else if (lines.length) {
    next = { ...next, religious: { ...next.religious!, foundationLine: lines.join(' ') } };
  }
  return next;
}
