import type { Pillar } from './character';
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

export type Op = '>=' | '<=';

/**
 * DESIGN.md §12.3, with extensions flagged inline:
 *  - `pillar`: a formation pillar score this year (seminary only).
 *  - `year`: the seminary year, for choices that need it (events use yearGate).
 *  - `thread`: whether a chain is currently open.
 *  - `all`: explicit conjunction, for nesting under `any`/`not`.
 * `relationship.npcId` may be a selector such as "@rector" or "@closest_classmate".
 */
export type Condition =
  | { type: 'stat'; key: StatKey; op: Op; value: number }
  | { type: 'reputation'; key: ConstituencyKey; op: '>=' | '<='; value: number }
  | { type: 'relationship'; npcId: string; op: '>=' | '<='; value: number }
  | { type: 'credential'; key: string }
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'alignment'; op: '>=' | '<='; value: number }
  | { type: 'outspokenness'; op: '>=' | '<='; value: number }
  | { type: 'phase'; value: Phase }
  | { type: 'season'; value: Season }
  | { type: 'pillar'; key: Pillar; op: Op; value: number }
  | { type: 'year'; op: Op; value: number }
  | { type: 'thread'; key: string; open: boolean }
  | { type: 'not'; inner: Condition }
  | { type: 'any'; inner: Condition[] }
  | { type: 'all'; inner: Condition[] };

/**
 * DESIGN.md §12.3 lists the first nine targets. Extensions, all needed by
 * seminary content and flagged here:
 *  - `pillar`       key: Pillar, delta
 *  - `alignment`    delta (drift), key ignored
 *  - `outspokenness`delta
 *  - `honesty`      delta
 *  - `credential`   key: credential id (added)
 *  - `trait`        key: trait text (added)
 *  - `archetype`    key: Archetype, delta to leaning
 *  - `concern`      key: text recorded on the formation record
 *  - `risk`         key: risk id, value: label, delta: severity
 *  - `npc`          key: selector, value: new NpcStatus
 *  - `end`          key: Ending; the run ends
 * `relationship.key` and `npc.key` accept selectors ("@rector").
 */
export type EffectTarget =
  | 'stat'
  | 'reputation'
  | 'relationship'
  | 'flag'
  | 'group'
  | 'money'
  | 'ap'
  | 'thread'
  | 'position'
  | 'pillar'
  | 'alignment'
  | 'outspokenness'
  | 'honesty'
  | 'credential'
  | 'trait'
  | 'archetype'
  | 'concern'
  | 'risk'
  | 'npc'
  | 'end';

export interface Effect {
  target: EffectTarget;
  key: string;
  delta?: number;
  value?: string | boolean | number;
}

export interface Choice {
  id: string;
  label: string;
  /** Prose shown after the choice is taken. May contain {tokens}. */
  outcome?: string;
  requires?: Condition[];
  hidden?: boolean;
  /** Extension: the choice taken when the event resolves without the player. */
  default?: boolean;
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
  /** Selector -> npc id, resolved when the event fired so text and effects agree. */
  bindings: Record<string, string>;
}

/** A resolved event in the history log. */
export interface HistoryEntry {
  eventId: string;
  choiceId: string;
  week: number;
  /** True when the clock resolved it without the player. */
  auto?: boolean;
}
