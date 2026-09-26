import historyRaw from './history.json';
import poolsRaw from './pools.json';
import type { HistoricalPapacyDef } from '@/types';

/** The papal record, in order. E1 §9 A. */
export const papalHistory: HistoricalPapacyDef[] = (historyRaw as unknown as { popes: HistoricalPapacyDef[] }).popes;

export interface PapalPools {
  /** Regnal name to the ordinal last used before the generated popes begin. */
  regnal: Record<string, number>;
  origins: { from: string; weight: number }[];
  /** What the elected man was before, with {from}. */
  before: string[];
}

export const papalPools: PapalPools = poolsRaw as unknown as PapalPools;
