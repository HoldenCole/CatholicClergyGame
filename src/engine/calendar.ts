import type { CalendarDate, Season } from '@/types';

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 for a proleptic Gregorian date (no timezone). */
export function toDayNumber(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day) / MS_PER_DAY;
}

export function fromDayNumber(n: number): CalendarDate {
  const dt = new Date(n * MS_PER_DAY);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(n: number): number {
  return (((n + 4) % 7) + 7) % 7;
}

/** The Sunday on or after day `n`. */
export function nextSundayOnOrAfter(n: number): number {
  const dow = dayOfWeek(n);
  return dow === 0 ? n : n + (7 - dow);
}

/** Easter Sunday for a Gregorian year (Meeus/Jones/Butcher). */
export function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDayNumber({ year, month, day });
}

/** Key dates of the liturgical cycle that falls within one calendar year. */
export interface LiturgicalYear {
  /** Baptism of the Lord that closes the Christmas season begun the previous December. */
  baptismOfTheLord: number;
  ashWednesday: number;
  palmSunday: number;
  easter: number;
  pentecost: number;
  /** First Sunday of Advent. */
  adventStart: number;
  christmas: number;
}

/**
 * Baptism of the Lord in a given January, following the US practice where
 * Epiphany is kept on the Sunday between 2 and 8 January. Baptism is the
 * following Sunday, except that when Epiphany falls on 7 or 8 January it is
 * kept on the Monday immediately after.
 */
export function baptismOfTheLord(year: number): number {
  const epiphanySunday = nextSundayOnOrAfter(toDayNumber({ year, month: 1, day: 2 }));
  const epiphanyDate = fromDayNumber(epiphanySunday).day;
  return epiphanyDate >= 7 ? epiphanySunday + 1 : epiphanySunday + 7;
}

export function liturgicalYear(year: number): LiturgicalYear {
  const easter = easterSunday(year);
  const christmas = toDayNumber({ year, month: 12, day: 25 });
  const dowChristmas = dayOfWeek(christmas);
  const adventStart = christmas - (dowChristmas === 0 ? 7 : dowChristmas) - 21;
  return {
    baptismOfTheLord: baptismOfTheLord(year),
    ashWednesday: easter - 46,
    palmSunday: easter - 7,
    easter,
    pentecost: easter + 49,
    adventStart,
    christmas,
  };
}

/** The season in effect on one day. */
export function seasonOfDay(n: number): Season {
  const { year } = fromDayNumber(n);
  const ly = liturgicalYear(year);
  if (n >= ly.christmas) return 'christmas';
  if (n >= ly.adventStart) return 'advent';
  if (n <= ly.baptismOfTheLord) return 'christmas';
  if (n >= ly.easter) return n <= ly.pentecost ? 'easter' : 'ordinary';
  if (n >= ly.palmSunday) return 'holy_week';
  if (n >= ly.ashWednesday) return 'lent';
  return 'ordinary';
}

/**
 * The season of a game week (Sunday `sunday` through the following Saturday).
 * The Sunday's season rules the week, except that Lent and Christmas, which can
 * begin mid-week, claim the week they begin in.
 */
export function seasonOfWeek(sunday: number): Season {
  const start = seasonOfDay(sunday);
  const end = seasonOfDay(sunday + 6);
  if (start === end) return start;
  if (end === 'lent' || end === 'christmas') return end;
  return start;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatDate(d: CalendarDate): string {
  return `${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
}

export const SEASON_LABELS: Record<Season, string> = {
  advent: 'Advent',
  christmas: 'Christmas',
  ordinary: 'Ordinary Time',
  lent: 'Lent',
  holy_week: 'Holy Week',
  easter: 'Easter',
};
