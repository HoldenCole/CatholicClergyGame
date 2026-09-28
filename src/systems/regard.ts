import type { GameState, Npc, RegardMark } from '@/types';
import { relationshipWord } from './classmates';

/**
 * Regard that settles. Every relationship has a resting point set by shared
 * history (the marks the scenes and favours leave, the bonds, who the person
 * is to him), and drifts back toward it when nothing is done; the top of the
 * scale costs continued contact. Before this, a relationship was one number
 * clamped at ±100, and once there it stayed for decades. Numbers invented.
 */
export const REGARD = {
  /** Where a relationship rests with no history at all, by who the person is. */
  base: { family: 35, classmate: 8, formator: 5, priest: 0, lay: 0, official: 0, bishop: 0, religious: 0 } as Record<Npc['role'], number>,
  /** How much of a mark stays in the resting point. */
  markWeight: 0.5,
  /** The most the marks can move the resting point, either way. */
  markCap: 40,
  /** Each bond written on a person, and the most they add. */
  bondWorth: 4,
  bondCap: 24,
  quarrelCost: 6,
  /** Drift toward the resting point per week without contact, and above the kept band; applied once a month, in a month's worth. */
  driftPerWeek: 0.06,
  keptBand: 70,
  keptDrift: 0.14,
  tickWeeks: 4,
  /** Weeks a contact counts for. */
  contactWeeks: 8,
  /** A change this large in one scene is remembered. */
  markAt: 6,
  /** Marks kept per person. */
  marksKept: 12,
  /** Where "a friend" starts, and where it stops being one. */
  friendAt: 40,
  friendUntil: 15,
  /** Where the resting point stays. */
  restMin: -70,
  restMax: 70,
} as const;

/** What the history says this relationship settles to. */
export function restOf(npc: Npc): number {
  const base = REGARD.base[npc.role] ?? 0;
  const marks = (npc.marks ?? []).reduce((s, m) => s + m.delta, 0) * REGARD.markWeight;
  const bonds = npc.bonds ?? [];
  const warm = Math.min(REGARD.bondCap, bonds.filter((b) => b.kind !== 'quarreled').length * REGARD.bondWorth);
  const quarrels = bonds.filter((b) => b.kind === 'quarreled').length * REGARD.quarrelCost;
  const rest = base + Math.max(-REGARD.markCap, Math.min(REGARD.markCap, marks)) + warm - quarrels;
  return Math.max(REGARD.restMin, Math.min(REGARD.restMax, Math.round(rest)));
}

/** He did something about this person this week. */
export function touch(npc: Npc, week: number): Npc {
  return npc.contactWeek === week ? npc : { ...npc, contactWeek: week };
}

/** A moment worth remembering, written on the person. */
export function mark(npc: Npc, entry: RegardMark): Npc {
  return { ...npc, marks: [...(npc.marks ?? []), entry].slice(-REGARD.marksKept), contactWeek: entry.week };
}

/** Whether the last contact still counts. */
export function inTouch(state: GameState, npc: Npc): boolean {
  const kept = state.flags[`kept:${npc.id}`];
  const last = Math.max(npc.contactWeek ?? -1, typeof kept === 'number' ? kept : -1);
  return last >= 0 && state.clock.week - last <= REGARD.contactWeeks;
}

/** The week: everyone drifts toward where the history says they rest, unless he is in touch; the top of the scale costs more. */
export function regardWeek(state: GameState): GameState {
  const week = state.clock.week;
  // Once a month: a life has hundreds of people, and the drift is slow enough that the week does not need it.
  if (week % REGARD.tickWeeks !== 0) return state;
  const npcs = { ...state.npcs };
  let changed = false;
  for (const n of Object.values(npcs)) {
    if (n.id === 'player' || n.status !== 'active') continue;
    let next = n;
    const friend = n.relationship >= REGARD.friendAt;
    if (friend && n.friendSince === undefined) next = { ...next, friendSince: week };
    else if (!friend && n.relationship < REGARD.friendUntil && n.friendSince !== undefined) { const { friendSince: _gone, ...rest } = next; void _gone; next = rest; }
    if (!inTouch(state, n)) {
      const rest = restOf(n);
      const gap = rest - n.relationship;
      if (Math.abs(gap) > 0.01) {
        const rate = (n.relationship > REGARD.keptBand && gap < 0 ? REGARD.keptDrift : REGARD.driftPerWeek) * REGARD.tickWeeks;
        const step = Math.sign(gap) * Math.min(Math.abs(gap), rate);
        next = { ...next, relationship: n.relationship + step };
      }
    }
    if (next !== n) { npcs[n.id] = next; changed = true; }
  }
  return changed ? { ...state, npcs } : state;
}

/**
 * After a scene: the people in it were seen, and anyone moved past the
 * threshold remembers why. `why` is the scene's title.
 */
export function noteMarks(before: GameState, after: GameState, ids: string[], why: string): GameState {
  if (!ids.length) return after;
  const week = after.clock.week;
  const npcs = { ...after.npcs };
  let changed = false;
  for (const id of new Set(ids)) {
    const was = before.npcs[id];
    const now = npcs[id];
    if (!was || !now || id === 'player') continue;
    const delta = now.relationship - was.relationship;
    const next = Math.abs(delta) >= REGARD.markAt ? mark(now, { week, delta: Math.round(delta), why }) : touch(now, week);
    if (next !== now) { npcs[id] = next; changed = true; }
  }
  return changed ? { ...after, npcs } : after;
}

/** The word on the sheet, and what is happening to it: "a friend, since 2019, kept" / "a friend, drifting". */
export function regardLine(state: GameState, npc: Npc, yearOf: (week: number) => number): string {
  const word = relationshipWord(npc.relationship);
  const since = npc.friendSince !== undefined && npc.relationship >= REGARD.friendAt ? `, since ${yearOf(npc.friendSince)}` : '';
  if (npc.status !== 'active') return `${word}${since}`;
  const rest = restOf(npc);
  const touch = inTouch(state, npc);
  const state_ = touch ? 'kept' : npc.relationship > rest + 3 ? 'drifting' : npc.relationship < rest - 3 ? 'mending' : 'settled';
  return `${word}${since}, ${state_}`;
}

/** The last thing that moved it, for the sheet. */
export function lastMark(npc: Npc): RegardMark | null {
  const m = npc.marks ?? [];
  return m.length ? m[m.length - 1]! : null;
}
