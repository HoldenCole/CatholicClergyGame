import { describe, it, expect } from 'vitest';
import { acceptOffer, commitmentAp, declineOffer, isOfferEligible, offersWeek, offerWeight } from '@/engine/offers';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, rngFromSave, serialize } from '@/engine/save';
import { seminaryState } from '../helpers/fixtures';
import type { GameState, OfferDef } from '@/types';

function def(overrides: Partial<OfferDef> = {}): OfferDef {
  return {
    id: 'rome_summer',
    category: 'academic',
    phase: ['seminary'],
    title: 'A summer in Rome',
    body: '{@rector} has put your name forward.',
    from: '@rector',
    requires: [{ type: 'stat', key: 'theology', op: '>=', value: 30 }],
    weight: 1000,
    windowWeeks: 4,
    cluster: 'academic',
    accept: {
      effects: [{ target: 'flag', key: 'went_to_rome', value: true }],
      outcome: 'You go.',
      commitment: {
        label: 'Rome',
        weeks: 10,
        apPerWeek: 2,
        onComplete: [{ target: 'credential', key: 'italian_basic' }],
        completeOutcome: 'You return.',
      },
    },
    decline: { effects: [{ target: 'reputation', key: 'rome', delta: -3 }], outcome: 'You stay.' },
    failure: { chance: 1, unless: [{ type: 'stat', key: 'knowledge', op: '>=', value: 60 }], effects: [{ target: 'concern', key: 'Failed in Rome' }], outcome: 'It went badly.' },
    ...overrides,
  };
}

const lookupOf = (defs: OfferDef[]) => (id: string) => defs.find((d) => d.id === id);

function withoutFailure(d: OfferDef): OfferDef {
  const { failure: _failure, ...rest } = d;
  return rest;
}

function atWeek(state: GameState, week: number): GameState {
  return { ...state, clock: { ...state.clock, week } };
}

