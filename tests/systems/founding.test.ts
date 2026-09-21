import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { applyEffects } from '@/engine/effects';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import type { Charter, GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { membersOf } from '@/systems/religious/house';
import { worldOf } from '@/systems/religious/transfer';
import { answerFoundationAsk, bishopWarmth, canPetition, foundationSites, foundingWeek, foundingYear, petitionFoundation, provinceScore, FOUNDING } from '@/systems/religious/founding';
import { charterFactors, charterWorks, readingOf, writeCharter, reviseCharter, optionAllowed, optionIdOf, CHARTER_DIALS } from '@/systems/religious/charter';
import { charterDials } from '@/content/religious';
import { reputationFit } from '@/systems/religious/reputations';
import { mostNeededWorks, workNeeds, CHARTER_WORKS } from '@/systems/religious/founding';
import { canSendDaughter, expectedVocations, foundationsYear, heirsOf, myFoundation, sendDaughter, addFoundationWork } from '@/systems/religious/foundationYear';

function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === 'priory') ?? gen.houses.find((h) => h.kind !== 'novitiate' && h.kind !== 'studium') ?? gen.houses[0]!).id;
  const base = seminaryState(seed);
  const c = testCharacter({ reputation: { ...base.character!.reputation, local_bishop: 20, province: 40 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 8 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 }, perceivedAmbition: 20, reputations: { preacher: 60, evangelist: 50 } } };
}

/** A territory diocese other than the one he is in, with a bishop made warm or cold through the file. */
function elsewhere(s: GameState, warm: boolean): { state: GameState; did: string } {
  const did = s.province!.dioceseIds.find((d) => d !== s.world!.diocese.presetId)!;
  const world = worldOf(s, did)!;
  const file = { ...(s.religious!.dioceseFile ?? {}), [did]: { local_bishop: warm ? 80 : -90, laity: 0, bishopId: world.diocese.hidden.bishop.npcId, leftWeek: 0 } };
  return { state: { ...s, religious: { ...s.religious!, dioceseFile: file } }, did };
}

function rich(s: GameState): GameState {
  return { ...s, province: { ...s.province!, trajectory: 'growing', finances: { balance: 5_000_000, retirementBurden: 0.1 } } };
}

function answered(s: GameState, seed = 'w'): GameState {
  return foundingWeek({ ...s, clock: { ...s.clock, week: s.clock.week + FOUNDING.answerWeeks } }, createRng(seed));
}

const CHARTER = (patch: Partial<Charter> = {}): Charter => ({ observance: 'strict', liturgy: 'chanted', primaryWork: 'evangelization', university: 'none', alignment: -40, poverty: 'moderate', sizeTarget: 'large', writtenWeek: 0, ...patch });

/** A work the order does not already do in that diocese: the one asked for when open, else the first open. */
function openWork(s: GameState, did: string, want: Charter['primaryWork'] = 'evangelization'): Charter['primaryWork'] {
  const needs = workNeeds(s, did);
  return needs[want].filled ? CHARTER_WORKS.find((w) => !needs[w].filled)! : want;
}

function founded(seed: string, charter: Partial<Charter> = {}): { state: GameState; did: string } {
  const { state: s, did } = elsewhere(rich(friar(seed)), true);
  const work = openWork(s, did, charter.primaryWork ?? 'evangelization');
  const pet = petitionFoundation(s, did, work);
  let next = answered(pet, `${seed}:ok`);
  expect(next.religious!.petition!.outcome).toBe('approved');
  next = writeCharter(next, CHARTER({ ...charter, primaryWork: work }), createRng(`${seed}:charter`));
  return { state: next, did };
}

function years(s: GameState, n: number, seed: string): GameState {
  let next = s;
  for (let i = 0; i < n; i++) next = foundationsYear({ ...next, clock: { ...next.clock, week: next.clock.week + 52 } }, createRng(`${seed}:${i}`));
  return next;
}

