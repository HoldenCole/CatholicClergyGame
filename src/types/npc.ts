import type { Stats } from './stats';
import type { Career, Field, Origin, PersonName } from './character';
import type { Milestone } from './career';

export type NpcRole =
  | 'classmate'
  | 'family'
  | 'formator'
  | 'priest'
  | 'lay'
  | 'official'
  | 'bishop';

export type NpcStatus = 'active' | 'left' | 'dead' | 'retired' | 'dismissed';

/**
 * One hidden trait per NPC, discovered only through interaction.
 * Never shown in a roster panel. DESIGN.md §9.2
 */
export type HiddenTrait =
  | 'fragile'
  | 'careerist'
  | 'mystic'
  | 'hiding_something'
  | 'smarter_than_he_lets_on'
  | 'loyal'
  | 'restless';

export const HIDDEN_TRAITS: readonly HiddenTrait[] = [
  'fragile',
  'careerist',
  'mystic',
  'hiding_something',
  'smarter_than_he_lets_on',
  'loyal',
  'restless',
] as const;

/** A private struggle, rolled independently of everything else. */
export type Struggle =
  | 'loneliness'
  | 'doubt'
  | 'drink'
  | 'ambition'
  | 'family'
  | 'health'
  | 'anger'
  | 'none';

export const STRUGGLES: readonly Struggle[] = [
  'loneliness',
  'doubt',
  'drink',
  'ambition',
  'family',
  'health',
  'anger',
  'none',
] as const;

export interface Npc {
  id: string;
  name: PersonName;
  role: NpcRole;
  /** "Fr.", "Msgr.", "Dr.", or empty. */
  title: string;
  birthYear: number;
  origin: Origin;
  alignment: number;
  stats: Stats;
  /** 0..100 */
  ambition: number;
  struggle: Struggle;
  hiddenTrait: HiddenTrait;
  /** Whether the player has discovered the hidden trait. */
  traitKnown: boolean;
  /** −100..+100, the NPC's regard for the player. */
  relationship: number;
  status: NpcStatus;
  /** Selector tags, e.g. "rector", "spiritual_director", "mother". */
  tags: string[];
  /** Classmates only. */
  formation?: {
    entryAge: number;
    field: Field | null;
    career: Career | null;
  };
  /** Rolled at ordination for classmates; simulated forward each year. */
  trajectory?: Milestone[];
  /** Parishioners: what the priest has done for this person and their family, in order. */
  bonds?: Bond[];
}

/** One thing a priest did for a parishioner that the parish remembers. */
export type BondKind = 'baptized' | 'married' | 'buried' | 'anointed' | 'confirmed' | 'counseled' | 'helped' | 'quarreled';

export interface Bond {
  kind: BondKind;
  week: number;
  /** "her daughter", "his father", "the two of them" */
  who: string;
}
