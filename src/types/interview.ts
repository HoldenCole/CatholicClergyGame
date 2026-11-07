import type { Condition, Effect } from './events';
import type { Volume } from './stats';

/**
 * The vocations director's interview at the start of formation (DESIGN §6.1a):
 * questions, each with its answers; every answer is authored effects, an
 * opinion where it is one, and a note in the file. content/seminary/interview.json
 */
export interface InterviewAnswer {
  id: string;
  /** What the man says. May carry {tokens}. */
  label: string;
  /** What follows in the room: shown before the next question. */
  outcome: string;
  /** Offered only when these pass (a man with a career is asked about it). */
  requires?: Condition[];
  effects: Effect[];
  /** An opinion given in the room: recorded as a position when all three are set. */
  volume?: Volume;
  positionTopic?: string;
  positionValue?: number;
}

export interface InterviewQuestion {
  id: string;
  /** The director's question. May carry {tokens}. */
  prompt: string;
  /** Asked only when these pass. */
  when?: Condition[];
  answers: InterviewAnswer[];
}

export interface InterviewDef {
  intro: string;
  close: string;
  questions: InterviewQuestion[];
}
