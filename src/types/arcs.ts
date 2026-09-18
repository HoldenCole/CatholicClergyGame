import type { Condition } from './events';
import type { Phase } from './stats';

/**
 * An arc: a thing that happens over years rather than in one scene.
 * DESIGN.md §12.5.
 *
 * One scene is a week. An arc is the five years in which a family comes
 * apart, a building is fought over, or a boy who served the eight o'clock
 * turns into a priest. It opens on its own, runs a stage at a time with real
 * gaps between them, branches on what the man does, and ends — and the
 * Record sheet can say what is running in his life at any moment.
 */
export interface ArcStageDef {
  id: string;
  /** The scene this stage brings. Authored with beat: "arc". */
  event: string;
  /** Weeks after the last stage before this one comes: a range, rolled. */
  after: [number, number];
  /** The stage waits until these hold. */
  requires?: Condition[];
}

export interface ArcDef {
  id: string;
  title: string;
  /** One line for the sheet while it runs. */
  line: string;
  phase: Phase[];
  /** What must be true for it to open at all. */
  requires?: Condition[];
  /** Relative chance of being the arc that opens, when one does. */
  weight: number;
  /**
   * Whether it follows the man when he is moved. A family he knows travels
   * in his head; a fight about a building belongs to the building.
   */
  travels?: boolean;
  stages: ArcStageDef[];
}

/** One arc as it stands in a save. */
export interface ActiveArc {
  id: string;
  /** Index of the stage that comes next. */
  stage: number;
  /** The week that stage is due. */
  dueWeek: number;
  startedWeek: number;
  /** The parish it belongs to, for an arc that does not travel. */
  parishId?: string;
  endedWeek?: number;
  /** How it ended, in a word content can read back: "done", "lost", "left". */
  outcome?: string;
}
