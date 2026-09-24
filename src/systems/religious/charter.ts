import type { Charter, CharterDial, CharterOptionDef, CharterWork, Foundation, GameState, Npc, ReputationKey } from '@/types';
import { workNeeds } from './founding';
import type { Rng } from '@/engine/rng';
import { charterDials, charterOption, religiousOrder } from '@/content/religious';
import { deliverLetter } from '@/systems/review';
import { foundHouse } from './foundations';
import { moveToHouse, worldOf } from './transfer';
import { foundationSites } from './founding';
import { vacateOffice } from './vacate';

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

export const CHARTER_DIALS: readonly CharterDial[] = ['primaryWork', 'secondaryWork', 'tertiaryWork', 'observance', 'liturgy', 'university', 'formation', 'hospitality', 'poverty', 'sizeTarget', 'governance', 'dress', 'language'] as const;

/** The weight of the second and third works against the first. */
export const WORK_SHARES: Record<'primaryWork' | 'secondaryWork' | 'tertiaryWork', number> = { primaryWork: 1, secondaryWork: 0.5, tertiaryWork: 0.25 };

/**
 * A draft that can be written: every dial the draft holds that this diocese
 * will not allow (a work the order already does there, a university dial with
 * no university) moves to the first option it will, so the charter he is
 * handed opens on something he may sign.
 */
export function settleDraft(state: GameState, draft: Charter, dioceseId: string): Charter {
  let next = { ...draft };
  for (const d of CHARTER_DIALS) {
    if (optionAllowed(state, d, optionIdOf(next, d), dioceseId, next).ok) continue;
    const first = charterDials[d].find((o) => optionAllowed(state, d, o.id, dioceseId, next).ok);
    if (first) next = { ...next, [d]: first.id } as Charter;
  }
  return next;
}

/** The option a charter holds on a dial: the later dials read as their first option when absent. */
export function optionIdOf(charter: Charter, dial: CharterDial): string {
  const v = charter[dial as keyof Charter];
  if (v === undefined || v === null) return charterDials[dial][0]!.id;
  return String(v);
}

/** The works of a charter, first to third, with their shares. */
export function charterWorks(charter: Charter): { work: CharterWork; share: number }[] {
  const out: { work: CharterWork; share: number }[] = [{ work: charter.primaryWork, share: 1 }];
  if (charter.secondaryWork) out.push({ work: charter.secondaryWork, share: WORK_SHARES.secondaryWork });
  if (charter.tertiaryWork) out.push({ work: charter.tertiaryWork, share: WORK_SHARES.tertiaryWork });
  return out;
}

/** The option chosen on each dial. */
export function charterOptions(charter: Charter): Record<CharterDial, CharterOptionDef> {
  const out = {} as Record<CharterDial, CharterOptionDef>;
  for (const d of CHARTER_DIALS) out[d] = charterOption(d, optionIdOf(charter, d));
  return out;
}

/** Whether an option may be written by this man in this diocese, and why not. */
export function optionAllowed(state: GameState, dial: CharterDial, id: string, dioceseId: string, charter?: Charter): { ok: boolean; why?: string } {
  const def = charterOption(dial, id);
  const r = state.religious;
  if (def.orders && r && !def.orders.includes(r.order)) return { ok: false, why: 'Not this order\'s to write.' };
  const world = worldOf(state, dioceseId);
  if (def.needsUniversity && !(world?.diocese.visible.institutions.includes('catholic_university'))) return { ok: false, why: 'No university in the diocese.' };
  if (def.needsLatino && !(world?.parishes.some((p) => p.terrain === 'latino'))) return { ok: false, why: 'No Spanish-speaking parishes in the diocese.' };
  if (dial === 'primaryWork' || dial === 'secondaryWork' || dial === 'tertiaryWork') {
    if (id !== 'none') {
      const need = workNeeds(state, dioceseId)[id as CharterWork];
      if (need?.filled) return { ok: false, why: need.why };
      if (charter) {
        const others = (['primaryWork', 'secondaryWork', 'tertiaryWork'] as const).filter((d) => d !== dial).map((d) => optionIdOf(charter, d));
        if (others.includes(id)) return { ok: false, why: 'Already one of the house\'s works.' };
      }
    }
    if (dial === 'tertiaryWork' && charter && optionIdOf(charter, 'secondaryWork') === 'none' && id !== 'none') return { ok: false, why: 'A third work wants a second first.' };
  }
  return { ok: true };
}

