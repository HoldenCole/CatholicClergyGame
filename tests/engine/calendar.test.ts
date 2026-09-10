import { describe, it, expect } from 'vitest';
import {
  baptismOfTheLord,
  dayOfWeek,
  easterSunday,
  fromDayNumber,
  liturgicalYear,
  seasonOfDay,
  seasonOfWeek,
  toDayNumber,
} from '@/engine/calendar';

const d = (year: number, month: number, day: number) => toDayNumber({ year, month, day });

describe('engine/calendar', () => {
  it('round-trips day numbers', () => {
    for (const date of [
      { year: 1970, month: 1, day: 1 },
      { year: 2000, month: 2, day: 29 },
      { year: 2024, month: 12, day: 31 },
      { year: 1955, month: 7, day: 4 },
    ]) {
      expect(fromDayNumber(toDayNumber(date))).toEqual(date);
    }
  });

  it('knows the day of the week', () => {
    expect(dayOfWeek(d(1970, 1, 1))).toBe(4); // Thursday
    expect(dayOfWeek(d(2024, 3, 31))).toBe(0); // Easter Sunday 2024
    expect(dayOfWeek(d(1961, 1, 1))).toBe(0); // before the epoch, still a Sunday
  });

  it.each([
    [2000, 4, 23],
    [2008, 3, 23],
    [2011, 4, 24],
    [2016, 3, 27],
    [2024, 3, 31],
    [2025, 4, 20],
    [2038, 4, 25],
    [1990, 4, 15],
  ])('computes Easter %i as %i/%i', (year, month, day) => {
    expect(fromDayNumber(easterSunday(year))).toEqual({ year, month, day });
  });

  it('places Advent on the Sunday nearest 30 November', () => {
    expect(fromDayNumber(liturgicalYear(2023).adventStart)).toEqual({ year: 2023, month: 12, day: 3 });
    expect(fromDayNumber(liturgicalYear(2024).adventStart)).toEqual({ year: 2024, month: 12, day: 1 });
    expect(fromDayNumber(liturgicalYear(2022).adventStart)).toEqual({ year: 2022, month: 11, day: 27 });
  });

  it('places the Baptism of the Lord per US practice', () => {
    // 2024: Epiphany Sunday 7 Jan, so Baptism moves to Monday 8 Jan.
    expect(fromDayNumber(baptismOfTheLord(2024))).toEqual({ year: 2024, month: 1, day: 8 });
    // 2023: Epiphany Sunday 8 Jan, Baptism Monday 9 Jan.
    expect(fromDayNumber(baptismOfTheLord(2023))).toEqual({ year: 2023, month: 1, day: 9 });
    // 2025: Epiphany Sunday 5 Jan, Baptism Sunday 12 Jan.
    expect(fromDayNumber(baptismOfTheLord(2025))).toEqual({ year: 2025, month: 1, day: 12 });
  });

  it('assigns seasons to days across the 2024 cycle', () => {
    expect(seasonOfDay(d(2024, 1, 7))).toBe('christmas'); // Epiphany
    expect(seasonOfDay(d(2024, 1, 9))).toBe('ordinary');
    expect(seasonOfDay(d(2024, 2, 13))).toBe('ordinary'); // Shrove Tuesday
    expect(seasonOfDay(d(2024, 2, 14))).toBe('lent'); // Ash Wednesday
    expect(seasonOfDay(d(2024, 3, 23))).toBe('lent');
    expect(seasonOfDay(d(2024, 3, 24))).toBe('holy_week'); // Palm Sunday
    expect(seasonOfDay(d(2024, 3, 30))).toBe('holy_week'); // Holy Saturday
    expect(seasonOfDay(d(2024, 3, 31))).toBe('easter');
    expect(seasonOfDay(d(2024, 5, 19))).toBe('easter'); // Pentecost
    expect(seasonOfDay(d(2024, 5, 20))).toBe('ordinary');
    expect(seasonOfDay(d(2024, 8, 15))).toBe('ordinary');
    expect(seasonOfDay(d(2024, 11, 30))).toBe('ordinary');
    expect(seasonOfDay(d(2024, 12, 1))).toBe('advent');
    expect(seasonOfDay(d(2024, 12, 24))).toBe('advent');
    expect(seasonOfDay(d(2024, 12, 25))).toBe('christmas');
    expect(seasonOfDay(d(2025, 1, 12))).toBe('christmas'); // Baptism of the Lord
    expect(seasonOfDay(d(2025, 1, 13))).toBe('ordinary');
  });

  it('lets mid-week Lent and Christmas claim their week; Sunday feasts rule otherwise', () => {
    expect(seasonOfWeek(d(2024, 2, 11))).toBe('lent'); // Ash Wednesday falls on the 14th
    expect(seasonOfWeek(d(2024, 12, 22))).toBe('christmas'); // Christmas on Wednesday
    expect(seasonOfWeek(d(2024, 5, 19))).toBe('easter'); // Pentecost Sunday rules its week
    expect(seasonOfWeek(d(2025, 1, 12))).toBe('christmas'); // Baptism Sunday rules its week
    expect(seasonOfWeek(d(2024, 3, 24))).toBe('holy_week');
    expect(seasonOfWeek(d(2024, 3, 31))).toBe('easter');
    expect(seasonOfWeek(d(2024, 7, 7))).toBe('ordinary');
  });

  it('produces every season at least once over any year of weeks', () => {
    const seen = new Set<string>();
    let sunday = d(2021, 8, 22);
    for (let i = 0; i < 53; i++, sunday += 7) seen.add(seasonOfWeek(sunday));
    expect([...seen].sort()).toEqual(['advent', 'christmas', 'easter', 'holy_week', 'lent', 'ordinary']);
  });
});
