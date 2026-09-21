import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { acknowledgeEvaluation, ordain, startSeminary } from '@/engine/seminary';
import { isEligible } from '@/engine/events';
import { testCharacter, testEvent, testNpc } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { creationContent } from '@/content/creation';
import { applyCreation } from '@/systems/creation';
import { beginReligious, generateProvinceCandidates, provincePreview } from '@/systems/religious/newGame';
import { formationGuide, formationStage, solemnlyProfessed } from '@/systems/religious/formation';
import { decideAssignment, receiveAssignment } from '@/systems/religious/obedience';
import { currentHouse, priorOf } from '@/systems/religious/house';
import { holdElection, openChapter, resolveElection, returnToRanks } from '@/systems/religious/chapter';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { askDispensation, dispensationWeek, positionWeight, preachingEvent, preachingOf, preachingWeek, studyApFactor } from '@/systems/religious/study';
import { horariumLoad } from '@/systems/religious/horarium';
import { appointOffice, appointmentYear, conferCredentials, dueCredentials, officeOffers } from '@/systems/religious/offices';
import { recordPosition } from '@/systems/reputation';
import { moveToHouse } from '@/systems/religious/transfer';
import type { CreationAnswers, GameState, OrderKey } from '@/types';

const answers: CreationAnswers = { firstName: 'Michael', lastName: 'Hale', portrait: 'p1', entryYear: 2010, origin: 'suburban', tie: 'transfer', path: 'college', field: 'philosophy', career: null, yearsWorked: 0, motive: 'priest', family: 'supportive', past: null };

/** A new religious game through creation, in the order's first province, at the novitiate. */
function novice(seed: string, order: OrderKey = 'OP'): GameState {
  const { state, rng } = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  const candidates = generateProvinceCandidates(rng.derive('provinces'), order, 2010);
  let s = applyCreation({ ...state, campaign: 'religious' }, answers, creationContent);
  s = beginReligious(s, candidates[0]!, { order, provinceId: candidates[0]!.province.id, why: 'alumnus', tie: 'educated', religiousName: 'Thomas' }, 2010);
  const classmates = ['c1', 'c2', 'c3'];
  const npcs = { ...s.npcs };
  for (const id of classmates) npcs[id] = testNpc(id, { role: 'classmate', tags: ['classmate'] });
  s = startSeminary({ ...s, npcs }, classmates, 'the novitiate');
  // The house thinks well of him, so the votes of a career test go his way; the refusal test sets them against him.
  for (const id of currentHouse(s)!.memberIds) npcs[id] = { ...npcs[id]!, relationship: 40 };
  return { ...s, npcs, mode: { kind: 'clock' } };
}

/** Advance a formation year as the evaluation would. */
function endYear(s: GameState, result: 'ADVANCED' | 'ADVANCED_WITH_CONCERNS' = 'ADVANCED'): GameState {
  const year = s.seminary!.year;
  const record = { year, result, pillars: { human: 8, spiritual: 8, intellectual: 8, pastoral: 8 }, notes: [] };
  const withEmphasis = { ...s, seminary: { ...s.seminary!, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 } }, clock: { ...s.clock, week: s.clock.week + 52 } };
  return acknowledgeEvaluation({ ...withEmphasis, mode: { kind: 'evaluation', record } } as GameState);
}

