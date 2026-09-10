import type { Career, DioceseTie, EntryPath, Field, Motive, Origin } from './character';
import type { Effect } from './events';

/** One answer to a creation question. Numbers are never shown; `outcome` is. */
export interface CreationOption {
  id: string;
  label: string;
  /** One or two sentences describing the choice, shown before choosing. */
  blurb: string;
  /** Prose consequence shown after choosing. */
  outcome: string;
  effects: Effect[];
  /** Hooks planted for the event system. */
  hooks?: { id: string; kind: 'person' | 'place' | 'thing'; label: string }[];
}

export interface OriginOption extends CreationOption {
  id: Origin;
  /** Heritage weights used to name family and, later, the home parish. */
  heritage: Record<string, number>;
}

export interface TieOption extends CreationOption {
  id: DioceseTie;
  /** Which hidden preview field this tie reveals, if any. DESIGN.md §3.2a */
  reveals: 'chancery_figure' | 'bishop_temperament' | 'complication' | null;
}

export interface PathOption extends CreationOption {
  id: EntryPath;
  entryAge: number;
  /** Whether the path includes a college field of study. */
  hasField: boolean;
  /** Philosophy-year AP discount, 0..1 of the maximum. DESIGN.md §6.3 */
  philosophyDiscount: number;
}

export interface FieldOption extends CreationOption {
  id: Field;
  philosophyDiscount: number;
}

export interface CareerOption extends CreationOption {
  id: Career;
  /** Fields that admit this career. Empty means any degree; `noDegree` allows the high-school path. */
  requiresField: Field[];
  noDegree?: boolean;
  trait: string;
  /** Stat gained per year worked, with diminishing returns after year 8. */
  perYear: { key: 'knowledge' | 'administration'; delta: number };
  partialCredential?: string;
}

export interface MotiveOption extends CreationOption {
  id: Motive;
}

export interface FamilyOption extends CreationOption {
  mother: 'living' | 'dead' | 'absent';
  father: 'living' | 'dead' | 'absent';
  siblings: number;
  /** −1 opposed .. +1 supportive; sets starting family relationships. */
  support: number;
  /** Someone who depends on the player. */
  dependent: 'mother' | 'father' | 'sibling' | null;
}

export interface PastOption extends CreationOption {
  risk: { id: string; label: string; severity: 1 | 2 | 3 } | null;
}

export interface CreationContent {
  origins: OriginOption[];
  ties: TieOption[];
  paths: PathOption[];
  fields: FieldOption[];
  careers: CareerOption[];
  motives: MotiveOption[];
  families: FamilyOption[];
  pasts: PastOption[];
}

/** The player's answers, gathered by the creation screens. */
export interface CreationAnswers {
  firstName: string;
  lastName: string;
  portrait: string;
  entryYear: number;
  origin: Origin;
  tie: DioceseTie;
  path: EntryPath;
  field: Field | null;
  career: Career | null;
  yearsWorked: number;
  motive: Motive;
  family: string;
  past: string | null;
}

/** DESIGN.md §3.3: entry age is capped at 40. */
export const MAX_ENTRY_AGE = 40;
export const SEMINARY_YEARS = 7;
