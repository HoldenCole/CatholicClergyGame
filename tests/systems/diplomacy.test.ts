import { describe, it, expect } from 'vitest';
import { offerById } from '@/content/offers';
import { nunciatures } from '@/content/rome';
import { createRng } from '@/engine/rng';
import { acceptOffer, isOfferEligible } from '@/engine/offers';
import { beginStudy, endStudy } from '@/engine/study';
import { evaluateAll, evaluateCondition } from '@/engine/conditions';
import { eventById } from '@/content';
import { renderText } from '@/engine/text';
import { resolveSelector } from '@/engine/selectors';
import { dateOf, sundayOf, termWeek } from '@/engine/time';
import { appointmentStep, pendingAppointment } from '@/engine/appointment';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { nuncioView } from '@/systems/rome/nuncioView';
import { mayBeCreated } from '@/systems/rome/college';
import { afar, homeSuccession } from '@/systems/homeFromAfar';
import { closeDiplomacyScene, DIPLOMACY, diplomacyWeek, dueDiplomacyScene } from '@/systems/rome/diplomacy';
import { atAcademy, young } from '../helpers/diplomat';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

const ACADEMY_TERM = { month: 10, day: 1 };

function inService(seed: string): GameState {
  const s = atAcademy(seed);
  return endStudy({ ...s, clock: { ...s.clock, week: s.study!.endWeek } }, offerById('rome_diplomatic_academy')!, createRng(`${seed}:end`));
}

/** Weeks of the service, the dials held where a trusted man keeps them. */
function serve(state: GameState, n: number, keep = true): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    if (keep) s = { ...s, study: { ...s.study!, place: { reports: 90, church: 60, state: 40, priesthood: 40 } } };
    s = diplomacyWeek(s).state;
    // The scene is answered as it comes: the next country is taken.
    if (dueDiplomacyScene(s)) s = closeDiplomacyScene(s);
  }
  return s;
}

describe('the Academy (E1 §11)', () => {
  it('writes to a young priest Rome and the nuncio regard, and not to an older man', () => {
    const s = young('dip-letter');
    expect(nuncioView(s).value).toBeGreaterThanOrEqual(50);
    const def = offerById('rome_diplomatic_academy')!;
    expect(isOfferEligible(def, s)).toBe(true);
    const old = { ...s, character: { ...s.character!, entryYear: 1980 } };
    expect(isOfferEligible(def, old)).toBe(false);
    expect(isOfferEligible(def, { ...s, flags: { ...s.flags, refused_academy: true } })).toBe(false);
  });

  it('takes him to Rome as a student, with the Academy\'s week and the missionary year ahead', () => {
    const s = atAcademy('dip-student');
    expect(s.study!.city).toBe('academy');
    expect(s.rome!.diplomacy!.rank).toBe('student');
    expect(s.rome!.diplomacy!.scene).toEqual({ kind: 'mission', dueWeek: s.clock.week + DIPLOMACY.missionAfter });
    const ids = studyActivitiesFor(s).map((a) => a.def.id);
    for (const id of ['acad_history', 'acad_languages', 'acad_drafting', 'acad_chapel']) expect(ids).toContain(id);
  });
});