describe('foundations: where, whether, and the charter (E3 §9.1–9.4)', () => {
  it('reads every diocese of the territory as a site, with a need of one to five, sorted by state and city, deterministically', () => {
    const s = friar('sites');
    const sites = foundationSites(s);
    expect(sites.map((x) => x.dioceseId).sort()).toEqual([...s.province!.dioceseIds].sort());
    for (const x of sites) {
      expect(x.need).toBeGreaterThanOrEqual(1);
      expect(x.need).toBeLessThanOrEqual(5);
      expect(x.climate).toBeGreaterThanOrEqual(0);
      expect(x.cost).toBeGreaterThan(0);
      expect(['none', 'thin', 'present', 'strong']).toContain(x.presence);
    }
    expect(foundationSites(s)).toEqual(sites);
    const keys = sites.map((x) => `${x.region}|${x.see}`);
    expect(keys).toEqual([...keys].sort());
    // A standing invitation raises the need, and the file makes the bishop warm or cold.
    const invited = { ...s, flags: { ...s.flags, [`foundation:invited:${sites[0]!.dioceseId}`]: s.clock.week } };
    expect(foundationSites(invited)[0]!.need).toBeGreaterThanOrEqual(sites[0]!.need);
    expect(bishopWarmth(elsewhere(s, true).state, elsewhere(s, true).did)).toBeGreaterThan(bishopWarmth(elsewhere(s, false).state, elsewhere(s, false).did));
  });

  it('the petition takes both keys: the province votes on the need and the man, the bishop signs or does not, and a refusal files the idea', () => {
    const base = rich(friar('keys'));
    expect(canPetition(base).ok).toBe(true);
    expect(canPetition({ ...base, religious: { ...base.religious!, vows: { renewals: [] } } }).ok).toBe(false);
    // Warm bishop, rich province, reputations that fit: approved, and the charter is asked for.
    const warm = elsewhere(base, true);
    const pet = petitionFoundation(warm.state, warm.did, openWork(warm.state, warm.did, 'preaching'));
    expect(pet.religious!.petition?.kind).toBe('petition');
    const carried = reputationFit(pet, FOUNDING.fitWork[pet.religious!.petition!.work]) >= FOUNDING.carriedAt;
    expect(pet.religious!.perceivedAmbition).toBe(base.religious!.perceivedAmbition + (carried ? FOUNDING.ambition.carried : FOUNDING.ambition.petition));
    expect(provinceScore(pet, pet.religious!.petition!)).toBeGreaterThan(0.6);
    expect(foundingWeek(pet, createRng('early')).religious!.petition!.outcome).toBeUndefined();
    const yes = answered(pet, 'k1');
    expect(yes.religious!.petition!.outcome).toBe('approved');
    expect(yes.mode.kind).toBe('charter');
    expect(yes.religious!.charterDraft?.primaryWork).toBe(pet.religious!.petition!.work);
    expect(yes.letters?.at(-1)?.title).toContain('approved');
    // The same petition, same seed, answers the same way.
    expect(answered(pet, 'k1').religious!.petition).toEqual(yes.religious!.petition);
    // A cold bishop is a hard gate whatever the province thinks.
    const cold = elsewhere(base, false);
    const no = answered(petitionFoundation(cold.state, cold.did, openWork(cold.state, cold.did, 'preaching')), 'k1');
    expect(no.religious!.petition!.outcome).toBe('bishop_refused');
    expect(no.flags['foundation:refused_week']).toBe(no.clock.week);
    expect(canPetition(no).ok).toBe(false);
    // A province in retirement debt refuses almost everything.
    const broke = { ...warm.state, province: { ...warm.state.province!, trajectory: 'shrinking' as const, finances: { balance: 10_000, retirementBurden: 50 } }, character: { ...warm.state.character!, reputation: { ...warm.state.character!.reputation, province: -40 } }, religious: { ...warm.state.religious!, perceivedAmbition: 90, reputations: {} } };
    const refused = answered(petitionFoundation(broke, warm.did, openWork(broke, warm.did, 'retreats')), 'k2');
    expect(refused.religious!.petition!.outcome).toBe('province_refused');
    expect(refused.flags[`foundation:refused:${warm.did}`]).toBeDefined();
    // The second try in the same place scores higher than the first did.
    const again = { ...refused, clock: { ...refused.clock, week: refused.clock.week + FOUNDING.retryYears * 52 + 1 } };
    expect(provinceScore(again, { dioceseId: warm.did, work: 'retreats', kind: 'petition' })).toBeGreaterThan(provinceScore(broke, { dioceseId: warm.did, work: 'retreats', kind: 'petition' }));
    // A succession mid-process kills it.
    const changed = { ...pet, religious: { ...pet.religious!, petition: { ...pet.religious!.petition!, bishopId: 'someone_else' } }, character: { ...pet.character!, reputation: { ...pet.character!.reputation } } };
    const died = answered({ ...changed, religious: { ...changed.religious, dioceseFile: {} } }, 'k1');
    expect(died.religious!.petition!.outcome).toBe('bishop_refused');
    expect(died.flags['foundation:bishop_refused']).toBeDefined();
  });

  it('the provincial can ask the man himself, and the scene flag brings it; declining is remembered', () => {
    const s = rich(friar('asked'));
    const scene = { ...s, flags: { ...s.flags, 'foundation:asked': true } };
    // Make one diocese needy and warm so the ask has somewhere to go.
    const { state: warm, did } = elsewhere(scene, true);
    const invited = { ...warm, flags: { ...warm.flags, [`foundation:invited:${did}`]: warm.clock.week } };
    const year = foundingYear(invited, createRng('y'));
    expect(year.religious!.petition?.kind).toBe('asked');
    expect(year.flags['foundation:asked']).toBeUndefined();
    expect(year.letters?.at(-1)?.title).toContain('asks you to found');
    const no = year;
    const answeredNo = answerFoundationAsk(no, false);
    expect(answeredNo.religious!.petition!.outcome).toBe('declined');
    expect(answeredNo.character!.reputation.province).toBe((no.character!.reputation.province ?? 0) - 4);
    // Asked, the province's score is higher than a petition's for the same place.
    expect(provinceScore(year, year.religious!.petition!)).toBeGreaterThan(provinceScore(year, { ...year.religious!.petition!, kind: 'petition' }));
  });

  it('the charter sums its dials, refuses what the order or the diocese cannot write, and a man reads it his own way', () => {
    const strict = charterFactors(CHARTER());
    const loose = charterFactors(CHARTER({ observance: 'relaxed', liturgy: 'vernacular', primaryWork: 'study', sizeTarget: 'small' }));
    expect(strict.vocations).toBeGreaterThan(loose.vocations * 2);
    expect(strict.observance).toBeGreaterThan(loose.observance);
    expect(strict.friction.progressive).toBeGreaterThan(0);
    expect(loose.friction.observant).toBeGreaterThan(0);
    expect(strict.reputations.liturgist).toBeGreaterThan(0);
    expect(loose.reputations.professor).toBeGreaterThan(0);
    const osa = friar('osa', 'OSA');
    expect(optionAllowed(osa, 'liturgy', 'order_rite', osa.world!.diocese.presetId).ok).toBe(false);
    expect(optionAllowed(friar('op'), 'liturgy', 'order_rite', friar('op').world!.diocese.presetId).ok).toBe(true);
    const npc = Object.values(osa.npcs).find((n) => n.role === 'religious')!;
    const looser = { ...npc, alignment: 60, stats: { ...npc.stats, piety: 30 } };
    const read = readingOf(looser, CHARTER());
    expect(read.observance).not.toBe('strict');
    expect(read.liturgy).toBe('mixed');
    const same = { ...npc, alignment: -40 };
    expect(readingOf(same, CHARTER()).observance).toBe('strict');
  });

  it('a work another house already does here is greyed, the most needed are named, and the second and third works count at a share', () => {
    const { state: s, did } = elsewhere(rich(friar('needs')), true);
    const needs = workNeeds(s, did);
    for (const w of CHARTER_WORKS) {
      expect(needs[w].need).toBeGreaterThanOrEqual(0);
      expect(needs[w].need).toBeLessThanOrEqual(3);
      if (needs[w].filled) expect(needs[w].why.length).toBeGreaterThan(0);
    }
    // The province has a studium: a house of studies is filled, and greyed.
    expect(needs.study.filled).toBe(true);
    expect(optionAllowed(s, 'primaryWork', 'study', did).ok).toBe(false);
    const most = mostNeededWorks(s, did);
    expect(most.length).toBeGreaterThan(0);
    for (const w of most) expect(needs[w].filled).toBe(false);
    expect(Math.max(...most.map((w) => needs[w].need))).toBe(Math.max(...CHARTER_WORKS.filter((w) => !needs[w].filled).map((w) => needs[w].need)));
    // A house of the order here that preaches fills preaching.
    const h = Object.values(s.orderHouses!)[0]!;
    const withHouse = { ...s, orderHouses: { ...s.orderHouses, [h.id]: { ...h, dioceseId: did, works: ['priory_church', 'preaching'] } } };
    expect(workNeeds(withHouse, did).preaching.filled).toBe(true);
    expect(workNeeds(withHouse, did).preaching.why).toContain('already');
    // Second and third works: distinct from the first, the third wants a second, and each adds at its share.
    const open = CHARTER_WORKS.filter((w) => !needs[w].filled);
    expect(open.length).toBeGreaterThanOrEqual(3);
    const [w1, w2, w3] = open as [typeof open[number], typeof open[number], typeof open[number]];
    const one = CHARTER({ primaryWork: 'preaching' });
    const two = CHARTER({ primaryWork: 'preaching', secondaryWork: 'poor_relief' });
    const three = CHARTER({ primaryWork: w1, secondaryWork: w2, tertiaryWork: w3 });
    expect(charterWorks(three).map((w) => w.share)).toEqual([1, 0.5, 0.25]);
    expect(charterFactors(two).income).toBe(charterFactors(one).income + Math.round(charterDials.primaryWork.find((o) => o.id === 'poor_relief')!.income! * 0.5));
    expect(charterFactors(two).reputations.advocate).toBe(2.5);
    const third = charterDials.primaryWork.find((o) => o.id === w3)!;
    const [rk, rv] = Object.entries(third.reputations ?? {})[0] as [keyof typeof needs extends never ? never : import('@/types').ReputationKey, number];
    const withoutThird = charterFactors(CHARTER({ primaryWork: w1, secondaryWork: w2 }));
    expect(charterFactors(three).reputations[rk]).toBeCloseTo((withoutThird.reputations[rk] ?? 0) + rv * 0.25, 5);
    expect(optionAllowed(s, 'secondaryWork', 'preaching', did, one).ok).toBe(false);
    expect(optionAllowed(s, 'tertiaryWork', 'retreats', did, one).ok).toBe(false);
    expect(optionAllowed(s, 'tertiaryWork', 'retreats', did, two).ok).toBe(true);
    // The later dials read as their first option on an older charter, and every dial has options.
    for (const d of CHARTER_DIALS) {
      expect(charterDials[d].length).toBeGreaterThan(1);
      expect(charterDials[d].some((o) => o.id === optionIdOf(one, d))).toBe(true);
    }
    expect(optionIdOf(one, 'governance')).toBe('prior');
    expect(optionIdOf(one, 'secondaryWork')).toBe('none');
    // The new dials do what they say: a chapter-governed charter stays a successor's hand; a novitiate forms earlier; Spanish wants Spanish parishes.
    expect(charterFactors(CHARTER({ governance: 'chapter' })).keeps).toBeGreaterThan(0);
    expect(charterFactors(CHARTER({ formation: 'novitiate' })).formsAt).toBe(5);
    expect(charterFactors(CHARTER({ observance: 'primitive' })).observance).toBeGreaterThan(charterFactors(CHARTER({ observance: 'strict' })).observance);
    expect(charterFactors(CHARTER({ dress: 'habit_always' })).vocations).toBeGreaterThan(charterFactors(CHARTER({ dress: 'clerics' })).vocations);
    const world = s.territory![did]!;
    const latino = world.parishes.some((p) => p.terrain === 'latino');
    expect(optionAllowed(s, 'language', 'spanish', did).ok).toBe(latino);
    // Written with three works, the house carries all three; revised to none, the third goes with the second.
    const pet = petitionFoundation(s, did, w1);
    let next = answered(pet, 'needs:ok');
    expect(next.religious!.petition!.outcome).toBe('approved');
    next = writeCharter(next, three, createRng('needs:charter'));
    const f = myFoundation(next)!;
    expect(next.orderHouses![f.houseId]!.works).toEqual(expect.arrayContaining([w1, w2, w3]));
    expect(next.flags[`charter:secondaryWork:${w2}`]).toBe(true);
    const cut = reviseCharter(next, f.houseId, 'secondaryWork', 'none', 'player');
    expect(myFoundation(cut)!.charter.secondaryWork).toBeUndefined();
    expect(myFoundation(cut)!.charter.tertiaryWork).toBeUndefined();
    expect(cut.orderHouses![f.houseId]!.works).not.toContain(w2);
    expect(cut.flags['charter:secondaryWork:none']).toBe(true);
  });

  it('writing the charter erects the house on it: the men are sent, the province pays, the founder is prior, and the diocese sees a new house', () => {
    const { state: s, did } = founded('write');
    const f = myFoundation(s)!;
    const house = s.orderHouses![f.houseId]!;
    expect(house.priorId).toBe('player');
    expect(house.observance).toBe(charterFactors(CHARTER()).observance);
    expect(house.alignment).toBe(-40);
    expect(house.kind).toBe('mission');
    expect(house.dioceseId).toBe(did);
    expect(s.religious!.houseId).toBe(f.houseId);
    expect(s.religious!.office).toMatchObject({ office: 'prior', bodyId: f.houseId });
    expect(s.world!.diocese.presetId).toBe(did);
    expect(membersOf(s, house).length).toBeGreaterThanOrEqual(3);
    expect(s.province!.finances.balance).toBeLessThan(5_000_000);
    expect(s.flags['foundation:founded']).toBe(s.clock.week);
    expect(s.flags[`chapter:house:${f.houseId}`]).toBe(s.clock.week);
    expect(s.religious!.charterDraft).toBeUndefined();
    expect(s.mode.kind).toBe('clock');
    expect((s.world!.diocese.visible.houses ?? []).some((h) => h.name === house.name)).toBe(true);
    expect(s.letters?.at(-1)?.title).toContain('decree of erection');
    // Same seed, same house.
    const again = founded('write');
    expect(again.state.orderHouses![myFoundation(again.state)!.houseId]!.memberIds).toEqual(house.memberIds);
    // The founder may revise a dial while he is prior, and it is remembered.
    const revised = reviseCharter(s, f.houseId, 'liturgy', 'mixed', 'player');
    expect(myFoundation(revised)!.charter.liturgy).toBe('mixed');
    expect(myFoundation(revised)!.revisions).toHaveLength(1);
  });
});

