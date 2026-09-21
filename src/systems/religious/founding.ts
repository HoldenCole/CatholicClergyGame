import type { CharterWork, FoundationPetition, FoundationSite, GameState, Letter } from '@/types';
import { instituteDefs } from '@/content/institutes';
import type { Rng } from '@/engine/rng';
import { religiousOrder, needLines } from '@/content/religious';
import { deliverLetter } from '@/systems/review';
import { membersOf } from './house';
import { worldOf } from './transfer';
import { reputationFit, topReputations } from './reputations';

/**
 * Starting a house: where, and whether the two keys turn. E3 §9.1–9.3.
 * The browser reads every diocese of the territory from the generated
 * world; the petition is scored by the province (fit, standing, ambition,
 * seniority, men to spare, money, and above all the need) and gated by the
 * bishop's written consent, which a succession mid-process can kill.
 * Failure is normal, especially early; a refused petition establishes the
 * idea and the second try scores higher. Tunables are invented.
 */
export const FOUNDING = {
  /** Weeks the province and the bishop take to answer. */
  answerWeeks: 14,
  /** Years before a refused petition may be tried again. */
  retryYears: 3,
  /** Men the province must be able to spare beyond the founder. */
  spare: 3,
  /** What the petition itself does to how ambitious he looks, and how far reputations that carry it soften that. */
  ambition: { petition: 8, carried: 3, asked: 0, declined: -2 },
  /** Cost of a foundation by the diocese's size. */
  cost: { small: 350_000, medium: 550_000, large: 800_000, huge: 1_100_000 } as Record<string, number>,
  /** The bishop's consent: below this warmth he does not sign. */
  bishopConsentAt: -5,
  /** The province's vote passes at this score, softened by the need; the roll around it is what makes early tries fail. */
  passAt: 0.55,
  needWeight: 0.09,
  /** Reputation fit to a work that counts as carrying the petition. */
  carriedAt: 45,
  /** How the charter's work reads against §8's works, for the fit. */
  fitWork: { preaching: 'preaching', teaching: 'teaching', study: 'formation', parish: 'parish', evangelization: 'mission', poor_relief: 'mission', retreats: 'formation', chaplaincy: 'parish', media: 'teaching' } as Record<CharterWork, string>,
  /** A standing invitation a year: chance in a diocese of need three or more with a warm bishop; and how long it stands. */
  inviteChance: 0.1,
  inviteYears: 4,
  /** The provincial asks the man himself when his reputations fit a need, a year. */
  askedChance: 0.12,
} as const;

/** The player's men to spare: solemnly professed, not priors, in houses that are not the novitiate or the studium. */
export function spareMen(state: GameState): number {
  return Object.values(state.orderHouses ?? {})
    .filter((h) => h.kind !== 'novitiate' && h.kind !== 'studium')
    .reduce((n, h) => n + membersOf(state, h).filter((m) => m.tags.includes('vows:solemn') && !m.tags.includes('prior')).length, 0);
}

/** The bishop's warmth toward the order in a diocese, −100..100: the file when he knows the man, the diocese's temper when he does not. */
export function bishopWarmth(state: GameState, dioceseId: string): number {
  const world = worldOf(state, dioceseId);
  if (!world) return 0;
  const r = state.religious;
  const here = state.world?.diocese.presetId === dioceseId;
  const known = here ? state.character?.reputation.local_bishop : r?.dioceseFile?.[dioceseId]?.bishopId === world.diocese.hidden.bishop.npcId ? r.dioceseFile[dioceseId]?.local_bishop : undefined;
  const v = world.diocese.visible;
  const order = r ? religiousOrder(r.order) : undefined;
  const provinceLean = state.province ? (state.province.factions.progressive - state.province.factions.observant) : 0;
  let warmth = known !== undefined ? known * 0.6 : 0;
  warmth -= Math.abs(v.disposition - provinceLean) / 4;
  if (v.bishop.priorities.includes('vocations')) warmth += 8;
  if (v.bishop.priorities.includes('evangelization')) warmth += 4;
  if (v.clergyNeed === 'critically_short') warmth += 12;
  else if (v.clergyNeed === 'stretched') warmth += 6;
  const ours = order ? (v.houses ?? []).filter((h) => h.order === order.houseOrderId).length : 0;
  warmth += ours >= 2 ? 6 : ours === 1 ? 3 : -3;
  if (state.flags[`house_closed:${dioceseId}`]) warmth -= 10;
  return Math.max(-100, Math.min(100, Math.round(warmth)));
}

