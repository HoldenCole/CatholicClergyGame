import type { CreationAnswers, CreationContent, DioceseCandidate, GameState, Parish } from '@/types';
import { applyCreation } from './creation';
import { scoreParish } from './assignment';
import { installWorld } from '@/generation/world';

/** What the diocese step can say about where a man would probably land. DESIGN §7.4, CLAUDE.md rule 6: no hidden field is read. */
export interface Placement {
  parish: Parish;
  reasons: string[];
  /** The five parishes, in the order the bishop would rank them for this man. */
  ranked: { parish: Parish; score: number }[];
}

export const KIND_WORD: Record<Parish['kind'], string> = {
  flagship_suburban: 'the flagship parish',
  struggling_urban: 'a struggling city parish',
  immigrant_growing: 'a growing immigrant parish',
  rural: 'a country parish',
  difficult: 'the parish nobody wants',
};

/**
 * The likely first assignment in a candidate diocese for the man the
 * answers describe: the same scoring the bishop will use, without the die
 * roll, without the hidden shortage, and with an ordinary formation record.
 */
export function likelyPlacement(state: GameState, answers: CreationAnswers, candidate: DioceseCandidate, content: CreationContent, year: number): Placement | null {
  const tie = content.ties.some((t) => t.id === answers.tie) ? answers.tie : (content.ties[0]?.id ?? answers.tie);
  let s: GameState;
  try {
    s = applyCreation(installWorld({ ...state, world: null, npcs: {} }, candidate, year), { ...answers, tie }, content);
  } catch {
    return null;
  }
  const world = s.world!;
  const ranked = world.parishes.map((parish) => scoreParish(s, world, parish, { hidden: false })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return null;
  return { parish: top.parish, reasons: top.reasons, ranked: ranked.map((r) => ({ parish: r.parish, score: r.score })) };
}
