import type { Reputation, Stats } from './stats';
import type { PositionRecord } from './stats';

/** DESIGN.md §3.2 */
export type Origin =
  | 'urban_ethnic'
  | 'latino_immigrant'
  | 'rural'
  | 'suburban'
  | 'convert'
  | 'lapsed';

/** DESIGN.md §3.2a */
export type DioceseTie = 'son' | 'school' | 'seminary' | 'transfer';

/** DESIGN.md §3.3. Entry age is derived from the path plus years worked. */
export type EntryPath =
  | 'high_school'
  | 'some_college'
  | 'college'
  | 'masters_1'
  | 'masters_2'
  | 'doctoral';

export type Field = 'business' | 'philosophy' | 'history_law' | 'stem' | 'classics' | 'education' | 'nursing' | 'social_science';

export type Career =
  | 'attorney'
  | 'accountant'
  | 'investment'
  | 'management'
  | 'teacher'
  | 'professor'
  | 'physician'
  | 'military'
  | 'trades'
  | 'journalism'
  | 'social_work'
  | 'nurse'
  | 'police_fire'
  | 'sales'
  | 'farm';

/** DESIGN.md §3.4 */
export type Motive = 'certainty' | 'conversion' | 'priest' | 'intellectual' | 'grief' | 'running';

/** DESIGN.md §3.7 */
export type Archetype = 'pastoral' | 'teaching' | 'theological' | 'administrative' | 'missionary';

export const ARCHETYPES: readonly Archetype[] = [
  'pastoral',
  'teaching',
  'theological',
  'administrative',
  'missionary',
] as const;

/** The Church's four pillars of formation. DESIGN.md §6.2 */
export type Pillar = 'human' | 'spiritual' | 'intellectual' | 'pastoral';

export const PILLARS: readonly Pillar[] = ['human', 'spiritual', 'intellectual', 'pastoral'] as const;

export interface Background {
  origin: Origin;
  tie: DioceseTie;
  path: EntryPath;
  field: Field | null;
  career: Career | null;
  yearsWorked: number;
  motive: Motive;
  /** Id of the chosen family option in content/creation. */
  family: string;
  /** Id of the chosen past option, or null for "nothing worth mentioning". */
  past: string | null;
  entryAge: number;
}

/** Something the scandal system can surface later. DESIGN.md §3.6 */
export interface LatentRisk {
  id: string;
  label: string;
  severity: 1 | 2 | 3;
}

/** A named person, place, or unresolved thing planted at creation. DESIGN.md §3 */
export interface Hook {
  id: string;
  kind: 'person' | 'place' | 'thing';
  label: string;
  npcId?: string;
}

export interface PersonName {
  first: string;
  last: string;
}

export interface Character {
  name: PersonName;
  portrait: string;
  entryYear: number;
  background: Background;
  stats: Stats;
  /** −100 traditional .. +100 progressive */
  alignment: number;
  /** 0..100, accumulated from public positions */
  outspokenness: number;
  /** Accrues from saying the hard true thing at cost. DESIGN.md §5.5 */
  honesty: number;
  reputation: Reputation;
  credentials: string[];
  /** Career traits, e.g. "reads a document properly". */
  traits: string[];
  positions: PositionRecord[];
  latentRisks: LatentRisk[];
  hooks: Hook[];
  archetype: Archetype | null;
  archetypeLeaning: Record<Archetype, number>;
}
