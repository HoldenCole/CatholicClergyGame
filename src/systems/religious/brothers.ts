import type { GameState, Npc } from '@/types';
import { createRng } from '@/engine/rng';
import { currentHouse, membersOf } from './house';
import { REGARD, restOf } from '@/systems/regard';

/**
 * Brothers who become friends (friar round D1). E3 §3.2: the house is the
 * peer group he cannot escape, and a rectory's table, choir, and recreation
 * build regard the way a parish's visits do. Each week every man at table
 * moves toward the player by what the common life gives them together (the
 * table kept, the choir sung, the hours given to the community, the house's
 * own cohesion) and by an affinity of the two men (rolled once from the
 * seed: alignment and temperament), toward a ceiling that the years raise:
 * every year at the same table is a bond, and a quarrel at chapter is one
 * too. Ten years in a house of eight should leave a friend or two and an
 * enemy. Tunables invented.
 */
export const BROTHERS = {
  /** Weekly regard from the common table, by how he keeps it. */
  table: { min: -0.06, standard: 0.04, invested: 0.1 } as Record<string, number>,
  /** Weekly regard from the choir, by how he keeps the Hours. */
  choir: { min: -0.03, standard: 0.02, invested: 0.05 } as Record<string, number>,
  /** Per block a week given to the community spend. */
  perCommunityBlock: 0.04,
  /** The house's cohesion, from −this at 0 to +this at 100. */
  cohesion: 0.05,
  /** Affinity: alignment within this is a like mind; beyond three times it is not. Most men are neither, and the roll decides them slowly. */
  likeMind: 15,
  affinity: { like: 0.08, unlike: -0.12, spread: 0.08 },
  /** Regard cannot climb past the resting point by more than this; the years raise the rest. */
  ceilingAbove: 42,
  /** A year at the same table: one bond (helped), which lifts where regard rests. */
  yearBond: 52,
  /** A quarrel: a man of unlike mind in a house at odds with itself, once a year at most, this chance. */
  quarrel: { chance: 0.18, cohesionBelow: 40, regard: -8 },
  /** Where a brother counts as a friend, for the line. */
  friendAt: REGARD.friendAt,
} as const;

/** The affinity of two men, rolled once from the seed: alignment and a little of who they are. */
export function affinityOf(state: GameState, npc: Npc): number {
  const mine = state.character?.alignment ?? 0;
  const gap = Math.abs(mine - npc.alignment);
  const base = gap <= BROTHERS.likeMind ? BROTHERS.affinity.like : gap >= BROTHERS.likeMind * 3 ? BROTHERS.affinity.unlike : 0;
  const roll = createRng(`${state.seed}:brothers:${npc.id}`).float(-BROTHERS.affinity.spread, BROTHERS.affinity.spread);
  return Math.round((base + roll) * 1000) / 1000;
}

/** What a week at table gives each man of the house, before his affinity. */
export function tableWeekly(state: GameState): number {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house) return 0;
  const table = BROTHERS.table[r.horarium.common_table] ?? BROTHERS.table.standard!;
  const choir = BROTHERS.choir[r.horarium.hours] ?? BROTHERS.choir.standard!;
  const community = (r.spends?.community ?? 0) * BROTHERS.perCommunityBlock;
  const cohesion = ((house.cohesion - 50) / 50) * BROTHERS.cohesion;
  return table + choir + community + cohesion;
}

function name(n: Npc): string {
  return `${n.title} ${n.name.first} ${n.name.last}`;
}

/** One week at table: regard with every man of the house moves, the years write bonds, and a quarrel now and then. */
export function brothersWeek(state: GameState, rng: import('@/engine/rng').Rng): { state: GameState; lines: string[] } {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house || state.study) return { state, lines: [] };
  const week = state.clock.week;
  const base = tableWeekly(state);
  const npcs = { ...state.npcs };
  const lines: string[] = [];
  const notes: string[] = [];
  let changed = false;
  for (const n of membersOf(state, house)) {
    if (n.id === 'player') continue;
    let next: Npc = { ...n, contactWeek: week };
    const delta = base + affinityOf(state, n);
    const ceiling = restOf(n) + BROTHERS.ceilingAbove;
    const room = delta > 0 ? Math.max(0, Math.min(1, (ceiling - n.relationship) / BROTHERS.ceilingAbove)) : 1;
    const moved = Math.max(-100, Math.min(100, n.relationship + delta * room));
    next = { ...next, relationship: Math.round(moved * 1000) / 1000 };
    // A year at the same table, counted from when he came to it.
    const since = Number(n.tags.find((t) => t.startsWith('table:'))?.slice('table:'.length) ?? NaN);
    if (Number.isNaN(since)) next = { ...next, tags: [...next.tags, `table:${week}`] };
    else if (week - since > 0 && (week - since) % BROTHERS.yearBond === 0) {
      next = { ...next, bonds: [...(next.bonds ?? []), { kind: 'helped', week, who: `a year at the same table` }] };
      // A man of unlike mind in a house at odds with itself: a quarrel, now and then, that the years remember.
      if (house.cohesion < BROTHERS.quarrel.cohesionBelow && affinityOf(state, n) < 0 && rng.derive(`quarrel:${n.id}:${week}`).chance(BROTHERS.quarrel.chance)) {
        next = { ...next, relationship: Math.max(-100, next.relationship + BROTHERS.quarrel.regard), bonds: [...(next.bonds ?? []), { kind: 'quarreled', week, who: 'the two of you, at chapter' }] };
        lines.push(`A quarrel at chapter with ${name(n)}, over a thing neither of you will remember and both of you will.`);
        notes.push(`Quarreled at chapter with ${name(n)}.`);
      }
    }
    if (n.relationship < BROTHERS.friendAt && next.relationship >= BROTHERS.friendAt) {
      lines.push(`${name(n)} has become, without either of you saying so, a friend: the seat beside yours at recreation is his.`);
      notes.push(`${name(n)} became a friend, at table.`);
    }
    npcs[n.id] = next;
    changed = true;
  }
  if (!changed) return { state, lines };
  const career = notes.length ? [...state.career, ...notes.map((text) => ({ week, kind: 'note' as const, text }))] : state.career;
  return { state: { ...state, npcs, career }, lines };
}