describe('the service', () => {
  it('begins when the Academy ends: a secretary in a country, a chief, and no road home', () => {
    const s = inService('dip-begin');
    const d = s.rome!.diplomacy!;
    expect(s.study!.city).toBe('nunciature');
    expect(d.rank).toBe('secretary2');
    expect(nunciatures.map((n) => n.country)).toContain(d.country);
    expect(s.assignment).toBeNull();
    expect(s.offerHistory.filter((o) => o.offerId === 'rome_diplomatic_academy' && o.decision === 'completed')).toHaveLength(1);
    expect(resolveSelector(s, '@nuncio_chief')?.title).toBe('Archbishop');
    expect(s.letterQueue!.some((l) => l.title.startsWith('The service'))).toBe(true);
    expect(renderText('{nunciature}', s)).toBe(`the Apostolic Nunciature in ${d.country}`);
    expect(evaluateCondition({ type: 'diplomacy', key: 'rank', value: 'secretary2' }, s)).toBe(true);
  });

  it('moves him every few years, asking first, to a country he has not served', () => {
    let s = inService('dip-rotate');
    const first = s.rome!.diplomacy!.country!;
    const chief = resolveSelector(s, '@nuncio_chief')!.id;
    const at = s.rome!.diplomacy!.rotateWeek!;
    // The rotation is put to him before it happens, the next country named.
    let asked = false;
    while (s.clock.week < at) {
      s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
      s = diplomacyWeek(s).state;
      if (dueDiplomacyScene(s) === 'rotation') {
        asked = true;
        expect(renderText('{country_next}', s)).not.toBe(first);
        s = closeDiplomacyScene(s);
      }
    }
    expect(asked).toBe(true);
    expect(s.rome!.diplomacy!.country).not.toBe(first);
    expect(s.rome!.diplomacy!.countries).toHaveLength(2);
    expect(resolveSelector(s, '@nuncio_chief')!.id).not.toBe(chief);
    expect(s.study!.record!.countries).toBe(2);
  });

  it('climbs the ladder for a trusted man, and gives him a nunciature of his own in time', () => {
    let s = inService('dip-ladder');
    // In the service he is away for good: the home see's changes come as news, not as his turn.
    expect(afar(s)).toBe('service');
    expect(afar(atAcademy('dip-ladder'))).toBeNull();
    s = serve(s, 52 * 3);
    expect(s.rome!.diplomacy!.rank).toBe('secretary1');
    s = serve(s, 52 * 4);
    expect(s.rome!.diplomacy!.rank).toBe('counsellor');
    s = serve(s, 52 * 7);
    expect(s.rome!.diplomacy!.rank).toBe('nuncio');
    expect(s.flags.ordained_bishop).toBe(true);
    expect(resolveSelector(s, '@nuncio_chief')).toBeNull();
    expect(afar(s)).toBe('see');
    expect(studyActivitiesFor(s).find((a) => a.def.id === 'nun_ternas')!.available).toBe(true);
    // A nuncio of long service whom Rome regards is a man the pope may create a cardinal.
    const long = serve(s, 52 * 8);
    expect(mayBeCreated(long, sundayOf(long.clock))).toBe(true);
  });

  it('lets a secretary go home at a rotation, to the board and a parish, and remembers the service', () => {
    let s = inService('dip-home');
    s = { ...s, flags: { ...s.flags, 'diplomat:go_home': true } };
    s = diplomacyWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(s.study!.endWeek).toBe(s.clock.week);
    const home = endStudy(s, offerById('rome_diplomatic_academy')!, createRng('dip-home:end'));
    expect(home.study).toBeNull();
    expect(home.rome!.diplomacy).toBeUndefined();
    expect(home.flags.diplomat_served).toBe(true);
    expect(home.assignment).not.toBeNull();
    expect((home.letters ?? []).some((l) => l.title === 'Home from the service')).toBe(true);
    expect(home.offerHistory.filter((o) => o.offerId === 'rome_diplomatic_academy' && o.decision === 'completed')).toHaveLength(1);
  });

  it('ends a nuncio\'s service in retirement, with the letter at seventy-five', () => {
    let s = inService('dip-75');
    s = { ...s, rome: { ...s.rome!, diplomacy: { ...s.rome!.diplomacy!, rank: 'nuncio', nuncioSince: s.clock.week } }, character: { ...s.character!, entryYear: 1960 } };
    s = diplomacyWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(dueDiplomacyScene(s)).toBe('seventy_five');
    const end = endStudy({ ...s, clock: { ...s.clock, week: s.study!.endWeek } }, offerById('rome_diplomatic_academy')!, createRng('dip-75:end'));
    expect(end.mode).toMatchObject({ kind: 'ended', ending: 'retired' });
  });
});

