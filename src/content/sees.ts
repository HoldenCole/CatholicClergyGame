import type { SeeDef } from '@/types';
import sees from './sees.json';

export const seeDefs = (sees as { sees: SeeDef[] }).sees;

export function seeDef(id: string): SeeDef | undefined {
  return seeDefs.find((s) => s.id === id);
}
