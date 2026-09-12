import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { dueFlag, isOfferEligible, offersWeek } from '@/engine/offers';
import { offerById, offersForPhase } from '@/content/offers';
import { eventById, eventsForPhase } from '@/content';
import { seminaryWeekHook, type EventDeps } from '@/engine/weekHook';
import type { GameState } from '@/types';

function traditionalSecondYear(seed: string, alignment = -30): GameState {
  const s = seminaryState(seed);
  return { ...s, character: { ...s.character!, alignment }, seminary: { ...s.seminary!, year: 2 }, clock: { ...s.clock, week: 60 } };
}

const defs = offersForPhase('seminary');

describe('letters in seminary', () => {
  it('the Latin Mass society is eligible for a man who is not progressive, and promised to one who clearly is traditional', () => {
    const def = offerById('sem_tlm_society')!;
    expect(isOfferEligible(def, traditionalSecondYear('elig'))).toBe(true);
    expect(isOfferEligible(def, traditionalSecondYear('prog', 25))).toBe(false);
    expect(def.guarantee).toBeDefined();
    let s = traditionalSecondYear('promise');
    let arrived: number | null = null;
    for (let i = 0; i < 60 && arrived === null; i++) {
      s = offersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`w${i}`), defs, offerById);
      if (i === 0) expect(typeof s.flags[dueFlag(def)]).toBe('number');
      if (s.offers.some((o) => o.offerId === def.id)) arrived = i + 1;
    }
    expect(arrived).not.toBeNull();
    expect(arrived!).toBeLessThanOrEqual(def.guarantee!.withinWeeks);
    expect(s.flags[dueFlag(def)]).toBeUndefined();
    // A man of the middle gets no promise, only the dice.
    const middle = offersWeek(traditionalSecondYear('middle', 0), createRng('m'), defs, offerById);
    expect(middle.flags[dueFlag(def)]).toBeUndefined();
  });

  it('the seminary week ticks the offer engine, so invitations arrive during the year', () => {
    const deps: EventDeps = { pool: eventsForPhase('seminary'), lookup: eventById, offers: defs, offerLookup: offerById };
    const def = offerById('sem_tlm_society')!;
    let s = traditionalSecondYear('hook');
    s = { ...s, seminary: { ...s.seminary!, emphasis: { human: 3, spiritual: 3, intellectual: 2, pastoral: 2 } }, mode: { kind: 'clock' }, flags: { ...s.flags, [dueFlag(def)]: s.clock.week + 1 } };
    let seen = false;
    for (let i = 0; i < 12 && !seen; i++) {
      s = seminaryWeekHook(deps)({ ...s, clock: { ...s.clock, week: s.clock.week + 1 }, pending: [], mode: { kind: 'clock' } }, createRng(`h${i}`), []);
      seen = s.offers.some((o) => o.offerId === def.id);
    }
    expect(seen).toBe(true);
  });
});