/** What the dials sum to: the vocations multiplier, the observance the house keeps, its cohesion rest, income a year, house reputations a year, and the faction it rubs. */
export function charterFactors(charter: Charter): { vocations: number; observance: number; cohesion: number; income: number; reputations: Partial<Record<ReputationKey, number>>; friction: { observant: number; progressive: number }; daughterAt: number; formsAt?: number; keeps: number } {
  const opts = charterOptions(charter);
  const reputations: Partial<Record<ReputationKey, number>> = {};
  const friction = { observant: 0, progressive: 0 };
  let vocations = 1;
  let cohesion = CHARTER_RULES.cohesion;
  let income = 0;
  let daughterAt = 16;
  let formsAt: number | undefined;
  let keeps = 0;
  for (const d of CHARTER_DIALS) {
    const o = opts[d];
    if (o.id === 'none' && (d === 'secondaryWork' || d === 'tertiaryWork')) continue;
    // The second and third works count at a share of the first.
    const share = d === 'secondaryWork' || d === 'tertiaryWork' ? WORK_SHARES[d] : 1;
    vocations *= 1 + ((o.vocations ?? 1) - 1) * share;
    cohesion += (o.cohesion ?? 0) * share;
    income += (o.income ?? 0) * share;
    if (o.friction && share === 1) friction[o.friction] += 1;
    for (const [k, v] of Object.entries(o.reputations ?? {})) reputations[k as ReputationKey] = (reputations[k as ReputationKey] ?? 0) + (v ?? 0) * share;
    if (o.daughterAt && d === 'primaryWork') daughterAt = o.daughterAt;
    if (o.formsAt !== undefined) formsAt = o.formsAt;
    keeps += o.keeps ?? 0;
  }
  // Size target sets the threshold last; the work only suggests it.
  const size = charterOption('sizeTarget', charter.sizeTarget);
  if (size.daughterAt) daughterAt = Math.round((daughterAt + size.daughterAt) / 2);
  // The house at odds with the province's fault line: friction with whichever side it sits away from.
  return { vocations, observance: charterOption('observance', charter.observance).observance ?? 55, cohesion: Math.round(cohesion), income: Math.round(income), reputations, friction, daughterAt, ...(formsAt !== undefined ? { formsAt } : {}), keeps };
}

/** A man's own reading of a charter: what he would change, from who he is. Deterministic in the man. E3 §9.6–9.7. */
export function readingOf(npc: Npc, charter: Charter): Charter {
  const c = { ...charter };
  const gap = npc.alignment - charter.alignment;
  if (gap > CHARTER_RULES.readingGap) {
    if (c.observance === 'primitive' || c.observance === 'strict') c.observance = 'moderate';
    else if (c.observance === 'moderate' && npc.stats.piety < 45) c.observance = 'mitigated';
    else if (c.observance === 'mitigated' && npc.stats.piety < 40) c.observance = 'relaxed';
    if (c.liturgy === 'order_rite' || c.liturgy === 'chanted') c.liturgy = 'mixed';
    else if (c.liturgy === 'mixed' && gap > 45) c.liturgy = 'vernacular';
    if (c.dress === 'habit_always') c.dress = 'habit_in_house';
    c.alignment = Math.round((charter.alignment + npc.alignment) / 2);
  } else if (gap < -CHARTER_RULES.readingGap) {
    if (c.observance === 'relaxed') c.observance = 'mitigated';
    else if (c.observance === 'mitigated') c.observance = 'moderate';
    else if (c.observance === 'moderate' && npc.stats.piety >= 55) c.observance = 'strict';
    if (c.liturgy === 'vernacular' || c.liturgy === 'polyphony') c.liturgy = 'mixed';
    else if (c.liturgy === 'mixed' && gap < -45) c.liturgy = 'chanted';
    if (c.dress === 'clerics') c.dress = 'habit_in_house';
    c.alignment = Math.round((charter.alignment + npc.alignment) / 2);
  }
  if (npc.stats.administration >= 65 && c.sizeTarget === 'small') c.sizeTarget = 'large';
  return c;
}

/** The dials that differ between two charters. */
export function charterDiff(a: Charter, b: Charter): { dial: CharterDial; from: string; to: string }[] {
  return CHARTER_DIALS.filter((d) => optionIdOf(a, d) !== optionIdOf(b, d)).map((d) => ({ dial: d, from: optionIdOf(a, d), to: optionIdOf(b, d) }));
}

