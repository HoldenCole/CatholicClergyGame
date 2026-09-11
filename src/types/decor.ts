import type { Condition, Effect } from './events';
import type { LiturgicalTopic } from './world';

/** A place that has a look: the church and office of a parish, the rectory, the seminary room, a chancery office. */
export type DecorPlace = 'church' | 'office' | 'rectory' | 'seminary_room' | 'chancery';

/** Slots a place exposes. Each holds exactly one option. */
export type DecorSlot =
  // church
  | 'sanctuary'
  | 'altar_rail'
  | 'orientation'
  | 'confessionals'
  | 'choir'
  | 'statues'
  | 'tabernacle'
  | 'mass_form'
  | 'music'
  // office and rectory and room
  | 'wall'
  | 'desk'
  | 'floor'
  | 'corner';

export interface DecorOption {
  id: string;
  place: DecorPlace;
  slot: DecorSlot;
  label: string;
  blurb: string;
  /** Parish cash (church) or nothing (personal). */
  cost: number;
  /** −100 traditional .. +100 progressive, for reactions. Null for neutral items. */
  alignment: number | null;
  requires?: Condition[];
  /** Which diocesan policy governs it, if any. Checked against the bishop. */
  policy?: LiturgicalTopic;
  /** Applied once when chosen, on top of the computed reaction. */
  effects?: Effect[];
  /** Art variant key the renderer uses. */
  art: string;
}

export type PlaceDecor = Partial<Record<DecorSlot, string>>;

/** Keyed by place key: "parish:<id>:church", "parish:<id>:office", "rectory:<id>", "seminary", "chancery". */
export type DecorState = Record<string, PlaceDecor>;

/** Something the room shows because of who the man is. Derived, never stored. */
export interface AmbientItem {
  layer: string;
  variant: string;
  /** What the caption says when hovered. */
  label: string;
}

/** Achievements are derived from the record. DESIGN 15: a life, not a score. */
export interface Achievement {
  id: string;
  label: string;
  /** Where it shows: a plaque, a photo, a framed page. */
  art: 'plaque' | 'photo' | 'frame';
}

/** A letter to the chancery asking leave for something the bishop governs. */
export interface Permission {
  topic: LiturgicalTopic;
  status: 'pending' | 'granted' | 'denied';
  bishopId: string;
  askedWeek: number;
  /** The week the answer arrives, or arrived. */
  answerWeek: number;
}
