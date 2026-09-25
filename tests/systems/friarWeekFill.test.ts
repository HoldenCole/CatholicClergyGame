import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { DEFAULT_SPENDS_FLAG, defaultSpends, spendBudget, spendsOf, spendsUsed } from '@/systems/religious/spends';
import { HOUSE_LIFE_LINES, houseLifeLine } from '@/systems/religious/houseLife';
import { friarLoad } from '@/systems/religious/bishopAsks';
import { laneOf } from '@/systems/digest';
import { allOffers } from '@/content/offers';
import { isOfferEligible } from '@/engine/offers';
import type { GameState, OrderKey } from '@/types';

/** A priest of the order a year ordained, in a priory of his province. */
function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  const s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 64, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: 0 } }, gen, 2010, priory.id);
  return { ...s, seminary: null, phase: 'parochial_vicar', clock: { ...s.clock, week: 60 }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, spends: {} } };
}

describe('a friar\'s week is not handed to him empty', () => {
  it('the order\'s default week is given once, as data, within the hours he has', () => {
    for (const order of ['OP', 'OSA'] as const) {
      const s = defaultSpends(friar(`def-${order}`, order));
      const given = spendsOf(s);
      const wanted = religiousOrder(order).mechanics.defaultSpends!;
      expect(Object.keys(given).length).toBeGreaterThan(0);
      for (const id of Object.keys(given)) expect(wanted[id]).toBeDefined();
      expect(spendsUsed(s)).toBeLessThanOrEqual(spendBudget(s) + 1e-9);
      expect(s.flags[DEFAULT_SPENDS_FLAG]).toBe(true);
    }
  });

  it('a week he cleared stays cleared, and a week he set is left alone', () => {
    const once = defaultSpends(friar('clear'));
    const cleared = { ...once, religious: { ...once.religious!, spends: {} } };
    expect(spendsOf(defaultSpends(cleared))).toEqual({});
    const own = friar('own');
    const set = { ...own, religious: { ...own.religious!, spends: { mercy: 2 } } };
    expect(spendsOf(defaultSpends(set))).toEqual({ mercy: 2 });
  });

  it('the hours that are his are never fewer than ten, however much the house and the offices take', () => {
    const s = friar('floor');
    expect(spendBudget(s)).toBeGreaterThanOrEqual(10);
    const heavy = { ...s, religious: { ...s.religious!, horarium: { ...s.religious!.horarium, hours: 'invested' as const, common_table: 'invested' as const, conventual_mass: 'invested' as const, house_chapter: 'invested' as const } } };
    expect(spendBudget(heavy)).toBeGreaterThanOrEqual(10);
  });

  it('a novice is not given a priest\'s week', () => {
    const s = friar('novice');
    const novice = { ...s, flags: { ...s.flags, ordained: false } };
    expect(defaultSpends(novice)).toBe(novice);
  });

  it('a commitment he accepted runs beside the week and takes none of its hours', () => {
    const s = friar('commit');
    const before = friarLoad(s);
    const busy = { ...s, commitments: [{ offerId: 'fr_parish_mission', label: 'Preaching a parish mission', startWeek: 60, endWeek: 62, apPerWeek: 4, failed: false }] };
    expect(friarLoad(busy)).toBeCloseTo(before);
  });
});

describe('the house around him', () => {
  it('most weeks carry a line of the house, filed with the place around him, never a line the Record still shows', () => {
    let s = friar('life');
    let said = 0;
    for (let w = 0; w < 52; w++) {
      const line = houseLifeLine(s, createRng(`life:${w}`));
      const recent = new Set(s.digest.slice(-12).flatMap((d) => d.lines));
      if (line) {
        said++;
        expect(recent.has(line)).toBe(false);
        expect(laneOf(line)).toBe('around');
      }
      s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 }, digest: [...s.digest, { week: s.clock.week, lines: line ? [line] : [] }] };
    }
    expect(said).toBeGreaterThan(26);
    expect(new Set(HOUSE_LIFE_LINES).size).toBe(HOUSE_LIFE_LINES.length);
  });

  it('the Record files his week as his and news of a named brother with the brothers', () => {
    expect(laneOf('The library, and the argument with Thomas. Confessions until the church was dark.')).toBe('you');
    expect(laneOf('Fr. Sepúlveda\'s mother is dying, slowly, in the next county, and he drives there on his days off.')).toBe('people');
    expect(laneOf('Fr. Battaglia, of your class, has been elected prior of a house of the province.')).toBe('people');
  });

  it('says nothing to a priest of the diocese', () => {
    const { religious: _r, ...d } = seminaryState('dioc');
    void _r;
    expect(houseLifeLine(d as GameState, createRng('x'))).toBeNull();
  });
});

describe('the order\'s own letters', () => {
  it('a friar a year ordained has several of the provincial\'s and the prior\'s letters open to him, and none of the diocese\'s', () => {
    const s = friar('letters');
    const open = allOffers.filter((o) => isOfferEligible(o, s));
    expect(open.every((o) => o.campaign === 'religious')).toBe(true);
    expect(open.length).toBeGreaterThanOrEqual(5);
  });
});
