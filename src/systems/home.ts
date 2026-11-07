import type { GameState, Npc, Opening, Parish } from '@/types';
import { readDigest } from './digest';

/**
 * Home, seen from away (one world, round 1). A man in Rome, in the service,
 * or in a see elsewhere keeps his diocese in view: the parish he left and who
 * has it now, his bishop and the chancery, the openings, and what the year's
 * news from home said. A view over what the engine already keeps; nothing is
 * stored.
 */
export interface HomeView {
  diocese: string;
  bishop: Npc | null;
  /** The last parish he held, who holds it now, and how he left it. */
  formerParish: { parish: Parish; pastor: Npc | null; label: string; left: string; years: number } | null;
  chancery: Npc[];
  openings: Opening[];
  /** The diocese lane of the last year's record, newest first. */
  news: string[];
}

export function homeView(state: GameState): HomeView | null {
  const world = state.world;
  if (!world) return null;
  const bishop = state.npcs[world.diocese.hidden.bishop.npcId] ?? null;
  const last = [...(state.tenures ?? [])].reverse().find((t) => t.kind === 'parish' && t.parishId);
  const parish = last ? world.parishes.find((p) => p.id === last.parishId) : undefined;
  const formerParish = last && parish ? { parish, pastor: state.npcs[parish.pastorId] ?? null, label: last.label, left: last.left ?? 'left', years: Math.max(1, Math.round((last.endWeek - last.startWeek) / 52)) } : null;
  const chancery = Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'official' && !n.tags.some((t) => ['nuncio_chief', 'nuncio', 'curia_prefect', 'curia_secretary', 'curia_colleague', 'nac_rector', 'nac_vice_rector', 'vocation_director'].includes(t)) && n.tags.some((t) => ['vicar_general', 'chancellor', 'vicar_for_clergy', 'judicial_vicar'].includes(t)));
  const news = readDigest(state.digest, 52).flatMap((w) => w.lanes.diocese ?? []).filter((l) => /From home|Rome names|has been moved|has died|retired|named/.test(l)).slice(0, 12);
  return { diocese: world.diocese.visible.name, bishop, formerParish, chancery, openings: state.openings.filter((o) => o.parishId), news };
}
