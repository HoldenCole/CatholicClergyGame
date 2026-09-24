import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { orderDefs } from '@/content/houses';
import { houseWorks } from '@/content/parish';
import { connectedTo, doHouseWork, favourOffers, HOUSES, houseWorkOffers, housesOf, housesYear, patronYear, standingOf } from '@/systems/houses';
import { spend, spendAvailability } from '@/systems/spending';
import { availableProjects, projectDefs, projectWeek, startProject } from '@/systems/projects';
import type { GameState, ReligiousHouse } from '@/types';

function house(order: string): ReligiousHouse {
  const def = orderDefs.find((o) => o.id === order)!;
  return { id: `house:${order}`, name: def.names[0]!, order, orderLabel: def.label, members: def.members, charism: def.charism, alignment: 0, setting: 'city', size: 10, line: 'A house.' };
}

/** A pastor with money next to a priory, at a given standing with it. */
function patronage(seed: string, regard = 70, cash = 600000): GameState {
  const base = parishState(seed);
  const priory = house('dominican');
  const world = { ...base.world!, diocese: { ...base.world!.diocese, visible: { ...base.world!.diocese.visible, houses: [priory] } } };
  return {
    ...base,
    world,
    assignment: { ...base.assignment!, role: 'pastor' },
    parish: { ...base.parish!, finance: { ...base.parish!.finance, cash, debt: 0 } },
    houses: { [priory.id]: { houseId: priory.id, regard, sinceWeek: 0, asked: 0, given: 0, arrangements: [] } },
  };
}

describe('growing the order (DESIGN §9.4c)', () => {
  it('the works are for a man connected to the house: standing at the bar, or one of theirs', () => {
    expect(houseWorks.map((w) => w.id)).toEqual(['expand', 'found', 'patron']);
    const cold = patronage('cold', 10);
    const priory = housesOf(cold)[0]!;
    expect(connectedTo(cold, priory, 45)).toBe(false);
    expect(houseWorkOffers(cold).every((w) => !w.available && /one of theirs/.test(w.why))).toBe(true);
    // A third-order profession counts, whatever the standing.
    const professed = { ...cold, flags: { ...cold.flags, 'third_order:dominican': true } };
    expect(connectedTo(professed, priory, 45)).toBe(true);
    expect(houseWorkOffers(professed).find((w) => w.def.id === 'expand')!.available).toBe(true);
    const warm = patronage('warm', 70);
    expect(houseWorkOffers(warm).filter((w) => w.available).map((w) => w.def.id)).toEqual(['expand', 'found', 'patron']);
    const poor = patronage('poor', 70, 1000);
    expect(houseWorkOffers(poor).find((w) => w.def.id === 'found')!.why).toBe('The parish cannot pay for it');
  });

  it('helping them build adds men to the house, costs the parish, and is not done again for years', () => {
    const s = patronage('build');
    const before = housesOf(s)[0]!.size;
    const r = doHouseWork(s, 'house:dominican', 'expand', createRng('b'));
    expect(housesOf(r.state)[0]!.size).toBe(before + HOUSES.expandBy);
    expect(r.state.parish!.finance.cash).toBe(s.parish!.finance.cash - 25000);
    expect(standingOf(r.state, 'house:dominican').regard).toBe(70 + HOUSES.workRegard);
    expect(r.line).toMatch(/new wing/);
    expect(houseWorkOffers(r.state).find((w) => w.def.id === 'expand')!.why).toMatch(/Not again for 5 years/);
    expect(r.state.career.at(-1)!.text).toMatch(/Help them build at St\. Dominic Priory/);
  });

  it('a foundation is a second house of the order with a standing of its own, made once in a life', () => {
    const s = patronage('found');
    const r = doHouseWork(s, 'house:dominican', 'found', createRng('f'));
    const houses = housesOf(r.state);
    expect(houses.length).toBe(2);
    const made = houses[1]!;
    expect(made.order).toBe('dominican');
    expect(made.motherId).toBe('house:dominican');
    expect(made.foundedWeek).toBe(s.clock.week);
    expect(made.name).not.toBe(houses[0]!.name);
    expect(orderDefs.find((o) => o.id === 'dominican')!.names).toContain(made.name);
    expect(made.size).toBeGreaterThanOrEqual(HOUSES.foundSize[0]);
    expect(made.size).toBeLessThanOrEqual(HOUSES.foundSize[1]);
    expect(standingOf(r.state, made.id).regard).toBe(HOUSES.foundRegard);
    expect(r.state.flags['founded:dominican']).toBe(true);
    // The new house takes favours like any other, and the order is not founded twice.
    expect(favourOffers(r.state).some((o) => o.house.id === made.id && o.def.id === 'confessor' && o.available)).toBe(true);
    expect(houseWorkOffers(r.state).find((w) => w.def.id === 'found' && w.house.id === 'house:dominican')!.why).toMatch(/once in a life/);
    expect(houseWorkOffers(r.state).find((w) => w.def.id === 'found' && w.house.id === made.id)!.available).toBe(false);
    expect(doHouseWork(s, 'house:dominican', 'found', createRng('f')).state).toEqual(r.state);
  });

  it("a patron's house grows a man most years, the gift goes out yearly, and the provincial may end it", () => {
    const s = patronage('patron');
    const r = doHouseWork(s, 'house:dominican', 'patron', createRng('p'));
    expect(standingOf(r.state, 'house:dominican').arrangements.map((a) => a.id)).toEqual(['patron']);
    expect(r.state.flags['house:patron']).toBe(true);
    let grew = 0;
    let paid = 0;
    for (let i = 0; i < 40; i++) {
      const y = patronYear({ ...r.state, clock: { ...r.state.clock, week: r.state.clock.week + 52 * i } }, createRng(`y-${i}`));
      if (housesOf(y.state)[0]!.size > housesOf(r.state)[0]!.size) grew++;
      paid += r.state.parish!.finance.cash - y.state.parish!.finance.cash;
    }
    expect(grew).toBeGreaterThan(15);
    expect(grew).toBeLessThan(40);
    expect(paid).toBe(40 * 2000);
    let ended: string | undefined;
    for (let i = 0; i < 300 && !ended; i++) {
      const y = housesYear({ ...r.state, clock: { ...r.state.clock, week: r.state.clock.week + i } }, createRng(`e-${i}`));
      ended = y.lines.find((l) => /patron/.test(l));
      if (ended) expect(standingOf(y.state, 'house:dominican').arrangements.length).toBe(0);
    }
    expect(ended).toMatch(/stand on its own/);
  });
});

