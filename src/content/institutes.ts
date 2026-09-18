import type { InstituteDef } from '@/types';
import data from './institutes.json';

export const instituteDefs = (data as { institutes: InstituteDef[] }).institutes;

export function instituteDef(id: string): InstituteDef | undefined {
  return instituteDefs.find((d) => d.id === id);
}
