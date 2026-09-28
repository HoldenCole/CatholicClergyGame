import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { writeFile } from './file';
import { seedRumour } from './talk';
import { mark } from './regard';
import { inDiocese } from '@/engine/selectors';

/**
 * Enemies with agency (D10). A person who holds him at −40 or below does
 * something about it, once a year, half the time: a lay leader takes the
 * parish's complaint to the chancery, a priest talks, a pastor of the
 * deanery writes a note; the officials already write (systems/file.ts).
 * And he can go to a man and try to mend it. Numbers invented.
 */
export const ENEMIES = {
  at: -40,
  actChance: 0.5,
  /** Making amends: the hours, the cooldown, and what it is worth by the kind of man. */
  mendHours: 2,
  mendWeeks: 52,
  mendAt: -30,
  mend: { loyal: 14, mystic: 14, fragile: 9, smarter_than_he_lets_on: 9, restless: 9, careerist: 4, hiding_something: 4 } as Record<Npc['hiddenTrait'], number>,
} as const;

const RUMOURS_FROM_AN_ENEMY = ['tired', 'wants_out', 'decline'] as const;

export function enemiesOf(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => n.id !== 'player' && n.status === 'active' && n.relationship <= ENEMIES.at && inDiocese(state, n));
}

/** Once a year: each enemy acts on his position, half the time. */
export function enemiesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (!state.character || !state.flags.ordained) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  const year = Math.floor(state.clock.week / 52);
  for (const e of enemiesOf(state)) {
    const r = rng.derive(`enemy:${e.id}:${year}`);
    if (!r.chance(ENEMIES.actChance)) continue;
    const mended = state.flags[`mend:${e.id}`];
    if (typeof mended === 'number' && state.clock.week - mended < ENEMIES.mendWeeks) continue;
    const name = `${e.title ? `${e.title} ` : ''}${e.name.first} ${e.name.last}`;
    const leads = Object.values(state.groups).find((g) => g.leaderId === e.id && g.parishId === state.assignment?.parishId);
    if (e.role === 'lay' && leads) {
      const c = next.character!;
      next = { ...next, character: { ...c, reputation: { ...c.reputation, parishioners: Math.max(-100, c.reputation.parishioners - 3) } } };
      next = writeFile(next, { by: e.id, byLabel: `${e.name.first} ${e.name.last}, of ${leads.name}`, kind: 'complaint', text: `A petition about the pastor, with signatures, from ${leads.name}.`, weight: -1, lean: 0, seen: false });
      lines.push(`${name} has taken a petition round ${leads.name}, and it has gone to the chancery with signatures on it.`);
    } else if (e.role === 'priest' || e.role === 'classmate') {
      next = seedRumour(next, r, r.pick([...RUMOURS_FROM_AN_ENEMY]));
      if (e.tags.some((t) => t.startsWith('pastor:'))) next = writeFile(next, { by: e.id, byLabel: `${name}, of the deanery`, kind: 'note', text: 'Not a man the deanery would speak for.', weight: -1, lean: 0, seen: false });
      lines.push(`${name} has been talking, and what he says is not kind, and some of it is not true.`);
    } else if (e.role === 'official') {
      // The officials write in the file each year already (systems/file.ts); here he also holds a letter.
      lines.push(`${name} has held a letter of yours at the chancery for a month, which is what he can do.`);
    } else continue;
  }
  return { state: next, lines };
}

/** Whether he may go to a man about it this week. */
export function mayMend(state: GameState, npcId: string): { ok: boolean; why: string | null } {
  const n = state.npcs[npcId];
  if (!n || n.status !== 'active') return { ok: false, why: 'Not here.' };
  if (n.relationship > ENEMIES.mendAt) return { ok: false, why: 'Nothing to mend yet.' };
  if (state.mode.kind !== 'clock') return { ok: false, why: 'Not now.' };
  const last = state.flags[`mend:${npcId}`];
  if (typeof last === 'number' && state.clock.week - last < ENEMIES.mendWeeks) return { ok: false, why: 'You went to him this year; twice would be a campaign.' };
  return { ok: true, why: null };
}

/** Go to him: two hours, and what comes of it depends on the kind of man he is. */
export function mendWith(state: GameState, npcId: string): { state: GameState; line: string } {
  const may = mayMend(state, npcId);
  const n = state.npcs[npcId];
  if (!may.ok || !n) throw new Error(may.why ?? 'not now');
  const gain = ENEMIES.mend[n.hiddenTrait] ?? 9;
  const name = `${n.title ? `${n.title} ` : ''}${n.name.first} ${n.name.last}`;
  const npc = mark({ ...n, relationship: Math.min(100, n.relationship + gain), traitKnown: n.traitKnown || gain !== 9 }, { week: state.clock.week, delta: gain, why: 'you went to him' });
  const line = gain >= 14 ? `${name} lets you in, and after twenty minutes of nothing says the thing he has been holding, and you say yours, and it is not fixed, but the door is open.` : gain <= 4 ? `${name} is courteous for the whole hour, which is how you know it did nothing.` : `${name} hears you out. He does not say it is all right, because it is not, but he shakes your hand at the door, which he has not done in years.`;
  return {
    state: { ...state, npcs: { ...state.npcs, [npcId]: npc }, flags: { ...state.flags, [`mend:${npcId}`]: state.clock.week }, parish: state.parish ? { ...state.parish, apNextWeek: state.parish.apNextWeek - ENEMIES.mendHours / 4 } : state.parish, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Went to ${name} to mend it.` }] },
    line,
  };
}
