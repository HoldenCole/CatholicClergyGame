import type { Effect } from './events';

/** DESIGN.md §10. */
export type GroupType =
  | 'young_adult'
  | 'youth'
  | 'pro_life'
  | 'svdp'
  | 'knights'
  | 'womens_guild'
  | 'bible_study'
  | 'adoration'
  | 'choir'
  | 'rcia'
  | 'marriage_prep'
  | 'school_parents'
  | 'ethnic_community'
  | 'tlm_society'
  | 'social_justice'
  | 'mens_group'
  | 'grief_support'
  | 'recovery'
  | 'third_order';

export const GROUP_TYPES: readonly GroupType[] = [
  'young_adult', 'youth', 'pro_life', 'svdp', 'knights', 'womens_guild', 'bible_study', 'adoration', 'choir',
  'rcia', 'marriage_prep', 'school_parents', 'ethnic_community', 'tlm_society', 'social_justice', 'mens_group',
  'grief_support', 'recovery', 'third_order',
] as const;

export type Vitality = 'thriving' | 'steady' | 'declining' | 'dying';

/** What a lay leader wants from the group. Invented. */
export type LeaderAgenda = 'saintly' | 'empire' | 'political' | 'tired' | 'new' | 'grieving';

export interface Group {
  id: string;
  parishId: string;
  type: GroupType;
  name: string;
  size: number;
  /** 0..100; bands give the vitality word. */
  vitality: number;
  leaderId: string;
  agenda: LeaderAgenda;
  alignment: number;
  /** Founded by the player in this or an earlier assignment. */
  foundedByPlayer: boolean;
  foundedWeek: number;
  /** The player has withdrawn support; the group is being let die. */
  suppressed: boolean;
  /** The leader has turned against the player. */
  hostile: boolean;
  /** The player has singled this group out: sustaining hours go to focused groups first. */
  focus?: boolean;
}

export interface GroupTypeDef {
  type: GroupType;
  label: string;
  names: string[];
  /** Weekly effects while thriving, scaled by band (steady half, declining none, dying negative). */
  benefit: Effect[];
  /** Obligation the group relieves by one AP while thriving. */
  relieves: 'sacramental_prep' | 'confessions' | 'meetings' | null;
  /** Alignment tendency of the group. */
  alignmentMean: number;
  /** Parish kinds where the group is common (weight). */
  weights: Record<string, number>;
  /** Weeks of sustained founding effort, and the AP per week it costs. */
  founding: { weeks: number; apPerWeek: number };
}

/** A founding project in progress. DESIGN.md §10.1 */
export interface Founding {
  type: GroupType;
  startWeek: number;
  endWeek: number;
  apPerWeek: number;
  /** Whether a leader was recruited; rolled at the end. */
  leaderFound: boolean | null;
}
