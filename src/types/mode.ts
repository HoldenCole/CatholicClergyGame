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
  /** The bishop offers the man a choice; each option says what it involves. */
  | { kind: 'assignment_choice'; options: AssignmentOption[]; why: string }
  /** A letter that stops the clock until read: the year in review, a new bishop's reading of the file. */
  | { kind: 'letter'; letter: Letter }
  | { kind: 'ended'; ending: Ending; summary: string };

/** One assignment on offer, with its breakdown. systems/choice.ts */
export interface AssignmentOption {
  id: string;
  headline: string;
  blurb: string;
  assignment: Assignment;
  /** In words: what the post is worth in the diocese's eyes. */
  prestige: string;
  /** In words: what it takes of the week. */
  time: string;
  /** What is involved, a few lines. */
  involves: string[];
  /** A diocesan office carried alongside (parish/offices.json), by id. */
  office?: string;
  /** A posting instead of a parish: the offer whose program it is. */
  posting?: string;
}

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
