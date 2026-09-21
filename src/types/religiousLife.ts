import type { PillarDef } from './campaign';
import type { StatKey } from './stats';

/**
 * The religious campaign's data model. E3 §12. Orders are data: every
 * order-specific behaviour is a flag or a parameter on `OrderDef.mechanics`,
 * never a test on the key in engine or systems code (CLAUDE.md).
 */
export type OrderKey = 'OP' | 'OSA'; // round 2: 'OFM' | 'OFMConv' | 'OFMCap'

export const ORDER_KEYS: readonly OrderKey[] = ['OP', 'OSA'] as const;

/** One year of formation as an order shapes it. Seven years; ordination = entry age + 7. E3 §5. */
export interface FormationStage {
  year: number;
  /** "Novitiate", "Studium: philosophy" */
  label: string;
  /** Who guides the year: the seminary's formator roles, reskinned. */
  guide: string;
  /** What is professed or received at the year's end, if anything. */
  milestone?: 'clothing' | 'simple_profession' | 'renewal' | 'solemn_profession' | 'diaconate' | 'ordination';
  /** The community votes on a profession or a renewal this year. */
  communityVote?: boolean;
  line: string;
}

/**
 * Governance as configurable defaults. Close to real practice, flagged for
 * verification, and never scattered as literals through the code. E3 §18.
 */
export interface OrderGovernance {
  priorTermYears: number;
  priorMaxConsecutive: number;
  provincialTermYears: number;
  provincialMaxConsecutive: number;
  generalTermYears: number;
  generalRenewable: boolean;
  /** "Master of the Order", "Prior General" */
  generalTitle: string;
  /** "provincial", "prior provincial" */
  provincialTitle: string;
  priorTitle: string;
}

export interface OrderMechanics {
  /** OP: study AP costs this fraction less across the career. */
  studyApDiscount?: number;
  /** OP: a friar may be dispensed from common obligations for study. */
  studyDispensation?: boolean;
  /** OP: a portable preaching reputation, 0..100. */
  preachingReputation?: boolean;
  /** OP: public doctrinal positions carry this much weight. */
  doctrinalVolumeMultiplier?: number;
  /** OP: the Hours in common cost this much more at every quality. */
  choralOfficeExtraAp?: number;
  /** OSA: house cohesion modulates piety decay for every member. */
  cohesionModulatesPiety?: boolean;
  /** OSA: close-friend slots. */
  closeFriendSlots?: number;
  /** OSA: a survived crisis raises the piety ceiling. */
  pietyCeilingRaisedByCrisis?: boolean;
  /** OSA: temporary vows are renewed every year, each a gate. */
  annualVowRenewal?: boolean;
  /** OP: a religious name at clothing. */
  religiousName?: boolean;
  /** How much of the province's business goes to a vote: 1 is the base. */
  democracy?: number;
}

export interface OrderDef {
  key: OrderKey;
  /** "Order of Preachers" */
  name: string;
  /** "the Dominicans" */
  short: string;
  /** "Dominican" */
  adjective: string;
  /** "friar" */
  member: string;
  /** The institute in content/institutes.json and the house in content/houses.json this order already is in the base game. */
  instituteId: string;
  houseOrderId: string;
  motto: string;
  /** Four entries, ids fixed to the base game's pillars, in the same order. Drives the formation engine. */
  pillars: PillarDef[];
  governance: OrderGovernance;
  formation: FormationStage[];
  mechanics: OrderMechanics;
  /** The stats an office weighs when the province is in that state; the chapter engine reads these. */
  officeWeights?: Partial<Record<'debt' | 'decline' | 'growth' | 'division', Partial<Record<StatKey, number>>>>;
  /** Names for the province's houses, by kind. */
  houseNames: { priory: string[]; studium: string[]; novitiate: string[]; school: string[] };
  /** A line per province of the order, and which dioceses (by id) its territory holds. E3 §4.1. */
  provinces: ProvinceSeed[];
  /** Saints the order gives its names from, for the religious name and the houses. */
  saints: string[];
}

/** A real province of a real order: its name and territory; everything in it is generated. */
export interface ProvinceSeed {
  id: string;
  name: string;
  /** "Eastern" */
  region: string;
  /** Preset diocese ids inside it; the rest of the territory is generated. */
  dioceseIds: string[];
  /** Regions the generator draws its other dioceses from. */
  regions: string[];
  /** How many dioceses the province spans in play, presets included. */
  dioceses: [number, number];
  /** Where the provincial sits. */
  curia: string;
  line: string;
  /** A bias on the roll, −100..100. */
  dispositionBias?: number;
  trajectoryBias?: ProvinceTrajectory;
}

export type ProvinceTrajectory = 'growing' | 'stable' | 'shrinking';

export type HouseKind = 'priory' | 'studium' | 'novitiate' | 'parish' | 'school' | 'mission' | 'curia';

export const HOUSE_KINDS: readonly HouseKind[] = ['priory', 'studium', 'novitiate', 'parish', 'school', 'mission', 'curia'] as const;

/** A house of the province: where a friar lives. E3 §3.2. */
export interface OrderHouse {
  id: string;
  provinceId: string;
  dioceseId: string;
  name: string;
  kind: HouseKind;
  memberIds: string[];
  priorId: string;
  /** 0..100: how well the community actually lives together. */
  cohesion: number;
  /** 0..100: how strictly the common life is kept. */
  observance: number;
  /** −100..100, its own, distinct from the diocese it sits in. */
  alignment: number;
  works: string[];
  budget: number;
}

export interface Province {
  id: string;
  order: OrderKey;
  name: string;
  region: string;
  /** Every diocese of the territory: presets and generated. */
  dioceseIds: string[];
  houseIds: string[];
  friarIds: string[];
  provincialId: string;
  councilIds: string[];
  /** The house the provincial governs from. */
  curiaHouseId: string;
  finances: { balance: number; retirementBurden: number };
  factions: { observant: number; progressive: number; hostility: number };
  trajectory: ProvinceTrajectory;
  /** The year the provincial took office. */
  provincialSince: number;
  /** The one visible problem. */
  complication: string;
  line: string;
}

export type ChapterLevel = 'house' | 'provincial' | 'general';

export interface Chapter {
  id: string;
  level: ChapterLevel;
  week: number;
  electorIds: string[];
  /** The office being filled, if electoral. */
  office?: string;
  ballots: { round: number; tallies: Record<string, number> }[];
  outcome?: { electedId: string; accepted: boolean; confirmed: boolean };
}

export interface ReligiousPlayerState {
  order: OrderKey;
  provinceId: string;
  houseId: string;
  religiousName?: string;
  vows: {
    simpleWeek?: number;
    renewals: number[];
    solemnWeek?: number;
  };
  /** 0..100, partly hidden from the player. E3 §3.6. */
  perceivedAmbition: number;
  /** OP */
  preachingReputation?: number;
  /** OSA */
  closeFriendIds?: string[];
  dispensed?: { from: string[]; untilWeek: number };
  termsServed: { office: string; startWeek: number; endWeek: number }[];
}
