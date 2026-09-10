import type { Condition, GameState } from '@/types';
import { seasonOf } from './time';
import { resolveSelector } from './selectors';

function compare(op: '>=' | '<=', actual: number, value: number): boolean {
  return op === '>=' ? actual >= value : actual <= value;
}

/**
 * Evaluate one condition against the state. Bindings map selectors to npc ids
 * for an event that has already fired, so the same NPC is used throughout.
 */
export function evaluateCondition(
  cond: Condition,
  state: GameState,
  bindings: Record<string, string> = {},
): boolean {
  const c = state.character;
  switch (cond.type) {
    case 'stat':
      return !!c && compare(cond.op, c.stats[cond.key], cond.value);
    case 'reputation':
      return !!c && compare(cond.op, c.reputation[cond.key], cond.value);
    case 'relationship': {
      const id = bindings[cond.npcId] ?? cond.npcId;
      const npc = resolveSelector(state, id);
      return !!npc && compare(cond.op, npc.relationship, cond.value);
    }
    case 'credential':
      return !!c && c.credentials.includes(cond.key);
    case 'flag': {
      const v = state.flags[cond.key];
      const truthy = v !== undefined && v !== false && v !== 0 && v !== '';
      return truthy === cond.value;
    }
    case 'alignment':
      return !!c && compare(cond.op, c.alignment, cond.value);
    case 'outspokenness':
      return !!c && compare(cond.op, c.outspokenness, cond.value);
    case 'phase':
      return state.phase === cond.value;
    case 'season':
      return seasonOf(state.clock) === cond.value;
    case 'pillar':
      return !!state.seminary && compare(cond.op, state.seminary.pillarScores[cond.key], cond.value);
    case 'year':
      return !!state.seminary && compare(cond.op, state.seminary.year, cond.value);
    case 'thread':
      return (cond.key in state.threads) === cond.open;
    case 'not':
      return !evaluateCondition(cond.inner, state, bindings);
    case 'any':
      return cond.inner.some((inner) => evaluateCondition(inner, state, bindings));
    case 'all':
      return cond.inner.every((inner) => evaluateCondition(inner, state, bindings));
  }
}

export function evaluateAll(
  conds: Condition[] | undefined,
  state: GameState,
  bindings: Record<string, string> = {},
): boolean {
  return !conds || conds.every((c) => evaluateCondition(c, state, bindings));
}
