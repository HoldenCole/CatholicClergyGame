import type { EvaluationRecord } from './seminary';
import type { Assignment } from './world';

export type Ending =
  | 'dismissed'
  | 'left_seminary'
  | 'left_priesthood'
  | 'died'
  | 'retired';

/**
 * What the player is looking at. The clock only runs in `clock` mode with an
 * empty pending queue; every other mode is a decision the player must make.
 */
export type Mode =
  | { kind: 'creation' }
  | { kind: 'clock' }
  | { kind: 'year_start'; year: number }
  | { kind: 'summer'; year: number }
  | { kind: 'evaluation'; record: EvaluationRecord }
  | { kind: 'ordination' }
  | { kind: 'assignment'; assignment: Assignment }
  /** A letter that stops the clock until read: the year in review, a new bishop's reading of the file. */
  | { kind: 'letter'; letter: Letter }
  | { kind: 'ended'; ending: Ending; summary: string };

export interface Letter {
  /** What kind of letter, for the sheet's heading and the record. */
  sort: 'review' | 'bishop';
  title: string;
  /** Prose paragraphs. */
  body: string[];
  /** Short rows the sheet can print, label and value. */
  rows?: { label: string; value: string }[];
  week: number;
}
