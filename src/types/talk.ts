/**
 * The presbyterate as people who talk. DESIGN §8.12: rumours seeded by
 * what happened, true or distorted, heard at the venues, moving a man's
 * standing with his brothers, and reaching the bishop a step later.
 */
export interface Rumour {
  id: string;
  /** The kind in content/rumours.json. */
  kind: string;
  /** 'you', or the NPC it is about. */
  about: string;
  /** How the talk names the subject: "Fr. Reilly". */
  name: string;
  text: string;
  true: boolean;
  /** The week the talk started. */
  week: number;
  /** The week he heard it, and where. */
  heardWeek?: number;
  venue?: string;
  /** For talk about him: the week it reaches the bishop, unless answered first. */
  bishopWeek?: number;
  reachedBishop?: boolean;
  /** He answered it: set it straight, owned it, or let it lie. */
  answered?: 'correct' | 'own' | 'let_lie' | 'defend' | 'join';
  /** What it does to his standing with his brothers when it goes round. */
  standing: number;
}

export interface TalkState {
  rumours: Rumour[];
  /** The watched men as last seen, by id: status, marks, the open life. */
  snapshot: Record<string, string>;
}
