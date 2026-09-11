import type { GameState, Npc } from '@/types';

/**
 * Classmates as living careers: what each man is now, in words, from the
 * tags and status the trajectories write each year. DESIGN 9.2.
 */
export interface ClassmateLine {
  npc: Npc;
  /** "pastor of a parish", "at the chancery", "left the priesthood" */
  post: string;
  /** "a friend", "civil", "hostile" */
  regard: string;
  /** He has gone further than you, or not. */
  ahead: boolean;
}

export function relationshipWord(r: number): string {
  if (r >= 40) return 'a friend';
  if (r >= 15) return 'warm';
  if (r > -15) return 'civil';
  if (r > -40) return 'cool';
  return 'hostile';
}

export function classmatePost(npc: Npc): string {
  if (npc.status === 'left') return 'left the priesthood';
  if (npc.status === 'dead') return 'dead';
  if (npc.status === 'retired') return 'retired';
  if (npc.status === 'dismissed') return 'dismissed from the seminary';
  const t = new Set(npc.tags);
  if (t.has('bishop_elsewhere')) return 'a bishop, elsewhere';
  if (t.has('on_leave')) return 'on leave, and nobody says why';
  if (t.has('chancery')) return 'at the chancery, a monsignor';
  if (t.has('pastor')) return t.has('rome_alumnus') ? 'a pastor, with a Roman degree' : 'a pastor';
  if (t.has('rome_alumnus')) return 'back from Rome, a vicar still';
  return 'a parochial vicar';
}

function rank(npc: Npc): number {
  const t = new Set(npc.tags);
  if (npc.status !== 'active') return 0;
  if (t.has('bishop_elsewhere')) return 4;
  if (t.has('chancery')) return 3;
  if (t.has('pastor')) return 2;
  return 1;
}

export function classmateLines(state: GameState): ClassmateLine[] {
  const ids = state.seminary?.classmateIds ?? [];
  const mine = state.assignment?.role === 'pastor' ? 2 : state.phase === 'chancery' ? 3 : state.phase === 'bishop' ? 4 : 1;
  return ids
    .map((id) => state.npcs[id])
    .filter((n): n is Npc => !!n)
    .map((npc) => ({ npc, post: classmatePost(npc), regard: relationshipWord(npc.relationship), ahead: rank(npc) > mine }))
    .sort((a, b) => (a.npc.status === 'active' ? 0 : 1) - (b.npc.status === 'active' ? 0 : 1) || b.npc.relationship - a.npc.relationship);
}
