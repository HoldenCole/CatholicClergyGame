import type { Character, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { deliverLetter } from './review';
import { composeMail, findSender, mailDef } from './mail';
import { consistency } from './reputation';

/**
 * Sides, and the cost of changing them (D7). The blocs remember: a man
 * whose public record leans one way for years and then the other has
 * crossed, and the side that lost him says so, to his face, through the
 * mailbag; the You sheet carries a standing for it; consistency (DESIGN
 * §5.5) is read into the word. Numbers invented.
 */
export const SIDES = {
  /** Years read on each side of the crossing, and how many stands each needs. */
  windowYears: 5,
  minStands: 2,
  /** The mean has to lean at least this far, each way. */
  lean: 20,
  /** Not read as crossing again within this many years of the last. */
  againYears: 8,
} as const;

function meanLean(c: Character, from: number, to: number): { mean: number; n: number } {
  const xs = c.positions.filter((p) => p.volume !== 'private' && p.week >= from && p.week < to).map((p) => p.value);
  return { mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0, n: xs.length };
}

/** Whether the record, read this week, shows a crossing: the last five years against the five before. */
export function crossedSides(state: GameState): 'traditional' | 'progressive' | null {
  const c = state.character;
  if (!c) return null;
  const week = state.clock.week;
  const w = SIDES.windowYears * 52;
  const now = meanLean(c, week - w, week + 1);
  const then = meanLean(c, week - 2 * w, week - w);
  if (now.n < SIDES.minStands || then.n < SIDES.minStands) return null;
  if (Math.abs(now.mean) < SIDES.lean || Math.abs(then.mean) < SIDES.lean || Math.sign(now.mean) === Math.sign(then.mean)) return null;
  return then.mean < 0 ? 'traditional' : 'progressive';
}

/** Once a year: a crossing is marked, counted, and the side that lost him writes. */
export function sidesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const lost = crossedSides(state);
  if (!lost) return { state, lines: [] };
  const last = state.flags['sides:crossed_at'];
  if (typeof last === 'number' && state.clock.week - last < SIDES.againYears * 52) return { state, lines: [] };
  let next: GameState = { ...state, flags: { ...state.flags, 'sides:crossed_at': state.clock.week, 'sides:lost': lost, 'sides:crossings': Number(state.flags['sides:crossings'] ?? 0) + 1 } };
  const lines = [`The record has turned: for years it leaned ${lost}, and lately it does not. The ${lost} men have noticed.`];
  next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Changed sides, as the record reads it: the ${lost} bloc has lost you.` }] };
  const def = mailDef('ml_bloc_lost_you');
  const found = def ? findSender(next, 'old_bloc', rng) : null;
  if (def && found) {
    const letter = composeMail(next, def, found);
    next = deliverLetter({ ...next, mail: [...(next.mail ?? []), { mailId: def.id, week: next.clock.week, from: found.sender, title: letter.title, asked: def.asks }] }, letter);
  }
  return { state: next, lines };
}

/** The word for the record's shape: whether he has moved, and whether the private and the public agree. */
export function sidesWord(state: GameState): string {
  const c = state.character;
  if (!c) return '';
  const crossings = Number(state.flags['sides:crossings'] ?? 0);
  const steady = consistency(c);
  const moved = crossings === 0 ? 'a man who has never moved' : crossings === 1 ? 'a man who changed sides, once' : `a man who has changed sides ${crossings === 2 ? 'twice' : `${crossings} times`}`;
  const honest = steady >= 80 ? 'and says in public what he says in private' : steady >= 55 ? 'and mostly says in public what he says in private' : 'and says one thing in private and another aloud';
  return `${moved}, ${honest}`;
}
