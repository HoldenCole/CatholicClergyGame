import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { anniversaryWeek, anniversaryYears, ANNIVERSARIES } from '@/systems/anniversaries';
import type { GameState } from '@/types';

function ordainedYearsAgo(s: GameState, years: number, extraWeeks = 0): GameState {
  return { ...s, flags: { ...s.flags, ordination_week: s.clock.week - years * 52 - extraWeeks } };
}

describe('the anniversary of ordination', () => {
  it('is a line on the week itself, nothing on other weeks, and the silver jubilee is a letter with something in it', () => {
    const s = parishState('ann');
    expect(anniversaryYears(ordainedYearsAgo(s, 3, 5))).toBeNull();
    expect(anniversaryWeek(ordainedYearsAgo(s, 3, 5)).line).toBeNull();
    const one = anniversaryWeek(ordainedYearsAgo(s, 1));
    expect(one.line).toMatch(/A year ordained/);
    expect(one.state.flags['anniversary:1']).toBe(s.clock.week);
    expect(one.state.letterQueue?.length ?? 0).toBe(0);
    const ten = anniversaryWeek(ordainedYearsAgo(s, 10));
    expect(ten.line).toMatch(/Ten years/);
    const before = ordainedYearsAgo(s, 25);
    const silver = anniversaryWeek(before);
    expect(silver.line).toMatch(/silver/);
    expect(silver.state.flags['jubilee:25']).toBe(s.clock.week);
    expect(silver.state.letterQueue?.at(-1)?.title).toBe('The silver jubilee');
    expect(silver.state.character!.reputation.parishioners).toBe((before.character!.reputation.parishioners ?? 0) + ANNIVERSARIES.silver.laity);
    expect(silver.state.strain).toBeLessThan(before.strain + 1);
    expect(silver.state.career.at(-1)?.text).toContain('silver jubilee');
    // Deterministic and pure.
    expect(anniversaryWeek(before).state).toEqual(silver.state);
  });
});

describe('the anniversary through the week', () => {
  it('the parish week writes the anniversary line into the record', async () => {
    const { parishWeekHook } = await import('@/engine/weekHook');
    const { createRng } = await import('@/engine/rng');
    const s = parishState('ann-hook');
    // The clock has moved to the week already when the hook runs.
    const ordained: GameState = { ...s, clock: { ...s.clock, week: s.clock.week + 52 }, mode: { kind: 'clock' }, flags: { ...s.flags, ordination_week: s.clock.week + 52 - 52 * 10 } };
    const deps = { pool: [], draw: () => [] } as never;
    const r = parishWeekHook(deps)(ordained, createRng(ordained.seed), []);
    const lines = r.digest.flatMap((d) => d.lines);
    expect(lines.some((l) => /Ten years ordained/.test(l))).toBe(true);
    expect(r.flags['anniversary:10']).toBeDefined();
  });
});
