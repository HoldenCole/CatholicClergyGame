import type { ConstituencyKey, Phase, StatKey, Volume } from './stats';
import type { Season } from './time';

/** Drives interrupts. See DESIGN.md §12.3. */
export type Severity = 'ROUTINE' | 'NOTABLE' | 'MAJOR' | 'CRITICAL';

export const SEVERITIES: readonly Severity[] = ['ROUTINE', 'NOTABLE', 'MAJOR', 'CRITICAL'] as const;

/**
 * Interrupt configuration categories. See DESIGN.md §2.2.
 * Every authored event must carry exactly one of these.
 */
export type EventCategory =
  | 'formation'
  | 'parish_death'
  | 'finance'
  | 'admin'
  | 'chancery'
  | 'group'
  | 'classmate'
  | 'personal'
  | 'scandal'
  | 'assignment';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'formation',
  'parish_death',
  'finance',
  'admin',
  'chancery',
  'group',
  'classmate',
  'personal',
  'scandal',
  'assignment',
] as const;

/** Pressure tags. See DESIGN.md §12.2. */
export type Pressure =
  | 'loyalty_vs_honesty'
  | 'ambition_vs_integrity'
  | 'friendship_vs_duty'
  | 'belief_vs_safety'
  | 'body_vs_vow'
  | 'doubt'
  | 'competence'
  | 'money';

export type Condition =
  | { type: 'stat'; key: StatKey; op: '>=' | '<='; value: number }
  | { type: 'reputation'; key: ConstituencyKey; op: '>=' | '<='; value: number }
  | { type: 'relationship'; npcId: string; op: '>=' | '<='; value: number }
  | { type: 'credential'; key: string }
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'alignment'; op: '>=' | '<='; value: number }
  | { type: 'outspokenness'; op: '>=' | '<='; value: number }
  | { type: 'phase'; value: Phase }
  | { type: 'season'; value: Season }
  | { type: 'not'; inner: Condition }
  | { type: 'any'; inner: Condition[] };

export type EffectTarget =
  | 'stat'
  | 'reputation'
  | 'relationship'
  | 'flag'
  | 'group'
  | 'money'
  | 'ap'
  | 'thread'
  | 'position';

export interface Effect {
  target: EffectTarget;
  key: string;
  delta?: number;
  value?: string | boolean;
}

export interface Choice {
  id: string;
  label: string;
  requires?: Condition[];
  hidden?: boolean;
  volume?: Volume;
  positionTopic?: string;
  positionValue?: number;
  effects: Effect[];
  opensThread?: string;
  resolvesThread?: string;
  followUpId?: string;
}

export interface GameEvent {
  id: string;
  phase: Phase;
  yearGate?: number[];
  pressure: Pressure[];
  severity: Severity;
  category: EventCategory;
  baseWeight: number;
  requires?: Condition[];
  bias?: { when: Condition; multiplier: number }[];
  suppressYears: number;
  once?: boolean;
  title: string;
  body: string;
  flavorPrompt?: string;
  choices: Choice[];
}

/**
 * An event that has been drawn and is waiting for the player. The clock uses
 * `severity` and `category` (copied from the event so the clock never needs
 * the content pool) to decide whether to stop.
 */
export interface PendingEvent {
  eventId: string;
  severity: Severity;
  category: EventCategory;
  /** Absolute game week the event fired. */
  week: number;
}

/** A resolved event in the history log. */
export interface HistoryEntry {
  eventId: string;
  choiceId: string;
  week: number;
}
