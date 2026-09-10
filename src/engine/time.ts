import type { CalendarDate, Clock, Season } from '@/types';
import {
  formatDate,
  fromDayNumber,
  nextSundayOnOrAfter,
  seasonOfWeek,
  SEASON_LABELS,
  toDayNumber,
} from './calendar';

/**
 * A clock whose week 0 begins on the first Sunday on or after `anchor`.
 * Game-year anniversaries are counted from that opening Sunday.
 */
export function createClock(anchor: CalendarDate): Clock {
  return { startDay: nextSundayOnOrAfter(toDayNumber(anchor)), week: 0 };
}

export function sundayOf(clock: Clock, week = clock.week): number {
  return clock.startDay + week * 7;
}

export function dateOf(clock: Clock, week = clock.week): CalendarDate {
  return fromDayNumber(sundayOf(clock, week));
}

export function seasonOf(clock: Clock, week = clock.week): Season {
  return seasonOfWeek(sundayOf(clock, week));
}

/** Day number of the Sunday that opens game year `k` (1-based). */
export function yearStartDay(clock: Clock, k: number): number {
  if (k <= 1) return clock.startDay;
  const start = fromDayNumber(clock.startDay);
  return nextSundayOnOrAfter(toDayNumber({ ...start, year: start.year + (k - 1) }));
}

/**
 * The game year (1-based) a week falls in. A new year begins on the first
 * Sunday on or after each anniversary of the opening Sunday, so years are
 * 52 or 53 weeks long and stay aligned with the calendar.
 */
export function gameYearOf(clock: Clock, week = clock.week): number {
  const sunday = sundayOf(clock, week);
  const start = fromDayNumber(clock.startDay);
  const startDate = fromDayNumber(sunday);
  // Candidate year from the calendar, then correct by at most one.
  let k = startDate.year - start.year + 1;
  while (k > 1 && yearStartDay(clock, k) > sunday) k--;
  while (yearStartDay(clock, k + 1) <= sunday) k++;
  return k;
}

/** Week index within the current game year, 1-based. */
export function weekOfYear(clock: Clock, week = clock.week): number {
  const k = gameYearOf(clock, week);
  return Math.floor((sundayOf(clock, week) - yearStartDay(clock, k)) / 7) + 1;
}

export function isYearStart(clock: Clock, week = clock.week): boolean {
  return week > 0 && gameYearOf(clock, week) !== gameYearOf(clock, week - 1);
}

export function advanceClock(clock: Clock, weeks = 1): Clock {
  return { ...clock, week: clock.week + weeks };
}

/** "Week of 14 March 2021 · Lent" */
export function describeWeek(clock: Clock, week = clock.week): string {
  return `Week of ${formatDate(dateOf(clock, week))} · ${SEASON_LABELS[seasonOf(clock, week)]}`;
}