export function dialLabel(dial: CharterDial): string {
  return { observance: 'Observance', liturgy: 'Liturgy', primaryWork: 'Primary work', secondaryWork: 'Second work', tertiaryWork: 'Third work', university: 'The university', poverty: 'Poverty', sizeTarget: 'Size', formation: 'Formation', hospitality: 'Hospitality', governance: 'Governance', dress: 'Dress', language: 'Language' }[dial];
}

/** The charter as flags, for the scenes: `charter:<dial>:<option>`, the old ones cleared. */
export function charterFlags(flags: GameState['flags'], charter: Charter): GameState['flags'] {
  const out = { ...flags };
  for (const k of Object.keys(out)) if (k.startsWith('charter:')) delete out[k];
  for (const d of CHARTER_DIALS) out[`charter:${d}:${optionIdOf(charter, d)}`] = true;
  return out;
}

/** The founder writes the charter: the house is erected on it, the men are sent, and he goes as its prior. E3 §9.4. */
export function writeCharter(state: GameState, charter: Charter, rng: Rng): GameState {
  const r = state.religious;
  const pet = r?.petition;
  const p = state.province;
  if (!r || !pet || pet.outcome !== 'approved' || !p) return state;
  for (const d of CHARTER_DIALS) if (!optionAllowed(state, d, optionIdOf(charter, d), pet.dioceseId, charter).ok) return state;
  const week = state.clock.week;
  const factors = charterFactors(charter);
  const work = charterOption('primaryWork', charter.primaryWork);
  const kind = work.houseKind ?? 'priory';
  const site = foundationSites(state).find((s) => s.dioceseId === pet.dioceseId);
  const cost = site?.cost ?? 600_000;
  const works = [...charterWorks(charter).map((w) => w.work), ...(charter.university !== 'none' && !charterWorks(charter).some((w) => w.work === 'chaplaincy') ? ['chaplaincy'] : [])];
  const founded = foundHouse({ ...state, province: { ...p, finances: { ...p.finances, balance: p.finances.balance - cost } } }, pet.dioceseId, kind, rng.derive('found'), { priorId: 'player', size: CHARTER_RULES.size, observance: factors.observance, alignment: charter.alignment, works, budget: Math.round(cost * 0.15) });
  if (!founded.line) {
    // The province could not, after all, find the men: the approval lapses, and the idea stays filed.
    const { charterDraft: _d, ...rest } = r;
    return { ...state, religious: { ...rest, petition: { ...pet, outcome: 'lapsed', decidedWeek: week, line: 'The men could not be found after all.' }, foundationLine: 'When it came to naming the men, the priors would not give them up, and the provincial let it lapse. The idea stays filed.' }, flags: { ...state.flags, 'foundation:refused_week': week }, mode: { kind: 'clock' } };
  }
  const houseId = Object.keys(founded.state.orderHouses ?? {}).find((id) => !(state.orderHouses ?? {})[id])!;
  const house = founded.state.orderHouses![houseId]!;
  // A man who governs elsewhere lays that down to be the founder's prior here.
  const freed = r.office ? vacateOffice(founded.state, 'to found a house') : founded.state;
  let next = moveToHouse({ ...freed, mode: { kind: 'clock' } }, houseId, kind === 'parish' ? 'parish' : kind === 'school' ? 'school' : kind === 'mission' ? 'mission' : 'priory_church');
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
  if (!r || !f || !house || optionIdOf(f.charter, dial) === to) return state;
  if (!charterDials[dial].some((o) => o.id === to)) return state;
  if (!optionAllowed(state, dial, to, f.dioceseId, f.charter).ok) return state;
  const charter = { ...f.charter } as Charter;
  if ((dial === 'secondaryWork' || dial === 'tertiaryWork') && to === 'none') delete charter[dial];
  else (charter as unknown as Record<string, string>)[dial] = to;
  // A third work cannot stand without a second.
  if (dial === 'secondaryWork' && to === 'none') delete charter.tertiaryWork;
  const factors = charterFactors(charter);
  const revised: Foundation = { ...f, charter, revisions: [...f.revisions, { week: state.clock.week, by, dial, from: optionIdOf(f.charter, dial), to }] };
  const mine = !f.daughterOf;
  const works = [...new Set([...house.works.filter((w) => !charterWorks(f.charter).some((x) => x.work === w) || charterWorks(charter).some((x) => x.work === w)), ...charterWorks(charter).map((w) => w.work)])];
  return { ...state, religious: { ...r, foundations: r.foundations!.map((x) => (x.houseId === houseId ? revised : x)) }, orderHouses: { ...state.orderHouses, [houseId]: { ...house, observance: factors.observance, works } }, flags: mine ? charterFlags(state.flags, charter) : state.flags };
}
