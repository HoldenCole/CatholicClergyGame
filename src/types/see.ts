import type { Condition, Effect } from './events';
import type { ChanceryOffice, LiturgicalStance, LiturgicalTopic } from './world';
import type { Struggle } from './npc';
import type { StatKey } from './stats';

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
  /** E4 R1.0: what the diocese synthesizer needs to roll the see as a world of parishes and priests (a small see; the great ones are presets). */
  synth?: { state: string; region: string; lat: number; lon: number; size: 'small' | 'medium' | 'large' | 'huge'; latinoShare: number; growth: 'shrinking' | 'stable' | 'growing' | 'fast'; climate: 'cold' | 'temperate' | 'hot' | 'desert' | 'mild' };
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
  /** E4 R1.0: the preset id of the see's own world (`state.world` while he holds it): the see as a place with people. */
  dioceseId?: string;
  /** E4 R1.1: the act on the desk, being written in the desk's hours; and the acts signed in this chair. */
  desk?: SeeAct;
  acts?: SignedAct[];
  /** E4 R1.2: the directions given to his priests, and the week of the last. */
  directions?: GivenDirection[];
  lastDirectionWeek?: number;
  /** E4 R1.3: the week each parish was last visited, and the week of the last visit anywhere. */
  visits?: Record<string, number>;
  lastVisitWeek?: number;
  /** E4 R1.3: cycles of the whole diocese completed. */
  cyclesDone?: number;
}

/** E4 R1.3: what a visit says, by what the visit finds (content/see/visits.json): pools of lines with {parish}, {pastor}, {town}. */
export interface VisitPools {
  kind: Record<string, string[]>;
  school: Record<string, string[]>;
  debt: { none: string[]; some: string[]; heavy: string[] };
  generational: Record<string, string[]>;
  struggle: Record<string, string[]>;
  trait: Record<string, string[]>;
  vacant: string[];
  again: string[];
}

/** E4 R1.2: what a direction needs of the man it is given to. Declared in data, checked by the engine. */
export interface DirectionRequires {
  minAge?: number;
  maxAge?: number;
  /** One of these private struggles. */
  struggle?: Struggle[];
  /** Not already carrying this title. */
  titleNot?: string;
  stat?: { key: StatKey; min: number };
  /** A pastor of a parish (or, false, not one). */
  pastor?: boolean;
  /** The file must know it: the struggle seen on a visit (E4 R1.3), never guessed at. */
  known?: boolean;
}

export type DirectionKind = 'move' | 'dean' | 'monsignor' | 'study' | 'sabbatical' | 'treatment' | 'rebuke' | 'retire' | 'chancery';
export type DirectionAnswer = 'accepted' | 'reluctant' | 'refused';

/** E4 R1.2: a direction a bishop may give a priest of his diocese, as data (content/see/directions.json). */
export interface DirectionDef {
  id: string;
  kind: DirectionKind;
  label: string;
  blurb: string;
  /** A parish to move him to, or a chancery office to name him to. */
  target?: 'parish' | 'office';
  requires?: DirectionRequires;
  /** How a priest usually takes it, −1 (a blow) .. 1 (an honour). */
  welcome: number;
  /** Whether he can say no and make it stick. */
  refusable: boolean;
  /** Weeks away, for a direction that sends him somewhere. */
  awayWeeks?: number;
  /** The tag he carries home from it. */
  returnTag?: string;
  /** What it does to the see's dials when accepted; halved when reluctant, turned when refused. */
  see?: Partial<Record<'presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number>>;
  /** Not this direction again, to anyone, within these weeks. */
  restWeeks?: number;
  /** His reply, by answer, with {priest}, {parish}, {to}, {office}, {see}. */
  letter: Record<DirectionAnswer, string[]>;
  note: string;
}

export interface GivenDirection {
  id: string;
  npcId: string;
  week: number;
  answer: DirectionAnswer;
  /** The week he is due back, when it sent him away. */
  returnWeek?: number;
  parishId?: string;
  office?: ChanceryOffice;
}

/** E4 R1.1: an act of the bishop's desk, as data (content/see/acts.json): a decree, a letter, a synod, an appeal, a review. */
export interface SeeActDef {
  id: string;
  label: string;
  blurb: string;
  /** Blocks of the desk's hours it takes to write and sign. */
  hours: number;
  /** What must be chosen before it is begun: a parish of the diocese, or a liturgical topic and the stance to set. */
  target?: 'parish' | 'stance';
  requires?: Condition[];
  /** Once in a chair; or not again within these years. */
  once?: boolean;
  everyYears?: number;
  /** Written when it is signed (data); what the target does is the engine's (systems/bishop/desk.ts). */
  effects: Effect[];
  /** The letter to the diocese, with {see}, {parish}, {topic}, {stance}. */
  letter: string[];
  /** The line the record keeps, same tokens. */
  note: string;
}

export interface SeeAct {
  actId: string;
  startedWeek: number;
  /** The desk's logged hours when it was begun; progress is what has been logged since. */
  startedHours: number;
  parishId?: string;
  topic?: LiturgicalTopic;
  stance?: LiturgicalStance;
}

export interface SignedAct {
  actId: string;
  week: number;
  parishId?: string;
  parishName?: string;
  topic?: LiturgicalTopic;
  stance?: LiturgicalStance;
}
