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
    default: {
      const m = /^classmate:(\d+)$/.exec(name);
      if (m) return classmates[Number(m[1])] ?? null;
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
