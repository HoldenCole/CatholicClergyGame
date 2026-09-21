import type { Charter, CharterDial, CharterOptionDef, Foundation, GameState, Npc, ReputationKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { charterDials, charterOption, religiousOrder } from '@/content/religious';
import { deliverLetter } from '@/systems/review';
import { foundHouse } from './foundations';
import { moveToHouse, worldOf } from './transfer';
import { foundationSites } from './founding';

/**
 * The founding charter: the design layer. E3 §9.4. The charism is the
 * order's; the dials are the founder's; every consequence of a dial is
 * data in content/religious/foundations.json, summed here. A successor's
 * own reading of the charter is derived from the man, so a daughter house
 * under a stricter heir becomes, in thirty years, a different place.
 */
export const CHARTER_RULES = {
  /** Men the province sends with the founder. */
  size: [3, 5] as [number, number],
  /** Observance the house opens at, by the dial, and cohesion at the start. */
  cohesion: 62,
  /** How far an NPC's alignment must sit from the charter's before his reading differs. */
  readingGap: 25,
} as const;

export const CHARTER_DIALS: readonly CharterDial[] = ['observance', 'liturgy', 'primaryWork', 'university', 'poverty', 'sizeTarget'] as const;

/** The option chosen on each dial. */
export function charterOptions(charter: Charter): Record<CharterDial, CharterOptionDef> {
  return { observance: charterOption('observance', charter.observance), liturgy: charterOption('liturgy', charter.liturgy), primaryWork: charterOption('primaryWork', charter.primaryWork), university: charterOption('university', charter.university), poverty: charterOption('poverty', charter.poverty), sizeTarget: charterOption('sizeTarget', charter.sizeTarget) };
}

/** Whether an option may be written by this man in this diocese, and why not. */
export function optionAllowed(state: GameState, dial: CharterDial, id: string, dioceseId: string): { ok: boolean; why?: string } {
  const def = charterOption(dial, id);
  const r = state.religious;
  if (def.orders && r && !def.orders.includes(r.order)) return { ok: false, why: 'Not this order\'s to write.' };
  if (def.needsUniversity && !(worldOf(state, dioceseId)?.diocese.visible.institutions.includes('catholic_university'))) return { ok: false, why: 'No university in the diocese.' };
  return { ok: true };
}

/** What the dials sum to: the vocations multiplier, the observance the house keeps, its cohesion rest, income a year, house reputations a year, and the faction it rubs. */
export function charterFactors(charter: Charter): { vocations: number; observance: number; cohesion: number; income: number; reputations: Partial<Record<ReputationKey, number>>; friction: { observant: number; progressive: number }; daughterAt: number } {
  const opts = Object.values(charterOptions(charter));
  const reputations: Partial<Record<ReputationKey, number>> = {};
  const friction = { observant: 0, progressive: 0 };
  let vocations = 1;
  let cohesion = CHARTER_RULES.cohesion;
  let income = 0;
  let daughterAt = 16;
  for (const o of opts) {
    vocations *= o.vocations ?? 1;
    cohesion += o.cohesion ?? 0;
    income += o.income ?? 0;
    if (o.friction) friction[o.friction] += 1;
    for (const [k, v] of Object.entries(o.reputations ?? {})) reputations[k as ReputationKey] = (reputations[k as ReputationKey] ?? 0) + (v ?? 0);
    if (o.daughterAt) daughterAt = o.daughterAt;
  }
  // Size target sets the threshold last; the work only suggests it.
  const size = charterOption('sizeTarget', charter.sizeTarget);
  if (size.daughterAt) daughterAt = Math.round((daughterAt + size.daughterAt) / 2);
  // The house at odds with the province's fault line: friction with whichever side it sits away from.
  return { vocations, observance: charterOption('observance', charter.observance).observance ?? 55, cohesion, income, reputations, friction, daughterAt };
}

/** A man's own reading of a charter: what he would change, from who he is. Deterministic in the man. E3 §9.6–9.7. */
export function readingOf(npc: Npc, charter: Charter): Charter {
  const c = { ...charter };
  const gap = npc.alignment - charter.alignment;
  if (gap > CHARTER_RULES.readingGap) {
    if (c.observance === 'strict') c.observance = 'moderate';
    else if (c.observance === 'moderate' && npc.stats.piety < 45) c.observance = 'relaxed';
    if (c.liturgy === 'order_rite' || c.liturgy === 'chanted') c.liturgy = 'mixed';
    else if (c.liturgy === 'mixed' && gap > 45) c.liturgy = 'vernacular';
    c.alignment = Math.round((charter.alignment + npc.alignment) / 2);
  } else if (gap < -CHARTER_RULES.readingGap) {
    if (c.observance === 'relaxed') c.observance = 'moderate';
    else if (c.observance === 'moderate' && npc.stats.piety >= 55) c.observance = 'strict';
    if (c.liturgy === 'vernacular') c.liturgy = 'mixed';
    else if (c.liturgy === 'mixed' && gap < -45) c.liturgy = 'chanted';
    c.alignment = Math.round((charter.alignment + npc.alignment) / 2);
  }
  if (npc.stats.administration >= 65 && c.sizeTarget === 'small') c.sizeTarget = 'large';
  return c;
}

/** The dials that differ between two charters. */
export function charterDiff(a: Charter, b: Charter): { dial: CharterDial; from: string; to: string }[] {
  return CHARTER_DIALS.filter((d) => a[d] !== b[d]).map((d) => ({ dial: d, from: String(a[d]), to: String(b[d]) }));
}

export function dialLabel(dial: CharterDial): string {
  return { observance: 'Observance', liturgy: 'Liturgy', primaryWork: 'Primary work', university: 'The university', poverty: 'Poverty', sizeTarget: 'Size' }[dial];
}

/** The charter as flags, for the scenes: `charter:<dial>:<option>`, the old ones cleared. */
export function charterFlags(flags: GameState['flags'], charter: Charter): GameState['flags'] {
  const out = { ...flags };
  for (const k of Object.keys(out)) if (k.startsWith('charter:')) delete out[k];
  for (const d of CHARTER_DIALS) out[`charter:${d}:${String(charter[d])}`] = true;
  return out;
}

/** The founder writes the charter: the house is erected on it, the men are sent, and he goes as its prior. E3 §9.4. */
export function writeCharter(state: GameState, charter: Charter, rng: Rng): GameState {
  const r = state.religious;
  const pet = r?.petition;
  const p = state.province;
  if (!r || !pet || pet.outcome !== 'approved' || !p) return state;
  for (const d of CHARTER_DIALS) if (!optionAllowed(state, d, String(charter[d]), pet.dioceseId).ok) return state;
  const week = state.clock.week;
  const factors = charterFactors(charter);
  const work = charterOption('primaryWork', charter.primaryWork);
  const kind = work.houseKind ?? 'priory';
  const site = foundationSites(state).find((s) => s.dioceseId === pet.dioceseId);
  const cost = site?.cost ?? 600_000;
  const works = [charter.primaryWork, ...(charter.university !== 'none' ? ['chaplaincy'] : [])];
  const founded = foundHouse({ ...state, province: { ...p, finances: { ...p.finances, balance: p.finances.balance - cost } } }, pet.dioceseId, kind, rng.derive('found'), { priorId: 'player', size: CHARTER_RULES.size, observance: factors.observance, alignment: charter.alignment, works, budget: Math.round(cost * 0.15) });
  if (!founded.line) {
    // The province could not, after all, find the men: the approval lapses, and the idea stays filed.
    const { charterDraft: _d, ...rest } = r;
    return { ...state, religious: { ...rest, petition: { ...pet, outcome: 'lapsed', decidedWeek: week, line: 'The men could not be found after all.' }, foundationLine: 'When it came to naming the men, the priors would not give them up, and the provincial let it lapse. The idea stays filed.' }, flags: { ...state.flags, 'foundation:refused_week': week }, mode: { kind: 'clock' } };
  }
  const houseId = Object.keys(founded.state.orderHouses ?? {}).find((id) => !(state.orderHouses ?? {})[id])!;
  const house = founded.state.orderHouses![houseId]!;
  let next = moveToHouse({ ...founded.state, mode: { kind: 'clock' } }, houseId, kind === 'parish' ? 'parish' : kind === 'school' ? 'school' : kind === 'mission' ? 'mission' : 'priory_church');
  const order = religiousOrder(r.order);
  const years = order.governance.priorTermYears;
  const foundation: Foundation = { houseId, dioceseId: pet.dioceseId, foundedWeek: week, charter: { ...charter, writtenWeek: week }, vocationIds: [], works: [], reputations: {}, budget: house.budget, status: 'alive', revisions: [] };
  const { charterDraft: _draft, ...rest } = next.religious!;
  const c = next.character;
  next = {
    ...next,
    religious: { ...rest, foundations: [...(r.foundations ?? []), foundation], office: { office: 'prior', bodyId: houseId, startWeek: week, endWeek: week + years * 52, consecutive: 1 }, foundationLine: `${house.name} is erected. You are its first prior; the charter is written; the men are at the door.` },
    orderHouses: { ...next.orderHouses!, [houseId]: { ...house, cohesion: factors.cohesion } },
    flags: { ...charterFlags(next.flags, charter), 'foundation:founded': week, founder: week, 'foundation:prior': week, [`chapter:house:${houseId}`]: week, 'office:prior': week },
    career: [...next.career, { week, kind: 'promotion', text: `Founded ${house.name} in ${worldOf(next, pet.dioceseId)?.diocese.visible.name ?? 'the diocese'}, and became its first prior.` }],
  };
  if (c) next = { ...next, character: { ...c, reputation: { ...c.reputation, province: (c.reputation.province ?? 0) + 3 } } };
  return deliverLetter(next, { sort: 'provincial', title: `${house.name}: the decree of erection`, body: [founded.line, `The charter is read at the first chapter of the house: ${charterOption('observance', charter.observance).label.toLowerCase()} observance, ${charterOption('liturgy', charter.liturgy).label.toLowerCase()}, for ${work.label.toLowerCase()}. ${work.line}`, 'What the house becomes is now a matter of years.'], week });
}

/** Revise one dial of a foundation's charter, by the founder or a successor, and remember it. E3 §9.7. */
export function reviseCharter(state: GameState, houseId: string, dial: CharterDial, to: string, by: string): GameState {
  const r = state.religious;
  const f = r?.foundations?.find((x) => x.houseId === houseId);
  const house = state.orderHouses?.[houseId];
  if (!r || !f || !house || String(f.charter[dial]) === to) return state;
  if (!charterDials[dial].some((o) => o.id === to)) return state;
  const charter = { ...f.charter, [dial]: to } as Charter;
  const factors = charterFactors(charter);
  const revised: Foundation = { ...f, charter, revisions: [...f.revisions, { week: state.clock.week, by, dial, from: String(f.charter[dial]), to }] };
  const mine = !f.daughterOf;
  return { ...state, religious: { ...r, foundations: r.foundations!.map((x) => (x.houseId === houseId ? revised : x)) }, orderHouses: { ...state.orderHouses, [houseId]: { ...house, observance: factors.observance } }, flags: mine ? charterFlags(state.flags, charter) : state.flags };
}
