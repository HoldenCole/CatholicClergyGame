import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { beginStudy, endStudy } from '@/engine/study';
import { isOfferEligible } from '@/engine/offers';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { allEvents } from '@/content';
import { offerById } from '@/content/offers';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { BISHOP_FLAG, romanTokens } from '@/systems/religious/mitre';
import { dueCredentials } from '@/systems/religious/offices';
import { curiaWeek, rankOf } from '@/systems/rome/curia';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { papacyWeek } from '@/systems/rome/papacy';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { parishState } from './week.test';
import type { GameState, OrderKey } from '@/types';

/** A solemnly professed priest of fifty, a former provincial, a Roman alumnus with Italian, whom Rome reads well. */
function friar(seed: string, order: OrderKey = 'OP', patch: Partial<NonNullable<GameState['religious']>> = {}): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 70, charisma: 65, theology: 78, knowledge: 70, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20, rome_alumnus: true } }, gen, 2010, priory.id);
  const c = s.character!;
  s = { ...s, phase: 'pastor', character: { ...c, credentials: [...c.credentials, 'italian', 'STL'], reputation: { ...c.reputation, order: 70, province: 60, rome: 40 } }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 5, legibility: 80, termsServed: [{ office: 'provincial', startWeek: -400, endWeek: -200 }], ...patch } };
  return nuncioWeek(papacyWeek(s).state).state;
}