/** Every diocese of the territory as a place to found, read from the generated worlds. E3 §9.2. */
export function foundationSites(state: GameState): FoundationSite[] {
  const p = state.province;
  const r = state.religious;
  if (!p || !r) return [];
  const order = religiousOrder(r.order);
  const week = state.clock.week;
  const out: FoundationSite[] = [];
  for (const did of p.dioceseIds) {
    const world = worldOf(state, did);
    if (!world) continue;
    const v = world.diocese.visible;
    const ours = Object.values(state.orderHouses ?? {}).filter((h) => h.dioceseId === did).length;
    const university = v.institutions.includes('catholic_university');
    const invitedAt = Number(state.flags[`foundation:invited:${did}`] ?? 0);
    const invited = invitedAt > 0 && week - invitedAt < FOUNDING.inviteYears * 52;
    let need = v.clergyNeed === 'critically_short' ? 3 : v.clergyNeed === 'stretched' ? 2 : v.clergyNeed === 'adequate' ? 1 : 0;
    if (university && ours === 0) need += 1;
    if (invited) need += 1;
    if (v.bishop.priorities.includes('vocations') || v.bishop.priorities.includes('evangelization')) need += 0.5;
    if (ours >= 2) need -= 1;
    if (state.flags[`parish_handed_back:${did}`]) need += 1;
    need = Math.max(1, Math.min(5, Math.round(need)));
    const thin = (world.institutes ?? []).some((i) => i.defId === order.instituteId);
    const presence = ours >= 2 ? 'strong' : ours === 1 ? 'present' : thin ? 'thin' : 'none';
    const gens = world.parishes.map((x) => (x.generational === 'young' ? 80 : x.generational === 'mixed' ? 50 : 25));
    const climate = gens.length ? Math.round(gens.reduce((a, b) => a + b, 0) / gens.length) : 50;
    const others = (v.houses ?? []).filter((h) => h.order !== order.houseOrderId).length;
    const bishop = bishopWarmth(state, did);
    const lines = [needLines[String(need)] ?? '', invited ? 'The bishop has asked the province for a house here, in writing.' : bishop >= 20 ? 'The bishop is warm to the order.' : bishop <= -20 ? 'The bishop has no use for religious, or for this order in particular.' : 'The bishop would hear a proposal.'];
    out.push({ dioceseId: did, name: v.name, see: v.see, region: v.region, need, invited, bishop, presence, university, climate, cost: FOUNDING.cost[v.size] ?? 600_000, others, lines });
  }
  return out.sort((a, b) => a.region.localeCompare(b.region) || a.see.localeCompare(b.see));
}

/** Whether the man may petition now, and why not. */
export function canPetition(state: GameState): { ok: boolean; why?: string } {
  const r = state.religious;
  if (!r || !state.flags.ordained) return { ok: false, why: 'Not yet ordained.' };
  if (r.vows.solemnWeek === undefined) return { ok: false, why: 'Not yet in solemn vows.' };
  if (r.petition && !r.petition.outcome) return { ok: false, why: 'A petition stands.' };
  if (r.charterDraft) return { ok: false, why: 'The charter is being written.' };
  if ((r.foundations ?? []).some((f) => f.status === 'alive' && r.office?.office === 'prior' && r.office.bodyId === f.houseId)) return { ok: false, why: 'You are prior of the house you founded; a second goes out from it, as a daughter house.' };
  const refused = Number(state.flags['foundation:refused_week'] ?? -1e9);
  if (state.clock.week - refused < FOUNDING.retryYears * 52) return { ok: false, why: `Refused within ${FOUNDING.retryYears} years; the chapter will not hear it again yet.` };
  return { ok: true };
}

