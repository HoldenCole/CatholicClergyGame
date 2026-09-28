import type { GameState, Npc } from '@/types';
import { inDiocese } from '@/engine/selectors';
import { playerAge } from '@/engine/career';

/**
 * The last decade as its own register (D8). Past sixty the younger men's
 * regard becomes a thing he can see; at the end, the shelf says who came,
 * or who would. The board's leaving him be is in engine/career.ts (Q6) and
 * the retirement letter is an authored scene (pl_retirement_letter).
 */
export const LAST_DECADE = { from: 60, youngerBy: 12 } as const;

/** The priests of the diocese born a dozen years or more after him, and what they make of him. */
export function youngerMenLine(state: GameState): string | null {
  const c = state.character;
  if (!c || playerAge(state) < LAST_DECADE.from) return null;
  const born = c.entryYear - c.background.entryAge;
  const young = Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'priest' && n.id !== 'player' && n.birthYear >= born + LAST_DECADE.youngerBy && inDiocese(state, n));
  if (young.length < 2) return null;
  const mean = young.reduce((s, n) => s + n.relationship, 0) / young.length;
  const word = mean >= 30 ? 'warm to the old man, and come to him' : mean >= 10 ? 'civil to the old man, and call him Father in the other tone' : mean > -10 ? 'polite to the old man, and do not ask him anything' : 'tired of the old man, and say so at the table';
  return `The younger men (${young.length}) are ${word}.`;
}

/** Who came, or would: the living who hold him as a friend, and the family. */
export function mourners(state: GameState): Npc[] {
  return Object.values(state.npcs)
    .filter((n) => n.id !== 'player' && n.status === 'active' && (n.relationship >= 40 || (n.role === 'family' && n.relationship >= 15)))
    .sort((a, b) => b.relationship - a.relationship)
    .slice(0, 12);
}
