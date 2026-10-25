/**
 * The parish's week as it is actually said: Masses at times, in languages, by
 * someone; confessions at times, for so long. The hours the routine charges
 * for the liturgy derive from this (systems/schedule.ts), so the week says
 * what it was doing and not only how long it took. DESIGN §8.
 */
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Who says it: the player, the pastor he serves under, the vicar who serves under him, or another priest of the house. */
export type Celebrant = 'me' | 'pastor' | 'vicar' | 'other';

export interface MassTime {
  id: string;
  day: Weekday;
  /** Minutes after midnight. */
  minute: number;
  /** 'english', or a language id from content/languages.json ('spanish', 'latin', ...). */
  language: string;
  celebrant: Celebrant;
  /** Counts toward the Sunday obligation: a Sunday Mass, or a Saturday vigil at four or later. */
  sunday: boolean;
}

export interface ConfessionSlot {
  id: string;
  day: Weekday;
  minute: number;
  /** How long the light is on. */
  minutes: number;
  confessor: Celebrant;
}

export interface ParishSchedule {
  masses: MassTime[];
  confessions: ConfessionSlot[];
  /** The last answer a vicar had from his pastor about the schedule, for the sheet. */
  lastAsk?: { week: number; text: string; granted: boolean };
}

/** A change to the schedule, as the sheet or a scene asks for it. */
export type ScheduleChange =
  | { kind: 'add_mass'; day: Weekday; minute: number; language: string }
  | { kind: 'remove_mass'; id: string }
  | { kind: 'hand_mass'; id: string; to: Celebrant }
  | { kind: 'add_confessions'; day: Weekday; minute: number; minutes: number }
  | { kind: 'remove_confessions'; id: string };