/** Propose a foundation at chapter: a place, a work, and the ambition it shows. E3 §9.1. */
export function petitionFoundation(state: GameState, dioceseId: string, work: CharterWork): GameState {
  const r = state.religious;
  const world = worldOf(state, dioceseId);
  if (!r || !world || !canPetition(state).ok) return state;
  // A work the order already does here is not a foundation the chapter will hear.
  if (workNeeds(state, dioceseId)[work]?.filled) return state;
  const carried = reputationFit(state, FOUNDING.fitWork[work]) >= FOUNDING.carriedAt;
  const petition: FoundationPetition = { kind: 'petition', dioceseId, work, week: state.clock.week, bishopId: world.diocese.hidden.bishop.npcId };
  const ambition = Math.max(0, Math.min(100, r.perceivedAmbition + (carried ? FOUNDING.ambition.carried : FOUNDING.ambition.petition)));
  return {
    ...state,
    religious: { ...r, petition, petitionsMade: (r.petitionsMade ?? 0) + 1, perceivedAmbition: ambition, foundationLine: `The petition is on the chapter's table: a house in ${world.diocese.visible.name}, for ${workLabel(work)}. ${carried ? 'Your reputations carry it; the chapter reads it as a need, not a wish.' : 'The chapter reads it as ambition, whatever it is.'}` },
    flags: { ...state.flags, 'foundation:petitioned': state.clock.week, [`foundation:idea:${dioceseId}`]: state.clock.week },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Petitioned the chapter for a foundation in ${world.diocese.visible.name}.` }],
  };
}

/** The provincial asked him to lead a foundation; he takes it up or declines, and declining is remembered. */
export function answerFoundationAsk(state: GameState, accept: boolean): GameState {
  const r = state.religious;
  const pet = r?.petition;
  if (!r || !pet || pet.kind !== 'asked' || pet.outcome) return state;
  if (accept) return { ...state, religious: { ...r, foundationLine: 'You said yes. The provincial has the bishop\'s letter in hand already; the men are being chosen.' } };
  const c = state.character;
  return {
    ...state,
    religious: { ...r, petition: { ...pet, outcome: 'declined', decidedWeek: state.clock.week, line: 'Declined.' }, perceivedAmbition: Math.max(0, r.perceivedAmbition + FOUNDING.ambition.declined), foundationLine: 'You said no. The provincial thanked you and asked someone else, and the province wrote it down.' },
    character: c ? { ...c, reputation: { ...c.reputation, province: (c.reputation.province ?? 0) - 4 } } : c,
    flags: { ...state.flags, 'foundation:declined_ask': state.clock.week },
  };
}

export function workLabel(work: CharterWork): string {
  return ({ preaching: 'preaching', teaching: 'teaching', study: 'a house of studies', parish: 'a parish', evangelization: 'evangelization', poor_relief: 'the poor', retreats: 'retreats', chaplaincy: 'chaplaincies', media: 'the press' } as Record<CharterWork, string>)[work];
}

/** The province's score for a petition, 0..1, before the roll. Exposed for the sheet's honest reading and the tests. */
export function provinceScore(state: GameState, pet: Pick<FoundationPetition, 'dioceseId' | 'work' | 'kind'>): number {
  const r = state.religious;
  const p = state.province;
  const c = state.character;
  if (!r || !p || !c) return 0;
  const site = foundationSites(state).find((s) => s.dioceseId === pet.dioceseId);
  const fit = reputationFit(state, FOUNDING.fitWork[pet.work]) / 100;
  const standing = ((c.reputation.province ?? 0) + 100) / 200;
  const humility = 1 - r.perceivedAmbition / 100;
  const seniority = Math.min(1, Math.max(0, (state.clock.week - (r.vows.solemnWeek ?? state.clock.week)) / (52 * 20)));
  const spare = spareMen(state);
  const canSpare = spare >= FOUNDING.spare + 2 ? 1 : spare >= FOUNDING.spare ? 0.5 : 0;
  const cost = site?.cost ?? 600_000;
  const money = p.finances.retirementBurden > p.finances.balance ? 0 : p.finances.balance >= cost ? 1 : p.finances.balance >= cost / 2 ? 0.5 : 0.2;
  let score = 0.25 * fit + 0.2 * standing + 0.15 * humility + 0.1 * seniority + 0.15 * canSpare + 0.15 * money;
  score += ((site?.need ?? 3) - 3) * FOUNDING.needWeight;
  score += p.trajectory === 'shrinking' ? -0.15 : p.trajectory === 'growing' ? 0.08 : 0;
  if (pet.kind === 'asked') score += 0.25;
  // The second try in the same place, after a refusal: the idea is established.
  if (pet.kind === 'petition' && Number(state.flags[`foundation:refused:${pet.dioceseId}`] ?? 0) > 0) score += 0.08;
  return Math.max(0, Math.min(1, score));
}

/** The weeks pass and the answer comes: two keys, in order. E3 §9.3. */
export function foundingWeek(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const pet = r?.petition;
  if (!r || !pet || pet.outcome || state.mode.kind !== 'clock') return state;
  const week = state.clock.week;
  if (week - pet.week < FOUNDING.answerWeeks) return state;
  const world = worldOf(state, pet.dioceseId);
  const name = world?.diocese.visible.name ?? 'the diocese';
  const title = religiousOrder(r.order).governance.provincialTitle;
  const c = state.character;
  const decide = (outcome: NonNullable<FoundationPetition['outcome']>, line: string, body: string[], rep: number, flags: Record<string, number>): GameState => {
    const letter: Letter = { sort: 'provincial', title: outcome === 'approved' ? `The ${title} writes: the foundation is approved` : `The ${title} writes: the foundation is refused`, body, week };
    let next: GameState = { ...state, religious: { ...r, petition: { ...pet, outcome, decidedWeek: week, line }, foundationLine: line }, flags: { ...state.flags, ...flags }, career: [...state.career, { week, kind: 'note', text: line }] };
    if (c && rep) next = { ...next, character: { ...c, reputation: { ...c.reputation, province: (c.reputation.province ?? 0) + rep } } };
    return deliverLetter(next, letter);
  };
  // The first key: the province must send men.
  const score = provinceScore(state, pet);
  const pass = rng.derive(`province:${pet.week}`).chance(Math.max(0.05, Math.min(0.95, (score - FOUNDING.passAt) * 2.2 + 0.5)));
  if (!pass) {
    const why = spareMen(state) < FOUNDING.spare ? 'it has no men to send' : (state.province?.finances.retirementBurden ?? 0) > (state.province?.finances.balance ?? 0) ? 'it is in retirement debt and can fund nothing' : score < 0.4 ? 'the chapter read it as ambition' : 'the vote was close and went the other way';
    return decide('province_refused', `The province refused the foundation in ${name}: ${why}.`, [`The chapter took up your petition for a house in ${name} and did not pass it: ${why}. The ${title} writes that the idea is not dead, that ${name} is on the province's map now because you put it there, and that a second petition in three years with a better location would be read differently.`, 'It is not wasted. It is filed.'], pet.kind === 'petition' ? -2 : 0, { 'foundation:refused_week': week, [`foundation:refused:${pet.dioceseId}`]: week });
  }
  // The second key: the bishop must consent in writing, and a succession mid-process kills it.
  const succession = world && world.diocese.hidden.bishop.npcId !== pet.bishopId;
  const warmth = bishopWarmth(state, pet.dioceseId);
  if (succession && warmth < 20) {
    return decide('bishop_refused', `The foundation in ${name} died with the old bishop: his successor will not sign.`, [`The province voted for the house in ${name}. Then the see changed hands, and the new bishop, who did not ask for friars and has his own plans for his priests, declined to sign the decree of erection. Canon law is clear that he need not, and he did not.`, `The ${title} is sorry, and means it, and has already turned to the next thing.`], 0, { 'foundation:refused_week': week, [`foundation:refused:${pet.dioceseId}`]: week, 'foundation:bishop_refused': week });
  }
  if (warmth < FOUNDING.bishopConsentAt) {
    return decide('bishop_refused', `The bishop of ${name} would not consent to the foundation.`, [`The province said yes. The bishop of ${name} said no, in a letter of two paragraphs that thanked the order for its history in the region and regretted that the diocese's circumstances did not allow a new house at this time. Without his consent no house can be erected, and everyone in the room knew it before the vote.`, `The ${title} suggests, drily, that the next petition name a diocese whose bishop likes friars.`], 0, { 'foundation:refused_week': week, [`foundation:refused:${pet.dioceseId}`]: week, 'foundation:bishop_refused': week });
  }
  const next = decide('approved', `The foundation in ${name} is approved: the province sends men, and the bishop has signed.`, [`Both keys turned. The chapter voted the house in ${name}, ${spareMen(state)} men can be spared, and the bishop's consent came by return of post with a line about how long he has hoped for this. The ${title} asks you to write the charter: what the house is to be, under the order's charism, and the men will be chosen against it.`, 'Write it carefully. It will be read by men who never met you.'], 4, { 'foundation:approved': week });
  return { ...next, religious: { ...next.religious!, charterDraft: { observance: 'moderate', liturgy: 'mixed', primaryWork: pet.work, university: 'none', alignment: state.character?.alignment ?? 0, poverty: 'moderate', sizeTarget: 'small', writtenWeek: week } }, mode: { kind: 'charter' } };
}

