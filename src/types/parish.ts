import type { Condition, Effect } from './events';
import type { Season } from './time';
import type { Role } from './world';

/** DESIGN.md §2.6: the five mandatory obligations, each with a quality dial. */
export type ObligationKey = 'sunday_masses' | 'weekday_masses' | 'confessions' | 'meetings' | 'sacramental_prep';

export const OBLIGATION_KEYS: readonly ObligationKey[] = [
  'sunday_masses',
  'weekday_masses',
  'confessions',
  'meetings',
  'sacramental_prep',
] as const;

export type Quality = 'min' | 'standard' | 'invested';

export interface ObligationDef {
  key: ObligationKey;
  label: string;
  /** AP cost per quality; `invested` may be null where the table has no such level. */
  ap: { min: number; standard: number; invested: number | null };
  /** Per-week effects at each quality. `standard` is the neutral baseline. */
  effects: { min: Effect[]; standard: Effect[]; invested: Effect[] };
  /** Whether Administration reduces this obligation's AP (admin floor). */
  adminReducible: boolean;
  /** One-line description shown next to the dial. */
  blurb: { min: string; standard: string; invested: string };
}

/**
 * Where an action happens. The scene graphics phase binds hotspots to these,
 * so every discretionary action must carry one.
 */
export type ActionLocation =
  | 'church'
  | 'sacristy'
  | 'confessional'
  | 'rectory'
  | 'office'
  | 'hall'
  | 'school'
  | 'street'
  | 'hospital'
  | 'chancery'
  | 'study'
  | 'chapel';

/** Something a man cuts out of his own week to make an hour. parish/sacrifices.json */
export interface SacrificeDef {
  id: string;
  label: string;
  blurb: string;
  ap: number;
  /** Strain added a week while it stands. */
  strain: number;
  effectsPerWeek: Effect[];
}

/** The work that answers a parish's live problem. parish/problems.json */
export interface ProblemFixDef {
  problem: string;
  label: string;
  blurb: string;
  weeks: number;
  apPerWeek: number;
  cost: number;
  outcome: string;
  effects: Effect[];
}

export interface ActionDef {
  id: string;
  label: string;
  blurb: string;
  location: ActionLocation;
  /** Effects applied per AP spent in a week. */
  effectsPerAp: Effect[];
  requires?: Condition[];
  /** Whether spending here counts as using Theology / Knowledge (halts atrophy). */
  usesTheology?: boolean;
  usesKnowledge?: boolean;
  /** Whether spending here counts as administrative load (drains Piety). */
  adminLoad?: boolean;
  /** Maximum AP per week that does anything. */
  maxAp: number;
  /** Phase 4: which group verb this action performs, if any. */
  groupVerb?: 'sustain' | 'found';
}

/** DESIGN.md §2.3: the standing routine, set per assignment and editable any time. */
export interface Routine {
  obligations: Record<ObligationKey, Quality>;
  /** Action id -> AP per week. Scaled down when the week's mandatory floor eats into it. */
  discretionary: Record<string, number>;
  /** What he has cut out of his own week to make hours: ids from parish/sacrifices.json. */
  sacrifices?: string[];
}

/** A quarterly reading of the parish, so the man can tell whether it is turning. */
export interface ParishSnapshot {
  week: number;
  attendance: number;
  collections: number;
  debt: number;
  /** Mean vitality of supported groups. */
  groups: number;
  /** Mean building condition. */
  buildings: number;
  households: number;
}

/** Work on the parish's one live problem. */
export interface ProblemWork {
  problem: string;
  startWeek: number;
  endWeek: number;
  apPerWeek: number;
}

/** Seasonal AP floors. DESIGN.md §2.5 */
export type SeasonalLoad = Record<Season, number>;

export interface ParishFinance {
  cash: number;
  debt: number;
  /** Rolling average weekly collection, for the digest. */
  averageCollection: number;
  /** Weeks until the next assessment installment. */
  weeksToAssessment: number;
}

/** The live state of the player's current parish assignment. */
export interface ParishState {
  parishId: string;
  role: Role;
  arcStartWeek: number;
  /** Planned end of the arc; the next assignment beat fires here. */
  arcEndWeek: number;
  routine: Routine;
  /** Absolute weeks scheduled as played weeks in the current year. */
  playedWeeks: number[];
  /** Absolute week the current played-week schedule was made for. */
  scheduleYear: number;
  finance: ParishFinance;
  /** Registered households attending on a typical Sunday, as a fraction. */
  attendance: number;
  staffIds: string[];
  /** One-week AP adjustment authored by an event (target "ap"). */
  apNextWeek: number;
  /** Consecutive weeks the homily was recycled. DESIGN §2.6 */
  recycledHomilyStreak: number;
  /** Weeks served in this assignment. */
  weeksServed: number;
  /**
   * Rolling 0..1 measure of how present the man is to his people: visits,
   * confessions, the groups, an invested homily. Feeds attendance and so
   * collections, and a well-tended parish has fewer fires. Absent in older saves.
   */
  care?: number;
  /** The parish as it was when he arrived, and each quarter since. */
  arrival?: ParishSnapshot;
  snapshots?: ParishSnapshot[];
  /** Work in hand on the parish's problem. */
  work?: ProblemWork | null;
}

/** What the week resolved to, for the digest and for tests. */
export interface WeekLedger {
  week: number;
  apTotal: number;
  apMandatory: number;
  apDiscretionary: Record<string, number>;
  obligations: Record<ObligationKey, Quality>;
  collection: number;
  /** Attendance after this week, and the change from the week before. */
  attendance: number;
  attendanceDelta: number;
  debtService: number;
  lines: string[];
}
