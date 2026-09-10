/**
 * Liturgical season of a game week. See DESIGN.md §2.5.
 *
 * Schema note: DESIGN.md §12.3 lists five seasons. `christmas` is added because
 * §2.5 names Christmas as a season that raises the AP floor, and the Christmas
 * season (25 Dec – Baptism of the Lord) is liturgically distinct from Advent
 * and Ordinary Time.
 */
export type Season = 'advent' | 'christmas' | 'ordinary' | 'lent' | 'holy_week' | 'easter';

export const SEASONS: readonly Season[] = [
  'advent',
  'christmas',
  'ordinary',
  'lent',
  'holy_week',
  'easter',
] as const;

/** Speed control. See DESIGN.md §2.2. */
export type Speed = 'PAUSED' | 'MANUAL' | 'AUTO' | 'SKIP';

export const SPEEDS: readonly Speed[] = ['PAUSED', 'MANUAL', 'AUTO', 'SKIP'] as const;

/**
 * A calendar date, proleptic Gregorian, no timezone.
 * `month` is 1–12, `day` is 1–31.
 */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * The game clock. Weeks are the atomic unit; each week runs Sunday to Saturday.
 * `startDay` is the day number (days since 1970-01-01) of the Sunday that opens
 * week 0. `week` is the number of weeks elapsed since then.
 */
export interface Clock {
  startDay: number;
  week: number;
}

/**
 * Major structural beats. `SKIP` runs until one of these is reached.
 * Later phases push beats onto the clock; Phase 0 only produces `year_end`.
 */
export type BeatKind =
  | 'year_end'
  | 'assignment'
  | 'evaluation'
  | 'promotion_decision'
  | 'succession'
  | 'ordination'
  | 'phase_change';

export interface Beat {
  kind: BeatKind;
  /** Absolute game week the beat lands on. */
  week: number;
  label: string;
}
