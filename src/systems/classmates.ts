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
  // A brother of the order, from the novitiate class. E3.
  if (npc.tags.includes('friar')) {
    if (npc.status === 'left') return 'left the order';
    if (npc.status === 'dead') return 'dead, in the necrology';
    if (npc.status === 'retired') return 'in the infirmary house';
    if (npc.status === 'dismissed') return 'sent home from formation';
    const f = new Set(npc.tags);
    if (f.has('bishop_elsewhere')) return 'a bishop, elsewhere';
    if (f.has('on_leave')) return 'withdrawn from ministry';
    if (f.has('provincial_council')) return "on the provincial's council";
    if (f.has('superior')) return f.has('rome_alumnus') ? 'a prior, with a Roman degree' : 'a prior';
    if (f.has('rome_alumnus')) return 'back from Rome';
    return npc.tags.includes('vows:solemn') ? 'a friar of the province' : 'in formation';
  }
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
  if (t.has('chancery') || t.has('provincial_council')) return 3;
  if (t.has('pastor') || t.has('superior')) return 2;
  return 1;
}

export function classmateLines(state: GameState): ClassmateLine[] {
  const ids = state.seminary?.classmateIds ?? [];
  const office = state.religious?.office?.office;
  const mine = office === 'provincial' ? 3 : office === 'prior' ? 2 : state.assignment?.role === 'pastor' ? 2 : state.phase === 'chancery' ? 3 : state.phase === 'bishop' ? 4 : 1;
  return ids
    .map((id) => state.npcs[id])
    .filter((n): n is Npc => !!n)
    .map((npc) => ({ npc, post: classmatePost(npc), regard: relationshipWord(npc.relationship), ahead: rank(npc) > mine }))
    .sort((a, b) => (a.npc.status === 'active' ? 0 : 1) - (b.npc.status === 'active' ? 0 : 1) || b.npc.relationship - a.npc.relationship);
}
