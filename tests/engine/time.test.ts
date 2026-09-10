import { describe, it, expect } from 'vitest';
import {
  advanceClock,
  createClock,
  dateOf,
  describeWeek,
  gameYearOf,
  isYearStart,
  seasonOf,
  weekOfYear,
  yearStartDay,
} from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';

describe('engine/time', () => {
  const clock = createClock({ year: 2021, month: 8, day: 20 }); // a Friday

  it('snaps week 0 to the first Sunday on or after the anchor', () => {
    expect(dateOf(clock, 0)).toEqual({ year: 2021, month: 8, day: 22 });
    const onSunday = createClock({ year: 2021, month: 8, day: 22 });
    expect(dateOf(onSunday, 0)).toEqual({ year: 2021, month: 8, day: 22 });
  });

  it('advances by whole weeks', () => {
    expect(dateOf(advanceClock(clock, 3))).toEqual({ year: 2021, month: 9, day: 12 });
    expect(advanceClock(clock, 3).week).toBe(3);
  });

  it('counts game years from the anchor anniversary, 52 or 53 weeks each', () => {
    expect(gameYearOf(clock, 0)).toBe(1);
    expect(gameYearOf(clock, 52)).toBe(1); // 21 Aug 2022, still before the anniversary
    expect(gameYearOf(clock, 53)).toBe(2); // 28 Aug 2022, first Sunday on/after 22 Aug
    expect(fromDayNumber(yearStartDay(clock, 2))).toEqual({ year: 2022, month: 8, day: 28 });
    expect(isYearStart(clock, 53)).toBe(true);
    expect(isYearStart(clock, 52)).toBe(false);
    expect(isYearStart(clock, 0)).toBe(false);
    // Walk seven years and check every year is 52 or 53 weeks.
    const lengths: number[] = [];
    let start = 0;
    for (let w = 1; w < 7 * 53; w++) {
      if (isYearStart(clock, w)) {
        lengths.push(w - start);
        start = w;
      }
    }
    expect(lengths.length).toBeGreaterThanOrEqual(6);
    for (const len of lengths) expect([52, 53]).toContain(len);
  });

  it('numbers weeks within a year from 1', () => {
    expect(weekOfYear(clock, 0)).toBe(1);
    expect(weekOfYear(clock, 52)).toBe(53);
    expect(weekOfYear(clock, 53)).toBe(1);
  });

  it('reports the season and a readable description', () => {
    expect(seasonOf(clock, 0)).toBe('ordinary');
    expect(describeWeek(clock, 0)).toBe('Week of 22 August 2021 · Ordinary Time');
    // 28 Nov 2021 is the First Sunday of Advent: week 14.
    expect(dateOf(clock, 14)).toEqual({ year: 2021, month: 11, day: 28 });
    expect(seasonOf(clock, 14)).toBe('advent');
  });
});
