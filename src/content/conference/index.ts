import type { ConferenceDocumentDef } from '@/types';
import documentsRaw from './documents.json';

/** E2 R1.2: the documents the bishops' conference may issue. */
export const conferenceDocuments: ConferenceDocumentDef[] = (documentsRaw as { documents: ConferenceDocumentDef[] }).documents;

export function conferenceDocument(id: string): ConferenceDocumentDef | undefined {
  return conferenceDocuments.find((d) => d.id === id);
}
