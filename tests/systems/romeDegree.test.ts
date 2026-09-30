import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById, offersForPhase } from '@/content/offers';
import { studyProgram } from '@/content/study';
import { officeDef } from '@/content/parish';
import { eventById } from '@/content';
import { dueFlag, isOfferEligible, offersWeek } from '@/engine/offers';
import { evaluateAll } from '@/engine/conditions';
import { nuncioView } from '@/systems/rome/nuncioView';
import { PROMOTION } from '@/systems/promotion';
import { REQUESTABLE_POSTS } from '@/systems/request';
import type { GameState } from '@/types';

function alumnus(seed: string, regard = 25): GameState {
  const s = parishState(seed);
  const bishop = Object.values(s.npcs).find((n) => n.role === 'bishop')!;
  return {
    ...s,
    clock: { ...s.clock, week: s.clock.week + 52 * 5 },
    character: { ...s.character!, credentials: [...s.character!.credentials, 'STL', 'italian'], reputation: { ...s.character!.reputation, rome: 20, chancery: 20 }, stats: { ...s.character!.stats, theology: 60 } },
    flags: { ...s.flags, rome_alumnus: true },
    npcs: { ...s.npcs, [bishop.id]: { ...bishop, relationship: regard } },
    offers: [],
  };
}

describe('the Gregorian and what comes after', () => {
  it('the doctorate is a course of study a licentiate can be asked to, and asked for', () => {
    expect(studyProgram('rome_std')).toMatchObject({ kind: 'study', city: 'rome' });
    expect(REQUESTABLE_POSTS).toContain('pv_rome_doctorate');
    const def = offerById('pv_rome_doctorate')!;
    const s = alumnus('std');
    expect(isOfferEligible(def, s)).toBe(true);
    expect(isOfferEligible(def, { ...s, character: { ...s.character!, credentials: ['italian'] } })).toBe(false);
    expect(def.accept.commitment?.away).toBe('rome_std');
    expect(def.accept.commitment?.onComplete.some((e) => e.target === 'credential' && e.key === 'STD')).toBe(true);
  });

  it("the seminary's chair and the bishop's theologian are promised to a man with the degree", () => {
    const s = alumnus('promised');
    const fac = offerById('pv_seminary_faculty')!;
    // Theology at 60 would not have qualified; the licentiate does.
    expect(isOfferEligible(fac, s)).toBe(true);
    expect(fac.guarantee?.when.some((c) => c.type === 'credential' && c.key === 'STL')).toBe(true);
    const theo = offerById('pv_bishops_theologian')!;
    expect(officeDef('bishops_theologian')).toBeTruthy();
    expect(isOfferEligible(theo, s)).toBe(true);
    const defs = offersForPhase('parochial_vicar');
    const t = offersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng('p'), defs, offerById);
    const due = (id: string) => typeof t.flags[dueFlag(offerById(id)!)] === 'number' || t.offers.some((o) => o.offerId === id);
    expect(due('pv_seminary_faculty')).toBe(true);
    expect(due('pv_bishops_theologian')).toBe(true);
    // Without the bishop's regard the theologian's chair is only the dice.
    const cool = offersWeek({ ...alumnus('cool', 12), clock: { ...s.clock, week: s.clock.week + 1 } }, createRng('c'), defs, offerById);
    expect(typeof cool.flags[dueFlag(theo)]).not.toBe('number');
  });

  it('the degree weighs in promotion and in the nuncio\'s view, and the Roman network asks its questions of an alumnus', () => {
    expect(PROMOTION.credentialBonus.pastor.STL).toBeGreaterThanOrEqual(8);
    expect(PROMOTION.credentialBonus.chancery.STD).toBeGreaterThan(PROMOTION.credentialBonus.chancery.STL!);
    const s = alumnus('view');
    const plain = nuncioView({ ...s, character: { ...s.character!, credentials: [] }, flags: { ...s.flags, rome_alumnus: false } });
    const stl = nuncioView(s);
    const std = nuncioView({ ...s, character: { ...s.character!, credentials: [...s.character!.credentials, 'STD'] } });
    expect(stl.value).toBeGreaterThan(plain.value);
    expect(std.value).toBeGreaterThan(stl.value);
    expect(std.good).toContain('the doctorate');
    const ids = ['ra_the_letter_from_the_curia', 'ra_the_lecture', 'ra_the_envy', 'ra_the_conference_draft', 'ra_the_nuncio_dinner', 'ra_the_journalist', 'ra_the_stranger', 'ra_the_recommendation'];
    for (const id of ids) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'flag' && c.key === 'rome_alumnus'), id).toBe(true);
      expect(e.choices.some((c) => c.roll), id).toBe(true);
      expect(evaluateAll(e.requires ?? [], parishState('ra:plain')), id).toBe(false);
    }
    expect(eventById('ra_the_recommendation')!.flavorPrompt).toBeUndefined();
  });
});
