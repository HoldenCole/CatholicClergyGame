import type {
  Archetype,
  ConstituencyKey,
  Effect,
  Ending,
  GameState,
  NpcStatus,
  Pillar,
  StatKey,
} from '@/types';
import { applyReputation, clampSigned } from '@/systems/reputation';
import { applyStat } from '@/systems/stats';
import { resolveSelector } from './selectors';

export class EffectError extends Error {
  override name = 'EffectError';
}

function requireCharacter(state: GameState, effect: Effect) {
  if (!state.character) throw new EffectError(`${effect.target}:${effect.key} needs a character`);
  return state.character;
}

/**
 * Apply one authored effect. Pure. Throws EffectError on an effect the state
 * cannot take (no character, unknown target), so content mistakes surface in
 * tests rather than silently doing nothing.
 */
export function applyEffect(
  state: GameState,
  effect: Effect,
  bindings: Record<string, string> = {},
): GameState {
  const delta = effect.delta ?? 0;
  switch (effect.target) {
    case 'stat': {
      const c = requireCharacter(state, effect);
      return { ...state, character: { ...c, stats: applyStat(c.stats, effect.key as StatKey, delta) } };
    }
    case 'reputation': {
      const c = requireCharacter(state, effect);
      return {
        ...state,
        character: { ...c, reputation: applyReputation(c.reputation, effect.key as ConstituencyKey, delta) },
      };
    }
    case 'relationship': {
      const npc = resolveSelector(state, bindings[effect.key] ?? effect.key);
      if (!npc) return state; // the person may be gone; content must tolerate that
      return {
        ...state,
        npcs: { ...state.npcs, [npc.id]: { ...npc, relationship: clampSigned(npc.relationship + delta) } },
      };
    }
    case 'flag': {
      const current = state.flags[effect.key];
      const next =
        effect.value !== undefined
          ? effect.value
          : typeof current === 'number'
            ? current + delta
            : delta !== 0
              ? delta
              : true;
      return { ...state, flags: { ...state.flags, [effect.key]: next } };
    }
    case 'pillar': {
      if (!state.seminary) throw new EffectError('pillar effect outside seminary');
      const key = effect.key as Pillar;
      return {
        ...state,
        seminary: {
          ...state.seminary,
          pillarScores: { ...state.seminary.pillarScores, [key]: state.seminary.pillarScores[key] + delta },
        },
      };
    }
    case 'alignment': {
      const c = requireCharacter(state, effect);
      return { ...state, character: { ...c, alignment: clampSigned(c.alignment + delta) } };
    }
    case 'outspokenness': {
      const c = requireCharacter(state, effect);
      return { ...state, character: { ...c, outspokenness: Math.min(100, Math.max(0, c.outspokenness + delta)) } };
    }
    case 'honesty': {
      const c = requireCharacter(state, effect);
      return { ...state, character: { ...c, honesty: Math.max(0, c.honesty + delta) } };
    }
    case 'credential': {
      const c = requireCharacter(state, effect);
      if (c.credentials.includes(effect.key)) return state;
      return { ...state, character: { ...c, credentials: [...c.credentials, effect.key] } };
    }
    case 'trait': {
      const c = requireCharacter(state, effect);
      if (c.traits.includes(effect.key)) return state;
      return { ...state, character: { ...c, traits: [...c.traits, effect.key] } };
    }
    case 'archetype': {
      const c = requireCharacter(state, effect);
      const key = effect.key as Archetype;
      return {
        ...state,
        character: { ...c, archetypeLeaning: { ...c.archetypeLeaning, [key]: c.archetypeLeaning[key] + delta } },
      };
    }
    case 'concern': {
      if (!state.seminary) throw new EffectError('concern effect outside seminary');
      if (state.seminary.concerns.includes(effect.key)) return state;
      return { ...state, seminary: { ...state.seminary, concerns: [...state.seminary.concerns, effect.key] } };
    }
    case 'risk': {
      const c = requireCharacter(state, effect);
      if (c.latentRisks.some((r) => r.id === effect.key)) return state;
      const severity = Math.min(3, Math.max(1, delta || 1)) as 1 | 2 | 3;
      return {
        ...state,
        character: {
          ...c,
          latentRisks: [...c.latentRisks, { id: effect.key, label: String(effect.value ?? effect.key), severity }],
        },
      };
    }
    case 'npc': {
      const npc = resolveSelector(state, bindings[effect.key] ?? effect.key);
      if (!npc) return state;
      return { ...state, npcs: { ...state.npcs, [npc.id]: { ...npc, status: effect.value as NpcStatus } } };
    }
    case 'end':
      return {
        ...state,
        speed: 'PAUSED',
        mode: { kind: 'ended', ending: effect.key as Ending, summary: String(effect.value ?? '') },
      };
    case 'thread':
    case 'position':
      // Handled by applyChoice via opensThread / resolvesThread / volume.
      return state;
    case 'group':
    case 'money':
    case 'ap':
      throw new EffectError(`${effect.target} effects are not implemented yet`);
  }
}

export function applyEffects(state: GameState, effects: Effect[], bindings: Record<string, string> = {}): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, bindings), state);
}
