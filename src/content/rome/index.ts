import historyRaw from './history.json';
import poolsRaw from './pools.json';
import documentsRaw from './documents.json';
import axesRaw from './axes.json';
import documentPoolsRaw from './documentPools.json';
import type { DiocesanNorm, DocumentKind, HistoricalDocumentDef, HistoricalPapacyDef, PolicyAxisDef } from '@/types';

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