describe('a Dominican career from novitiate through an elected priorship (E3 R1.3)', () => {
  it('the order is chosen, then a province from a preview that reads only what is visible', () => {
    const { rng } = newGame({ seed: 'pick', start: { year: 2010, month: 8, day: 20 } });
    const candidates = generateProvinceCandidates(rng.derive('provinces'), 'OP', 2010);
    expect(candidates.map((c) => c.province.id)).toEqual(religiousOrder('OP').provinces.map((p) => p.id));
    for (const c of candidates) {
      const v = c.visible;
      expect(v.territory.length).toBe(c.province.dioceseIds.length);
      expect(v.provincial.age).toBeGreaterThan(40);
      expect(v.works.length).toBeGreaterThan(1);
      expect(v.complication.length).toBeGreaterThan(10);
      const json = JSON.stringify(v);
      for (const key of ['balance', 'hostility', 'councilIds', 'friarIds', 'houseIds', 'observant', 'retirementBurden']) expect(json.includes(`"${key}"`), key).toBe(false);
      expect(provincePreview(c, 2010)).toEqual(v);
    }
    expect(generateProvinceCandidates(createRng('x'), 'OP', 2010).map((c) => c.visible.provincial.name)).not.toEqual(candidates.map((c) => c.visible.provincial.name));
  });

  it('creation adds why this order and the tie to the province, and a Dominican takes a religious name', () => {
    const s = novice('create');
    expect(s.campaign).toBe('religious');
    expect(s.religious!.why).toBe('alumnus');
    expect(s.religious!.tie).toBe('educated');
    expect(s.religious!.religiousName).toBe('Thomas');
    expect(s.flags['why:alumnus']).toBe(true);
    expect(s.character!.reputation.province).toBe(18);
    expect(currentHouse(s)!.kind).toBe('novitiate');
    expect(formationStage(s)!.label).toBe('Novitiate');
    expect(formationGuide(s)).toBe('novice master');
    const osa = novice('create-osa', 'OSA');
    expect(osa.religious!.religiousName).toBeUndefined();
    expect(currentHouse(osa)!.kind).toBe('priory');
    expect(formationStage(osa)!.label).toBe('Pre-novitiate');
  });

  it('seven years: simple profession voted by the house, the move to the studium, renewals, solemn vows, and ordination into the provincial\'s consultation', () => {
    let s = novice('years');
    expect(solemnlyProfessed(s)).toBe(false);
    s = endYear(s);
    expect(s.religious!.vows.simpleWeek).toBeDefined();
    expect(s.flags['vows:simple']).toBeDefined();
    expect(s.career.some((c) => /Simple profession/.test(c.text))).toBe(true);
    expect(s.seminary!.year).toBe(2);
    expect(currentHouse(s)!.kind).toBe('studium');
    expect(s.world!.diocese.presetId).toBe(currentHouse(s)!.dioceseId);
    for (let y = 2; y <= 5; y++) s = endYear(s);
    expect(s.religious!.vows.renewals.length).toBe(1);
    expect(s.seminary!.year).toBe(6);
    s = endYear(s);
    expect(solemnlyProfessed(s)).toBe(true);
    expect(s.career.some((c) => /Solemn profession/.test(c.text))).toBe(true);
    expect(s.seminary!.year).toBe(7);
    s = endYear(s);
    expect(s.mode.kind).toBe('ordination');
    const ordained = ordain(s, createRng('ordain'));
    expect(ordained.flags.ordained).toBe(true);
    expect(ordained.assignment).toBeNull();
    expect(ordained.religious!.consultation!.reason).toBe('first');
    expect(ordained.religious!.consultation!.options.length).toBe(3);
    expect(ordained.mode.kind).toBe('clock');
  });

  it('the house can vote against him: a year repeated, the question again', () => {
    let s = novice('refused');
    const house = currentHouse(s)!;
    const npcs = { ...s.npcs };
    for (const id of house.memberIds) npcs[id] = { ...npcs[id]!, relationship: -90 };
    s = { ...s, npcs };
    let held: GameState | undefined;
    for (let i = 0; i < 12 && !held; i++) {
      const t = endYear({ ...s, seed: `ref-${i}` }, 'ADVANCED_WITH_CONCERNS');
      if (t.seminary!.year === 1) held = t;
    }
    expect(held).toBeDefined();
    expect(held!.flags['vows:refused']).toBeDefined();
    expect(held!.religious!.vows.simpleWeek).toBeUndefined();
    expect(held!.seminary!.heldBackCount).toBe(1);
    expect(held!.career.at(-1)!.text).toMatch(/voted/);
  });

  it('a Dominican priest under obedience: the consultation, a posting, and years later a house that elects him prior', () => {
    let s = novice('prior');
    for (let y = 1; y <= 7; y++) s = endYear(s);
    s = ordain(s, createRng('o'));
    s = receiveAssignment(decideAssignment(s, createRng('d')), 'good');
    expect(s.religious!.assignments.at(-1)!.grace).toBe('good');
    expect(s.religious!.obedience.accepted).toBe(1);
    // Twelve years on, liked, legible, and not visibly wanting it.
    const later = s.clock.week + 12 * 52;
    s = { ...s, clock: { ...s.clock, week: later }, character: { ...s.character!, stats: { administration: 70, charisma: 75, theology: 70, knowledge: 60, piety: 70 } }, religious: { ...s.religious!, perceivedAmbition: 5, legibility: 90 } };
    const house = currentHouse(s)!;
    const npcs = { ...s.npcs };
    for (const id of house.memberIds) npcs[id] = { ...npcs[id]!, relationship: 70 };
    s = { ...s, npcs };
    let elected: GameState | undefined;
    for (let i = 0; i < 20 && !elected; i++) {
      const t = holdElection(openChapter({ ...s, seed: `e-${i}` }, 'house', house.id, 'prior'));
      if (t.religious!.chapter!.outcome!.electedId === PLAYER_ID) elected = t;
    }
    expect(elected).toBeDefined();
    const seated = resolveElection(elected!, createRng('c'), true);
    expect(seated.religious!.office!.office).toBe('prior');
    expect(seated.career.at(-1)!.text).toMatch(/Elected prior/);
    const ended = returnToRanks({ ...seated, clock: { ...seated.clock, week: seated.religious!.office!.endWeek } }, 'well');
    expect(ended.religious!.termsServed.length).toBe(1);
    expect(ended.religious!.office).toBeUndefined();
  });
});