describe("Rome's offices for a friar (E3 §16C)", () => {
  it("the Secretariat's letter comes through the provincial to a friar, and the bishop's never does", () => {
    const f = friar('letter');
    expect(isOfferEligible(offerById('fr_curia_official')!, f)).toBe(true);
    expect(isOfferEligible(offerById('rome_curia_official')!, f)).toBe(false);
    expect(isOfferEligible(offerById('fr_curia_official')!, parishState('dio'))).toBe(false);
    // Not from Rome as head of the order, nor twice.
    expect(isOfferEligible(offerById('fr_curia_official')!, { ...f, flags: { ...f.flags, 'office:general': 10 } })).toBe(false);
    expect(isOfferEligible(offerById('fr_curia_official')!, { ...f, flags: { ...f.flags, curia_served: true } })).toBe(false);
  });

  it('lent to the Holy See, he lays his office down, lives in the order\'s house, and the record says who lent him', () => {
    const s = friar('lent', 'OP', { office: { office: 'prior', bodyId: 'h', startWeek: -50, endWeek: 200, consecutive: 1 } });
    const off = { ...s, flags: { ...s.flags, 'office:prior': -50 } };
    const away = beginStudy(off, offerById('fr_curia_official')!, false, createRng('go'));
    expect(away.study?.city).toBe('curia');
    expect(away.religious!.office).toBeUndefined();
    expect(away.study!.residence).toBe(religiousOrder('OP').roman.residence);
    expect(away.career.some((e) => /Lent by the order to the Holy See/.test(e.text))).toBe(true);
    expect(away.flags['curia:rank']).toBe('official');
    // The superiors' letter asks the order, not the diocese.
    const staying = { ...away, flags: { ...away.flags, 'curia:stays': true }, clock: { ...away.clock, week: away.clock.week + 1 } };
    expect(curiaWeek(staying).lines.join(' ')).toMatch(/asking the order for you/);
    // Home: a consultation, not the board, and the Curia's mark on him.
    const done = { ...away, clock: { ...away.clock, week: away.study!.endWeek } };
    const home = endStudy(done, offerById('fr_curia_official')!, createRng('home'));
    expect(home.mode.kind).toBe('consultation');
    expect(home.flags.curia_served).toBe(true);
    expect(home.study).toBeNull();
  });

  it('a friar made secretary of a dicastery is an archbishop, and leaves the order\'s governance with it', () => {
    let seated: GameState | null = null;
    for (let i = 0; i < 12 && !seated; i++) {
      const s = friar(`sec-${i}`);
      let away = beginStudy(s, offerById('fr_curia_official')!, false, createRng('go'));
      // A man the superiors send for, past fifty, kept for as long as the ladder needs.
      away = { ...away, character: { ...away.character!, entryYear: 1978, reputation: { ...away.character!.reputation, rome: 90 } }, study: { ...away.study!, endWeek: away.study!.endWeek + 52 * 20, place: { desk: 90, superiors: 95, city: 60, priesthood: 40 } } };
      for (let w = 0; w < 52 * 16 && rankOf(away) !== 'secretary'; w++) {
        away = { ...away, clock: { ...away.clock, week: away.clock.week + 1 } };
        away = curiaWeek(away).state;
        away = { ...away, study: { ...away.study!, place: { desk: 90, superiors: 95, city: 60, priesthood: 40 } } };
      }
      if (rankOf(away) === 'secretary') seated = away;
    }
    expect(seated).not.toBeNull();
    expect(seated!.flags.ordained_bishop).toBe(true);
    expect(seated!.flags[BISHOP_FLAG]).toBeDefined();
  });

  it("the chair in Rome: the order's own faculty by name, its activities, and the years that count as teaching", () => {
    for (const order of ['OP', 'OSA'] as const) {
      const s = friar(`chair-${order}`, order);
      const def = offerById('fr_roman_faculty')!;
      expect(isOfferEligible(def, s)).toBe(true);
      const away = beginStudy(s, def, false, createRng('go'));
      expect(away.study?.city).toBe('faculty');
      expect(away.study!.school).toBe(religiousOrder(order).roman.faculty);
      expect(away.study!.label).toMatch(/^Professor at /);
      expect(away.career.some((e) => /Sent by the province to teach/.test(e.text))).toBe(true);
      expect(studyActivitiesFor(away).length).toBeGreaterThanOrEqual(6);
      const tokens = romanTokens(away);
      expect(religiousOrder(order).roman.chairs).toContain(tokens.roman_chair);
      expect(renderText('{roman_faculty}, a chair in {roman_chair}', away)).toBe(`${religiousOrder(order).roman.faculty}, a chair in ${tokens.roman_chair}`);
      expect(romanTokens(away).roman_chair).toBe(tokens.roman_chair);
      const done = { ...away, clock: { ...away.clock, week: away.study!.endWeek } };
      const home = endStudy(done, def, createRng('home'));
      expect(home.mode.kind).toBe('consultation');
      expect(home.flags.faculty_served).toBe(true);
      expect(home.flags['faculty:years']).toBe(5);
      expect(home.career.some((e) => /years teaching at/.test(e.text))).toBe(true);
      // Five years at the faculty are five years' teaching: the order's first credential is due.
      const teaching = religiousOrder(order).credentials.find((c) => c.work === 'teaching' && c.afterYears <= 5);
      if (teaching) expect(dueCredentials(home).map((c) => c.id)).toContain(teaching.id);
    }
    expect(religiousOrder('OP').roman.faculty).not.toBe(religiousOrder('OSA').roman.faculty);
  });

  it("the friar's Roman scenes fire in their postings, and the Curia's own reach him", () => {
    const s = friar('scenes');
    const curia = beginStudy(s, offerById('fr_curia_official')!, false, createRng('c'));
    const faculty = beginStudy(s, offerById('fr_roman_faculty')!, false, createRng('f'));
    const later = (g: GameState) => ({ ...g, clock: { ...g.clock, week: g.clock.week + 200 } });
    const fits = (id: string, g: GameState) => { const e = allEvents.find((x) => x.id === id)!; return (isEligible(e, g) && evaluateAll(e.requires ?? [], g)) || (isEligible(e, later(g)) && evaluateAll(e.requires ?? [], later(g))); };
    for (const id of ['fr_cu_first_day', 'fr_cu_file_home', 'fr_cu_house_in_rome', 'cu_protocol', 'cu_prefect_lunch']) expect(fits(id, curia), id).toBe(true);
    for (const id of ['cu_stay', 'cu_file_home', 'cu_ad_limina']) expect(fits(id, curia), id).toBe(false);
    for (const id of ['fr_fac_first_lecture', 'fr_fac_thesis_from_a_poor_province', 'fr_fac_dicastery_opinion', 'fr_fac_head_of_the_order', 'fr_fac_student_from_home', 'fr_fac_the_book']) expect(fits(id, faculty), id).toBe(true);
    expect(fits('fr_fac_first_lecture', curia)).toBe(false);
  });

  it('a friar in Rome survives a save', () => {
    const s = friar('save', 'OSA');
    const away = beginStudy(s, offerById('fr_roman_faculty')!, false, createRng('go'));
    const back = deserialize(serialize(buildSave(away, createRng(away.seed), null, {})));
    expect(back.state.study).toEqual(away.study);
    expect(back.state.religious!.office).toEqual(away.religious!.office);
    expect(PLAYER_ID).toBe('player');
  });
});
