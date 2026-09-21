import type { PillarDef } from './campaign';
import type { StatKey } from './stats';
import type { Quality } from './parish';

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
  /** The kind of house the year is lived in; a move at the year's start when it changes. */
  house?: HouseKind;
  line: string;
}

/** An office of the province, appointed by the provincial or elected by a chapter. E3 §6.3, §7.3. */
export interface OrderOfficeDef {
  id: string;
  label: string;
  kind: 'appointed' | 'elected';
  /** Years a term runs. */
  termYears: number;
  /** What the provincial looks for, as stat floors. */
  requires?: Partial<Record<StatKey, number>>;
  /** Years ordained before it is offered. */
  minYears?: number;
  /** The kind of house the office is held in, if it is tied to one. */
  house?: HouseKind;
  /** Standing when appointed. */
  effects?: { target: string; key: string; delta: number }[];
  line: string;
}

/** A credential of the order's own. E3 §6.4, §7.4. */
export interface OrderCredentialDef {
  id: string;
  label: string;
  /** Years of the work named before it can be conferred. */
  afterYears: number;
  /** The work that counts: a house work or an office id. */
  work: string;
  effects?: { target: string; key: string; delta: number }[];
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
  offices: OrderOfficeDef[];
  credentials: OrderCredentialDef[];
}

/** What drew him to this order, and how he stands to its province. E3 §4.2–4.3. */
export type WhyOrder = 'charism' | 'friar_mentor' | 'intellectual' | 'community' | 'left_diocesan' | 'alumnus';
export type ProvinceTie = 'near_house' | 'educated' | 'outside';

export interface ReligiousAnswers {
  order: OrderKey;
  provinceId: string;
  why: WhyOrder;
  tie: ProvinceTie;
  /** Dominicans only: the name taken at clothing. */
  religiousName?: string;
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

export type ChapterOffice = 'prior' | 'provincial' | 'general';

/** What the player did at this chapter, each remembered by the electorate. E3 §3.6 "Player agency". */
export interface ChapterActions {
  /** The man he votes for, every round. */
  vote?: string;
  /** Men he spoke for in the discussion. Twice is too visibly. */
  spokeFor: string[];
  /** He quietly steered a bloc. */
  steered?: string;
  /** What he let be known of his own willingness, privately and carefully. */
  signal?: 'willing' | 'unwilling';
}

export interface Chapter {
  id: string;
  level: ChapterLevel;
  week: number;
  /** The house or the province it sits for. */
  bodyId: string;
  electorIds: string[];
  /** The office being filled, if electoral, and who may be elected to it. */
  office?: ChapterOffice;
  candidateIds: string[];
  actions: ChapterActions;
  ballots: { round: number; tallies: Record<string, number>; field: string[]; absolute: boolean }[];
  /** How the vote ended, once run. */
  ended?: 'majority' | 'narrowed' | 'plurality';
  outcome?: { electedId: string; accepted: boolean; confirmed: boolean; /** Elected after a first choice declined or was refused. */ second?: boolean };
}

/** The common life's mandatory obligations. E3 §3.3; content/religious/horarium.json. */
export type HorariumKey = 'hours' | 'conventual_mass' | 'common_table' | 'house_chapter';

export const HORARIUM_KEYS: readonly HorariumKey[] = ['hours', 'conventual_mass', 'common_table', 'house_chapter'] as const;

export interface HorariumDef {
  key: HorariumKey;
  label: string;
  /** AP per quality; `invested` null where the table has no such level. */
  ap: { min: number; standard: number; invested: number | null };
  blurb: { min: string; standard: string; invested: string };
  /** Per-week movement at each quality: standing with the house, its cohesion, and piety. `standard` is neutral. */
  effects: Record<Quality, { community: number; cohesion: number; piety: number }>;
  /** Everyone sees who is not in choir: the standing cost of the minimum is this much larger when observance is high. */
  visible?: boolean;
}

/** A personal expense the prior can grant or refuse. E3 §3.4; content/religious/permissions.json. */
export interface PermissionDef {
  id: string;
  label: string;
  blurb: string;
  /** What it costs the house. */
  cost: number;
  /** How readily a prior grants it, 0..1, before relationship, budget, temperament, and precedent. */
  ease: number;
  /** Weeks before it can be asked again. */
  cooldown: number;
  /** Set when granted, for content: `permission:<flag>`. */
  flag?: string;
  line: { granted: string; refused: string };
}

export interface PermissionRecord {
  id: string;
  week: number;
  granted: boolean;
}

/** One posting under obedience. E3 §3.1, §3.8. */
export interface ReligiousAssignment {
  houseId: string;
  dioceseId: string;
  /** What he is sent to do there: one of the house's works. */
  work: string;
  startWeek: number;
  endWeek?: number;
  /** A parish entrusted to the order: the bishop appointed him on the provincial's presentation, and either can remove him. */
  dual?: boolean;
  /** How he took the letter. */
  grace?: 'good' | 'reluctant' | 'refused';
}

export interface ConsultationOption {
  houseId: string;
  work: string;
  /** The provincial's inputs, 0..100 each. */
  need: number;
  fit: number;
  formation: number;
  line: string;
}

/** The talk before the letter: preferences stated, an objection made or not, then the provincial decides. E3 §3.1. */
export interface Consultation {
  week: number;
  options: ConsultationOption[];
  /** The house he asked for, if any. */
  preference?: string;
  /** He objected on real grounds. */
  objection?: boolean;
  /** Why it opened: the term ended, the bishop wanted the parish back, the province needed him elsewhere. */
  reason: 'term' | 'bishop' | 'province' | 'withdrawal' | 'first';
  decided?: { houseId: string; work: string; reasons: string[] };
}

export interface ReligiousPlayerState {
  order: OrderKey;
  provinceId: string;
  houseId: string;
  /** The common life as he keeps it. */
  horarium: Record<HorariumKey, Quality>;
  permissions: PermissionRecord[];
  assignments: ReligiousAssignment[];
  consultation?: Consultation;
  obedience: { accepted: number; reluctant: number; refused: number };
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
  /** The office he holds now, if any, and since when. */
  office?: { office: ChapterOffice; bodyId: string; startWeek: number; endWeek: number; consecutive: number };
  /** Elections declined, by office: twice ends the question. */
  declined?: Partial<Record<ChapterOffice, number>>;
  /** The chapter in session, if one is. */
  chapter?: Chapter;
  /** An appointed office held now. */
  appointment?: { id: string; startWeek: number; endWeek: number };
  why?: WhyOrder;
  tie?: ProvinceTie;
  /**
   * How readily the province can say what he is, 0..100. E3 §8.3: the
   * electorate votes for a reputation, not a stat sheet. Fed by the
   * reputations of §8 once they exist; until then by offices held and
   * the record.
   */
  legibility?: number;
}

/** A rolled province held in the save until one is chosen: its visible half for the cards, and the whole for installing. */
export interface ProvinceCandidateRecord {
  id: string;
  visible: import('@/systems/religious/newGame').ProvinceVisible;
  gen: import('@/generation/province').GeneratedProvince;
}
