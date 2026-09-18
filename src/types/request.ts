/**
 * The letter to the vicar for clergy. DESIGN.md §7.6.
 *
 * Not the preference form of §7.4, which names a kind of place: this names a
 * place. One stands at a time, the chancery counts how often a man has asked,
 * and it is answered by the board when his arc ends or, for a strong man or an
 * urgent need, sooner.
 */
export type RequestTarget =
  | { kind: 'parish'; parishId: string }
  /** A posting, by the id of the offer whose commitment it is. */
  | { kind: 'post'; offerId: string };

export type RequestOutcome = 'granted' | 'refused' | 'withdrawn' | 'lapsed';

export interface CareerRequest {
  target: RequestTarget;
  /** What he asked for, in words, so the file reads without the world. */
  label: string;
  /** The week the letter went in. */
  week: number;
  /** Times he has asked in this career, this one included. */
  asked: number;
  /** Set when the file is closed. */
  answeredWeek?: number;
  outcome?: RequestOutcome;
}
