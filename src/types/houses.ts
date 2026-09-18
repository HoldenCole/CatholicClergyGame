/**
 * The order next door. DESIGN.md §9.4a.
 *
 * A religious house in the diocese is not the bishop's and not the pastor's:
 * it was here first, it answers to a provincial or an abbot, and what it does
 * for a parish it does as a favour. A priest builds a standing with it over
 * years and can spend that standing on real help — and the house asks in
 * return, and the provincial can take any of it away without notice.
 */
export type HouseFavourId = 'prayers' | 'confessor' | 'mission' | 'supply' | 'retreat' | 'vicar';

export type HouseAskId = 'say_their_mass' | 'collection' | 'novena' | 'back_them' | 'take_a_man';

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
}
