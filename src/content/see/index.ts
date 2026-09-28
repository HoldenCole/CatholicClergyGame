import actsRaw from './acts.json';
import type { SeeActDef } from '@/types';

/** E4 R1.1: the acts of the bishop's desk, as data. */
export const seeActs: SeeActDef[] = (actsRaw as unknown as { acts: SeeActDef[] }).acts;

export function seeAct(id: string): SeeActDef | undefined {
  return seeActs.find((a) => a.id === id);
}