describe("the bishop's causes (DESIGN §8.3)", () => {
  it('a gift moves the bishop and the chancery, costs the parish, and cannot be given again for a year', () => {
    const s = patronage('appeal');
    const bishop = Object.values(s.npcs).find((n) => n.role === 'bishop')!;
    const before = spendAvailability(s).find((x) => x.def.id === 'bishops_appeal')!;
    expect(before.available).toBe(true);
    const gave = spend(s, 'bishops_appeal');
    expect(gave.npcs[bishop.id]!.relationship).toBe(bishop.relationship + 6);
    expect(gave.character!.reputation.chancery).toBe(s.character!.reputation.chancery + 4);
    expect(gave.parish!.finance.cash).toBe(s.parish!.finance.cash - 12000);
    expect(gave.flags['spent:bishops_appeal']).toBe(s.clock.week);
    expect(spendAvailability(gave).find((x) => x.def.id === 'bishops_appeal')!.why).toBe('Not again for 1 year');
    const later = { ...gave, clock: { ...gave.clock, week: gave.clock.week + 52 } };
    expect(spendAvailability(later).find((x) => x.def.id === 'bishops_appeal')!.available).toBe(true);
    for (const id of ['seminary_burse', 'retired_priests', 'cathedral_fund']) expect(spendAvailability(s).find((x) => x.def.id === id)!.available, id).toBe(true);
  });
});

describe('more for a church to do (DESIGN §8.3)', () => {
  it('eighteen projects, the new ones written on themselves, and their gates', () => {
    expect(projectDefs.length).toBe(18);
    const s = patronage('projects');
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const noSpanish = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, needsSpanish: false, buildings: { ...p.buildings, hall: 10 } } : p)) } };
    const gates = availableProjects(noSpanish);
    expect(gates.find((p) => p.def.type === 'bilingual_parish')!.why).toMatch(/second language/);
    expect(gates.find((p) => p.def.type === 'youth_center')!.why).toMatch(/hall/);
    for (const def of projectDefs.slice(8)) expect(def.onComplete, def.type).toBeDefined();
  });

  it('a columbarium pays for the roof when it is done, and a census finds families', () => {
    let s = startProject(patronage('col'), 'columbarium');
    const project = s.projects![0]!;
    s = { ...s, projects: [{ ...project, endWeek: s.clock.week }], project: null };
    const cashBefore = s.parish!.finance.cash;
    const done = projectWeek(s);
    expect(done.line).toMatch(/Build a columbarium is done/);
    expect(done.state.projects).toEqual([]);
    expect(done.state.flags.built_columbarium).toBe(true);
    expect(done.state.parish!.finance.cash).toBeGreaterThan(cashBefore);
    let c = startProject(patronage('census'), 'parish_census');
    const rec = c.world!.parishes.find((p) => p.id === c.parish!.parishId)!;
    c = { ...c, projects: [{ ...c.projects![0]!, endWeek: c.clock.week }] };
    const counted = projectWeek(c);
    expect(counted.state.world!.parishes.find((p) => p.id === rec.id)!.households).toBe(rec.households + 80);
    expect(counted.state.character!.stats.administration).toBe(c.character!.stats.administration + 3);
  });
});
