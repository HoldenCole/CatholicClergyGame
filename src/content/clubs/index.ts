import type { ClubDef } from '@/types';
import seminary from './seminary.json';
import priests from './priests.json';
import religious from './religious.json';

export const clubDefs = [...(seminary as ClubDef[]), ...(priests as ClubDef[]), ...(religious as ClubDef[])];

export function clubDef(id: string): ClubDef | undefined {
  return clubDefs.find((c) => c.id === id);
}
