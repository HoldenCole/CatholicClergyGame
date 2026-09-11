import type { Bond, BondKind, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';

/**
 * A parish that remembers you. The routine writes bonds on named
 * parishioners: the sacraments happen to people, and the people keep them.
 * Requested in playtesting; numbers invented.
 */
export const BONDS = {
  /** Chance a week, at standard sacramental care, that a named parishioner is on the receiving end of something. */
  chancePerWeek: 0.05,
  /** A person carries at most so many bonds; the rest of the parish gets the next one. */
  perPerson: 5,
  /** Multipliers by the quality of sacramental preparation. */
  byQuality: { min: 0.4, standard: 1, full: 1.6 } as Record<string, number>,
  /** Relationship gained with the person. */
  warmth: 4,
} as const;

/** What a priest does for a person of that age, and for whom. */
function rollBond(rng: Rng, npc: Npc, year: number): Bond | null {
  const age = year - npc.birthYear;
  const woman = npc.name.first.endsWith('a') || npc.name.first.endsWith('e');
  const his = woman ? 'her' : 'his';
  const pool: [BondKind, string, number][] =
    age < 32 ? [['married', 'the two of them', 3], ['baptized', `${his} first child`, 3], ['counseled', woman ? 'her' : 'him', 1]] :
    age < 48 ? [['baptized', `${his} ${rng.chance(0.5) ? 'daughter' : 'son'}`, 3], ['buried', `${his} ${rng.chance(0.5) ? 'father' : 'mother'}`, 2], ['confirmed', `${his} ${rng.chance(0.5) ? 'daughter' : 'son'}`, 2], ['counseled', woman ? 'her' : 'him', 1]] :
    age < 68 ? [['married', `${his} ${rng.chance(0.5) ? 'daughter' : 'son'}`, 3], ['buried', `${his} ${rng.chance(0.5) ? 'mother' : 'brother'}`, 2], ['baptized', `${his} grandchild`, 2], ['anointed', woman ? 'her' : 'him', 1]] :
    [['buried', `${his} ${woman ? 'husband' : 'wife'}`, 3], ['anointed', woman ? 'her' : 'him', 2], ['baptized', `${his} great-grandchild`, 1]];
  const pick = rng.weighted(pool, (p) => p[2]);
  return { kind: pick[0], who: pick[1], week: 0 };
}

const VERB: Record<BondKind, string> = { baptized: 'baptized', married: 'married', buried: 'buried', anointed: 'anointed', confirmed: 'prepared', counseled: 'sat with', helped: 'helped', quarreled: 'quarreled with' };

/** One bond in words: "buried her husband", "married the two of them". */
export function bondWord(b: Bond): string {
  return `${VERB[b.kind]} ${b.who}`;
}

/** A person's bonds in a phrase: "whose daughter you baptized and whose husband you buried". */
export function bondsPhrase(npc: Npc): string {
  const bonds = npc.bonds ?? [];
  if (!bonds.length) return '';
  return bonds.slice(-3).map((b) => (b.kind === 'married' && b.who === 'the two of them' ? 'whom you married' : b.kind === 'anointed' || b.kind === 'counseled' ? `whom you ${VERB[b.kind]}` : `whose ${b.who.replace(/^(his|her|their) /, '')} you ${VERB[b.kind]}`)).join(' and ');
}

/** The named people of the current parish, the ones with a history first. */
export function parishPeople(state: GameState): Npc[] {
  const pid = state.assignment?.parishId;
  if (!pid) return [];
  return Object.values(state.npcs)
    .filter((n) => n.role === 'lay' && n.status === 'active' && n.tags.includes(`parish:${pid}`) && n.tags.includes('parishioner'))
    .sort((a, b) => (b.bonds?.length ?? 0) - (a.bonds?.length ?? 0) || b.relationship - a.relationship);
}

/** Every bond he has with the people of every parish, counted by kind. */
export function bondCounts(state: GameState): Record<BondKind, number> {
  const out: Record<BondKind, number> = { baptized: 0, married: 0, buried: 0, anointed: 0, confirmed: 0, counseled: 0, helped: 0, quarreled: 0 };
  for (const n of Object.values(state.npcs)) for (const b of n.bonds ?? []) out[b.kind] += 1;
  return out;
}

/** The week: at sacramental care, something may happen to someone you know, and the parish keeps it. */
export function bondsWeek(state: GameState, sacramentalQuality: string, rng: Rng): { state: GameState; line: string | null } {
  const people = parishPeople(state);
  if (!people.length) return { state, line: null };
  const chance = BONDS.chancePerWeek * (BONDS.byQuality[sacramentalQuality] ?? 1);
  if (!rng.chance(chance)) return { state, line: null };
  const year = new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
  // The ones with fewer bonds first, so the parish's memory spreads across families.
  const open = people.filter((n) => (n.bonds?.length ?? 0) < BONDS.perPerson);
  if (!open.length) return { state, line: null };
  const least = Math.min(...open.map((n) => n.bonds?.length ?? 0));
  const npc = rng.pick(open.filter((n) => (n.bonds?.length ?? 0) === least));
  const rolled = rollBond(rng, npc, year);
  if (!rolled) return { state, line: null };
  const bond: Bond = { ...rolled, week: state.clock.week };
  const next: GameState = { ...state, npcs: { ...state.npcs, [npc.id]: { ...npc, bonds: [...(npc.bonds ?? []), bond], relationship: Math.min(100, npc.relationship + BONDS.warmth) } } };
  const name = `${npc.name.first} ${npc.name.last}`;
  const line = bond.kind === 'married' && bond.who === 'the two of them' ? `You married ${name}.` : bond.kind === 'anointed' || bond.kind === 'counseled' ? `You ${VERB[bond.kind]} ${name}.` : `You ${VERB[bond.kind]} ${name}'s ${bond.who.replace(/^(his|her|their) /, '')}.`;
  return { state: next, line };
}
