import type { DioceseSize, FinancialState, Institution, ParishKind } from './world';

/**
 * A diocese preset: the layer that keeps its character across runs. Custom
 * dioceses (post-V1) use this same schema. CLAUDE.md rule 5.
 */
/** The place as it sounds: lines the parish sheet and the digest can use. Authored per preset. */
export interface DioceseVoice {
  weather: string[];
  sunday: string[];
  presbyterate: string[];
}

export interface DiocesePreset {
  /** Optional until every preset carries one. */
  voice?: DioceseVoice;
  id: string;
  name: string;
  see: string;
  region: string;
  size: DioceseSize;
  /** Weights for rolled state. Each is a bias, not a fixed value. */
  wealth: number; // 1..5
  mediaExposure: number; // 1..5
  romeConnection: number; // 1..5
  latinoShare: number; // 0..1
  growth: 'shrinking' | 'stable' | 'growing' | 'fast';
  /** Alignment tendency, −100..100, of the presbyterate and laity. */
  dispositionBias: number;
  /** Shortage tendency 1..5. */
  shortageBias: number;
  /** Financial tendency weights. */
  financialWeights: Record<FinancialState, number>;
  institutions: Institution[];
  /** Prose lines the generator chooses among, keyed by rolled state. */
  character: {
    base: string[];
    byNeed: Partial<Record<'critically_short' | 'stretched' | 'adequate' | 'deep_bench', string>>;
    byFinancial: Partial<Record<FinancialState, string>>;
    byTension: Partial<Record<'one_voice' | 'quietly_split' | 'openly_divided', string>>;
  };
  /** Visible complications the generator draws one of. */
  complications: string[];
  /** Hidden complications the generator draws one of. */
  hiddenComplications: string[];
  /**
   * The parishes of the diocese. A seed with `real` is an actual church of
   * that diocese, fixed by name and place and year; everything else about it
   * rolls. A seed without one rolls its patron and place from the pools. The
   * one marked cathedral is the bishop's own church, downtown, with a rector.
   */
  parishSeeds: { kind: ParishKind; places: string[]; patrons: string[]; cathedral?: boolean; real?: { name: string; place: string; founded: number; lat?: number; lon?: number } }[];
  /** The see's cathedral on the earth, and how many miles the map is across. Real churches and places project onto it. */
  map?: { lat: number; lon: number; milesAcross: number };
  /** The cities and neighborhoods of the diocese, where they are, for the map's labels and for placing rolled parishes. */
  places?: { name: string; lat: number; lon: number }[];
  /** Heritage weights for the presbyterate and laity. */
  heritage: Record<string, number>;
  seminaryName: string;
}
