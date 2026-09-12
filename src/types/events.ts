import type { Pillar } from './character';
import type { ConstituencyKey, Phase, StatKey, Volume } from './stats';
import type { Season } from './time';
import type { DecorPlace, DecorSlot } from './decor';
import type { LiturgicalStance, LiturgicalTopic } from './world';

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
  /** Extension: a fact about the current parish (kind, terrain, school, problem, needsSpanish, wealth, generational). */
  | { type: 'parish'; key: 'kind' | 'terrain' | 'school' | 'problem' | 'needsSpanish' | 'wealth' | 'generational'; value: string | boolean | number }
  /** Extension: the current role. */
  | { type: 'role'; value: 'parochial_vicar' | 'administrator' | 'pastor' }
  /** Extension: years since ordination. */
  | { type: 'years_ordained'; op: Op; value: number }
  /** Weeks into the current assignment. */
  | { type: 'weeks_served'; op: Op; value: number }
  /** Weeks until the current arc ends (the bishop's next look). */
  | { type: 'arc_weeks_left'; op: Op; value: number }
  /** Extension: the current bishop's alignment, −100 traditional .. +100 progressive. */
  | { type: 'bishop_alignment'; op: Op; value: number }
  /** How the church or a room is furnished right now: the option id in a slot of the current parish's place. */
  | { type: 'decor'; place: DecorPlace; slot: DecorSlot; value: string }
  /** The bishop's temper: his management style, a priority, what he rewards or cannot bear, or his stance on a liturgical topic. */
  | { type: 'bishop'; key: 'management' | 'priority' | 'rewards' | 'cannotTolerate'; value: string }
  | { type: 'bishop'; key: 'stance'; topic: LiturgicalTopic; value: LiturgicalStance }
  /** A semi-public or public position on record for a topic ('any' for any topic) at or past the value. DESIGN §5.4. */
  | { type: 'position'; topic: string; op: Op; value: number }
  /** Hours a week in the standing routine: a discretionary action id, or an obligation key read as AP. DESIGN §2.3. */
  | { type: 'routine'; key: string; op: Op; value: number }
  /** Whether the man has become a figure. DESIGN §5.6. */
  | { type: 'figure' }
  /** How worn the man is, 0..100, from what he has cut out of his week to make hours. */
  | { type: 'strain'; op: Op; value: number }
  /** Extension: the man's age in years. */
  | { type: 'age'; op: Op; value: number }
  /** Extension: the pastor's Mass: a dial set to an option, or 'changes' / 'friction' (0..1 distance from what the parish wants) against a value. */
  | { type: 'liturgy'; key: string; value?: string; op?: Op; amount?: number }
  /** Extension: how many bonds of a kind ('any' for all) he has with the people of the current parish. */
  | { type: 'bond'; kind: string; op: Op; value: number }
  /** Extension: the see he holds as bishop, one of its dials. */
  | { type: 'see'; key: 'presbyterate' | 'people' | 'rome' | 'money' | 'shortage' | 'years'; op: Op; value: number }
  /**
   * Extension: some group of the current parish matches. When an event
   * carries group conditions, @group_leader binds to a matching group.
   */
  | { type: 'group'; key: 'type' | 'vitality' | 'hostile' | 'suppressed' | 'foundedByPlayer' | 'agenda'; value: string | boolean }
  /** The calendar year of the current week: the 2021 norms on the older Mass, and the like. */
  | { type: 'calendar_year'; op: Op; value: number }
  /** Whether the diocese has a religious house, of a charism if given. */
  | { type: 'house'; charism?: 'contemplative' | 'active'; value: boolean }
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
 *  - `group`        key: vitality | size | hostile | suppressed | dissolve, on the bound group (@group_leader)
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
  | 'end'
  /** key "<place>:<slot>", value: option id. Sets a furnishing outright, no cost, no computed reaction. */
  | 'decor'
  /** key: liturgical topic, value: 'granted' | 'denied'. The bishop's word, given or taken back. */
  | 'permission'
  /** key: selector or npc id. The player has seen through to that person's hidden trait. DESIGN §9.2. */
  | 'trait_known'
  /** Extension: write a bond on a parishioner (key: selector or binding; value: the bond kind). */
  | 'bond'
  /** Move the man now: key is a parish kind (or 'difficult'), value the role. The letter arrives the next week. */
  | 'transfer'
  /** Building condition of the current parish: key church | rectory | hall | school, delta. */
  | 'building'
  /** Join or leave a society: key is the club id, value 'join' | 'leave'. content/clubs. */
  | 'club';

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
  /** One phase, or several for events that belong to the whole career. */
  phase: Phase | Phase[];
  yearGate?: number[];
  pressure: Pressure[];
  severity: Severity;
  category: EventCategory;
  baseWeight: number;
  requires?: Condition[];
  bias?: { when: Condition; multiplier: number }[];
  suppressYears: number;
  once?: boolean;
  /**
   * Extension: a structural beat this event can carry ("candidacy",
   * "diaconate"). The year guarantees one event with the beat fires;
   * which one varies. DESIGN.md §12.2.
   */
  beat?: string;
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
