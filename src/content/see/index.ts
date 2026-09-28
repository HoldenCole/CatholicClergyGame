import actsRaw from './acts.json';
import directionsRaw from './directions.json';
import visitsRaw from './visits.json';
import type { DirectionDef, SeeActDef, VisitPools } from '@/types';

/** E4 R1.1: the acts of the bishop's desk, as data. */
export const seeActs: SeeActDef[] = (actsRaw as unknown as { acts: SeeActDef[] }).acts;

export function seeAct(id: string): SeeActDef | undefined {
  return seeActs.find((a) => a.id === id);
}

/** E4 R1.2: the directions a bishop gives his priests, as data. */
export const directionDefs: DirectionDef[] = (directionsRaw as unknown as { directions: DirectionDef[] }).directions;

export function directionDef(id: string): DirectionDef | undefined {
  return directionDefs.find((d) => d.id === id);
}

/** E4 R1.3: what a visit finds, as pools of lines. */
export const visitPools: VisitPools = visitsRaw as unknown as VisitPools;