describe('engine/offers', () => {
  const base = seminaryState();

  it('eligibility checks phase, year, requirements, selectors, open, once, and commitments', () => {
    expect(isOfferEligible(def(), base)).toBe(true);
    expect(isOfferEligible(def({ phase: ['pastor'] }), base)).toBe(false);
    expect(isOfferEligible(def({ yearGate: [3] }), base)).toBe(false);
    expect(isOfferEligible(def({ requires: [{ type: 'stat', key: 'theology', op: '>=', value: 99 }] }), base)).toBe(false);
    expect(isOfferEligible(def({ from: '@spiritual_director' }), base)).toBe(false);
    expect(isOfferEligible(def(), { ...base, offers: [{ offerId: 'rome_summer', arrivedWeek: 0, expiresWeek: 4, bindings: {} }] })).toBe(false);
    expect(isOfferEligible(def({ once: true }), { ...base, offerHistory: [{ offerId: 'rome_summer', week: 0, decision: 'declined' }] })).toBe(false);
    expect(isOfferEligible(def(), { ...base, commitments: [{ offerId: 'rome_summer', label: 'x', startWeek: 0, endWeek: 9, apPerWeek: 1, failed: false }] })).toBe(false);
  });

  it('clustering raises the weight of accepted categories', () => {
    expect(offerWeight(def(), base)).toBe(1000);
    expect(offerWeight(def(), { ...base, clusters: { academic: 2 } })).toBeCloseTo(1000 * 1.8 * 1.8);
    expect(offerWeight(def({ bias: [{ when: { type: 'flag', key: 'x', value: true }, multiplier: 0 }] }), { ...base, flags: { x: true } })).toBe(0);
  });

  it('an offer arrives with a window and bindings, and stops arriving once open', () => {
    const defs = [def()];
    const s = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    expect(s.offers).toHaveLength(1);
    expect(s.offers[0]).toMatchObject({ offerId: 'rome_summer', arrivedWeek: 10, expiresWeek: 14, bindings: { '@rector': 'rector' } });
    const s2 = offersWeek(atWeek(s, 11), createRng('again'), defs, lookupOf(defs));
    expect(s2.offers).toHaveLength(1);
  });

  it('arrival is probabilistic in the weight and deterministic in the seed', () => {
    const defs = [def({ weight: 100 })];
    let arrivals = 0;
    for (let i = 0; i < 500; i++) {
      if (offersWeek(atWeek(base, i), createRng(`p-${i}`), defs, lookupOf(defs)).offers.length) arrivals++;
    }
    expect(arrivals).toBeGreaterThan(20);
    expect(arrivals).toBeLessThan(90);
    expect(offersWeek(atWeek(base, 3), createRng('d'), defs, lookupOf(defs))).toEqual(offersWeek(atWeek(base, 3), createRng('d'), defs, lookupOf(defs)));
  });

  it('declining writes the consequence and costs the relationship; expiry costs more', () => {
    const defs = [def()];
    const open = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    const declined = declineOffer(open, defs[0]!);
    expect(declined.offers).toHaveLength(0);
    expect(declined.character!.reputation.rome).toBe(-3);
    expect(declined.npcs.rector!.relationship).toBe(-8);
    expect(declined.offerHistory).toEqual([{ offerId: 'rome_summer', week: 10, decision: 'declined' }]);
    const expired = offersWeek(atWeek(open, 15), createRng('x'), defs, lookupOf(defs));
    expect(expired.offers).toHaveLength(0);
    expect(expired.npcs.rector!.relationship).toBe(-12);
    expect(expired.offerHistory[0]!.decision).toBe('expired');
  });

  it('accepting starts a commitment that pays out when it ends and counts against AP', () => {
    const defs = [withoutFailure(def())];
    const open = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    const { state: accepted, failed } = acceptOffer(open, defs[0]!, createRng('ok'));
    expect(failed).toBe(false);
    expect(accepted.flags.went_to_rome).toBe(true);
    expect(accepted.commitments[0]).toMatchObject({ offerId: 'rome_summer', startWeek: 10, endWeek: 20, apPerWeek: 2, failed: false });
    expect(commitmentAp(accepted)).toBe(2);
    expect(accepted.clusters.academic).toBe(1);
    const midway = offersWeek(atWeek(accepted, 15), createRng('m'), defs, lookupOf(defs));
    expect(midway.commitments).toHaveLength(1);
    const done = offersWeek(atWeek(accepted, 20), createRng('m'), defs, lookupOf(defs));
    expect(done.commitments).toHaveLength(0);
    expect(done.character!.credentials).toContain('italian_basic');
    expect(done.offerHistory.map((h) => h.decision)).toEqual(['accepted', 'completed']);
  });

  it('an underqualified acceptance can fail, and the failure lands when the commitment ends', () => {
    const defs = [def()];
    const open = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    const { state: accepted, failed } = acceptOffer(open, defs[0]!, createRng('fail'));
    expect(failed).toBe(true);
    const done = offersWeek(atWeek(accepted, 20), createRng('m'), defs, lookupOf(defs));
    expect(done.seminary!.concerns).toContain('Failed in Rome');
    expect(done.character!.credentials).not.toContain('italian_basic');
    expect(done.offerHistory.map((h) => h.decision)).toEqual(['accepted', 'failed']);
    const qualified: GameState = { ...open, character: { ...open.character!, stats: { ...open.character!.stats, knowledge: 70 } } };
    expect(acceptOffer(qualified, defs[0]!, createRng('fail')).failed).toBe(false);
  });

  it('a commitment survives save and load mid-way and completes on schedule', () => {
    const defs = [withoutFailure(def())];
    const open = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    const rng = createRng('save');
    const { state: accepted } = acceptOffer(open, defs[0]!, rng);
    const midway = offersWeek(atWeek(accepted, 14), rng, defs, lookupOf(defs));
    const save = deserialize(serialize(buildSave(midway, rng, null)));
    expect(save.state.commitments[0]!.endWeek).toBe(20);
    const resumedRng = rngFromSave(save);
    let s = save.state;
    for (let w = 15; w <= 20; w++) s = offersWeek(atWeek(s, w), resumedRng, defs, lookupOf(defs));
    expect(s.commitments).toHaveLength(0);
    expect(s.character!.credentials).toContain('italian_basic');
  });

  it('one-scene offers expire the week after they arrive if ignored', () => {
    const defs = [def({ windowWeeks: 0 })];
    const open = offersWeek(atWeek(base, 10), createRng('arrive'), defs, lookupOf(defs));
    expect(open.offers[0]!.expiresWeek).toBe(10);
    const later = offersWeek(atWeek(open, 11), createRng('x'), defs, lookupOf(defs));
    expect(later.offers).toHaveLength(0);
    expect(later.offerHistory[0]!.decision).toBe('expired');
  });
});