describe('foundations: the years (E3 §9.5–9.7)', () => {
  it('a strict, chanted, evangelizing house draws more men than a relaxed house of studies, and the run is deterministic', () => {
    const magnet = founded('years', {}).state;
    const study = founded('years', { observance: 'relaxed', liturgy: 'vernacular', primaryWork: 'retreats', sizeTarget: 'small' }).state;
    expect(expectedVocations(magnet, myFoundation(magnet)!)).toBeGreaterThan(expectedVocations(study, myFoundation(study)!) * 2);
    const a = years(magnet, 12, 'run');
    const b = years(study, 12, 'run');
    const fa = myFoundation(a) ?? a.religious!.foundations![0]!;
    const fb = myFoundation(b) ?? b.religious!.foundations![0]!;
    expect(fa.vocationIds.length).toBeGreaterThan(fb.vocationIds.length);
    expect(fa.vocationIds.length).toBeGreaterThanOrEqual(4);
    // The men who came are the order's, tagged as the house's, and take vows as the years pass.
    for (const id of fa.vocationIds) {
      const n = a.npcs[id]!;
      expect(n.tags).toContain(`vocation_of:${fa.houseId}`);
      expect(a.province!.friarIds).toContain(id);
    }
    const early = fa.vocationIds.slice(0, 2).map((id) => a.npcs[id]!);
    expect(early.some((n) => n.tags.includes('vows:solemn') || n.tags.includes('vows:simple'))).toBe(true);
    // Two men of the same house are not the same man.
    if (fa.vocationIds.length >= 2) expect(a.npcs[fa.vocationIds[0]!]!.name.last === a.npcs[fa.vocationIds[1]!]!.name.last && a.npcs[fa.vocationIds[0]!]!.alignment === a.npcs[fa.vocationIds[1]!]!.alignment).toBe(false);
    // House reputations follow the charter.
    expect((fa.reputations.liturgist ?? 0) > 0 && (fa.reputations.evangelist ?? 0) > 0).toBe(true);
    expect(fb.reputations.spiritual_director ?? 0).toBeGreaterThan(0);
    expect(years(magnet, 12, 'run').religious!.foundations).toEqual(a.religious!.foundations);
    expect(a.flags['foundation:years']).toBe(12);
  });

  it('a work opens when the house has the men and the money, and feeds the house from then on', () => {
    const s = founded('works').state;
    const f = myFoundation(s)!;
    const poor = { ...s, religious: { ...s.religious!, foundations: s.religious!.foundations!.map((x) => ({ ...x, budget: 0 })) } };
    expect(myFoundation(addFoundationWork(poor, f.houseId, 'hospital'))!.works).toEqual([]);
    const funded = { ...s, religious: { ...s.religious!, foundations: s.religious!.foundations!.map((x) => ({ ...x, budget: 500_000 })) } };
    const opened = addFoundationWork(funded, f.houseId, 'hospital');
    expect(myFoundation(opened)!.works).toEqual(['hospital']);
    expect(myFoundation(opened)!.budget).toBe(500_000 - 20_000);
    expect(opened.orderHouses![f.houseId]!.works).toContain('hospital');
    expect(opened.flags['foundation:work:hospital']).toBeDefined();
    const later = years(opened, 3, 'w');
    expect((later.religious!.foundations![0]!.reputations.pastor_of_dying ?? 0)).toBeGreaterThan(0);
    // A novitiate wants eight men; the house has fewer.
    expect(myFoundation(addFoundationWork(funded, f.houseId, 'novitiate'))!.works).toEqual([]);
  });

  it('when the founder is gone a successor revises the charter his own way, or keeps it word for word', () => {
    const s = founded('successor').state;
    const f = myFoundation(s)!;
    const house = s.orderHouses![f.houseId]!;
    const men = membersOf(s, house);
    const loose = { ...men[0]!, alignment: 70, stats: { ...men[0]!.stats, piety: 30 } };
    const { office: _o, ...rest } = s.religious!;
    const gone: GameState = { ...s, religious: rest, npcs: { ...s.npcs, [loose.id]: loose }, orderHouses: { ...s.orderHouses, [f.houseId]: { ...house, priorId: loose.id } } };
    const after = years(gone, 8, 'rev');
    const ff = after.religious!.foundations![0]!;
    expect(ff.revisions.length).toBeGreaterThan(0);
    expect(ff.revisions[0]!.by).toBe(loose.id);
    expect(after.flags['foundation:revised']).toBeDefined();
    expect(after.letters?.some((l) => l.title === 'News of the houses')).toBe(true);
    const kept = { ...men[0]!, alignment: -40 };
    const same: GameState = { ...s, religious: rest, npcs: { ...s.npcs, [kept.id]: kept }, orderHouses: { ...s.orderHouses, [f.houseId]: { ...house, priorId: kept.id } } };
    const afterSame = years(same, 8, 'rev');
    expect(afterSame.religious!.foundations![0]!.revisions).toHaveLength(0);
    expect(afterSame.flags['foundation:kept']).toBeDefined();
  });

  it('a daughter house goes out under an heir formed in the house, and inherits his reading of the charter', () => {
    let s = founded('daughter').state;
    const f0 = myFoundation(s)!;
    expect(canSendDaughter(s, f0).ok).toBe(false);
    // Fill the house through the scene effect, then let the years bring the men to solemn vows.
    s = applyEffects(s, [{ target: 'foundation', key: 'vocation', delta: 14 }], {}, 'a wave');
    expect(myFoundation(s)!.vocationIds).toHaveLength(14);
    s = years(s, 6, 'd');
    // Keep him prior through the years for the test's sake.
    s = { ...s, religious: { ...s.religious!, office: { office: 'prior', bodyId: f0.houseId, startWeek: 0, endWeek: s.clock.week + 52, consecutive: 1 } } };
    const f = myFoundation(s) ?? s.religious!.foundations![0]!;
    if (f.status !== 'alive') return; // the young house can fail; that is the design
    const heirs = heirsOf(s, f);
    expect(heirs.length).toBeGreaterThan(0);
    expect(canSendDaughter(s, f).ok).toBe(true);
    const heir = { ...heirs[0]!, alignment: 40 };
    s = { ...s, npcs: { ...s.npcs, [heir.id]: heir } };
    const where = s.province!.dioceseIds.find((d) => d !== f.dioceseId)!;
    const sent = sendDaughter(s, f.houseId, heir.id, where, createRng('send'));
    expect(sent.line).toContain(heir.name.last);
    const daughter = sent.state.religious!.foundations!.find((x) => x.daughterOf === f.houseId)!;
    expect(daughter.heirId).toBe(heir.id);
    expect(daughter.charter).toMatchObject({ ...readingOf(heir, f.charter), writtenWeek: s.clock.week });
    expect(daughter.charter.observance).not.toBe('strict');
    const dh = sent.state.orderHouses![daughter.houseId]!;
    expect(dh.priorId).toBe(heir.id);
    expect(dh.dioceseId).toBe(where);
    expect(sent.state.npcs[heir.id]!.tags).toContain(`house:${daughter.houseId}`);
    expect(sent.state.orderHouses![f.houseId]!.memberIds).not.toContain(heir.id);
    expect(sent.state.flags['foundation:daughters']).toBe(1);
  });

  it('early foundations fail often: a thin house under a bishop who resents religious closes, and the founder goes back to the ranks', () => {
    let failures = 0;
    for (let i = 0; i < 12 && failures === 0; i++) {
      const { state: s, did } = founded(`fail${i}`, { primaryWork: 'retreats', observance: 'relaxed' });
      const f = myFoundation(s)!;
      const house = s.orderHouses![f.houseId]!;
      const cold = { ...s, religious: { ...s.religious!, dioceseFile: { ...(s.religious!.dioceseFile ?? {}), [did]: { local_bishop: -95, laity: 0, bishopId: 'new_bishop', leftWeek: 0 } }, foundations: s.religious!.foundations!.map((x) => ({ ...x, budget: -500_000 })) }, character: { ...s.character!, reputation: { ...s.character!.reputation, local_bishop: -90 } }, orderHouses: { ...s.orderHouses, [f.houseId]: { ...house, memberIds: house.memberIds.slice(0, 2) } }, province: { ...s.province!, trajectory: 'shrinking' as const } };
      const after = years(cold, 6, `f${i}`);
      const ff = after.religious!.foundations![0]!;
      if (ff.status === 'failed') {
        failures++;
        expect(after.orderHouses![f.houseId]).toBeUndefined();
        expect(after.flags['foundation:failed']).toBeDefined();
        expect(after.religious!.office).toBeUndefined();
        expect(after.letters?.some((l) => l.title.endsWith('is closed'))).toBe(true);
        expect(ff.failedWhy).toBeTruthy();
      }
    }
    expect(failures).toBeGreaterThan(0);
  });

  it('a scene touches the house through the foundation effect, and a save mid-petition round-trips', () => {
    const { state: s } = founded('effects');
    const f = myFoundation(s)!;
    const paid = applyEffects(s, [{ target: 'foundation', key: 'budget', delta: 50_000 }, { target: 'foundation', key: 'reputation:liturgist', delta: 10 }, { target: 'foundation', key: 'revise:poverty', value: 'austere' }], {}, 'a scene');
    const pf = myFoundation(paid)!;
    expect(pf.budget).toBe(f.budget + 50_000);
    expect(pf.reputations.liturgist).toBe(10);
    expect(pf.charter.poverty).toBe('austere');
    const invited = applyEffects(s, [{ target: 'foundation', key: 'invite', value: s.province!.dioceseIds[0]! }], {}, 'x');
    expect(invited.flags[`foundation:invited:${s.province!.dioceseIds[0]}`]).toBeDefined();
    const closed = applyEffects(s, [{ target: 'foundation', key: 'fail', value: 'the money ran out' }], {}, 'x');
    expect(closed.religious!.foundations![0]!.status).toBe('failed');
    expect(closed.religious!.office).toBeUndefined();
    // A save in the middle of a petition, and in the middle of the charter, reads back the same.
    const { state: p, did } = elsewhere(rich(friar('save')), true);
    const pet = petitionFoundation(p, did, openWork(p, did, 'retreats'));
    const rng = createRng(pet.seed);
    const json = serialize(buildSave(pet, rng, null));
    expect(serialize(deserialize(json))).toBe(json);
    expect(deserialize(json).state.religious!.petition).toEqual(pet.religious!.petition);
    const drafting = answered(pet, 'sv');
    expect(drafting.mode.kind).toBe('charter');
    const json2 = serialize(buildSave(drafting, createRng(drafting.seed), null));
    expect(deserialize(json2).state.religious!.charterDraft).toEqual(drafting.religious!.charterDraft);
  });
});
