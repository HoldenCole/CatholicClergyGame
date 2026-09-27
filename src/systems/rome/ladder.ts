import type { GameState } from '@/types';
import { fromDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';

/**
 * The Roman ladders (the Curia's and the service's) are climbed by chance, not
 * by threshold: a man at the rung's score has a third of a chance each year,
 * one well over it is certain, one under it waits. Invented and flagged.
 */
export const LADDER_CHANCE = { below: 8, span: 24 } as const;

/** The yearly chance of the rung, 0..1, from the Secretariat's score against the rung's. */
export function climbChance(score: number, threshold: number): number {
  return Math.max(0, Math.min(1, (score - threshold + LADDER_CHANCE.below) / LADDER_CHANCE.span));
}

/** The man's age this week. */
export function ageOf(state: GameState): number {
  const c = state.character!;
  return fromDayNumber(sundayOf(state.clock)).year - (c.entryYear - c.background.entryAge);
}
