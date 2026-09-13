import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { deferOffer, isOfferEligible, OFFERS, offerWeight, onFileFlag, offersWeek } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { stopAfterWeek } from '@/engine/clock';
import { explainAlignment, explainStat, reasonsLine } from '@/systems/movers';
import { studyWeek, setStudyActivity } from '@/systems/studyWeek';
import { clubsForPhase } from '@/systems/clubs';
import { acceptAndGo } from '../helpers/appointment';
import { parishWeek } from '@/engine/parish';
import type { GameState } from '@/types';

describe('the why behind the stats', () => {
  it('hours away note what they built, and the reasons read in words', () => {
    const base = parishState('why');
    const c = base.character!;
    const s: GameState = { ...base, character: { ...c, stats: { ...c.stats, theology: 75, knowledge: 60 }, reputation: { ...c.reputation, chancery: 40 } }, offers: [{ offerId: 'pv_rome_study', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }], flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3, rome_track: true } };
    let away = acceptAndGo(s, offerById('pv_rome_study')!, createRng('a')).state;
    away = setStudyActivity(away, 'thesis', 3);
    const after = studyWeek({ ...away, clock: { ...away.clock, week: away.clock.week + 1 } }, createRng('w')).state;
    const theology = explainStat(after, 'theology');
    expect(theology.length).toBeGreaterThan(0);
    expect(reasonsLine(theology, 1)).toMatch(/This quarter: .* \+/);
  });

  it('a parish week notes atrophy under its own reason, and a club notes alignment', () => {
    const s = parishState('atrophy');
    const week = parishWeek(s, createRng('rw'));
    const knowledge = explainStat(week, 'knowledge');
    expect(knowledge.some((r) => /fading/.test(r.label)) || knowledge.length === 0).toBe(true);
    const sem = seminaryState('club');
    const joined: GameState = { ...sem, flags: { ...sem.flags, 'club_pending:tlm_society': 'join' }, movers: [] };
    expect(clubsForPhase(joined).some((d) => d.id === 'tlm_society')).toBe(true);
    // alignment moves through effects carry a reason
    const moved = { ...joined, movers: [{ week: joined.clock.week, key: 'alignment', delta: -3, why: 'The Latin Mass Society' }] };
    expect(explainAlignment(moved)[0]!.label).toBe('The Latin Mass Society');
  });

  it('every invite-only club says what earns the letter', () => {
    for (const phase of ['seminary', 'priest'] as const) {
      const s = phase === 'seminary' ? seminaryState('hint') : parishState('hint');
      for (const def of clubsForPhase(s)) if (def.inviteOnly) expect(def.hint, def.id).toBeTruthy();
    }
  });
});

describe('not now, keep my name', () => {
  function withHospital(seed: string): GameState {
    const base = parishState(seed);
    return { ...base, offers: [{ offerId: 'pv_hospital_chaplain', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 3, bindings: {} }], flags: { ...base.flags, ordination_week: base.clock.week - 52 * 2, 'summer:hospital': true } };
  }
  it('costs less than a no, keeps the offer alive despite once, and weighs it heavier when it comes back', () => {
    const def = offerById('pv_hospital_chaplain')!;
    const s = withHospital('defer');
    const next = deferOffer(s, def);
    expect(next.offers).toHaveLength(0);
    expect(next.offerHistory.at(-1)).toMatchObject({ offerId: def.id, decision: 'deferred' });
    expect(next.flags[onFileFlag(def)]).toBe(true);
    // Too soon, then eligible again sooner than a refusal would allow, and heavier.
    expect(isOfferEligible(def, next)).toBe(false);
    const later: GameState = { ...next, clock: { ...next.clock, week: next.clock.week + OFFERS.reofferAfterDeferWeeks } };
    expect(isOfferEligible(def, later)).toBe(true);
    expect(offerWeight(def, later)).toBeCloseTo(offerWeight(def, { ...later, flags: { ...later.flags, [onFileFlag(def)]: false } }) * OFFERS.deferredWeight);
    // When it arrives again the file note is spent.
    let again: GameState = later;
    for (let i = 0; i < 400 && !again.offers.some((o) => o.offerId === def.id); i++) again = offersWeek({ ...again, clock: { ...again.clock, week: again.clock.week + 1 } }, createRng(`re${i}`), [def], offerById);
    expect(again.offers.some((o) => o.offerId === def.id)).toBe(true);
    expect(again.flags[onFileFlag(def)]).toBeUndefined();
    expect(() => deferOffer({ ...s, offers: [{ offerId: 'pv_rome_study', arrivedWeek: 0, expiresWeek: 9, bindings: {} }] }, offerById('pv_rome_study')!)).toThrow(/not now/);
  });
});

describe('the clock and the letters', () => {
  it('stops the week before a letter lapses, at every speed but SKIP', () => {
    const base = parishState('lapse');
    const s: GameState = { ...base, offers: [{ offerId: 'pv_hospital_chaplain', arrivedWeek: base.clock.week - 2, expiresWeek: base.clock.week + 1, bindings: {} }] };
    expect(stopAfterWeek('AUTO', s, [])).toMatchObject({ kind: 'offer', lapsing: true });
    expect(stopAfterWeek('SKIP', s, [])).toBeNull();
    const fine: GameState = { ...s, offers: [{ ...s.offers[0]!, expiresWeek: base.clock.week + 2 }] };
    expect(stopAfterWeek('AUTO', fine, [])).toBeNull();
  });
});
