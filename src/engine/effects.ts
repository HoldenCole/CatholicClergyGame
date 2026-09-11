import type { Bond } from '@/types';
import type {
  Archetype,
  ConstituencyKey,
  DecorPlace,
  DecorSlot,
  Effect,
  Ending,
  GameState,
  LiturgicalTopic,
  NpcStatus,
  Pillar,
  StatKey,
} from '@/types';
import { currentDecor, placeKey } from '@/systems/decorState';
import { applyReputation, clampSigned } from '@/systems/reputation';
import { applyStat } from '@/systems/stats';
import { closeTenure } from '@/systems/tenures';
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
        ...closeTenure(state, effect.key === 'left_priesthood' ? 'left the priesthood' : effect.key.replace(/_/g, ' ')),
        speed: 'PAUSED',
        mode: { kind: 'ended', ending: effect.key as Ending, summary: String(effect.value ?? '') },
      };
    case 'decor': {
      const [place, slot] = effect.key.split(':') as [DecorPlace, DecorSlot];
      if (!place || !slot || typeof effect.value !== 'string') throw new EffectError(`decor effect needs "<place>:<slot>" and an option id`);
      const key = placeKey(state, place);
      return { ...state, decor: { ...state.decor, [key]: { ...currentDecor(state, place), [slot]: effect.value } } };
    }
    case 'permission': {
      const status = effect.value === 'granted' ? 'granted' : 'denied';
      const topic = effect.key as LiturgicalTopic;
      const bishopId = state.world?.diocese.hidden.bishop.npcId ?? 'bishop';
      const week = state.clock.week;
      return {
        ...state,
        permissions: { ...state.permissions, [topic]: { topic, status, bishopId, askedWeek: state.permissions[topic]?.askedWeek ?? week, answerWeek: week } },
        flags: { ...state.flags, [`permission:${topic}`]: status === 'granted' },
      };
    }
    case 'transfer': {
      // Resolved by the parish week hook next week, so the letter arrives after the scene.
      const role = typeof effect.value === 'string' ? effect.value : (state.assignment?.role ?? 'parochial_vicar');
      return { ...state, flags: { ...state.flags, transfer_pending: `${effect.key}:${role}` } };
    }
    case 'building': {
      const pid = state.parish?.parishId;
      if (!pid || !state.world || effect.delta === undefined) return state;
      const k = effect.key as 'church' | 'rectory' | 'hall' | 'school';
      const parishes = state.world.parishes.map((p) => {
        if (p.id !== pid) return p;
        const current = p.buildings[k];
        if (current === null || current === undefined) return p;
        return { ...p, buildings: { ...p.buildings, [k]: Math.max(0, Math.min(100, current + effect.delta!)) } };
      });
      return { ...state, world: { ...state.world, parishes } };
    }
    case 'club': {
      // Joining needs a die for the fellows; the hook resolves it next week from this flag.
      const verb = effect.value === 'leave' ? 'leave' : 'join';
      return { ...state, flags: { ...state.flags, [`club_pending:${effect.key}`]: verb } };
    }
    case 'bond': {
      const npc = resolveSelector(state, bindings[effect.key] ?? effect.key);
      if (!npc || typeof effect.value !== 'string') return state;
      const [kind, who] = effect.value.split(':') as [Bond['kind'], string | undefined];
      const bond: Bond = { kind, week: state.clock.week, who: who ?? 'them' };
      return { ...state, npcs: { ...state.npcs, [npc.id]: { ...npc, bonds: [...(npc.bonds ?? []), bond], relationship: Math.max(-100, Math.min(100, npc.relationship + (kind === 'quarreled' ? -6 : 4))) } } };
    }
    case 'trait_known': {
      const npc = resolveSelector(state, bindings[effect.key] ?? effect.key);
      if (!npc) return state;
      return { ...state, npcs: { ...state.npcs, [npc.id]: { ...npc, traitKnown: true } } };
    }
    case 'thread':
    case 'position':
      // Handled by applyChoice via opensThread / resolvesThread / volume.
      return state;
    default:
      throw new EffectError(`unknown effect target ${String((effect as { target: string }).target)}`);
    case 'money': {
      if (!state.parish) return state;
      return { ...state, parish: { ...state.parish, finance: { ...state.parish.finance, cash: state.parish.finance.cash + delta } } };
    }
    case 'ap': {
      if (!state.parish) return state;
      return { ...state, parish: { ...state.parish, apNextWeek: state.parish.apNextWeek + delta } };
    }
    case 'group': {
      const leader = bindings['@group_leader'];
      const group = Object.values(state.groups).find((g) => g.leaderId === leader);
      if (!group) return state;
      const groups = { ...state.groups };
      switch (effect.key) {
        case 'vitality':
          groups[group.id] = { ...group, vitality: Math.max(0, Math.min(100, group.vitality + delta)) };
          break;
        case 'size':
          groups[group.id] = { ...group, size: Math.max(0, group.size + delta) };
          break;
        case 'hostile':
          groups[group.id] = { ...group, hostile: effect.value !== false };
          break;
        case 'suppressed':
          groups[group.id] = { ...group, suppressed: effect.value !== false };
          break;
        case 'dissolve':
          delete groups[group.id];
          break;
        default:
          throw new EffectError(`unknown group effect key ${effect.key}`);
      }
      return { ...state, groups };
    }
  }
}

export function applyEffects(state: GameState, effects: Effect[], bindings: Record<string, string> = {}): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, bindings), state);
}
