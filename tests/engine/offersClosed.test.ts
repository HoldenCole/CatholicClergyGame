import { describe, expect, it } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { OFFERS, closeOffer, declineOffer, isOfferEligible, offerClosed } from '@/engine/offers';
import { allOffers } from '@/content/offers';
import type { GameState } from '@/types';

function open(state: GameState, id: string): GameState {
  return { ...state, offers: [{ offerId: id, arrivedWeek: state.clock.week, expiresWeek: state.clock.week + 4, bindings: {} }] };
}

describe('an offer refused twice stops coming', () => {
  const def = allOffers.find((d) => !d.once && !d.from && d.windowWeeks > 0 && (d.decline.effects ?? []).every((e) => e.target !== 'end'))!;
  it('is offerable again after one no and the wait, and not after two', () => {
    let s = seminaryState('closed');
    s = declineOffer(open(s, def.id), def);
    expect(offerClosed(s, def)).toBe(false);
    const later = { ...s, clock: { ...s.clock, week: s.clock.week + OFFERS.reofferAfterWeeks + 1 } };
    expect(later.offerHistory.filter((h) => h.offerId === def.id && h.decision === 'declined')).toHaveLength(1);
    s = declineOffer(open(later, def.id), def);
    expect(offerClosed(s, def)).toBe(true);
    const much = { ...s, clock: { ...s.clock, week: s.clock.week + 1000 } };
    expect(isOfferEligible(def, much)).toBe(false);
  });
  it('"not again" closes it at the first no', () => {
    const s = closeOffer(open(seminaryState('closed2'), def.id), def);
    expect(offerClosed(s, def)).toBe(true);
    expect(s.offers).toHaveLength(0);
    expect(s.offerHistory[s.offerHistory.length - 1]!.decision).toBe('declined');
  });
});