describe('Dominican systems as data (E3 §6.2–6.4)', () => {
  it('study is protected, a dispensation lifts the choir at a cost, and preaching reputation travels', () => {
    const op = novice('study');
    const osa = novice('study-osa', 'OSA');
    expect(studyApFactor(op)).toBe(0.75);
    expect(studyApFactor(osa)).toBe(1);
    expect(studyApFactor({})).toBe(1);
    const prior = priorOf(op)!;
    const warm = { ...op, npcs: { ...op.npcs, [prior.id]: { ...prior, relationship: 80 } } };
    let granted: ReturnType<typeof askDispensation> | undefined;
    for (let i = 0; i < 20 && !granted?.granted; i++) granted = askDispensation(warm, createRng(`disp-${i}`));
    expect(granted!.granted).toBe(true);
    const before = horariumLoad(warm);
    expect(horariumLoad(granted!.state)).toBeLessThan(before);
    expect(askDispensation(granted!.state, createRng('again')).line).toBe('Already dispensed');
    const week = dispensationWeek(granted!.state);
    expect(week.character!.reputation.community!).toBeLessThan(granted!.state.character!.reputation.community ?? 0);
    const lapsed = dispensationWeek({ ...granted!.state, clock: { ...granted!.state.clock, week: granted!.state.religious!.dispensed!.untilWeek } });
    expect(lapsed.religious!.dispensed).toBeUndefined();
    expect(askDispensation(osa, createRng('x')).line).toMatch(/does not dispense/);
    // Preaching.
    expect(preachingOf(osa)).toBeUndefined();
    expect(preachingOf(op)).toBe(0);
    let p = op;
    for (let i = 0; i < 100; i++) p = preachingWeek(p, 'invested');
    expect(preachingOf(p)).toBeCloseTo(20);
    p = preachingEvent(preachingEvent(p, 'mission'), 'mission');
    expect(preachingOf(p)).toBeCloseTo(32);
    const faded = preachingWeek(p, 'min');
    expect(preachingOf(faded)).toBeLessThan(32);
    let known = p;
    for (let i = 0; i < 6; i++) known = preachingEvent(known, 'mission');
    expect(preachingOf(known)).toBeGreaterThanOrEqual(60);
    expect(known.flags['preacher:known']).toBeDefined();
    // It survives a transfer.
    const other = Object.values(known.orderHouses!).find((h) => h.id !== known.religious!.houseId)!;
    expect(preachingOf(moveToHouse(known, other.id, other.works[0]!))).toBe(preachingOf(known));
  });

  it('Veritas: a public doctrinal position counts one and a quarter for a Dominican, and as one for anyone else', () => {
    const op = novice('veritas');
    expect(positionWeight(op, 'liturgy')).toBe(1.25);
    expect(positionWeight(op, 'immigration')).toBe(1);
    expect(positionWeight(novice('veritas-osa', 'OSA'), 'liturgy')).toBe(1);
    expect(positionWeight({}, 'liturgy')).toBe(1);
    const c = testCharacter();
    const plain = recordPosition(c, { topic: 'liturgy', value: -60, volume: 'public', week: 1 });
    const loud = recordPosition(c, { topic: 'liturgy', value: -60, volume: 'public', week: 1 }, 1.25);
    expect(Math.abs(loud.alignment)).toBeGreaterThan(Math.abs(plain.alignment));
    expect(loud.outspokenness).toBeGreaterThan(plain.outspokenness);
  });

  it('appointed offices come from the provincial against stats and years, run a term, and the order\'s credentials follow the work', () => {
    let s = novice('office');
    s = { ...s, flags: { ...s.flags, ordained: true, ordination_week: s.clock.week - 9 * 52 }, character: { ...s.character!, stats: { administration: 50, charisma: 60, theology: 72, knowledge: 62, piety: 60 } } };
    const offers = officeOffers(s);
    expect(offers.map((o) => o.def.id)).toEqual(['novice_master', 'master_of_students', 'regent_of_studies', 'promoter_of_preaching', 'vocation_director']);
    expect(offers.find((o) => o.def.id === 'regent_of_studies')!.why).toMatch(/Not before 12 years/);
    expect(offers.find((o) => o.def.id === 'novice_master')!.available).toBe(true);
    const appointed = appointOffice(s, 'novice_master');
    expect(appointed.religious!.appointment!.id).toBe('novice_master');
    expect(appointed.flags['office:novice_master']).toBe(s.clock.week);
    expect(appointed.character!.reputation.province).toBe(18 + 6);
    expect(officeOffers(appointed).every((o) => !o.available)).toBe(true);
    const over = appointmentYear({ ...appointed, clock: { ...appointed.clock, week: appointed.religious!.appointment!.endWeek } });
    expect(over.religious!.appointment).toBeUndefined();
    expect(over.religious!.termsServed).toEqual([{ office: 'novice_master', startWeek: s.clock.week, endWeek: s.clock.week + 4 * 52 }]);
    // Three years teaching: Lector of Sacred Theology.
    const studium = Object.values(s.orderHouses!).find((h) => h.kind === 'studium')!;
    let teacher = moveToHouse(s, studium.id, 'teaching');
    expect(dueCredentials(teacher)).toEqual([]);
    teacher = { ...teacher, clock: { ...teacher.clock, week: teacher.clock.week + 3 * 52 + 1 } };
    expect(dueCredentials(teacher).map((d) => d.id)).toEqual(['lector_theology']);
    const conferred = conferCredentials(teacher);
    expect(conferred.state.character!.credentials).toContain('lector_theology');
    expect(conferred.lines[0]).toMatch(/Lector/);
    expect(dueCredentials(conferred.state)).toEqual([]);
  });

  it('a scene belongs to a campaign: the base game\'s pools do not fire for a friar, and his do not fire for a priest', () => {
    const friarState = { ...novice('pool'), phase: 'seminary' as const };
    const { campaign: _c, religious: _r, ...rest } = friarState;
    const diocesan = rest as GameState;
    const base = testEvent({ id: 'base', phase: 'seminary' });
    const friar = testEvent({ id: 'friar', phase: 'seminary', campaign: 'religious' });
    const shared = testEvent({ id: 'shared', phase: 'seminary', campaign: 'any' });
    expect(isEligible(base, friarState)).toBe(false);
    expect(isEligible(friar, friarState)).toBe(true);
    expect(isEligible(shared, friarState)).toBe(true);
    expect(isEligible(base, diocesan)).toBe(true);
    expect(isEligible(friar, diocesan)).toBe(false);
    expect(isEligible(shared, diocesan)).toBe(true);
  });
});
