import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { buildChoice, chooseAssignment, earnsChoice, withChoice } from '@/systems/choice';
import { offerById } from '@/content/offers';
import { officeDefs, groupTypeDefs } from '@/content/parish';
import { seminaryActivity } from '@/content/seminary';
import { offersWeek } from '@/engine/offers';
import { acceptOffer } from '@/engine/offers';
import { studyProgram } from '@/content/study';
import { placeVerdict, setStudyActivity, studyWeek } from '@/systems/studyWeek';
import { startFounding, finishFounding, parishGroups } from '@/systems/groups';
import { offerWeight } from '@/engine/offers';
import { evaluateAll } from '@/engine/conditions';
import { commitmentAp } from '@/engine/offers';
import type { GameState } from '@/types';

describe('Italian in seminary', () => {
  it('is an activity that earns the credential, and Rome reads it', () => {
    const def = seminaryActivity('italian')!;
    expect(def).toBeDefined();
    expect(def.credentialAfter!.credential).toBe('italian');
    const rome = offerById('pv_rome_study')!;
    const s = parishState('italian');
    const base: GameState = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, theology: 52 }, reputation: { ...s.character!.reputation, chancery: 5 } }, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 3 } };
    // The fixture has no classmates for the letter's selectors, so read the requirements themselves.
    expect(evaluateAll(rome.requires, base)).toBe(false);
    const fluent: GameState = { ...base, character: { ...base.character!, credentials: [...base.character!.credentials, 'italian'] } };
    expect(evaluateAll(rome.requires, fluent)).toBe(true);
    const tracked: GameState = { ...base, flags: { ...base.flags, rome_track: true } };
    expect(offerWeight(rome, { ...tracked, character: fluent.character })).toBeGreaterThan(offerWeight(rome, tracked));
  });
});

describe('third orders', () => {
  it('can be founded at a parish like any group, and lean traditional', () => {
    const def = groupTypeDefs.find((g) => g.type === 'third_order')!;
    expect(def).toBeDefined();
    expect(def.alignmentMean).toBeLessThan(0);
    let s = parishState('third');
    s = { ...s, groups: Object.fromEntries(Object.entries(s.groups).filter(([, g]) => g.type !== 'third_order')) };
    s = startFounding(s, 'third_order');
    expect(s.founding!.type).toBe('third_order');
    const r = finishFounding({ ...s, clock: { ...s.clock, week: s.founding!.endWeek }, character: { ...s.character!, stats: { ...s.character!.stats, charisma: 90 }, reputation: { ...s.character!.reputation, parishioners: 90 } } }, createRng('found'), 2020);
    expect(parishGroups(r.state).some((g) => g.type === 'third_order')).toBe(true);
  });
});

describe('the postings as places', () => {
  it('every posting has dials the week moves, and a verdict for the record', () => {
    for (const id of ['bishops_secretary', 'university_chaplain', 'hospital_chaplain', 'seminary_faculty', 'vicar_general', 'auxiliary_bishop']) expect(studyProgram(id)!.place?.dials.length, id).toBe(3);
    const base = parishState('place');
    const c = base.character!;
    const s: GameState = { ...base, character: { ...c, stats: { ...c.stats, theology: 75 }, reputation: { ...c.reputation, chancery: 40 } }, flags: { ...base.flags, ordination_week: base.clock.week - 52 * 4 }, offers: [{ offerId: 'pv_seminary_faculty', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }] };
    let away = acceptOffer(s, offerById('pv_seminary_faculty')!, createRng('f')).state;
    expect(away.study!.place).toEqual({ men: 0, faculty: 0, formation: 0 });
    away = setStudyActivity(away, 'lectures', 3);
    away = setStudyActivity(away, 'formation_reports', 2);
    let t = away;
    for (let i = 1; i <= 30; i++) t = studyWeek({ ...t, clock: { ...t.clock, week: away.clock.week + i } }, createRng(`w${i}`)).state;
    expect(t.study!.place!.men).toBeGreaterThan(20);
    expect(t.study!.place!.formation).toBeGreaterThan(20);
    expect(placeVerdict(t)).toMatch(/went well|made your name/);
    expect(placeVerdict(away)).toBe('the years there passed');
  });
});

