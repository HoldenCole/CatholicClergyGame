import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { currentParish, dialAvailability, frictionOf, leanOf, liturgyWeek, mayChangeMass, rollLiturgy, rollTaste, setDial, weeklyCost } from '@/systems/liturgy';
import { NOTICE, noticeQuarter, readNotice } from '@/systems/notice';
import { availableProjects, projectCap, projectWeek, projectsOf, pushProject, startProject } from '@/systems/projects';
import { fundBonuses, spend, spendAvailability, spendingWeek } from '@/systems/spending';
import { careOfPlan, planWeek, resolveWeek } from '@/systems/week';
import { evaluateCondition } from '@/engine/conditions';
import { liturgyDials } from '@/content/parish';
import type { GameState } from '@/types';

function pastorOf(seed: string, cash = 400_000): GameState {
  const s = parishState(seed);
  return { ...s, assignment: { ...s.assignment!, role: 'pastor' }, parish: { ...s.parish!, finance: { ...s.parish!.finance, cash, debt: 0 } } };
}

describe("the pastor's Mass", () => {
  it('every parish has a Mass rolled near what its people want, and the dials read the parish', () => {
    const s = parishState('mass');
    const parish = currentParish(s)!;
    expect(parish.liturgy).toBeTruthy();
    expect(parish.taste).toBeTruthy();
    for (const d of liturgyDials) expect(d.options.map((o) => o.id)).toContain(parish.liturgy![d.id]);
    expect(frictionOf(parish)).toBeLessThan(0.35);
    // Taste follows alignment.
    const trad = { ...parish, alignment: -80 };
    const prog = { ...parish, alignment: 80 };
    const tT = rollTaste(createRng('t'), trad);
    const tP = rollTaste(createRng('t'), prog);
    expect(Object.values(tT).reduce((a, b) => a + b, 0)).toBeLessThan(Object.values(tP).reduce((a, b) => a + b, 0));
    expect(leanOf({ ...trad, liturgy: rollLiturgy(createRng('m'), trad, tT), taste: tT })).toBeLessThan(leanOf({ ...prog, liturgy: rollLiturgy(createRng('m'), prog, tP), taste: tP }));
    // Options that need the people for them are shut elsewhere.
    const noLatino = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, ethnic: { irish: 1 } } : p)) } };
    const music = dialAvailability({ ...noLatino, assignment: { ...noLatino.assignment!, role: 'pastor' } }).find((d) => d.def.id === 'music')!;
    expect(music.options.find((o) => o.def.id === 'mariachi')!.available).toBe(false);
  });

  it('only a pastor turns a dial; a change shocks the parish, goes on the record, and the weeks decide', () => {
    const vicar = parishState('dial');
    expect(mayChangeMass(vicar).ok).toBe(false);
    expect(() => setDial(vicar, 'servers', 'boys')).toThrow(/vicar/);
    const p = pastorOf('dial');
    const before = currentParish(p)!;
    const other = before.liturgy!.servers === 'boys' ? 'girls' : 'boys';
    const after = setDial(p, 'servers', other);
    const parish = currentParish(after)!;
    expect(parish.liturgy!.servers).toBe(other);
    expect(parish.liturgyChanged!.servers).toBe(p.clock.week);
    expect(after.character!.reputation.parishioners).toBeLessThan(p.character!.reputation.parishioners);
    expect(after.character!.positions.length).toBe(p.character!.positions.length + 1);
    expect(after.character!.positions[after.character!.positions.length - 1]!.topic).toBe('liturgy');
    expect(evaluateCondition({ type: 'liturgy', key: 'servers', value: other }, after)).toBe(true);
    expect(evaluateCondition({ type: 'liturgy', key: 'fresh', op: '>=', amount: 1 }, after)).toBe(true);
    expect(evaluateCondition({ type: 'liturgy', key: 'changes', op: '>=', amount: 2 }, after)).toBe(false);
    // A Mass set against the people drains support; one that fits builds it.
    const fighting: GameState = { ...p, world: { ...p.world!, parishes: p.world!.parishes.map((x) => (x.id === before.id ? { ...x, taste: Object.fromEntries(liturgyDials.map((d) => [d.id, 1])), liturgy: Object.fromEntries(liturgyDials.map((d) => [d.id, [...d.options].sort((a, b) => a.lean - b.lean)[0]!.id])) } : x)) } };
    const fw = liturgyWeek(fighting);
    expect(fw.pull).toBeLessThan(0);
    expect(fw.state.character!.reputation.parishioners).toBeLessThan(p.character!.reputation.parishioners);
    const fitting: GameState = { ...p, world: { ...p.world!, parishes: p.world!.parishes.map((x) => (x.id === before.id ? { ...x, taste: Object.fromEntries(liturgyDials.map((d) => [d.id, -0.8])), liturgy: Object.fromEntries(liturgyDials.map((d) => [d.id, [...d.options].sort((a, b) => a.lean - b.lean)[0]!.id])) } : x)) } };
    const gw = liturgyWeek(fitting);
    expect(gw.pull).toBeGreaterThan(0);
    expect(gw.state.character!.reputation.traditional_bloc).toBeGreaterThan(p.character!.reputation.traditional_bloc);
    expect(weeklyCost(currentParish(fitting)!)).toBeGreaterThan(0);
  });
});

