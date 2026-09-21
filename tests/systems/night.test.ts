import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { defaultNight, markNightScene, NIGHT, nightCondition, nightOf, nightReviewLine, nightSceneDue, nightWeek, nightWords, restFactor, setEvenings } from '@/systems/night';
import { strainAfterWeek } from '@/systems/week';
import { evaluateCondition } from '@/engine/conditions';
import { allEvents } from '@/content';
import { parishWeekHook } from '@/engine/weekHook';
import { EVENING_KINDS, type GameState } from '@/types';

describe('the house at night', () => {
  it('starts from the house he is in, follows the evenings he chooses, and is shown in words', () => {
    const s = parishState('night-start');
    const d = defaultNight(s);
    expect(d.evenings).toBe('quiet');
    expect(nightOf(s)).toEqual(d);
    for (const k of EVENING_KINDS) expect(setEvenings(s, k).night!.evenings).toBe(k);
    let quiet: GameState = setEvenings(s, 'quiet');
    let company: GameState = setEvenings(s, 'company');
    let breviary: GameState = setEvenings(s, 'the_breviary');
    for (let i = 0; i < 60; i++) {
      quiet = nightWeek(quiet, createRng(`q${i}`)).state;
      company = nightWeek(company, createRng(`c${i}`)).state;
      breviary = nightWeek(breviary, createRng(`b${i}`)).state;
    }
    expect(company.night!.company).toBeGreaterThan(quiet.night!.company + 20);
    expect(quiet.night!.rest).toBeGreaterThan(company.night!.rest + 10);
    expect(breviary.night!.prayer).toBeGreaterThan(quiet.night!.prayer + 20);
    expect(breviary.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
    const w = nightWords(company);
    expect(w.company).toMatch(/peopled|company/);
    expect(nightReviewLine(company)).toMatch(/^The nights: /);
    expect(nightReviewLine(s)).toBeNull();
    // Deterministic, and a line now and then, from the evenings' own pool.
    expect(nightWeek(s, createRng('same'))).toEqual(nightWeek(s, createRng('same')));
    let lines = 0;
    for (let i = 0; i < 100; i++) if (nightWeek(s, createRng(`l${i}`)).line) lines++;
    expect(lines).toBeGreaterThan(3);
    expect(lines).toBeLessThan(30);
  });

  it('rest decides how a plain week recovers strain; alone weeks are counted; the condition reads it', () => {
    const s = parishState('night-rest');
    const rested: GameState = { ...s, strain: 40, night: { ...defaultNight(s), rest: 100 } };
    const sleepless: GameState = { ...s, strain: 40, night: { ...defaultNight(s), rest: 0 } };
    expect(restFactor(rested)).toBeCloseTo(NIGHT.restFloor + NIGHT.restSpan, 5);
    expect(restFactor(sleepless)).toBeCloseTo(NIGHT.restFloor, 5);
    expect(restFactor(s)).toBe(1);
    expect(strainAfterWeek(rested, 0, 0)).toBeLessThan(strainAfterWeek(sleepless, 0, 0));
    let alone: GameState = { ...s, strain: 50, night: { ...defaultNight(s), evenings: 'quiet', company: 10 } };
    for (let i = 0; i < 12; i++) alone = nightWeek(alone, createRng(`a${i}`)).state;
    expect(alone.night!.aloneWeeks).toBeGreaterThanOrEqual(10);
    expect(evaluateCondition({ type: 'night', key: 'alone_weeks', op: '>=', value: 10 }, alone, {})).toBe(true);
    expect(evaluateCondition({ type: 'night', key: 'evenings', value: 'quiet' }, alone, {})).toBe(true);
    expect(evaluateCondition({ type: 'night', key: 'evenings', value: 'company' }, alone, {})).toBe(false);
    expect(nightCondition(s, { type: 'night', key: 'rest', op: '>=', value: 0 })).toBe(true);
    // Company back, strain down: the count falls off.
    let better: GameState = { ...alone, strain: 10, night: { ...alone.night!, company: 60 } };
    for (let i = 0; i < 15; i++) better = nightWeek(better, createRng(`r${i}`)).state;
    expect(better.night!.aloneWeeks).toBe(0);
  });

  it('the bottle is only authored: its scenes need the alone weeks and the strain, and every step has a way out', () => {
    const third = allEvents.find((e) => e.id === 'nt_the_third_glass')!;
    expect(third.requires!.some((c) => c.type === 'night' && c.key === 'alone_weeks')).toBe(true);
    expect(third.requires!.some((c) => c.type === 'strain')).toBe(true);
    expect(third.choices.filter((c) => c.effects?.some((e) => e.target === 'flag' && e.key === 'night:sober_once')).length).toBeGreaterThanOrEqual(2);
    const program = allEvents.find((e) => e.id === 'nt_the_program')!;
    expect(program.choices.filter((c) => c.effects?.some((e) => e.target === 'flag' && e.key === 'night:sober' && e.value === true)).length).toBeGreaterThanOrEqual(2);
    // No night scene names a number for the bottle, and none reaches the LLM: the flavour prompts exist for the ordinary nights only.
    for (const e of allEvents.filter((ev) => ev.id.startsWith('nt_') || ev.id.startsWith('shn_'))) expect(e.requires!.some((c) => c.type === 'night' || (c.type === 'flag' && c.key.startsWith('night:')))).toBe(true);
  });

  it('one night a season: the hook draws a night scene at most every thirteen weeks', () => {
    const s = parishState('night-hook');
    expect(nightSceneDue({ ...s, night: { ...defaultNight(s), sceneWeek: s.clock.week - 3 } }, createRng('x'))).toBe(false);
    let due = 0;
    for (let i = 0; i < 100; i++) if (nightSceneDue({ ...s, night: { ...defaultNight(s), sceneWeek: s.clock.week - 20 } }, createRng(`d${i}`))) due++;
    expect(markNightScene(s).night!.sceneWeek).toBe(s.clock.week);
    expect(due).toBeGreaterThan(5);
    expect(due).toBeLessThan(40);
    // A pool of night scenes that never suppress, so the cadence alone decides.
    const phone = allEvents.find((e) => e.id === 'nt_the_phone_at_eleven')!;
    const synthetic = ['a', 'b', 'c'].map((k) => ({ ...phone, id: `nt_test_${k}`, suppressYears: 0, once: false }));
    const deps = { pool: synthetic, lookup: (id: string) => synthetic.find((e) => e.id === id) } as never;
    let fired = 0;
    let last = -100;
    let next: GameState = { ...s, mode: { kind: 'clock' } };
    for (let w = 1; w <= 208; w++) {
      const at: GameState = { ...next, clock: { ...next.clock, week: s.clock.week + w }, mode: { kind: 'clock' }, pending: [] };
      const r = parishWeekHook(deps)(at, createRng(`h${w}`), []);
      // A played week may draw a night scene from the pool by itself; the seasonal draw is the one that marks the night.
      if (r.night?.sceneWeek === at.clock.week) { fired++; expect(r.pending.some((p) => p.eventId.startsWith('nt_'))).toBe(true); expect(at.clock.week - last).toBeGreaterThanOrEqual(NIGHT.sceneEveryWeeks); last = at.clock.week; }
      next = { ...r, pending: [], mode: { kind: 'clock' } };
    }
    expect(fired).toBeGreaterThanOrEqual(4);
    expect(fired).toBeLessThanOrEqual(16);
  });
});
