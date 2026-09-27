import historyRaw from './history.json';
import poolsRaw from './pools.json';
import documentsRaw from './documents.json';
import axesRaw from './axes.json';
import documentPoolsRaw from './documentPools.json';
import dicasteriesRaw from './dicasteries.json';
import collegeRaw from './college.json';
import nunciaturesRaw from './nunciatures.json';
import type { DiocesanNorm, DocumentKind, HistoricalDocumentDef, HistoricalPapacyDef, NunciatureDef, PolicyAxisDef } from '@/types';

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

/** The papal record as documents, in date order. E1 §4.1. */
export const documentHistory: HistoricalDocumentDef[] = (documentsRaw as unknown as { documents: HistoricalDocumentDef[] }).documents;

export type PolicyAxis = PolicyAxisDef;

export const policyAxes: PolicyAxis[] = (axesRaw as unknown as { axes: PolicyAxis[] }).axes;

export function axisDef(key: string): PolicyAxis | undefined {
  return policyAxes.find((a) => a.key === key);
}

export interface DocumentPools {
  kinds: Record<DocumentKind, { label: string; topicWeight: number; axisWeight: number }>;
  readings: Record<DiocesanNorm, string>;
  openers: string[];
  continuations: string[];
  topics: string[];
  /** Real documents' titles a generated incipit must never take. */
  blocked: string[];
}

export const documentPools: DocumentPools = documentPoolsRaw as unknown as DocumentPools;

/** E1 R1.4: the offices of the Roman Curia a diocesan priest may be lent to. */
export interface DicasteryDef {
  key: string;
  /** Its name, by the day it held it: the last has no end. */
  names: { until?: string; name: string }[];
  short: string;
  /** What comes across an official's desk there. */
  work: string;
  /** What in a man's record makes the Holy See put him there. */
  fit: { credentials: Record<string, number>; flags: Record<string, number> };
  /** Where the office calls its rungs by other names: the Secretariat of State's assessor and substitute. */
  ranks?: Partial<Record<'head' | 'undersecretary' | 'secretary', string>>;
}

export const dicasteries: DicasteryDef[] = (dicasteriesRaw as unknown as { dicasteries: DicasteryDef[] }).dicasteries;

/** E1 R1.5: where the College's cardinals come from, and the districts of their titular churches. */
export interface CollegePools {
  origins: { from: string; region: string; heritage: string; weight: number }[];
  districts: string[];
}

export const collegePools: CollegePools = collegeRaw as unknown as CollegePools;

/** The countries of the diplomatic service. E1 R1.7, §11. */
export const nunciatures: NunciatureDef[] = (nunciaturesRaw as unknown as { nunciatures: NunciatureDef[] }).nunciatures;
