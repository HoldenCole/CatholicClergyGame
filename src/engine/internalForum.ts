import type { Effect, EffectTarget, GameState } from '@/types';
import { applyEffects } from './effects';

/**
 * The internal forum. DESIGN.md §9.4, CLAUDE.md rule 7.
 *
 * Spiritual direction and confession are sealed. The director cannot be
 * consulted by the formation team, cannot contribute to an evaluation, and
 * cannot disclose anything said to him. The guarantee is enforced here rather
 * than in each event, so a scene cannot leak by an author's oversight: a scene
 * flagged `internalForum` runs through this resolver, which accepts only what
 * changes the man himself and throws on anything another person could see.
 *
 * If it ever leaks, the mechanic is dead and so is the relationship it was
 * built for.
 */

/** What a sealed scene may write: the man's own interior, a private flag, an open thread. */
export const SEALED_TARGETS: readonly EffectTarget[] = ['stat', 'flag', 'thread'] as const;

export class InternalForumError extends Error {
  override name = 'InternalForumError';
}

/** Whether one effect may be written inside the seal. */
export function isSealed(effect: Effect): boolean {
  return SEALED_TARGETS.includes(effect.target);
}

/** The effects a sealed scene may not carry, for a validator's message. */
export function leaks(effects: Effect[]): Effect[] {
  return effects.filter((e) => !isSealed(e));
}

/**
 * Apply the effects of a sealed scene. Throws on anything outside the seal, so
 * a reputation effect on an internal-forum event fails loudly rather than
 * quietly telling the diocese what was said.
 */
export function applyInternalForum(state: GameState, effects: Effect[], bindings: Record<string, string> = {}, why?: string): GameState {
  const bad = leaks(effects);
  if (bad.length) {
    throw new InternalForumError(
      `the internal forum is sealed: ${bad.map((e) => `${e.target}:${e.key}`).join(', ')} would be visible outside it. Only ${SEALED_TARGETS.join(', ')} may be written in spiritual direction.`,
    );
  }
  // Movers are the player's own reading of his own stats, and never leave him.
  return applyEffects(state, effects, bindings, why);
}