/** The year: bishops of need write standing invitations, and the provincial may ask the man himself. E3 §9.1. */
export function foundingYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const p = state.province;
  if (!r || !p || !state.flags.ordained) return state;
  const week = state.clock.week;
  let next = state;
  const sites = foundationSites(state);
  const flags = { ...state.flags };
  for (const s of sites) {
    if (!s.invited && s.need >= 3 && s.bishop >= 10 && rng.derive(`invite:${s.dioceseId}:${week}`).chance(FOUNDING.inviteChance)) flags[`foundation:invited:${s.dioceseId}`] = week;
  }
  next = { ...next, flags };
  // The provincial asks: a need his reputations fit, and a man the province trusts.
  const asked = !r.petition || r.petition.outcome;
  const scene = state.flags['foundation:asked'];
  if (asked && !r.charterDraft && canPetition(next).ok && r.office?.office !== 'provincial') {
    const best = sites.filter((s) => s.need >= 3 && s.bishop >= FOUNDING.bishopConsentAt).sort((a, b) => b.need - a.need || a.dioceseId.localeCompare(b.dioceseId))[0];
    const top = topReputations(state)[0];
    const work = top ? bestWorkFor(top.key) : 'preaching';
    const trusted = (state.character?.reputation.province ?? 0) >= 15 && reputationFit(state, FOUNDING.fitWork[work]) >= FOUNDING.carriedAt;
    if (best && (scene || (trusted && rng.derive(`asked:${week}`).chance(FOUNDING.askedChance)))) {
      const world = worldOf(next, best.dioceseId);
      const title = religiousOrder(r.order).governance.provincialTitle;
      const petition: FoundationPetition = { kind: 'asked', dioceseId: best.dioceseId, work, week, bishopId: world?.diocese.hidden.bishop.npcId ?? '' };
      const { 'foundation:asked': _a, ...rest } = next.flags;
      next = { ...next, flags: rest, religious: { ...next.religious!, petition, foundationLine: `The ${title} has asked you to lead a foundation in ${best.name}, for ${workLabel(work)}. It comes with the province's backing already; the bishop's letter is being sought. Say yes on the foundation sheet, or say no and be remembered for it.` } };
      next = deliverLetter(next, { sort: 'provincial', title: `The ${title} asks you to found a house`, body: [`${best.name} needs a house and the province has decided it can send one. The ${title} writes that he has thought about who should lead it and has not thought about anyone else. ${best.lines[0]}`, 'This is the better path: the province is already behind it. The answer is yours, and so is the house.'], week });
    }
  }
  return next;
}

