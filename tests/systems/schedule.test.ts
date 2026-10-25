import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { generateCandidates } from '@/generation/world';
import { SCHEDULE, applyChange, canOpenBox, canSay, changeSchedule, defaultSchedule, derivedQuality, myMasses, pastorGrants, scheduleAp, scheduleEffect, scheduleMeasure, scheduleOf, schedulePull, sundayDemand } from '@/systems/schedule';
import { obligationAp, obligationCost, planWeek } from '@/systems/week';
import { evaluateCondition } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { parishWeekBook } from '@/systems/ministry';
import { eventById } from '@/content';
import { buildSave, deserialize, serialize } from '@/engine/save';
import type { GameState, ParishSchedule } from '@/types';

describe('the parish schedule', () => {
  it('every parish rolls a schedule of its own: Masses for its households, a vigil, a Mass each weekday, the box, the communities in their languages', () => {
    const cands = generateCandidates(createRng('sched'), 2010);
    const counts = new Set<number>();
    let community = 0;
    let parishes = 0;
    for (const c of cands) {
      for (const p of c.parishes) {
        parishes++;
        const s = defaultSchedule(p, 'pastor', 1, createRng(`d:${p.id}`));
        const sundays = s.masses.filter((m) => m.sunday);
        counts.add(sundays.length);
        expect(sundays.length).toBeGreaterThanOrEqual(2);
        expect(sundays.length).toBeLessThanOrEqual(7);
        expect(s.masses.some((m) => m.day === 'sat' && m.sunday)).toBe(true);
        expect(s.masses.filter((m) => !m.sunday).length).toBe(6);
        expect(s.confessions.length).toBeGreaterThanOrEqual(1);
        if (s.masses.some((m) => m.language !== 'english')) community++;
        // A pastor alone says every Mass the canon lets him; what it does not falls to another priest. A vicar says about half.
        expect(myMasses(s).filter((m) => m.sunday).length).toBe(Math.min(3, sundays.length));
        expect(myMasses(s).filter((m) => !m.sunday).length).toBe(6);
        const v = defaultSchedule(p, 'parochial_vicar', 2, createRng(`d:${p.id}`));
        expect(myMasses(v).length).toBeLessThan(v.masses.length);
        expect(myMasses(v).length).toBeGreaterThan(0);
      }
    }
    expect(counts.size).toBeGreaterThanOrEqual(3);
    expect(community).toBeGreaterThan(0);
    expect(parishes).toBeGreaterThan(50);
  });

  it('the hours derive from the schedule, and the old quality words from the hours; a save without one reads the default', () => {
    const s = parishState('sched:hours');
    expect(s.parish!.schedule).toBeUndefined();
    const sched = scheduleOf(s)!;
    expect(sched).toBeTruthy();
    expect(scheduleOf(s)).toEqual(sched);
    const sundays = myMasses(sched).filter((m) => m.sunday).length;
    expect(scheduleAp(sched, 'sunday_masses', 'standard')).toBeCloseTo(SCHEDULE.sundayMassAp * sundays + SCHEDULE.homilyAp.standard);
    expect(scheduleAp(sched, 'weekday_masses', 'standard')).toBeCloseTo(SCHEDULE.weekdayMassAp * myMasses(sched).filter((m) => !m.sunday).length);
    expect(derivedQuality(sched, 'weekday_masses')).toBe('standard');
    expect(derivedQuality(sched, 'confessions')).toBe('standard');
    // Without a schedule the old table stands; with one the liturgy is charged as scheduled.
    expect(obligationCost('weekday_masses', 'standard')).toBe(obligationAp('weekday_masses', 'standard'));
    expect(obligationCost('weekday_masses', 'standard', 0, undefined, sched)).toBeCloseTo(scheduleAp(sched, 'weekday_masses', 'standard')!);
    expect(obligationCost('weekday_masses', 'min', 0, undefined, sched)).toBeLessThan(obligationCost('weekday_masses', 'standard', 0, undefined, sched));
    const plan = planWeek(s);
    expect(plan.mandatory).toBeGreaterThan(3);
    expect(plan.mandatory).toBeLessThan(7);
    // Round trip: a schedule written to the record survives the save.
    const written = { ...s, parish: { ...s.parish!, schedule: sched } };
    expect(deserialize(serialize(buildSave(written, createRng(written.seed), null))).state.parish!.schedule).toEqual(sched);
  });

  it('the canon holds: two on a weekday, three on a Sunday with the vigil counted; a parish keeps one Sunday Mass', () => {
    const s = parishState('sched:canon');
    const base = { ...s, parish: { ...s.parish!, role: 'pastor' as const }, phase: 'pastor' as const };
    let sched: ParishSchedule = { ...scheduleOf(base)!, masses: scheduleOf(base)!.masses.map((m) => ({ ...m, celebrant: 'me' as const })) };
    // Weekdays: a second Mass is allowed, a third is not.
    sched = applyChange(base, sched, { kind: 'add_mass', day: 'tue', minute: 18 * 60, language: 'english' });
    expect(canSay(sched, 'tue', 12 * 60).ok).toBe(false);
    expect(() => applyChange(base, sched, { kind: 'add_mass', day: 'tue', minute: 12 * 60, language: 'english' })).toThrow(/canon/);
    // Sundays: three in all, the vigil counted.
    const sundays = sched.masses.filter((m) => m.sunday).map((m) => m.id);
    let trimmed = sched;
    for (const id of sundays.slice(3)) trimmed = applyChange(base, trimmed, { kind: 'remove_mass', id });
    while (trimmed.masses.filter((m) => m.sunday).length < 3) trimmed = applyChange(base, trimmed, { kind: 'add_mass', day: 'sun', minute: 19 * 60 - 60 * trimmed.masses.filter((m) => m.sunday).length, language: 'english' });
    expect(canSay(trimmed, 'sun', 20 * 60).ok).toBe(false);
    // Another priest may say more: hand one off and the day opens again.
    const handed = applyChange(base, trimmed, { kind: 'hand_mass', id: trimmed.masses.find((m) => m.sunday)!.id, to: 'vicar' });
    expect(canSay(handed, 'sun', 20 * 60).ok).toBe(true);
    // A language he does not have is not his to say.
    expect(() => applyChange(base, trimmed, { kind: 'add_mass', day: 'mon', minute: 19 * 60, language: 'korean' })).toThrow(/Korean/);
    // The last Sunday Mass stays.
    let one = trimmed;
    const ids = one.masses.filter((m) => m.sunday).map((m) => m.id);
    for (const id of ids.slice(1)) one = applyChange(base, one, { kind: 'remove_mass', id });
    expect(() => applyChange(base, one, { kind: 'remove_mass', id: ids[0]! })).toThrow(/one Sunday Mass/);
  });

  it("a pastor sets the schedule; a vicar asks, and the pastor's temper and regard answer, the same way for the same week", () => {
    const vicar = parishState('sched:ask');
    expect(vicar.parish!.role).toBe('parochial_vicar');
    const change = { kind: 'add_confessions' as const, day: 'thu' as const, minute: 18 * 60, minutes: 60 };
    const a = changeSchedule(vicar, change);
    const b = changeSchedule(vicar, change);
    expect(a.parish!.schedule!.lastAsk).toEqual(b.parish!.schedule!.lastAsk);
    expect(a.parish!.schedule!.lastAsk!.granted).toBe(pastorGrants(vicar, change));
    // A mentor says yes more than a micromanager, over many weeks.
    let mentorYes = 0;
    let microYes = 0;
    for (let w = 0; w < 60; w++) {
      const at = { ...vicar, clock: { ...vicar.clock, week: vicar.clock.week + w } };
      if (pastorGrants({ ...at, flags: { ...at.flags, 'boss:mentor': true } }, change)) mentorYes++;
      if (pastorGrants({ ...at, flags: { ...at.flags, 'boss:micromanager': true } }, change)) microYes++;
    }
    expect(mentorYes).toBeGreaterThan(microYes);
    // The pastor needs no one's leave.
    const pastor = { ...vicar, parish: { ...vicar.parish!, role: 'pastor' as const }, phase: 'pastor' as const };
    const set = changeSchedule(pastor, change);
    expect(set.parish!.schedule!.confessions.some((c) => c.day === 'thu' && c.minute === 18 * 60)).toBe(true);
    expect(set.parish!.schedule!.lastAsk).toBeUndefined();
  });

  it('the box does not open over itself, and two asks in one week keep both answers on the sheet', () => {
    const vicar = parishState('sched:box');
    const s = scheduleOf(vicar)!;
    const mine = s.confessions.find((c) => c.confessor === 'me')!;
    // Over an hour the man already keeps: refused by the schedule itself, whoever sets it, and the pastor is never asked.
    expect(canOpenBox(s, mine.day, mine.minute, 60).ok).toBe(false);
    expect(canOpenBox(s, mine.day, mine.minute + mine.minutes, 60).ok).toBe(true);
    expect(() => changeSchedule(vicar, { kind: 'add_confessions', day: mine.day, minute: mine.minute + 15, minutes: 30 })).toThrow(/already open/);
    const pastor = { ...vicar, parish: { ...vicar.parish!, role: 'pastor' as const }, phase: 'pastor' as const };
    expect(() => changeSchedule(pastor, { kind: 'add_confessions', day: mine.day, minute: mine.minute, minutes: 60 })).toThrow(/already open/);
    // Two asks in the same week: the second answer joins the first instead of replacing it.
    const first = changeSchedule(vicar, { kind: 'add_confessions', day: 'thu', minute: 18 * 60, minutes: 60 });
    const second = changeSchedule(first, { kind: 'add_mass', day: 'tue', minute: 18 * 60, language: 'english' });
    const text = second.parish!.schedule!.lastAsk!.text;
    expect(text).toContain('confessions on Thursday');
    expect(text).toContain('Mass on Tuesday');
    expect(text.indexOf('confessions on Thursday')).toBeLessThan(text.indexOf('Mass on Tuesday'));
    // The demand a parish's size asks for is one number, read by the sheet and the pull alike.
    const parish = vicar.world!.parishes.find((x) => x.id === vicar.parish!.parishId)!;
    expect(sundayDemand(parish)).toBe(Math.max(2, Math.round(parish.households / SCHEDULE.householdsPerSundayMass) + 1));
  });

  it('scenes read the schedule and change it, the pull and the book follow it, and the ten requests validate', () => {
    const s = parishState('sched:scenes');
    const sat = { ...scheduleOf(s)!, confessions: scheduleOf(s)!.confessions.filter((c) => c.day === 'sat') };
    const pastor: GameState = { ...s, parish: { ...s.parish!, role: 'pastor', schedule: sat }, phase: 'pastor' };
    expect(scheduleMeasure(pastor, 'evening_confessions')).toBe(false);
    expect(evaluateCondition({ type: 'schedule', key: 'evening_confessions', value: false }, pastor)).toBe(true);
    const sundays = scheduleMeasure(pastor, 'sunday_masses') as number;
    expect(evaluateCondition({ type: 'schedule', key: 'sunday_masses', op: '>=', value: sundays }, pastor)).toBe(true);
    expect(evaluateCondition({ type: 'schedule', key: 'sunday_masses', op: '>=', value: sundays + 1 }, pastor)).toBe(false);
    const withBox = applyEffects(pastor, [{ target: 'schedule', key: 'confessions:add', value: 'wed 18:30 60' }]);
    expect(scheduleMeasure(withBox, 'evening_confessions')).toBe(true);
    expect(schedulePull(withBox)).toBeGreaterThan(schedulePull(pastor));
    // The book counts what is said: a Mass added is a Mass in the book.
    const before = parishWeekBook(pastor, pastor.parish!.routine.obligations).masses!;
    const more = scheduleEffect(pastor, 'mass:add', 'tue 18:00');
    expect(parishWeekBook(more, more.parish!.routine.obligations).masses!).toBeCloseTo(before + 1);
    // Nothing the canon forbids is forced by a scene.
    const two = [{ id: 'x1', day: 'tue' as const, minute: 12 * 60, language: 'english', celebrant: 'me' as const, sunday: false }, { id: 'x2', day: 'tue' as const, minute: 15 * 60, language: 'english', celebrant: 'me' as const, sunday: false }];
    const full = { ...pastor, parish: { ...pastor.parish!, schedule: { ...sat, masses: [...sat.masses.filter((m) => m.day !== 'tue'), ...two] } } };
    const forced = scheduleEffect(full, 'mass:add', 'tue 18:00').parish!.schedule!;
    // Two already: the third is not forced on him.
    expect(forced.masses.filter((m) => m.day === 'tue' && m.celebrant === 'me').length).toBe(SCHEDULE.canon.weekdayMax);
    expect(forced.masses.length).toBe(full.parish.schedule.masses.length);
    for (const id of ['sch_evening_confessions', 'sch_spanish_mass_asked', 'sch_early_mass', 'sch_young_families', 'sch_thin_mass', 'sch_choir_wants_time', 'sch_pastor_wants_his_mass_back', 'sch_too_many_masses', 'sch_funeral_home', 'sch_first_friday']) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'schedule' || c.type === 'role'), id).toBe(true);
    }
    expect(evaluateCondition(eventById('sch_evening_confessions')!.requires![0]!, pastor)).toBe(true);
    expect(evaluateCondition(eventById('sch_evening_confessions')!.requires![0]!, withBox)).toBe(false);
  });
});
