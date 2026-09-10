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
  | 'capital_campaign';

export interface ProjectDef {
  type: ProjectType;
  label: string;
  blurb: string;
  weeks: number;
  apPerWeek: number;
  /** Total cost, drawn weekly from parish cash. */
  cost: number;
  requires?: { school?: boolean; debt?: boolean };
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
}

/** One line of the career record, for the summary. */
export interface CareerEntry {
  week: number;
  kind: 'assignment' | 'promotion' | 'passed_over' | 'succession' | 'project' | 'group_founded' | 'offer' | 'position' | 'note';
  text: string;
}
