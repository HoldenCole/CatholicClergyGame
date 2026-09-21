import type { DirectorOption } from './religious';
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
  /** Y1: the man chooses a spiritual director from those offered. DESIGN.md §6.6, §9.4. */
  | { kind: 'director'; options: DirectorOption[] }
  | { kind: 'assignment'; assignment: Assignment }
  /** The bishop offers the man a choice; each option says what it involves. */
  | { kind: 'assignment_choice'; options: AssignmentOption[]; why: string }
  /** A letter that stops the clock until read: the year in review, a new bishop's reading of the file. */
  | { kind: 'letter'; letter: Letter }
  | { kind: 'ended'; ending: Ending; summary: string }
  /** The provincial's consultation before an assignment: the friar states a preference or objects. E3 §3.1. */
  | { kind: 'consultation' }
  /** The provincial's letter has come: taken with good grace, reluctance, or refused. */
  | { kind: 'obedience_letter' }
  /** A chapter in session: the ballots, watched round by round. E3 §3.6. */
  | { kind: 'chapter' }
  /** A term of office has run out: the return to the ranks, well or badly. E3 §3.7. */
  | { kind: 'term_end' }
  /** The bishop's office asked the provincial for him; the provincial's answer, and the friar's when it is left to him. E3 §3.11. */
  | { kind: 'bishop_ask' }
  /** A foundation approved: the founder writes its charter before the men are sent. E3 §9.4. */
  | { kind: 'charter' };

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
  /**
   * A mid-arc answer to a request (DESIGN §7.6): the man is still in his post,
   * so 'go' must close it before the move, and 'stay' moves nothing at all.
   */
  requested?: 'go' | 'stay';
}

export interface Letter {
  /** What kind of letter, for the sheet's heading and the record. */
  sort: 'review' | 'bishop' | 'provincial' | 'confrere';
  title: string;
  /** Prose paragraphs. */
  body: string[];
  /** Short rows the sheet can print, label and value. */
  rows?: { label: string; value: string }[];
  week: number;
  /** A thing the letter lets the man do from it: look for a director again. */
  action?: 'seek_director';
}
