import type { ClubDef } from '@/types';
import seminary from './seminary.json';
import priests from './priests.json';

export const clubDefs = [...(seminary as ClubDef[]), ...(priests as ClubDef[])];

export function clubDef(id: string): ClubDef | undefined {
  return clubDefs.find((c) => c.id === id);
}
