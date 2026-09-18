import type { ArcDef } from '@/types';
import arcs from './arcs.json';

/** Every arc the game can open. DESIGN.md §12.5. */
export const arcDefs = (arcs as unknown as { arcs: ArcDef[] }).arcs;

export function arcDef(id: string): ArcDef | undefined {
  return arcDefs.find((a) => a.id === id);
}