describe('a parish that gets noticed', () => {
  it('draws households from a neighbour once a quarter when it is well run, and not otherwise', () => {
    const p = pastorOf('notice');
    const parish = currentParish(p)!;
    const quarter: GameState = { ...p, parish: { ...p.parish!, weeksServed: NOTICE.everyWeeks, care: 0.8, attendance: 0.6, arrival: { week: 0, attendance: 0.3, collections: 1000, debt: 100000, groups: 20, buildings: 30, households: parish.households }, finance: { ...p.parish!.finance, averageCollection: 5000, debt: 0 } } };
    const n = readNotice(quarter);
    expect(n.wellRun).toBe(true);
    const r = noticeQuarter(quarter, createRng('n'));
    expect(r.line).toMatch(/households registered/);
    expect(currentParish(r.state)!.households).toBeGreaterThan(parish.households);
    expect(r.state.flags.parish_noticed).toBe(1);
    expect(r.state.character!.reputation.public).toBeGreaterThan(p.character!.reputation.public);
    const poor: GameState = { ...quarter, parish: { ...quarter.parish!, care: 0, attendance: 0.3, arrival: { ...quarter.parish!.arrival!, attendance: 0.6, collections: 9000, groups: 80, buildings: 90 } } };
    expect(readNotice(poor).wellRun).toBe(false);
    expect(noticeQuarter(poor, createRng('n')).line).toBeNull();
    expect(noticeQuarter({ ...quarter, parish: { ...quarter.parish!, weeksServed: 5 } }, createRng('n')).line).toBeNull();
  });
});

describe("the vicar's week is the people's", () => {
  it('visits count for more and the desk for less in a vicar\'s hands', () => {
    const v = parishState('vicar-week');
    const plan = planWeek(v);
    expect(careOfPlan(plan, 'parochial_vicar')).toBeGreaterThanOrEqual(careOfPlan(plan, 'pastor'));
    const withVisits = { ...v, parish: { ...v.parish!, routine: { ...v.parish!.routine, discretionary: { visits: 2 } } } };
    const asPastor = { ...withVisits, assignment: { ...withVisits.assignment!, role: 'pastor' as const } };
    const rv = resolveWeek(withVisits, createRng('w'));
    const rp = resolveWeek(asPastor, createRng('w'));
    expect(rv.state.character!.reputation.parishioners).toBeGreaterThan(rp.state.character!.reputation.parishioners - 0.001);
  });
});