function bestWorkFor(key: string): CharterWork {
  const map: Record<string, CharterWork> = { preacher: 'preaching', professor: 'teaching', evangelist: 'evangelization', advocate: 'poor_relief', spiritual_director: 'retreats', man_of_prayer: 'retreats', confessor: 'parish', pastor_of_dying: 'parish', liturgist: 'preaching', builder: 'parish', confidant: 'teaching' };
  return map[key] ?? 'preaching';
}

/** The works a house could be founded for, each with its need here (0..3) and whether a house of the order, or another's, already fills it. E3 §9.4. */
export interface WorkNeed {
  need: number;
  filled: boolean;
  why: string;
}

export const CHARTER_WORKS: readonly CharterWork[] = ['preaching', 'teaching', 'study', 'parish', 'evangelization', 'poor_relief', 'retreats', 'chaplaincy', 'media'] as const;

export function workNeeds(state: GameState, dioceseId: string): Record<CharterWork, WorkNeed> {
  const world = worldOf(state, dioceseId);
  const r = state.religious;
  const out = {} as Record<CharterWork, WorkNeed>;
  const order = r ? religiousOrder(r.order) : undefined;
  const ours = Object.values(state.orderHouses ?? {}).filter((h) => h.dioceseId === dioceseId);
  const ourWorks = new Set(ours.flatMap((h) => h.works));
  const ourKinds = new Set(ours.map((h) => h.kind));
  const studium = Object.values(state.orderHouses ?? {}).some((h) => h.kind === 'studium');
  const v = world?.diocese.visible;
  const institutions = v?.institutions ?? [];
  const others = (v?.houses ?? []).filter((h) => !order || h.order !== order.houseOrderId);
  const otherWorks = new Set(others.flatMap((h) => (h.instituteId ? instituteDefs.find((d) => d.id === (world?.institutes ?? []).find((i) => i.id === h.instituteId)?.defId)?.works ?? [] : [])));
  const instituteWorks = new Set((world?.institutes ?? []).filter((i) => !order || i.defId !== order.instituteId).flatMap((i) => i.works));
  const short = v?.clergyNeed === 'critically_short' ? 3 : v?.clergyNeed === 'stretched' ? 2 : v?.clergyNeed === 'adequate' ? 1 : 0;
  const parishes = world?.parishes ?? [];
  const poor = parishes.length ? parishes.filter((p) => p.wealth <= 2).length / parishes.length : 0;
  const young = parishes.length ? parishes.filter((p) => p.generational === 'young').length / parishes.length : 0;
  const latino = parishes.some((p) => p.terrain === 'latino');
  const clamp = (n: number) => Math.max(0, Math.min(3, Math.round(n)));
  const filledBy = (label: string) => `${label} already does it here.`;
  out.preaching = ourWorks.has('preaching') || ourWorks.has('priory_church') ? { need: 0, filled: true, why: filledBy(`A house of the ${order?.short ?? 'order'}`) } : { need: clamp(1 + short * 0.5 + (others.filter((h) => h.charism === 'active').length ? -0.5 : 0.5)), filled: false, why: '' };
  out.teaching = ourKinds.has('school') || ourWorks.has('teaching') || ourWorks.has('school') ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s school`) } : { need: clamp((institutions.includes('school_network') ? 1.5 : 0.5) + (institutions.includes('catholic_university') ? 1 : 0) + (instituteWorks.has('high_school') || otherWorks.has('high_school') ? -1 : 0.5)), filled: false, why: '' };
  out.study = studium ? { need: 0, filled: true, why: 'The province has its house of studies already.' } : { need: clamp(1 + (institutions.includes('major_seminary') || institutions.includes('catholic_university') ? 1 : 0)), filled: false, why: '' };
  out.parish = { need: clamp(short + (state.flags[`parish_handed_back:${dioceseId}`] ? 1 : 0) - (ourKinds.has('parish') ? 1 : 0)), filled: false, why: '' };
  out.evangelization = ourKinds.has('mission') || ourWorks.has('mission') || ourWorks.has('evangelization') ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s mission house`) } : { need: clamp(1 + young * 2 + (institutions.includes('catholic_university') && !ourWorks.has('chaplaincy') ? 1 : 0) + (latino ? 0.5 : 0)), filled: false, why: '' };
  out.poor_relief = ourWorks.has('poor_relief') || ourWorks.has('shelter') ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s shelter`) } : { need: clamp(0.5 + poor * 3 - (instituteWorks.has('shelter') || instituteWorks.has('clinic') || institutions.includes('catholic_charities') ? 0.5 : 0)), filled: false, why: '' };
  out.retreats = ourWorks.has('retreats') || ourWorks.has('retreat_program') ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s retreat house`) } : { need: clamp(1.5 - (instituteWorks.has('retreat_house') || instituteWorks.has('monastery') ? 1 : 0) + (v?.size === 'large' || v?.size === 'huge' ? 0.5 : 0)), filled: false, why: '' };
  out.chaplaincy = ourWorks.has('chaplaincy') && ours.some((h) => h.works.includes('hospital')) ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s chaplains`) } : { need: clamp(0.5 + (institutions.includes('hospital_system') ? 1.5 : 0.5) + short * 0.3 - (instituteWorks.has('hospital') ? 0.5 : 0)), filled: false, why: '' };
  out.media = ourWorks.has('media') || ourWorks.has('press') ? { need: 0, filled: true, why: filledBy(`The ${order?.short ?? 'order'}'s press`) } : { need: clamp(0.5 + (institutions.includes('diocesan_media') ? -0.5 : 1) + (v?.size === 'huge' ? 1 : v?.size === 'large' ? 0.5 : 0)), filled: false, why: '' };
  return out;
}

/** The works most needed here: the top need, and any within one of it. */
export function mostNeededWorks(state: GameState, dioceseId: string): CharterWork[] {
  const needs = workNeeds(state, dioceseId);
  const top = Math.max(...CHARTER_WORKS.map((w) => (needs[w].filled ? 0 : needs[w].need)));
  if (top <= 0) return [];
  return CHARTER_WORKS.filter((w) => !needs[w].filled && needs[w].need >= top);
}
