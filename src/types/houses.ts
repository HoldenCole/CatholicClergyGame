/**
 * The order next door. DESIGN.md §9.4a.
 *
 * A religious house in the diocese is not the bishop's and not the pastor's:
 * it was here first, it answers to a provincial or an abbot, and what it does
 * for a parish it does as a favour. A priest builds a standing with it over
 * years and can spend that standing on real help — and the house asks in
 * return, and the provincial can take any of it away without notice.
 */
import type { Effect } from './events';

export type HouseFavourId =
  | 'prayers' | 'confessor' | 'mission' | 'supply' | 'retreat' | 'vicar'
  // The favours only one order does. DESIGN §9.4b.
  | 'course' | 'opinion' | 'kitchen' | 'mercy' | 'school_place' | 'common_table';

export type HouseAskId = 'say_their_mass' | 'collection' | 'novena' | 'back_them' | 'take_a_man' | 'disputation' | 'transitus' | 'school_dinner';

/** A favour that runs on: a friar in the confessional every Saturday, an order priest in the rectory. */
export interface HouseArrangement {
  id: HouseFavourId;
  since: number;
  /** The man of the house who does it, when it is a man rather than a promise. */
  npcId?: string;
}

/** What one house thinks of this priest, and what stands between them. */
export interface HouseStanding {
  houseId: string;
  /** −100..100. Built by turning up, by saying yes, by defending them. */
  regard: number;
  /** The week the relationship opened. */
  sinceWeek: number;
  /** Favours asked, and favours done for them. */
  asked: number;
  given: number;
  arrangements: HouseArrangement[];
  /** Weeks a one-off favour was last had, by id, so a mission is not a yearly event. */
  lastUsed?: Partial<Record<HouseFavourId, number>>;
  /** An ask from the house, waiting for an answer. */
  ask?: { id: HouseAskId; week: number; dueWeek: number };
}

/** What a house will do for a parish. content/parish/house_favours.json */
export interface HouseFavourDef {
  id: HouseFavourId;
  label: string;
  /** What it is, in the house's own terms. */
  blurb: string;
  /** What it does for the parish, in words. */
  gives: string;
  /** Contemplatives pray and keep a guesthouse; active houses preach and hear confessions. */
  charism?: 'contemplative' | 'active';
  /** Only a house of this order does it (content/houses.json order id). DESIGN §9.4b. */
  order?: string;
  /** What the parish gets, in the state: authored, applied when it is given. */
  effects?: Effect[];
  /** The man of the house who does it, by role (religious:<role>), when the order has one. */
  role?: string;
  /** Standing it takes before they will do it. */
  bar: number;
  /** It runs on until somebody ends it. */
  standing?: boolean;
  /** What the parish pays them, where a parish pays. */
  money?: number;
  /** Weeks before it can be asked for again. */
  cooldown?: number;
}

/** What a house asks of a parish in return. Silence is a no. */
export interface HouseAskDef {
  id: HouseAskId;
  label: string;
  blurb: string;
  /** What saying yes takes of the parish. */
  costs: string;
  money?: number;
  /** Blocks of the week it takes for a while. */
  ap?: number;
  charism?: 'contemplative' | 'active';
  /** Only a house of this order asks it. */
  order?: string;
}

/**
 * An order told apart from the others. DESIGN §9.4b. Three so far; the profile
 * is what makes a Dominican priory a different neighbour from a Franciscan
 * friary: its own words, its own people, its own favours and asks.
 */
export interface OrderProfile {
  /** The institute's id in content/institutes.json. */
  id: string;
  /** The order's id in content/houses.json. */
  houseOrder: string;
  /** "the Dominicans" */
  short: string;
  /** What their house is called, and who runs it. */
  house: string;
  superior: string;
  /** The men's word for themselves. */
  members: string;
  /** The wider family: the branches, the nuns, the sisters, the laity. */
  family: string;
  /** How they are governed, in a line: the province, the chapter, the vow. */
  governance: string;
  /** What the habit looks like from the back of a church. */
  habit: string;
  /** The people a house of theirs has, beyond the roles every institute fills. */
  people: OrderRoleDef[];
  /** What they are for, in the parish's terms: the favours' ids they alone do. */
  favours: string[];
  /** Lines the sheet uses when a favour of theirs is given, by favour id. */
  lines: Record<string, string>;
  /** One line under the name of the house. */
  blurb: string;
}

export interface OrderRoleDef {
  /** "prior", "lector", "kitchen": the tag is religious:<role>. */
  role: string;
  /** The superior is always there; the others roll. */
  always?: boolean;
  /** "Br." for a brother who is not a priest; otherwise the institute's titles. */
  title?: string;
  /** Rolled young: a student brother, a novice. */
  young?: boolean;
  /** Needs the institute to hold this work in the diocese. */
  needs?: string;
  line: string;
}

/** How present an order is in a diocese, from the preset. Never a fixed house: a bias the roll reads. */
export type OrderPresence = 'strong' | 'present' | 'thin' | 'none';
