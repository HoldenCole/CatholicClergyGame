import { describe, expect, it } from 'vitest';
import { climateOf, WEATHER_PULL, weatherOfWeek, type WeatherKind } from '@/systems/weather';
import { createClock, describeWeek } from '@/engine/time';
import { parishState } from './week.test';
import { resolveWeek } from '@/systems/week';
import { createRng } from '@/engine/rng';
import { readDigest } from '@/systems/digest';
import { feastsOfWeek } from '@/engine/feasts';

describe('the weather of the week', () => {
  it('reads the climate off the region line', () => {
    expect(climateOf('New England')).toBe('continental');
    expect(climateOf('Midwest')).toBe('continental');
    expect(climateOf('the Mississippi Gulf Coast')).toBe('southern');
    expect(climateOf('South Florida')).toBe('southern');
    expect(climateOf('east Texas')).toBe('southern');
    expect(climateOf('Northern California')).toBe('pacific');
    expect(climateOf('West')).toBe('pacific');
    expect(climateOf('eastern Montana')).toBe('mountain');
    expect(climateOf('western South Dakota')).toBe('mountain');
    expect(climateOf(undefined)).toBe('continental');
  });

  it('is deterministic by seed and week, snows in a northern winter and not in a southern one, and never empties the pews', () => {
    const clock = createClock({ year: 2020, month: 1, day: 5 });
    const a = weatherOfWeek('s', clock, 'New England');
    expect(weatherOfWeek('s', clock, 'New England')).toEqual(a);
    expect(a.word.length).toBeGreaterThan(0);
    const count = (region: string, weeks: number[]) => {
      const out: Partial<Record<WeatherKind, number>> = {};
      for (const w of weeks) for (let i = 0; i < 30; i++) { const k = weatherOfWeek(`seed${i}`, clock, region, w).kind; out[k] = (out[k] ?? 0) + 1; }
      return out;
    };
    const winter = [0, 1, 2, 3, 4, 5];
    const july = [26, 27, 28, 29];
    expect(count('New England', winter).snow ?? 0).toBeGreaterThan(20);
    expect(count('the Mississippi Gulf Coast', winter).snow ?? 0).toBe(0);
    expect(count('east Texas', july).heat ?? 0).toBeGreaterThan(30);
    expect(count('Northern California', winter).rain ?? 0).toBeGreaterThan(30);
    for (const v of Object.values(WEATHER_PULL)) { expect(v).toBeGreaterThanOrEqual(0.9); expect(v).toBeLessThanOrEqual(1); }
    expect(describeWeek(clock, 0, 'snow')).toMatch(/ · snow$/);
    expect(describeWeek(clock, 0)).not.toMatch(/snow/);
    expect(readDigest([{ week: 0, lines: [describeWeek(clock, 0, 'snow')] }], 1)[0]!.head).toMatch(/snow$/);
  });

  it('a snowed-in Sunday shows fewer in the pews that week without moving the parish\'s habit', () => {
    const s = parishState('weather-week');
    // Find a week that snows and one that is clear, same parish, same season band.
    const region = s.world!.diocese.visible.region;
    const parish = s.world!.parishes.find((p) => p.id === s.assignment!.parishId)!;
    let snowy = -1;
    let clear = -1;
    for (let w = 0; w < 600 && clear < 0; w++) {
      if (feastsOfWeek({ ...s.clock, week: w }, parish).length) continue;
      const k = weatherOfWeek(s.seed, s.clock, region, w).kind;
      if (k === 'snow' && snowy < 0) snowy = w;
      else if (k === 'clear' && snowy >= 0 && w - snowy <= 4) clear = w;
      else if (snowy >= 0 && w - snowy > 4) snowy = -1;
    }
    if (snowy < 0 || clear < 0) return; // a southern diocese; the pull is tested above
    const run = (w: number) => resolveWeek({ ...s, clock: { ...s.clock, week: w }, parish: { ...s.parish!, attendance: 0.5 } }, createRng('fixed'));
    const a = run(snowy);
    const b = run(clear);
    expect(a.ledger.attendance).toBeLessThan(b.ledger.attendance);
    expect(Math.abs(a.state.parish!.attendance - b.state.parish!.attendance)).toBeLessThan(0.02);
  });
});
