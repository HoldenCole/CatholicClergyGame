import type { EvaluationRecord } from './seminary';
import type { Assignment } from './world';

export type Ending =
  | 'dismissed'
  | 'left_seminary'
  | 'left_priesthood'
  | 'died'
  | 'retired';

/**
 * What the player is looking at. The clock only runs in `clock` mode with an
 * empty pending queue; every other mode is a decision the player must make.
 */
export type Mode =
  | { kind: 'creation' }
  | { kind: 'clock' }
  | { kind: 'year_start'; year: number }
  | { kind: 'summer'; year: number }
  | { kind: 'evaluation'; record: EvaluationRecord }
  | { kind: 'ordination' }
  | { kind: 'assignment'; assignment: Assignment }
  | { kind: 'ended'; ending: Ending; summary: string };
