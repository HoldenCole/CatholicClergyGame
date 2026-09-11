import type { Role } from './world';

/** One post held: a parish, or years away. Written when it ends; the ending reads them back. */
export interface Tenure {
  kind: 'parish' | 'away';
  /** "Pastor", "Parochial vicar", "Vicar General", "A licentiate in Rome" */
  label: string;
  /** "St. Ita, Edgewater" or "the Gregorian" */
  place: string;
  role?: Role;
  parishId?: string;
  startWeek: number;
  endWeek: number;
  /** For a parish: one word for how it went, and the rows behind it. */
  verdict?: string;
  rows?: { label: string; then: string; now: string; sign: -1 | 0 | 1 }[];
  /** How he left: "moved as pastor", "sent to Rome", "retired", "still there" */
  left?: string;
}
