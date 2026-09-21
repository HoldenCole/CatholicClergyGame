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
 *   @director                                     the standing spiritual director (DESIGN §9.4)
 *   @diverged_classmate                           the man who left formation for an order
 *   @religious                                    a random religious of the diocese
 *   @principal                                    the sister who runs the parish school
 *   @dominican @franciscan @augustinian           a random man of that institute in the diocese (DESIGN §9.4b)
 *   @dominican_lector, @franciscan_kitchen, ...   the man of that institute with that role (religious:<role>)
 */
const ORDER_SELECTOR = /^(dominican|franciscan|augustinian)(?:_([a-z_]+))?$/;
export function isSelector(key: string): boolean {
  return key.startsWith('@');
}

/**
 * A person tagged with a diocese belongs to it; with the whole province's
 * territory in one save, a selector for the bishop or a brother priest
 * means the ones where he is now. Untagged people belong to every world.
 */
export function inDiocese(state: GameState, npc: Npc): boolean {
  const here = state.world?.diocese.presetId;
  const tag = npc.tags.find((t) => t.startsWith('diocese:'));
  return !tag || !here || tag === `diocese:${here}`;
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
      // Without dice (an eligibility check), any classmate stands in; the roll happens when the letter is written.
      return classmates.length ? (rng ? rng.pick(classmates) : classmates[0]!) : null;
    case 'director': {
      const id = state.character?.direction?.npcId;
      const npc = id ? state.npcs[id] : undefined;
      if (npc && npc.status === 'active') return npc;
      return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes('spiritual_director') && inDiocese(state, n)) ?? null;
    }
    case 'diverged_classmate': {
      const gone = Object.values(state.npcs).filter((n) => n.status === 'active' && n.tags.includes('diverged')).sort((a, b) => (a.id < b.id ? -1 : 1));
      return gone.length ? (rng ? rng.pick(gone) : gone[0]!) : null;
    }
    case 'religious': {
      const all = Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'religious' && !n.tags.includes('diverged') && inDiocese(state, n)).sort((a, b) => (a.id < b.id ? -1 : 1));
      return all.length ? (rng ? rng.pick(all) : all[0]!) : null;
    }
    case 'principal':
      return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes('religious:principal') && inDiocese(state, n)) ?? null;
    // The religious campaign's people: the men of his house and his province. E3 §3.
    case 'prior': {
      const house = state.religious?.houseId ? state.orderHouses?.[state.religious.houseId] : undefined;
      const npc = house ? state.npcs[house.priorId] : undefined;
      return npc && npc.status === 'active' ? npc : null;
    }
    case 'provincial': {
      const npc = state.province ? state.npcs[state.province.provincialId] : undefined;
      return npc && npc.status === 'active' ? npc : null;
    }
    case 'novice_master':
    case 'master_of_students': {
      const tagged = Object.values(state.npcs).filter((n) => n.status === 'active' && n.tags.includes(name)).sort((a, b) => (a.id < b.id ? -1 : 1));
      return tagged[0] ?? null;
    }
    case 'confrere': {
      const house = state.religious?.houseId ? state.orderHouses?.[state.religious.houseId] : undefined;
      const men = (house?.memberIds ?? []).map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active' && n.id !== house?.priorId).sort((a, b) => (a.id < b.id ? -1 : 1));
      return men.length ? (rng ? rng.pick(men) : men[0]!) : null;
    }
    case 'old_friar': {
      const house = state.religious?.houseId ? state.orderHouses?.[state.religious.houseId] : undefined;
      const men = (house?.memberIds ?? []).map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active').sort((a, b) => a.birthYear - b.birthYear || (a.id < b.id ? -1 : 1));
      return men[0] ?? null;
    }
    case 'resident': {
      const id = state.parish?.resident?.npcId;
      const npc = id ? state.npcs[id] : undefined;
      return npc ?? null;
    }
    case 'pastor': {
      const pid = state.assignment?.parishId;
      return pid ? (Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${pid}`)) ?? null) : null;
    }
    case 'bonded_parishioner': {
      const pid = state.assignment?.parishId;
      const lay = pid ? Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'lay' && n.tags.includes(`parish:${pid}`) && (n.bonds?.length ?? 0) > 0 && inDiocese(state, n)) : [];
      const sorted = lay.sort((a, b) => (a.id < b.id ? -1 : 1));
      return sorted.length && rng ? rng.pick(sorted) : (sorted[0] ?? null);
    }
    case 'parishioner': {
      const pid = state.assignment?.parishId;
      const lay = pid ? Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'lay' && n.tags.includes(`parish:${pid}`) && inDiocese(state, n)) : [];
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
    case 'dean': {
      const id = (state.parish?.deanery ?? state.religious?.deanery)?.deanId;
      const dean = id ? state.npcs[id] : undefined;
      return dean && dean.status === 'active' ? dean : resolveSelector(state, '@brother_priest', rng);
    }
    case 'deanery_priest': {
      const ids = (state.parish?.deanery ?? state.religious?.deanery)?.priestIds ?? [];
      const priests = ids.map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active').sort((a, b) => (a.id < b.id ? -1 : 1));
      if (!priests.length) return resolveSelector(state, '@brother_priest', rng);
      return rng ? rng.pick(priests) : priests[0]!;
    }
    case 'brother_priest': {
      const pid = state.assignment?.parishId;
      const priests = Object.values(state.npcs)
        .filter((n) => n.status === 'active' && n.role === 'priest' && !n.tags.includes(`pastor:${pid}`) && inDiocese(state, n))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      return priests.length && rng ? rng.pick(priests) : (priests[0] ?? null);
    }
    default: {
      const m = /^classmate:(\d+)$/.exec(name);
      if (m) return classmates[Number(m[1])] ?? null;
      const o = ORDER_SELECTOR.exec(name);
      if (o) {
        const institute = `inst_${o[1]}s`;
        const role = o[2] ? `religious:${o[2]}` : undefined;
        const men = Object.values(state.npcs)
          .filter((n) => n.status === 'active' && n.role === 'religious' && n.institute === institute && (!role || n.tags.includes(role)) && inDiocese(state, n))
          .sort((a, b) => (a.id < b.id ? -1 : 1));
        return men.length ? (rng && !role ? rng.pick(men) : men[0]!) : null;
      }
      const pid = state.assignment?.parishId;
      // Parish staff are tagged with both their job and their parish.
      if (pid && ['secretary', 'dre', 'music_director', 'maintenance', 'seminarian', 'deacon'].includes(name)) {
        return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(name) && n.tags.includes(`parish:${pid}`)) ?? null;
      }
      return Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(name) && inDiocese(state, n)) ?? null;
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
