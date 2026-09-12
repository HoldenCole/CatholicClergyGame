import type { Condition, Effect } from './events';
import type { Pillar } from './character';
import type { StatKey, ConstituencyKey } from './stats';

/** Where he lives while away: a city for a degree, or the bishop's residence for a post. */
export type StudyCity = 'rome' | 'washington' | 'residence' | 'campus' | 'hospital' | 'seminary' | 'chancery' | 'auxiliary' | 'see';

/** A course of study away from the diocese. content/study/programs.json */
export interface StudyProgramDef {
  id: string;
  city: StudyCity;
  label: string;
  /** "the Gregorian", "the Catholic University of America" */
  school: string;
  /** Where he lives: "the North American College" */
  residence: string;
  /** A degree, a post held away from any parish, or a see of his own: the last act. */
  kind: 'study' | 'post' | 'see';
  /** Free hours a week after lectures, the chapel, and the house rule. */
  hours: number;
  /** The class line for the digest. */
  classes: string;
  /** A posting's own dials: what the years there move. */
  place?: { label: string; dials: { id: string; label: string; low: string; high: string }[] };
}

export type StudyLocation = 'desk' | 'chapel' | 'library' | 'hospital' | 'parish' | 'basilica' | 'college_office' | 'curia' | 'piazza' | 'language' | 'field';

/** What a priest-student does with a free hour. content/study/activities.json */
export interface StudyActivityDef {
  id: string;
  label: string;
  blurb: string;
  maxAp: number;
  location: StudyLocation;
  /** Only in these places, if set. */
  city?: StudyCity | StudyCity[];
  /** Studies, or work on the side. The sheet groups them. */
  kind: 'study' | 'work';
  requires?: Condition[];
  stats: Partial<Record<StatKey, number>>;
  pillars?: Partial<Record<Pillar, number>>;
  reputation?: { key: ConstituencyKey; delta: number }[];
  relationships?: { selector: string; delta: number }[];
  credentialAfter?: { hours: number; credential: string; flag?: string; line: string };
  /** Applied once, the first week it is taken. */
  onFirst?: Effect[];
  /** For a posting: what an hour a week does to the place's dials. */
  place?: Record<string, number>;
  /** For a bishop: what an hour a week does to the see's dials. */
  see?: Partial<Record<'presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number>>;
  digest: string[];
}

export interface StudyState {
  offerId: string;
  program: string;
  city: StudyCity;
  label: string;
  school: string;
  residence: string;
  startWeek: number;
  endWeek: number;
  /** Set when the failure roll went against him: he washes out at the end instead of graduating. */
  failed: boolean;
  routine: Record<string, number>;
  hoursLogged: Record<string, number>;
  /** Activities taken at least once, for onFirst effects. */
  taken: string[];
  /** The parish he left, for the record. */
  fromParishId: string | null;
  /** A posting's dials, −100..100, moved by the week. */
  place?: Record<string, number>;
}