describe('projects in parallel, with a push', () => {
  it('carries one more project for every forty points of administration, and a push halves the time for twice the draw', () => {
    const p = pastorOf('proj-par', 2_000_000);
    const low: GameState = { ...p, character: { ...p.character!, stats: { ...p.character!.stats, administration: 30 } } };
    expect(projectCap(low)).toBe(1);
    const high: GameState = { ...p, character: { ...p.character!, stats: { ...p.character!.stats, administration: 85 } } };
    expect(projectCap(high)).toBe(3);
    let s = startProject(high, 'renovation');
    s = startProject(s, 'capital_campaign');
    expect(projectsOf(s)).toHaveLength(2);
    expect(s.project!.type).toBe('renovation');
    expect(availableProjects(s).find((o) => o.def.type === 'renovation')!.why).toMatch(/Already/);
    const left = s.project!.endWeek - s.clock.week;
    const pushed = pushProject(s, 'renovation', true);
    expect(pushed.project!.pace).toBe(2);
    expect(pushed.project!.endWeek - s.clock.week).toBe(Math.round(left / 2));
    const cash = pushed.parish!.finance.cash;
    const week = projectWeek({ ...pushed, clock: { ...pushed.clock, week: pushed.clock.week + 1 } });
    // Both projects draw; the pushed one draws double.
    expect(cash - week.state.parish!.finance.cash).toBe(pushed.project!.costPerWeek * 2 + projectsOf(pushed)[1]!.costPerWeek);
    const eased = pushProject(pushed, 'renovation', false);
    expect(eased.project!.pace).toBe(1);
    // Both finish in time.
    let t = week.state;
    for (let w = 0; w < 110; w++) t = projectWeek({ ...t, clock: { ...t.clock, week: t.clock.week + 1 } }).state;
    expect(projectsOf(t)).toHaveLength(0);
    expect(t.career.filter((e) => /^Finished/.test(e.text))).toHaveLength(2);
  });
});

describe('standing programs', () => {
  it('run every week until wound up: the pews, the plate, the households, the school, the staff', () => {
    const p = pastorOf('programs');
    const parish = currentParish(p)!;
    const withSchool: GameState = { ...p, world: { ...p.world!, parishes: p.world!.parishes.map((x) => (x.id === parish.id ? { ...x, school: 'open' as const, buildings: { ...x.buildings, school: 40 } } : x)) } };
    const av = spendAvailability(withSchool);
    for (const id of ['marketing', 'school_quality', 'staff_bonuses', 'adult_formation', 'parish_online']) expect(av.find((a) => a.def.id === id)!.available, id).toBe(true);
    // Allowed even in debt: they are running costs, not purchases.
    const inDebt: GameState = { ...withSchool, parish: { ...withSchool.parish!, finance: { ...withSchool.parish!.finance, debt: 50_000 } } };
    expect(spendAvailability(inDebt).find((a) => a.def.id === 'marketing')!.available).toBe(true);
    expect(spendAvailability(inDebt).find((a) => a.def.id === 'parish_mission')!.available).toBe(false);
    let s = spend(withSchool, 'marketing');
    s = spend(s, 'school_quality');
    s = spend(s, 'staff_bonuses');
    const b = fundBonuses(s);
    expect(b.pull).toBeCloseTo(0.02);
    expect(b.relief).toBe(1);
    expect(planWeek(s).mandatory).toBeLessThanOrEqual(planWeek(withSchool).mandatory);
    const households = currentParish(s)!.households;
    let t = s;
    for (let w = 1; w <= 13; w++) t = spendingWeek({ ...t, clock: { ...t.clock, week: s.clock.week + w } }, createRng(`f${w}`)).state;
    expect(currentParish(t)!.households).toBeGreaterThan(households);
    expect(currentParish(t)!.buildings.school).toBeGreaterThan(40);
    expect(t.parish!.finance.cash).toBeLessThan(s.parish!.finance.cash);
    const secretary = s.npcs[s.parish!.staffIds.find((id) => s.npcs[id]?.tags.includes('secretary')) ?? '']; 
    if (secretary) expect(t.npcs[secretary.id]!.relationship).toBeGreaterThan(secretary.relationship);
  });
});
