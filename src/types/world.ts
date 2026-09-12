import type { Npc } from './npc';

/** DESIGN.md §9.1. The five presets keep their character; everything else rolls. */
export type DioceseSize = 'small' | 'medium' | 'large' | 'huge';
export type Tension = 'one_voice' | 'quietly_split' | 'openly_divided';
export type ClergyNeed = 'critically_short' | 'stretched' | 'adequate' | 'deep_bench';
export type FinancialState = 'healthy' | 'strained' | 'crisis';
export type BishopPriority = 'finances' | 'vocations' | 'education' | 'social_outreach' | 'liturgy' | 'evangelization';
export type ManagementStyle = 'delegator' | 'micromanager' | 'absentee' | 'reformer';
export type BishopKnowsYou = 'none' | 'heard_of' | 'good_opinion' | 'bad_opinion';
export type ScandalHandling = 'transparent' | 'defensive' | 'concealing';
export type PastorAgeProfile = 'young' | 'mixed' | 'top_heavy';

export type Institution =
  | 'major_seminary'
  | 'catholic_university'
  | 'hospital_system'
  | 'school_network'
  | 'national_cathedral'
  | 'diocesan_media'
  | 'catholic_charities'
  | 'nunciature_proximity'
  | 'shrine';

/** What a bishop rewards. Invented, per DESIGN §9.1 "temperament". */
export type BishopTrait =
  | 'loyalty'
  | 'competence'
  | 'visibility'
  | 'discretion'
  | 'orthodoxy'
  | 'pastoral_warmth'
  | 'initiative'
  | 'deference';

/** What a bishop cannot tolerate. Each is the shadow of a trait above. */
export type BishopFault =
  | 'disloyalty'
  | 'sloppiness'
  | 'showboating'
  | 'secretiveness'
  | 'heterodoxy'
  | 'coldness'
  | 'freelancing'
  | 'timidity';

export type ChanceryOffice =
  | 'vicar_general'
  | 'chancellor'
  | 'vicar_for_clergy'
  | 'judicial_vicar'
  | 'finance_officer'
  | 'vocations_director'
  | 'superintendent_of_schools'
  | 'communications_director'
  | 'bishop_secretary';

export const CHANCERY_OFFICES: readonly ChanceryOffice[] = [
  'vicar_general',
  'chancellor',
  'vicar_for_clergy',
  'judicial_vicar',
  'finance_officer',
  'vocations_director',
  'superintendent_of_schools',
  'communications_director',
  'bishop_secretary',
] as const;

/**
 * Everything the diocese preview is allowed to show. CLAUDE.md rule 6: the
 * preview component may only read this half. DESIGN.md §3.1a.
 */
export interface DioceseVisible {
  id: string;
  name: string;
  see: string;
  region: string;
  size: DioceseSize;
  /** −100 traditional .. +100 progressive, the balance shown as a bar. */
  disposition: number;
  tension: Tension;
  clergyNeed: ClergyNeed;
  bishop: {
    npcId: string;
    name: string;
    age: number;
    yearsInOffice: number;
    temperamentLine: string;
    priorities: [BishopPriority, BishopPriority];
  };
  /** Two or three lines of prose on the culture. */
  character: string[];
  /** Institutions present and what they open. */
  opportunities: string[];
  institutions: Institution[];
  /** The religious houses of the diocese: abbeys, friaries, monasteries of nuns. Public knowledge. */
  houses: ReligiousHouse[];
  /** One visible problem. */
  complication: string;
}

/**
 * A religious house in the diocese. Generated from content/houses.json; a
 * pastor can lean on one, and the diocese card names them.
 */
export interface ReligiousHouse {
  id: string;
  name: string;
  /** The order's id in content/houses.json. */
  order: string;
  /** "the Benedictines" */
  orderLabel: string;
  members: 'monks' | 'friars' | 'nuns' | 'canons';
  /** Contemplatives pray for a parish; an active house sends a confessor and a preacher. */
  charism: 'contemplative' | 'active';
  /** −100 traditional .. +100 progressive. */
  alignment: number;
  /** In the see city, or out in the country. */
  setting: 'city' | 'country';
  /** How many live there. */
  size: number;
  line: string;
}

/** Everything the preview must not show. DESIGN.md §3.1a "Hidden from the preview". */
export interface DioceseHidden {
  factions: { traditional: number; mainstream: number; progressive: number; hostility: number };
  /** 1 (deep bench) .. 5 (critically short). The promotion-pace driver. */
  shortage: number;
  financial: FinancialState;
  bishop: BishopProfile;
  chanceryIds: string[];
  scandal: { latent: number; handling: ScandalHandling };
  pastorAges: PastorAgeProfile;
  hiddenComplication: string;
}

