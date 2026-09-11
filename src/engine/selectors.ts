import type { GameState, Npc } from '@/types';
import type { Rng } from './rng';

/**
 * Authored content cannot name generated NPCs, so it refers to them by
 * selector. Selectors beginning with "@" resolve against the current state;
 * anything else is taken as a literal npc id.
 *
 *   @rector, @spiritual_director, @mother, ...   the active NPC with that tag
 *   @closest_classmate                            highest relationship
 *   @rival_classmate                              lowest relationship
 *   @random_classmate                             rolled once when the event fires
 *   @classmate:<n>                                the n-th classmate by id order
 *   @pastor                                       pastor of the current parish
 *   @secretary @dre @music_director @maintenance  parish staff by tag
 *   @parishioner                                  a random lay NPC of the current parish
 *   @bonded_parishioner                           one of them the priest has already done something for
 *   @brother_priest                               a random active priest of the diocese, not the pastor
 *   @vicar_general @chancellor @vicar_for_clergy  chancery officials by office tag
 */
export function isSelector(key: string): boolean {
  return key.startsWith('@');
}

function activeClassmates(state: GameState): Npc[] {
  return Object.values(state.npcs)
    .filter((n) => n.role === 'classmate' && n.status === 'active')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function resolveSelector(state: GameState, key: string, rng?: Rng): Npc | null {
  if (!isSelector(key)) return state.npcs[key] ?? null;
  const name = key.slice(1);
  const classmates = activeClassmates(state);
  switch (name) {
    case 'closest_classmate':
      return classmates.reduce<Npc | null>((best, n) => (!best || n.relationship > best.relationship ? n : best), null);
    case 'rival_classmate':
      return classmates.reduce<Npc | null>((best, n) => (!best || n.relationship < best.relationship ? n : best), null);
    case 'random_classmate':
      return classmates.length && rng ? rng.pick(classmates) : null;
    case 'pastor': {
      const pid = state.assignment?.parishId;
      return pid ? (Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${pid}`)) ?? null) : null;
    }
    case 'bonded_parishioner': {
      const pid = state.assignment?.parishId;
      const lay = pid ? Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'lay' && n.tags.includes(`parish:${pid}`) && (n.bonds?.length ?? 0) > 0) : [];
      const sorted = lay.sort((a, b) => (a.id < b.id ? -1 : 1));
      return sorted.length && rng ? rng.pick(sorted) : (sorted[0] ?? null);
    }
    case 'parishioner': {
      const pid = state.assignment?.parishId;
      const lay = pid ? Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'lay' && n.tags.includes(`parish:${pid}`)) : [];
      return lay.length && rng ? rng.pick(lay.sort((a, b) => (a.id < b.id ? -1 : 1))) : (lay[0] ?? null);
    }
    case 'group_leader': {
      const pid = state.assignment?.parishId;
      const leaders = Object.values(state.groups)
        .filter((g) => g.parishId === pid)
        .map((g) => state.npcs[g.leaderId])
        .filter((n): n is Npc => !!n && n.status === 'active')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      return leaders.length && rng ? rng.pick(leaders) : (leaders[0] ?? null);
    }
    case 'brother_priest': {
      const pid = state.assignment?.parishId;
      const priests = Object.values(state.npcs)
        .filter((n) => n.status === 'active' && n.role === 'priest' && !n.tags.includes(`pastor:${pid}`))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      return priests.length && rng ? rng.pick(priests) : (priests[0] ?? null);
    }
    default: {
      const m = /^classmate:(\d+)$/.exec(name);
      if (m) return classmates[Number(m[1])] ?? null;
      const pid = state.assignment?.parishId;
      // Parish staff are tagged with both their job and their parish.
      if (pid && ['secretary', 'dre', 'music_director', 'maintenance'].includes(name)) {
        return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(name) && n.tags.includes(`parish:${pid}`)) ?? null;
      }
      return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(name)) ?? null;
    }
  }
}

/** Every selector mentioned anywhere in a piece of text or a set of keys. */
export function selectorsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{(@?[a-z_:0-9]+)\}/g)) {
    const token = m[1] as string;
    if (token.startsWith('@')) out.add(token);
  }
  return [...out];
}