describe("the bishop's choice", () => {
  it('the top of the class chooses at ordination; an ordinary record does not', () => {
    const s: GameState = { ...seminaryState('choice'), flags: { rector_recommends: true } };
    const world = parishState('choice-world').world!;
    const withWorld: GameState = { ...s, world, character: { ...s.character! } };
    expect(earnsChoice(withWorld, 'ordination')).toBe(true);
    expect(earnsChoice({ ...withWorld, flags: {} }, 'ordination')).toBe(false);
    const fallback = { parishId: world.parishes[0]!.id, role: 'parochial_vicar' as const, startWeek: 0, letter: 'x', reasons: ['because'] };
    const choice = buildChoice(withWorld, createRng('c'), 'ordination', fallback)!;
    expect(choice.options.length).toBeGreaterThanOrEqual(2);
    expect(choice.options.map((o) => o.id)).toContain('cathedral');
    for (const o of choice.options) {
      expect(o.prestige).toBeTruthy();
      expect(o.time).toBeTruthy();
      expect(o.involves.length).toBeGreaterThan(0);
    }
    const chosen = chooseAssignment(withChoice(withWorld, createRng('c'), 'ordination', fallback), 'cathedral', createRng('x'));
    expect(chosen.mode.kind).toBe('assignment');
    expect(chosen.commitments.some((c) => c.offerId === 'office:cathedral_calendar')).toBe(true);
    expect(chosen.flags['office:cathedral_mc']).toBe(true);
    expect(commitmentAp(chosen)).toBe(officeDefs.find((o) => o.id === 'cathedral_calendar')!.apPerWeek);
  });

  it('a man home from Rome chooses the flagship, a parish with an office, or the seminary', () => {
    const base = parishState('rome-home');
    const s: GameState = { ...base, parish: null, assignment: null, phase: 'parochial_vicar', character: { ...base.character!, credentials: [...base.character!.credentials, 'STL'] }, flags: { ...base.flags, ordination_week: base.clock.week - 52 * 6 } };
    const fallback = { parishId: base.world!.parishes[1]!.id, role: 'pastor' as const, startWeek: s.clock.week, letter: 'x', reasons: ['home from Rome'] };
    const choice = buildChoice(s, createRng('r'), 'degree', fallback)!;
    expect(choice.options.map((o) => o.id)).toEqual(['flagship', 'office', 'faculty']);
    expect(choice.options[1]!.office).toBe('worship');
    expect(choice.options[1]!.time).toMatch(/hours a week/);
    const faculty = chooseAssignment(withChoice(s, createRng('r'), 'degree', fallback), 'faculty', createRng('x'));
    expect(faculty.study!.city).toBe('seminary');
    expect(faculty.phase).toBe('study');
    const canonist: GameState = { ...s, character: { ...s.character!, credentials: ['JCL'] } };
    expect(buildChoice(canonist, createRng('r'), 'degree', fallback)!.options.map((o) => o.office)).toContain('tribunal');
  });

  it('a diocesan office does its weekly work and pays out when the years end', () => {
    const s = parishState('office');
    const o = officeDefs.find((x) => x.id === 'tribunal')!;
    const held: GameState = { ...s, commitments: [{ offerId: 'office:tribunal', label: o.label, startWeek: s.clock.week, endWeek: s.clock.week + 2, apPerWeek: o.apPerWeek, failed: false }] };
    const week = offersWeek({ ...held, clock: { ...held.clock, week: held.clock.week + 1 } }, createRng('o'), [], () => undefined);
    expect(week.character!.reputation.chancery).toBeGreaterThan(s.character!.reputation.chancery);
    const done = offersWeek({ ...week, clock: { ...week.clock, week: held.clock.week + 2 } }, createRng('o2'), [], () => undefined);
    expect(done.commitments).toHaveLength(0);
    expect(done.character!.reputation.chancery).toBeGreaterThan(week.character!.reputation.chancery + 5);
    expect(done.career[done.career.length - 1]!.text).toMatch(/tribunal/i);
  });
});
