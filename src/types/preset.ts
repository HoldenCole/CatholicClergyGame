import type { DioceseSize, FinancialState, Institution, ParishKind } from './world';

/**
 * A diocese preset: the layer that keeps its character across runs. Custom
 * dioceses (post-V1) use this same schema. CLAUDE.md rule 5.
 */
export interface DiocesePreset {
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
  /** The five parish seeds: kind, place names, and patron pools. */
  parishSeeds: { kind: ParishKind; places: string[]; patrons: string[] }[];
  /** Heritage weights for the presbyterate and laity. */
  heritage: Record<string, number>;
  seminaryName: string;
}
