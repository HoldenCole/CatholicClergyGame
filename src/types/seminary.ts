import type { Pillar } from './character';

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
}
