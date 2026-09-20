import type { Effect } from './events';
/** A classmate's rolled future. DESIGN 9.2: trajectories roll at ordination and simulate forward. */
export type MilestoneKind = 'pastor' | 'chancery' | 'rome_study' | 'left' | 'died' | 'scandal' | 'bishop_elsewhere' | 'retired';

export interface Milestone {
  yearsOrdained: number;
  kind: MilestoneKind;
  /** Applied when reached. */
  done: boolean;
}

/** DESIGN 8.3: a pastor's multi-year project. */
export type ProjectType =
  | 'renovation'
  | 'restoration'
  | 'debt_retirement'
  | 'save_school'
  | 'close_school'
  | 'liturgical_change'
  | 'found_mission'
  | 'capital_campaign'
  // Added in playtesting: their outcomes are written on the project itself (DESIGN §8.3).
  | 'new_rectory'
  | 'columbarium'
  | 'food_pantry'
  | 'parish_census'
  | 'bilingual_parish'
  | 'parish_history'
  | 'youth_center'
  | 'cemetery'
  | 'bells'
  | 'grotto';

export interface ProjectDef {
  type: ProjectType;
  label: string;
  blurb: string;
  weeks: number;
  apPerWeek: number;
  /** Total cost, drawn weekly from parish cash. */
  cost: number;
  requires?: { school?: boolean; debt?: boolean; spanish?: boolean; hall?: boolean };
  /** What finishing it does to the man and his standing; the first seven projects keep theirs in code. */
  onComplete?: Effect[];
  /** What finishing it does to the parish record: buildings raised to at least these, households added. */
  parish?: { buildings?: Partial<Record<'church' | 'rectory' | 'hall' | 'school', number>>; households?: number };
}

export interface Project {
  type: ProjectType;
  parishId: string;
  startWeek: number;
  endWeek: number;
  apPerWeek: number;
  costPerWeek: number;
  /** Weeks the parish could not pay; slows completion. */
  stalledWeeks: number;
  /** Pushed: double the weekly draw and half the time left. */
  pace?: 1 | 2;
}

/** One line of the career record, for the summary. */
export interface CareerEntry {
  week: number;
  kind: 'assignment' | 'promotion' | 'passed_over' | 'succession' | 'project' | 'group_founded' | 'offer' | 'position' | 'note';
  text: string;
}