describe('the Academy from Rome (E1 §11)', () => {
  /** A young priest two years into a licentiate at the Gregorian. */
  function student(seed: string): GameState {
    const y = young(seed);
    const s: GameState = { ...y, character: { ...y.character!, credentials: y.character!.credentials.filter((c) => c !== 'STL') } };
    const away = beginStudy(s, offerById('pv_rome_study')!, false, createRng(`${seed}:rome`));
    return { ...away, clock: { ...away.clock, week: away.clock.week + 60 }, character: { ...away.character!, reputation: { ...away.character!.reputation, rome: 30 } } };
  }

  it('asks a priest at the Gregorian, and not one at home or one who has said no', () => {
    const def = offerById('rome_academy_from_rome')!;
    const s = student('dip-rome-ask');
    expect(s.study!.city).toBe('rome');
    expect(isOfferEligible(def, s)).toBe(true);
    expect(isOfferEligible(def, young('dip-rome-home'))).toBe(false);
    expect(isOfferEligible(def, { ...s, flags: { ...s.flags, refused_academy: true } })).toBe(false);
  });

  it('takes him from the degree straight to the Academy, degree in hand, when it ends near the October the Academy opens', () => {
    const def = offerById('rome_academy_from_rome')!;
    let s = student('dip-rome-yes');
    s = acceptAndGo({ ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 4, bindings: {} }] }, def, createRng('yes')).state;
    expect(s.flags['academy:recruited']).toBe(true);
    expect(s.study!.city).toBe('rome');
    // The home letter does not come to a man already promised to the Academy.
    expect(isOfferEligible(offerById('rome_diplomatic_academy')!, s)).toBe(false);
    // The degree ends two weeks before the Academy's year opens.
    const opens = termWeek(s.clock, ACADEMY_TERM, s.study!.endWeek);
    const done = endStudy({ ...s, clock: { ...s.clock, week: opens - 2 }, study: { ...s.study!, endWeek: opens - 2 } }, offerById('pv_rome_study')!, createRng('done'));
    expect(done.study!.city).toBe('academy');
    // Its three years run from the October it opens, not the week he carried his books across.
    expect(done.study!.endWeek).toBe(opens + 156);
    expect(dateOf(done.clock, opens).month).toBe(10);
    expect(done.rome!.diplomacy!.rank).toBe('student');
    expect(done.character!.credentials).toContain('STL');
    expect(done.assignment).toBeNull();
    expect(done.flags['academy:recruited']).toBeUndefined();
    expect(done.career.some((e) => /stayed in Rome for the Academy/.test(e.text))).toBe(true);
  });

  it('sends him home to wait when the degree ends months before October, and moves him the week the Academy opens', () => {
    const def = offerById('rome_academy_from_rome')!;
    let s = student('dip-rome-wait');
    s = acceptAndGo({ ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 4, bindings: {} }] }, def, createRng('yes')).state;
    // The degree ends in the spring: twenty weeks before the Academy's year.
    const opens = termWeek(s.clock, ACADEMY_TERM, s.study!.endWeek + 20);
    const end = opens - 20;
    const home = endStudy({ ...s, clock: { ...s.clock, week: end }, study: { ...s.study!, endWeek: end } }, offerById('pv_rome_study')!, createRng('home'));
    expect(home.study).toBeNull();
    expect(home.character!.credentials).toContain('STL');
    // A plain post from the board, not the flagship's choice: he is going back to Rome.
    expect(home.mode.kind).toBe('assignment');
    expect(pendingAppointment(home)).toMatchObject({ offerId: 'rome_diplomatic_academy', week: opens });
    expect(home.beats.some((b) => b.week === opens)).toBe(true);
    expect(home.career.some((e) => /Academy's year opens on \d+ October/.test(e.text))).toBe(true);
    expect(home.career.some((e) => /stayed in Rome/.test(e.text))).toBe(false);
    // The letter that moves him in October names the post he was given to wait in.
    const parish = home.world!.parishes.find((x) => x.id === home.assignment!.parishId)!;
    expect(renderText('{appointment_from}', home)).toBe(parish.name);
    // No other letter can move him in the meantime.
    expect(isOfferEligible(offerById('pv_canon_law_licentiate')!, home)).toBe(false);
    // The week it opens, the letter moves him.
    const oct = appointmentStep({ ...home, clock: { ...home.clock, week: opens } }, createRng('oct'), offerById);
    expect(oct.letter).toBe('go');
    expect(oct.state.study!.city).toBe('academy');
    expect(oct.state.study!.startWeek).toBe(opens);
    expect(oct.state.rome!.diplomacy!.rank).toBe('student');
  });

  it('holds the letter home until the Academy\'s October, whenever in the year he says yes', () => {
    const def = offerById('rome_diplomatic_academy')!;
    for (const shift of [0, 10, 20, 30, 40, 50]) {
      const base = young(`dip-term-${shift}`);
      const s: GameState = { ...base, clock: { ...base.clock, week: base.clock.week + shift }, offers: [{ offerId: def.id, arrivedWeek: base.clock.week + shift, expiresWeek: base.clock.week + shift + 4, bindings: {} }] };
      const r = acceptOffer(s, def, createRng(`term:${shift}`)).state;
      const p = pendingAppointment(r)!;
      expect(p.offerId).toBe(def.id);
      const d = dateOf(r.clock, p.week);
      expect(d.month === 10 && d.day <= 7, `shift ${shift}`).toBe(true);
      expect(p.week - s.clock.week).toBeGreaterThanOrEqual(2);
      expect(p.week - s.clock.week).toBeLessThan(56);
      // Until then he is where he was.
      expect(r.study).toBeFalsy();
      expect(r.parish).not.toBeNull();
    }
  });

  it('lets the offer lapse if the degree is not finished', () => {
    const def = offerById('rome_academy_from_rome')!;
    let s = student('dip-rome-fail');
    s = acceptAndGo({ ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 4, bindings: {} }] }, def, createRng('yes')).state;
    const home = endStudy({ ...s, study: { ...s.study!, failed: true }, clock: { ...s.clock, week: s.study!.endWeek } }, offerById('pv_rome_study')!, createRng('fail'));
    expect(home.study).toBeNull();
    expect(home.rome?.diplomacy).toBeUndefined();
    expect(home.career.some((e) => /kind letter/.test(e.text))).toBe(true);
  });

  it('seats the first dinner in his first weeks, whenever in the year he comes, and the French wall months later', () => {
    const s = atAcademy('dip-weeks');
    const at = (n: number): GameState => ({ ...s, clock: { ...s.clock, week: s.study!.startWeek + n } });
    const dinner = eventById('dp_first_dinner')!;
    const french = eventById('dp_language_wall')!;
    expect(evaluateCondition({ type: 'weeks_away', op: '<=', value: 8 }, at(3))).toBe(true);
    expect(evaluateCondition({ type: 'weeks_away', op: '<=', value: 8 }, young('dip-home'))).toBe(false);
    expect(evaluateAll(dinner.requires ?? [], at(2))).toBe(true);
    expect(evaluateAll(dinner.requires ?? [], at(20))).toBe(false);
    expect(evaluateAll(french.requires ?? [], at(4))).toBe(false);
    expect(evaluateAll(french.requires ?? [], at(20))).toBe(true);
  });
});

describe('home, from the nunciature (E1 §9 E, §11)', () => {
  it('tells a diplomat of a new bishop at home as news, not as his turn, and not as one bishop to another', () => {
    const d = inService('dip-home-news');
    const bishop = d.world!.diocese.hidden.bishop.npcId;
    // The home bishop made very old, so that his see changes hands.
    const s: GameState = { ...d, npcs: { ...d.npcs, [bishop]: { ...d.npcs[bishop]!, birthYear: 1900 } } };
    const before = s.world!.diocese.hidden.bishop.npcId;
    let out: ReturnType<typeof homeSuccession> | null = null;
    for (let i = 0; i < 400 && !out?.letter; i++) out = homeSuccession(s, createRng(`dip-home-news:${i}`));
    expect(out!.letter).not.toBeNull();
    expect(out!.state.world!.diocese.hidden.bishop.npcId).not.toBe(before);
    expect(out!.letter!.body.join(' ')).toMatch(/Secretariat of State moves you/);
    expect(out!.letter!.body.join(' ')).not.toMatch(/brother bishop/);
    expect(out!.state.career.at(-1)!.kind).toBe('note');
    expect(out!.state.flags.new_bishop_pending).toBeFalsy();
  });
});
