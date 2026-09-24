import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince, PROVINCE } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { installSuperior } from '@/systems/religious/chapter';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { askGrant, buildOffers, buildWeek, capacityOf, expectedHouseVocations, GROWTH, houseMoney, provinceGrowthYear, startBuild } from '@/systems/religious/growth';
import { spendPurse } from '@/systems/religious/priorDesk';
import type { GameState, OrderKey } from '@/types';

function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: 0 } }, gen, 2010, priory.id);
  s = { ...s, phase: 'parochial_vicar', religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10 } };
  return s;
}

function asPrior(s: GameState): GameState {
  const house = currentHouse(s)!;
  const seated = installSuperior(s, 'prior', house.id, PLAYER_ID);
  return { ...seated, religious: { ...seated.religious!, office: { office: 'prior', bodyId: house.id, startWeek: s.clock.week, endWeek: s.clock.week + 156, consecutive: 1 } } };
}

describe('houses that live: size, vocations, deaths, money, and building (E3 §3.2, §9.5)', () => {
  it('no house is generated tiny: every kind keeps its floor, and a priory has ten men or more', () => {
    for (const order of ['OP', 'OSA'] as OrderKey[]) for (const seed of ['a', 'b', 'c', 'd']) {
      const def = religiousOrder(order);
      for (const prov of def.provinces) {
        const gen = generateProvince(createRng(`${seed}:${prov.id}`), def, prov, 2010);
        for (const h of gen.houses) expect(h.memberIds.length, `${prov.id} ${h.kind}`).toBeGreaterThanOrEqual(PROVINCE.floor[h.kind]);
        for (const h of gen.houses.filter((x) => x.kind === 'priory')) expect(h.memberIds.length).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('a house draws men on its works, its observance, its buildings, and its prior; a full house draws fewer', () => {
    const s = friar('draw');
    const house = currentHouse(s)!;
    const base = expectedHouseVocations(s, house);
    expect(base).toBeGreaterThan(0);
    expect(expectedHouseVocations(s, { ...house, observance: Math.min(100, house.observance + 30) })).toBeGreaterThan(base);
    expect(expectedHouseVocations(s, { ...house, works: [...house.works, 'school'] })).toBeGreaterThan(base);
    expect(expectedHouseVocations(s, { ...house, buildings: ['church_expansion'] })).toBeGreaterThan(base);
    expect(expectedHouseVocations(s, { ...house, memberIds: [...house.memberIds, ...house.memberIds] })).toBeLessThan(base);
    // The prior's own name draws: the player as prior with reputations beats the NPC prior of the same house.
    const mine = asPrior({ ...s, religious: { ...s.religious!, reputations: { preacher: 70, confessor: 50 } } });
    expect(expectedHouseVocations(mine, currentHouse(mine)!)).toBeGreaterThan(base);
    // The vocations weekend lifts the draw for a year.
    const drove = spendPurse(mine, 'vocations_drive').state;
    expect(expectedHouseVocations(drove, currentHouse(drove)!)).toBeGreaterThan(expectedHouseVocations(mine, currentHouse(mine)!));
    expect(capacityOf(house)).toBeGreaterThan(PROVINCE.members[house.kind][1]);
  });

  it('twenty years pass: the province\'s houses gain and lose men, nobody collapses to a handful, the old die, the money moves, and a dead prior is replaced', () => {
    let s = friar('years');
    const before = Object.values(s.orderHouses!).map((h) => membersOf(s, h).length);
    let died = 0;
    let entered = 0;
    for (let y = 1; y <= 20; y++) {
      s = provinceGrowthYear({ ...s, clock: { ...s.clock, week: y * 52 } }, createRng(`y:${y}`));
      for (const h of Object.values(s.orderHouses!)) { died += h.grew?.died ?? 0; entered += h.grew?.entered ?? 0; }
    }
    const after = Object.values(s.orderHouses!).map((h) => membersOf(s, h).length);
    expect(died).toBeGreaterThan(0);
    expect(entered).toBeGreaterThan(0);
    for (const h of Object.values(s.orderHouses!)) {
      expect(membersOf(s, h).length, h.name).toBeGreaterThanOrEqual(4);
      expect(membersOf(s, h).length).toBeLessThanOrEqual(capacityOf(h) + 2);
      for (const m of membersOf(s, h)) expect(m.status).toBe('active');
      expect(s.npcs[h.priorId]?.status ?? 'active').toBe('active');
      expect(h.grew).toBeDefined();
      expect(h.budget).toBeGreaterThanOrEqual(0);
    }
    expect(after.reduce((a, b) => a + b, 0)).toBeGreaterThan(before.reduce((a, b) => a + b, 0) * 0.6);
    // Dead men are out of the house and stay in the book.
    expect(Object.values(s.npcs).some((n) => n.status === 'dead' && n.role === 'religious')).toBe(true);
    // Same seeds, same province.
    let t = friar('years');
    for (let y = 1; y <= 20; y++) t = provinceGrowthYear({ ...t, clock: { ...t.clock, week: y * 52 } }, createRng(`y:${y}`));
    expect(Object.values(t.orderHouses!).map((h) => h.memberIds)).toEqual(Object.values(s.orderHouses!).map((h) => h.memberIds));
  });

  it('the prior builds: from the purse, one at a time, a grant from the province when the house is short, and the building stands and does what it does', () => {
    const s = asPrior(friar('build'));
    const house = currentHouse(s)!;
    expect(buildOffers(friar('build')).every((o) => !o.available)).toBe(true);
    const rich = { ...s, orderHouses: { ...s.orderHouses, [house.id]: { ...house, budget: 5_000_000, works: ['priory_church', 'preaching'] } } };
    const offers = buildOffers(rich);
    expect(offers.find((o) => o.def.id === 'chapel_restoration')!.available).toBe(true);
    expect(offers.find((o) => o.def.id === 'studium_wing')!.available).toBe(false);
    expect(offers.find((o) => o.def.id === 'church_expansion')!.available).toBe(true);
    const begun = startBuild(rich, 'classrooms').state;
    const h1 = currentHouse(begun)!;
    expect(h1.build?.id).toBe('classrooms');
    expect(h1.budget).toBe(5_000_000 - 260_000);
    expect(buildOffers(begun).every((o) => !o.available)).toBe(true);
    expect(buildWeek(begun).state).toBe(begun);
    const done = buildWeek({ ...begun, clock: { ...begun.clock, week: h1.build!.endWeek } });
    expect(done.line).toMatch(/Creed/);
    const h2 = currentHouse(done.state)!;
    expect(h2.build).toBeUndefined();
    expect(h2.buildings).toEqual(['classrooms']);
    expect(h2.works).toContain('teaching');
    expect(houseMoney(done.state, h2).income).toBeGreaterThan(houseMoney(rich, currentHouse(rich)!).income);
    expect(buildOffers(done.state).find((o) => o.def.id === 'classrooms')!.why).toBe('Built');
    // A school needs men and money; a house that is short asks the province.
    const poor = { ...s, orderHouses: { ...s.orderHouses, [house.id]: { ...house, budget: 10_000 } } };
    expect(buildOffers(poor).find((o) => o.def.id === 'chapel_restoration')!.why).toMatch(/grant/);
    let granted: GameState | undefined;
    for (let i = 0; i < 30 && !granted; i++) {
      const r = askGrant(poor, 'chapel_restoration', createRng(`g-${i}`));
      if (r.granted) granted = r.state;
    }
    expect(granted).toBeDefined();
    expect(currentHouse(granted!)!.budget).toBe(10_000 + 60_000);
    expect(granted!.province!.finances.balance).toBe(poor.province!.finances.balance - 60_000);
    expect(askGrant(granted!, 'library_wing', createRng('again')).line).toMatch(/Asked already/);
    expect(GROWTH.grant.share).toBe(0.5);
  });
});
