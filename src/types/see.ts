/** A small see from the pool. content/sees.json */
export interface SeeDef {
  id: string;
  /** "the Diocese of Gaylord" */
  name: string;
  /** "Gaylord" */
  see: string;
  region: string;
  /** Two or three sentences a priest from a big archdiocese would be told about it. */
  character: string;
  /** Rough size, for the word on the sheet. */
  priests: number;
  parishes: number;
  /** Where the dials start, −1..1 nudges. */
  leans?: Partial<Record<'presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number>>;
  /** One of the great sees: the game's own dioceses, where Rome sends a bishop it has watched. */
  great?: boolean;
}

/** A see he held before this one, for the sheet and the ending. */
export interface FormerSee {
  id: string;
  name: string;
  see: string;
  region: string;
  years: number;
  ordinations: number;
  closings: number;
}

/**
 * The see he holds as bishop. Five dials the bishop's week moves, and the
 * counts a career summary reads back. DESIGN post-V1: the episcopal tier.
 */
export interface SeeState {
  id: string;
  name: string;
  see: string;
  region: string;
  installedWeek: number;
  /** −100..100: how the priests of the diocese regard their bishop. */
  presbyterate: number;
  /** −100..100: the people and the town. */
  people: number;
  /** −100..100: Rome's regard for how the see is run. */
  rome: number;
  /** −100..100: solvency; below −50 the diocese is in crisis. */
  money: number;
  /** 1 (deep bench) .. 5 (critically short). */
  shortage: number;
  ordinations: number;
  closings: number;
  /** One line per year, for the sheet and the ending. */
  years: string[];
  /** The sees he held before, oldest first, when Rome has moved him. */
  former?: FormerSee[];
}
