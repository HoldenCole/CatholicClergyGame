import { frictionOf, leanOf, selectedOf } from '@/systems/liturgy';
import type { Condition, GameState } from '@/types';
import { dateOf, seasonOf } from './time';
import { feastsOfWeek, type FeastKey } from './feasts';
import { resolveSelector } from './selectors';

import type { Group } from '@/types';
import { vitalityBand } from '@/systems/groups';
import { currentDecor } from '@/systems/decorState';
import { isFigure } from '@/systems/reputation';
import { obligationDefs } from '@/content/parish';
import type { ObligationKey, Quality } from '@/types';

function compare(op: '>=' | '<=', actual: number, value: number): boolean {
  return op === '>=' ? actual >= value : actual <= value;
}

export function groupMatches(g: Group, key: 'type' | 'vitality' | 'hostile' | 'suppressed' | 'foundedByPlayer' | 'agenda', value: string | boolean): boolean {
  if (key === 'vitality') return vitalityBand(g.vitality) === value;
  return g[key] === value;
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
    case 'parish': {
      const parish = state.world && state.assignment ? state.world.parishes.find((p) => p.id === state.assignment!.parishId) : undefined;
      if (!parish) return false;
      return parish[cond.key] === cond.value;
    }
    case 'role':
      return state.assignment?.role === cond.value;
    case 'years_ordained': {
      const at = state.flags.ordination_week;
      if (typeof at !== 'number') return false;
      return compare(cond.op, (state.clock.week - at) / 52, cond.value);
    }
    case 'weeks_served':
      return !!state.parish && compare(cond.op, state.parish.weeksServed, cond.value);
    case 'age': {
      const c = state.character;
      if (!c) return false;
      const year = new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
      return compare(cond.op, year - (c.entryYear - c.background.entryAge), cond.value);
    }
    case 'liturgy': {
      const parish = state.world && state.assignment ? state.world.parishes.find((p) => p.id === state.assignment!.parishId) : undefined;
      if (!parish?.liturgy) return false;
      if (cond.key === 'changes') return compare(cond.op ?? '>=', Object.keys(parish.liturgyChanged ?? {}).length, cond.amount ?? 1);
      if (cond.key === 'friction') return compare(cond.op ?? '>=', frictionOf(parish), cond.amount ?? 0.3);
      if (cond.key === 'lean') return compare(cond.op ?? '>=', leanOf(parish), cond.amount ?? 0);
      if (cond.key === 'fresh') return compare(cond.op ?? '>=', Object.values(parish.liturgyChanged ?? {}).filter((w) => state.clock.week - w < 26).length, cond.amount ?? 1);
      return selectedOf(parish, cond.key).includes(String(cond.value));
    }
    case 'bond': {
      const pid = state.assignment?.parishId;
      if (!pid) return false;
      const n = Object.values(state.npcs).filter((x) => x.tags.includes(`parish:${pid}`)).reduce((sum, x) => sum + (x.bonds ?? []).filter((b) => cond.kind === 'any' || b.kind === cond.kind).length, 0);
      return compare(cond.op, n, cond.value);
    }
    case 'see': {
      const see = state.see;
      if (!see) return false;
      const v = cond.key === 'years' ? (state.clock.week - see.installedWeek) / 52 : see[cond.key];
      return compare(cond.op, v, cond.value);
    }
    case 'arc_weeks_left':
      return !!state.parish && compare(cond.op, state.parish.arcEndWeek - state.clock.week, cond.value);
    case 'bishop_alignment':
      return !!state.world && compare(cond.op, state.world.diocese.hidden.bishop.alignment, cond.value);
    case 'decor':
      return currentDecor(state, cond.place)[cond.slot] === cond.value;
    case 'position': {
      if (!c) return false;
      return c.positions.some((p) => p.volume !== 'private' && (cond.topic === 'any' || p.topic === cond.topic) && compare(cond.op, p.value, cond.value));
    }
    case 'routine': {
      const routine = state.parish?.routine;
      if (!routine) return false;
      const obligation = obligationDefs.find((o) => o.key === cond.key);
      const hours = obligation
        ? (obligation.ap[(routine.obligations as Record<ObligationKey, Quality>)[obligation.key] ?? 'standard'] ?? 0)
        : (routine.discretionary[cond.key] ?? 0);
      return compare(cond.op, hours, cond.value);
    }
    case 'figure':
      return !!c && isFigure(c);
    case 'strain':
      return compare(cond.op, state.strain ?? 0, cond.value);
    case 'bishop': {
      const b = state.world?.diocese.hidden.bishop;
      if (!b) return false;
      switch (cond.key) {
        case 'management': return b.management === cond.value;
        case 'priority': return b.priorities.includes(cond.value as (typeof b.priorities)[number]);
        case 'rewards': return b.rewards === cond.value;
        case 'cannotTolerate': return b.cannotTolerate === cond.value;
        case 'stance': return b.liturgy[cond.topic] === cond.value;
      }
      return false;
    }
    case 'group': {
      // Bound group first; otherwise any group of the current parish.
      const boundLeader = bindings['@group_leader'];
      const bound = boundLeader ? Object.values(state.groups).find((g) => g.leaderId === boundLeader) : undefined;
      const pool = bound ? [bound] : Object.values(state.groups).filter((g) => g.parishId === state.assignment?.parishId);
      return pool.some((g) => groupMatches(g, cond.key, cond.value));
    }
    case 'feast': {
      const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
      return feastsOfWeek(state.clock, parish).includes(cond.key as FeastKey);
    }
    case 'ethnic': {
      const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
      return !!parish && compare(cond.op, parish.ethnic[cond.key] ?? 0, cond.value);
    }
    case 'homily':
      return state.parish?.homily?.topic === cond.value;
    case 'calendar_year':
      return compare(cond.op, dateOf(state.clock).year, cond.value);
    case 'month':
      return compare(cond.op, dateOf(state.clock).month, cond.value);
    case 'diocese': {
      const id = state.world?.diocese.presetId;
      return !!id && (Array.isArray(cond.value) ? cond.value.includes(id) : cond.value === id);
    }
    case 'confessor':
      return compare(cond.op, state.character?.confessor ?? 0, cond.value);
    case 'house': {
      const houses = state.world?.diocese.visible.houses ?? [];
      return houses.some((h) => !cond.charism || h.charism === cond.charism) === cond.value;
    }
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
