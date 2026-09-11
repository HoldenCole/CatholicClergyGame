import type { Pillar } from './character';
import type { StatKey } from './stats';

/** DESIGN.md §6.4 */
export type EvaluationResult = 'ADVANCED' | 'ADVANCED_WITH_CONCERNS' | 'HELD_BACK' | 'DISMISSED';

export interface EvaluationRecord {
  year: number;
  result: EvaluationResult;
  pillars: Record<Pillar, number>;
  /** Plain-language concerns the rector recorded. */
  notes: string[];
}

export type SummerAssignment =
  | 'home_parish'
  | 'hard_parish'
  | 'hospital'
  | 'mission'
  | 'chancery'
  | 'rome'
  | 'language_immersion';

/** Where an activity happens, for the room's hotspots. */
export type SeminaryLocation = 'chapel' | 'library' | 'common_room' | 'gym' | 'director' | 'rector' | 'parish' | 'desk' | 'language';

/**
 * Something a seminarian can give his free hours to each week, on top of
 * the horarium. DESIGN §6: the weekly loop at low stakes. Rates are per
 * hour per week; a year of one hour a week is about a third of an
 * emphasis point.
 */
export interface SeminaryActivityDef {
  id: string;
  label: string;
  blurb: string;
  maxAp: number;
  location: SeminaryLocation;
  pillars: Partial<Record<Pillar, number>>;
  stats: Partial<Record<StatKey, number>>;
  /** Relationship movement per hour per week, by selector. */
  relationships?: { selector: string; delta: number }[];
  /** Standing with a constituency per hour per week. */
  reputation?: { key: 'parishioners' | 'brother_priests' | 'chancery'; delta: number };
  /** Hours logged toward a credential, and what arrives when they are done. */
  credentialAfter?: { hours: number; credential: string; flag?: string; line: string };
  /** Phrases for the week's digest line, rotated. */
  digest: string[];
}

export interface SeminaryState {
  /** The seminary's name, for {seminary} tokens. */
  name: string;
  /** 1 (propaedeutic) .. 7 (transitional deacon). */
  year: number;
  /** Chosen at year start. Sums to EMPHASIS_POINTS. Null until chosen. */
  emphasis: Record<Pillar, number> | null;
  /** Accumulated this year from emphasis and events. */
  pillarScores: Record<Pillar, number>;
  /** Consecutive years each pillar has been left at zero emphasis. */
  zeroStreak: Record<Pillar, number>;
  evaluations: EvaluationRecord[];
  /** Absolute weeks scheduled as played weeks this year. */
  playedWeeks: number[];
  summerAssignment: SummerAssignment | null;
  /** Summer choices made, by year. */
  summers: Record<number, SummerAssignment>;
  candidacy: boolean;
  lectorAcolyte: boolean;
  diaconate: boolean;
  /** Permanent flags on the formation record. */
  concerns: string[];
  heldBackCount: number;
  classmateIds: string[];
  /** Absolute week the current formation year began. */
  yearStartWeek: number;
  /** Free hours a week by activity id. Absent in saves from before the seminary week. */
  routine?: Record<string, number>;
  /** Hours ever given to each activity, for credentials that take time. */
  hoursLogged?: Record<string, number>;
  /** What this year's free hours built, by stat, for the evaluation. Reset each year. */
  hoursGains?: Partial<Record<StatKey, number>>;
}
