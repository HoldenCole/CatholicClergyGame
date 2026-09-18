/**
 * Religious institutes and the religious cast. DESIGN.md §9.4. Religious are
 * standing characters, not event flavour: they sit outside the player's ladder,
 * answer to a provincial in another city, hold institutions the diocese needs
 * and does not own, and carry a charism that cuts across the diocesan factions.
 */

export type Charism =
  | 'preaching'
  | 'scholarship'
  | 'contemplative'
  | 'poverty'
  | 'mission'
  | 'teaching'
  | 'healthcare'
  | 'charity'
  | 'tradition';

export const CHARISMS: readonly Charism[] = ['preaching', 'scholarship', 'contemplative', 'poverty', 'mission', 'teaching', 'healthcare', 'charity', 'tradition'] as const;

/** What an institute holds in the diocese. */
export type InstituteWork = 'university' | 'high_school' | 'hospital' | 'retreat_house' | 'parish' | 'shelter' | 'clinic' | 'monastery' | 'seminary_faculty';

export type InstituteTrajectory = 'growing' | 'stable' | 'collapsing';

/** Warm, correct, or openly strained. The bishop does not command them. */
export type BishopRelation = 'warm' | 'correct' | 'strained';

/** One institute in the content pool. */
export interface InstituteDef {
  id: string;
  /** "The Order of Preachers" */
  name: string;
  /** "the Dominicans" */
  short: string;
  /** OP, SJ, OSB, RSM. */
  initials: string;
  women: boolean;
  charism: Charism;
  /** −100..100 tendency; the rolled alignment varies around it. */
  lean: number;
  /** Works this institute plausibly holds, drawn from when the diocese has room. */
  works: InstituteWork[];
  /** How the men and women of it are addressed: "Fr.", "Br.", "Sr.". */
  titles: string[];
  /** One line for the sheet. */
  blurb: string;
}

/** An institute as it stands in this diocese. */
export interface Institute {
  id: string;
  defId: string;
  name: string;
  short: string;
  initials: string;
  women: boolean;
  charism: Charism;
  alignment: number;
  trajectory: InstituteTrajectory;
  /** Members in the diocese, roughly. */
  size: number;
  works: InstituteWork[];
  bishop: BishopRelation;
  /** The city the provincial sits in, which is never this one. */
  provincial: string;
}

/** What a director is like in the room, which decides what he is good for. */
export type Temperament = 'brisk' | 'contemplative' | 'scholarly' | 'warm' | 'severe';

export const TEMPERAMENTS: readonly Temperament[] = ['brisk', 'contemplative', 'scholarly', 'warm', 'severe'] as const;

/** The kinds of trouble a man brings to direction. */
export type Trouble = 'dark_night' | 'overwork' | 'doubt' | 'loneliness' | 'scruples' | 'anger';

export const TROUBLES: readonly Trouble[] = ['dark_night', 'overwork', 'doubt', 'loneliness', 'scruples', 'anger'] as const;

export type Match = 'good' | 'fair' | 'poor';

/** The standing spiritual direction relationship. Begins in seminary Y1 and can run forty years. */
export interface Direction {
  npcId: string;
  /** Week it began, for the record. */
  sinceWeek: number;
  charism: Charism;
  temperament: Temperament;
  /** Weeks of direction actually kept, which is what slows the drain. */
  weeksKept: number;
  /** He is also the confessor, or the roles are split. Splitting is read as guarded. */
  confessorToo: boolean;
  /** Set when a provincial moved him or he died: the replacement is never as good at once. */
  endedWeek?: number;
  endedWhy?: 'reassigned' | 'died' | 'changed';
}

/** One of the men offered in Y1. */
export interface DirectorOption {
  npcId: string;
  name: string;
  /** "A Dominican, forty years a preacher" */
  line: string;
  charism: Charism;
  temperament: Temperament;
  /** What he is plainly good for, in words. */
  good: string;
  /** What he is plainly not, in words. */
  poor: string;
}
