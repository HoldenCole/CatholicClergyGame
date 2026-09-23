import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { offerById, allOffers } from '@/content/offers';
import { acceptOffer, isOfferEligible } from '@/engine/offers';
import { endStudy } from '@/engine/study';
import { consult, decideAssignment, openWorks, statePreference } from '@/systems/religious/obedience';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { dateOf } from '@/engine/time';
import type { GameState, OrderKey } from '@/types';

/** A priest of the order a year ordained, in a priory of his province, with the theology and the standing Rome asks for. */
function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 64, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: 0 } }, gen, 2010, priory.id);
  s = { ...s, phase: 'parochial_vicar', clock: { ...s.clock, week: 60 }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10 } };
  const c = s.character!;
  return { ...s, character: { ...c, reputation: { ...c.reputation, province: 20, chancery: 30 } } };
}

/** A priest of the diocese with the same claim on Rome. */
function diocesan(seed: string): GameState {
  const base = seminaryState(seed);
  const c = testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 64, knowledge: 60, piety: 60 } });
  return { ...base, phase: 'parochial_vicar', clock: { ...base.clock, week: 160 }, flags: { ...base.flags, ordained: true, ordination_week: 0 }, character: { ...c, reputation: { ...c.reputation, chancery: 30 } } };
}

describe('the order moves its own men: letters by campaign, Rome from the provincial, and a short-handed house\'s choice of work', () => {
  it('the diocese\'s letters never reach a friar and the order\'s never reach a priest of the diocese', () => {
    const f = friar('gate');
    const d = diocesan('gate-d');
    expect(isOfferEligible(offerById('pv_rome_study')!, f)).toBe(false);
    expect(isOfferEligible(offerById('fr_rome_study')!, f)).toBe(true);
    expect(isOfferEligible(offerById('fr_rome_study')!, d)).toBe(false);
    expect(allOffers.some((o) => !o.campaign && o.phase.includes('parochial_vicar') && isOfferEligible(o, d))).toBe(true);
    // Every letter of the diocese is silent for a friar, whatever else it asks.
    for (const o of allOffers.filter((o) => o.campaign !== 'religious' && o.phase.includes('parochial_vicar'))) expect(isOfferEligible(o, f), o.id).toBe(false);
    for (const o of allOffers.filter((o) => o.campaign === 'religious')) expect(o.from?.startsWith('@') && ['@provincial', '@master_of_students', '@prior', '@novice_master', '@old_friar', '@confrere'].includes(o.from), o.id).toBe(true);
  });

  it('the provincial\'s letter about Rome moves him the week he says yes, and he comes home to a consultation, not the board', () => {
    const s = friar('rome');
    const def = offerById('fr_rome_study')!;
    const open = { ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 6, bindings: {} }] };
    const gone = acceptOffer(open, def, createRng('accept')).state;
    expect(gone.phase).toBe('study');
    expect(gone.study?.city).toBe('rome');
    expect(gone.study?.program).toBe('rome_order');
    expect(gone.study?.school).not.toMatch(/Gregorian|Angelicum/);
    expect(gone.flags['appointment:offer']).toBeUndefined();
    expect(gone.religious?.houseId).toBe(s.religious!.houseId);
    expect(gone.career.at(-1)!.text).toMatch(/Sent by the provincial to Rome/);
    const home = endStudy({ ...gone, clock: { ...gone.clock, week: gone.study!.endWeek } }, def, createRng('home'));
    expect(home.study).toBeNull();
    expect(home.phase).toBe('parochial_vicar');
    expect(home.assignment).toBeNull();
    expect(home.character!.credentials).toContain('STL');
    expect(home.flags.rome_alumnus).toBe(true);
    expect(home.mode.kind).toBe('consultation');
    expect(home.religious!.consultation?.options.length).toBeGreaterThan(0);
    expect(home.religious!.consultation?.decided).toBeUndefined();
  });

  it('a house short of men for the works it keeps lets him choose the work, and the provincial honours the choice with the house', () => {
    const s = friar('works');
    const year = dateOf(s.clock).year;
    const mine = currentHouse(s)!;
    const other = Object.values(s.orderHouses!).find((h) => h.id !== mine.id && h.works.length >= 2)!;
    // Thin the house to two men: short for its kind, and short for its works.
    const thin = { ...s, orderHouses: { ...s.orderHouses, [other.id]: { ...other, memberIds: other.memberIds.slice(0, 2) } } };
    expect(openWorks(thin, thin.orderHouses![other.id]!, year)).toEqual([...new Set(other.works)]);
    // A full house of one work names the work itself.
    const one = { ...other, works: ['priory_church'] };
    expect(openWorks(s, one, year)).toBeUndefined();
    const full = { ...other, memberIds: [...other.memberIds, ...membersOf(s, mine).map((m) => m.id)] };
    if (membersOf(s, full).length > other.works.length * 2) expect(openWorks({ ...s, orderHouses: { ...s.orderHouses, [other.id]: full } }, full, year)).toBeUndefined();
    // The consultation carries the works, the preference keeps the work, and the decision honours it when that house is chosen.
    const opened = consult(thin, createRng('consult'));
    const option = opened.religious!.consultation!.options.find((o) => o.houseId === other.id);
    const forced = option ? opened : { ...opened, religious: { ...opened.religious!, consultation: { ...opened.religious!.consultation!, options: [{ houseId: other.id, work: other.works[0]!, works: [...new Set(other.works)], need: 90, fit: 70, formation: 0, line: '' }] } } };
    const work = [...new Set(other.works)][1]!;
    const asked = statePreference(forced, other.id, false, work);
    expect(asked.religious!.consultation!.preference).toBe(other.id);
    expect(asked.religious!.consultation!.preferenceWork).toBe(work);
    const decided = decideAssignment(asked, createRng('decide')).religious!.consultation!.decided!;
    if (decided.houseId === other.id) {
      expect(decided.work).toBe(work);
      expect(decided.reasons.join(' ')).toMatch(/chose which/);
    }
    // Asking for a work the house did not open is not kept.
    expect(statePreference(forced, other.id, false, 'curia').religious!.consultation!.preferenceWork).toBeUndefined();
  });
});