/**
 * What a bishop lets his pastors do with the liturgy and the building.
 * 'free' needs no one's leave; 'by_permission' needs a letter to the
 * chancery and an answer; 'forbidden' is not open in this diocese under
 * this bishop. The Mass itself stays the Novus Ordo unless the bishop
 * authorizes the older form, as the 2021 norms require.
 */
export type LiturgicalStance = 'free' | 'by_permission' | 'forbidden';
export type LiturgicalTopic = 'ad_orientem' | 'latin_mass' | 'altar_rail' | 'tabernacle' | 'renovation' | 'older_form_faculty';
export const LITURGICAL_TOPICS: readonly LiturgicalTopic[] = ['ad_orientem', 'latin_mass', 'altar_rail', 'tabernacle', 'renovation', 'older_form_faculty'] as const;
export type LiturgicalPolicy = Record<LiturgicalTopic, LiturgicalStance>;

export interface BishopProfile {
  npcId: string;
  alignment: number;
  outspokenness: number;
  priorities: [BishopPriority, BishopPriority];
  management: ManagementStyle;
  rewards: BishopTrait;
  cannotTolerate: BishopFault;
  /** 0..100: a bishop angling for a larger see behaves differently. */
  ambition: number;
  knowsYou: BishopKnowsYou;
  /** Absolute year he took office. */
  installedYear: number;
  liturgy: LiturgicalPolicy;
}

export interface Diocese {
  presetId: string;
  visible: DioceseVisible;
  hidden: DioceseHidden;
}

/** Which hidden field a diocese tie reveals in the preview. DESIGN.md §3.2a */
export type RevealedField = 'chancery_figure' | 'bishop_temperament' | 'complication';

export type ParishKind = 'flagship_suburban' | 'struggling_urban' | 'immigrant_growing' | 'rural' | 'difficult';
export type SchoolStatus = 'open' | 'at_risk' | 'closing' | 'none';
export type HomeTerrain = 'urban' | 'latino' | 'rural' | 'suburban';
export type Generational = 'aging' | 'mixed' | 'young';

export interface Buildings {
  church: number;
  rectory: number;
  hall: number;
  /** Null when there is no school building. */
  school: number | null;
}

export interface Parish {
  id: string;
  name: string;
  place: string;
  /** The year the parish was founded, when it is a real church of the diocese. */
  founded?: number;
  kind: ParishKind;
  terrain: HomeTerrain;
  /** Registered households. */
  households: number;
  /** 1 poor .. 5 wealthy */
  wealth: number;
  /** Heritage -> share, summing to about 1. */
  ethnic: Record<string, number>;
  generational: Generational;
  /** Whether Spanish is needed to serve a substantial part of the parish. */
  needsSpanish: boolean;
  alignment: number;
  buildings: Buildings;
  debt: number;
  weeklyCollections: number;
  /** Diocesan assessment, annual. */
  assessment: number;
  school: SchoolStatus;
  pastorId: string;
  /** The bishop's own church. Its pastor is the rector. */
  cathedral?: boolean;
  staffIds: string[];
  groupIds: string[];
  /** One live problem, by id in content. */
  problem: string;
  /** The Mass as it is said here: dial id -> option id. Rolled at generation; the pastor changes it. */
  /** Where it sits on the map of the diocese, 0..100 each way; the cathedral at the center. */
  x?: number;
  y?: number;
  /** The parish's patronal feast, from its name or rolled: month, day, and what the parish calls it. */
  patronal?: { label: string; month?: number; day?: number; feast?: string };
  liturgy?: Record<string, string>;
  /** What the people want of each dial, −1 traditional .. +1 progressive. */
  taste?: Record<string, number>;
  /** The week each dial was last changed, for the shock of it. */
  liturgyChanged?: Record<string, number>;
  /** Times outsiders have taken notice of a well-run parish. */
  noticed?: number;
}

export interface World {
  diocese: Diocese;
  parishes: Parish[];
  /** Calendar year the world was generated. */
  generatedYear: number;
  /** Bishops who have held the see during the run, newest last. */
  bishopHistory: string[];
}

export type Role = 'parochial_vicar' | 'administrator' | 'pastor';

export interface Assignment {
  parishId: string;
  role: Role;
  startWeek: number;
  /** The bishop's letter, rendered once. */
  letter: string;
  /** Why the bishop chose this posting, for hindsight. */
  reasons: string[];
}

/** A generated bishop is an NPC plus a profile. */
export type BishopNpc = Npc & { role: 'bishop' };
