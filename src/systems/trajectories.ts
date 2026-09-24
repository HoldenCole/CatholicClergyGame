import type { GameState, Milestone, Npc } from '@/types';
import type { Rng } from '@/engine/rng';

/**
 * DESIGN 9.2: trajectories roll at ordination, seeded from stats, ambition,
 * and relationship with the player, then simulate forward in the background.
 */
export function rollTrajectory(rng: Rng, npc: Npc): Milestone[] {
  const out: Milestone[] = [];
  const s = npc.stats;
  const talent = (s.administration + s.charisma) / 2;
  const scholar = (s.theology + s.knowledge) / 2;
  let leaveYear: number | null = null;
  if (rng.chance(0.12 + (npc.struggle === 'doubt' || npc.struggle === 'loneliness' ? 0.1 : 0))) leaveYear = rng.int(2, 14);
  if (leaveYear !== null) {
    out.push({ yearsOrdained: leaveYear, kind: 'left', done: false });
    return out;
  }
  if (scholar >= 55 && rng.chance(0.35)) out.push({ yearsOrdained: rng.int(2, 6), kind: 'rome_study', done: false });
  const pastorYear = Math.max(3, Math.round(12 - npc.ambition / 12 - talent / 25 + rng.gaussian() * 2));
  out.push({ yearsOrdained: pastorYear, kind: 'pastor', done: false });
  if (npc.ambition >= 55 && talent >= 45 && rng.chance(0.5)) out.push({ yearsOrdained: pastorYear + rng.int(2, 8), kind: 'chancery', done: false });
  if (npc.ambition >= 80 && talent >= 60 && rng.chance(0.15)) out.push({ yearsOrdained: rng.int(18, 30), kind: 'bishop_elsewhere', done: false });
  if (npc.hiddenTrait === 'hiding_something' && rng.chance(0.4)) out.push({ yearsOrdained: rng.int(5, 25), kind: 'scandal', done: false });
  if (npc.struggle === 'health' && rng.chance(0.5)) out.push({ yearsOrdained: rng.int(10, 35), kind: 'died', done: false });
  const retire = 45 - Math.max(0, (rng.int(24, 40) - 25));
  out.push({ yearsOrdained: Math.max(30, retire), kind: 'retired', done: false });
  return out.sort((a, b) => a.yearsOrdained - b.yearsOrdained);
}

export function rollTrajectories(state: GameState, rng: Rng): GameState {
  const npcs = { ...state.npcs };
  for (const n of Object.values(npcs)) {
    if (n.role !== 'classmate' || n.status !== 'active' || n.trajectory) continue;
    // A brother of the order is ordained with the class, and professed solemnly before it. E3.
    const brother = isBrother(n) ? { title: n.tags.includes('lay_brother') ? 'Br.' : 'Fr.', tags: n.tags.map((t) => (t === 'vows:novice' || t === 'vows:simple' ? 'vows:solemn' : t)) } : {};
    npcs[n.id] = { ...n, ...brother, trajectory: rollTrajectory(rng.derive(`traj:${n.id}`), n) };
  }
  return { ...state, npcs };
}

/** A classmate who is a brother of the player's order: the novitiate class, not the diocesan seminary's. E3. */
export function isBrother(n: Npc): boolean {
  return n.tags.includes('friar');
}

/** The same milestones, lived in an order: a house to govern, the council, the order's infirmary. E3. */
const FRIAR_MILESTONE_TEXT: Record<Milestone['kind'], (n: Npc) => string> = {
  pastor: (n) => `${n.title} ${n.name.last}, of your class, has been elected prior of a house of the province.`,
  chancery: (n) => `${n.title} ${n.name.last}, of your class, has been named to the provincial's council.`,
  rome_study: (n) => `${n.title} ${n.name.last}, of your class, has been sent to Rome to study.`,
  left: (n) => `${n.name.first} ${n.name.last}, of your class, has left the order.`,
  died: (n) => `${n.title} ${n.name.last}, of your class, has died; the necrology has him now.`,
  scandal: (n) => `${n.title} ${n.name.last}, of your class, has been withdrawn from ministry by the provincial.`,
  bishop_elsewhere: (n) => `${n.name.first} ${n.name.last}, of your class, has been named a bishop.`,
  retired: (n) => `${n.title} ${n.name.last}, of your class, has gone to the province's infirmary house.`,
};

const MILESTONE_TEXT: Record<Milestone['kind'], (n: Npc) => string> = {
  pastor: (n) => `${n.name.first} ${n.name.last} has been made a pastor.`,
  chancery: (n) => `${n.name.first} ${n.name.last} has gone to the chancery.`,
  rome_study: (n) => `${n.name.first} ${n.name.last} has been sent to Rome to study.`,
  left: (n) => `${n.name.first} ${n.name.last} has left the priesthood.`,
  died: (n) => `${n.name.first} ${n.name.last} has died.`,
  scandal: (n) => `${n.name.first} ${n.name.last} has been placed on administrative leave.`,
  bishop_elsewhere: (n) => `${n.name.first} ${n.name.last} has been named a bishop.`,
  retired: (n) => `${n.name.first} ${n.name.last} has retired.`,
};

/** Apply every milestone due at this many years ordained. Returns classmate-news lines. */
export function advanceTrajectories(state: GameState, yearsOrdained: number): { state: GameState; lines: string[] } {
  const npcs = { ...state.npcs };
  const lines: string[] = [];
  for (const n of Object.values(npcs)) {
    if (!n.trajectory) continue;
    let npc = n;
    for (const m of n.trajectory) {
      if (m.done || m.yearsOrdained > yearsOrdained || npc.status !== 'active') continue;
      const trajectory = npc.trajectory!.map((x) => (x === m ? { ...x, done: true } : x));
      switch (m.kind) {
        case 'pastor':
          npc = isBrother(npc) ? { ...npc, trajectory, tags: [...npc.tags, 'superior'] } : { ...npc, trajectory, tags: [...npc.tags.filter((t) => t !== 'vicar'), 'pastor'], title: npc.title || 'Fr.' };
          break;
        case 'chancery':
          npc = isBrother(npc) ? { ...npc, trajectory, tags: [...npc.tags, 'provincial_council'] } : { ...npc, trajectory, tags: [...npc.tags, 'chancery'], title: 'Msgr.' };
          break;
        case 'rome_study':
          npc = { ...npc, trajectory, tags: [...npc.tags, 'rome_alumnus'] };
          break;
        case 'left':
          npc = { ...npc, trajectory, status: 'left' };
          break;
        case 'died':
          npc = { ...npc, trajectory, status: 'dead' };
          break;
        case 'scandal':
          npc = { ...npc, trajectory, tags: [...npc.tags, 'on_leave'] };
          break;
        case 'bishop_elsewhere':
          npc = { ...npc, trajectory, tags: [...npc.tags, 'bishop_elsewhere'], title: 'Bishop' };
          break;
        case 'retired':
          npc = { ...npc, trajectory, status: 'retired' };
          break;
      }
      lines.push((isBrother(npc) ? FRIAR_MILESTONE_TEXT : MILESTONE_TEXT)[m.kind](npc));
    }
    npcs[n.id] = npc;
  }
  return { state: { ...state, npcs }, lines };
}
