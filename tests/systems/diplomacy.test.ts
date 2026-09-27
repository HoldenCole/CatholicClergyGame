import { describe, it, expect } from 'vitest';
import { offerById } from '@/content/offers';
import { nunciatures } from '@/content/rome';
import { createRng } from '@/engine/rng';
import { isOfferEligible } from '@/engine/offers';
import { endStudy } from '@/engine/study';
import { evaluateCondition } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { resolveSelector } from '@/engine/selectors';
import { sundayOf } from '@/engine/time';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { nuncioView } from '@/systems/rome/nuncioView';
import { mayBeCreated } from '@/systems/rome/college';
import { afar } from '@/systems/homeFromAfar';
import { closeDiplomacyScene, DIPLOMACY, diplomacyWeek, dueDiplomacyScene } from '@/systems/rome/diplomacy';
import { atAcademy, young } from '../helpers/diplomat';
import type { GameState } from '@/types';

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
