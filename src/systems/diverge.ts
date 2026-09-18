import type { Charism, GameState, Institute, Npc } from '@/types';
import { TEMPERAMENTS } from '@/types';
import type { Rng } from '@/engine/rng';
import { instituteDef, instituteDefs } from '@/content/institutes';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { finishNpc, rollBaseStats } from '@/generation/npc';

/**
 * The classmate who becomes a religious. DESIGN.md §6.7.
 *
 * One or two men per cohort discern out of diocesan formation and into an
 * order. They do not leave the game, they diverge: off the ladder permanently,
 * and back years later as a religious with nothing to gain from the player and
 * nothing to lose to him. If the relationship was strong that is a friend with
 * no agenda; if it was competitive the competition simply evaporates, which is
 * its own kind of complicated.
 */
export const DIVERGE = {
  /** Chance per formation year, in the years men actually go. */
  chancePerYear: { 2: 0.3, 3: 0.25, 4: 0.12 } as Record<number, number>,
  /** Men per cohort who may go. */
  max: 2,
  /** The reverse: a man arrives from a novitiate he left, and nobody quite asks why. */
  exNovice: { years: [5, 6], chance: 0.18 },
} as const;

function houseFor(rng: Rng, state: GameState): { id: string; short: string; charism: Charism } {
  const present: Institute[] = state.world?.institutes?.filter((i) => !i.women) ?? [];
  if (present.length && rng.chance(0.6)) {
    const h = rng.pick(present);
    return { id: h.id, short: h.short, charism: h.charism };
  }
  const def = rng.pick(instituteDefs.filter((d) => !d.women));
  return { id: `inst_${def.id}`, short: def.short, charism: def.charism };
}

/** Who is likeliest to go: the prayerful, the unambitious, and the one who was never at home here. */
function weightOf(n: Npc): number {
  return Math.max(0.5, (n.stats.piety ?? 40) / 10 + (100 - n.ambition) / 20 + (n.struggle === 'doubt' ? 3 : 0) + (n.hiddenTrait === 'mystic' ? 6 : 0) + (n.hiddenTrait === 'restless' ? 3 : 0));
}

/**
 * A formation year passes: a man may discern out. He is moved rather than
 * removed, and keeps his record and his regard for the player.
 */
export function divergeStep(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const sem = state.seminary;
  if (!sem) return { state, line: null };
  const already = Object.values(state.npcs).filter((n) => n.tags.includes('diverged')).length;
  const chance = DIVERGE.chancePerYear[sem.year] ?? 0;
  if (already >= DIVERGE.max || chance === 0 || !rng.chance(chance)) return { state, line: null };
  const pool = sem.classmateIds.map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active' && !n.tags.includes('diverged'));
  if (pool.length <= 2) return { state, line: null };
  const man = rng.weighted(pool, weightOf);
  const house = houseFor(rng, state);
  const moved: Npc = {
    ...man,
    role: 'religious',
    institute: house.id,
    charism: house.charism as Charism,
    temperament: rng.pick([...TEMPERAMENTS]),
    tags: [...new Set([...man.tags.filter((t) => t !== 'classmate'), 'religious', 'diverged', `institute:${house.id}`])],
  };
  const warm = man.relationship >= 25;
  return {
    state: {
      ...state,
      npcs: { ...state.npcs, [man.id]: moved },
      seminary: { ...sem, classmateIds: sem.classmateIds.filter((id) => id !== man.id) },
      flags: { ...state.flags, 'classmate:diverged': true, ...(warm ? { 'diverged:friend': true } : { 'diverged:rival': true }) },
      career: [...state.career, { week: state.clock.week, kind: 'note', text: `${man.name.first} ${man.name.last} left formation for ${house.short}.` }],
    },
    line: warm
      ? `${man.name.first} ${man.name.last} is going to ${house.short}. He told you before he told the rector, in the corridor, and asked you not to talk him out of it. You did not try.`
      : `${man.name.first} ${man.name.last} is leaving for ${house.short} at the end of term. He seems lighter about it than you expected, and the race you are both in has one fewer man, which is not the same as winning.`,
  };
}

/** The reverse: a man arrives in Y5 or Y6 from a novitiate he left, carrying a question mark. */
export function exNoviceStep(state: GameState, rng: Rng, entryYear: number): { state: GameState; line: string | null } {
  const sem = state.seminary;
  if (!sem || !(DIVERGE.exNovice.years as readonly number[]).includes(sem.year)) return { state, line: null };
  if (state.flags['classmate:ex_novice'] || !rng.chance(DIVERGE.exNovice.chance)) return { state, line: null };
  const def = rng.pick(instituteDefs.filter((d) => !d.women));
  const birthYear = entryYear - rng.int(25, 33);
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const npc = finishNpc(rng, {
    id: `classmate_ex_novice`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'classmate',
    title: '',
    birthYear,
    origin: 'suburban',
    stats: rollBaseStats(rng, 38, 66),
    relationship: rng.int(-5, 10),
  });
  const man: Npc = { ...npc, tags: [...npc.tags, 'ex_novice', `former:inst_${def.id}`] };
  return {
    state: {
      ...state,
      npcs: { ...state.npcs, [man.id]: man },
      seminary: { ...sem, classmateIds: [...sem.classmateIds, man.id] },
      flags: { ...state.flags, 'classmate:ex_novice': true },
    },
    line: `A man joined the class this term who is two years older than the rest of you and came from ${def.short}. Nobody has asked him why he left, which is itself a kind of answer, and he knows every house of the order in three states.`,
  };
}

/** The institute a diverged man belongs to, in words, for content and the classmates sheet. */
export function divergedLine(state: GameState, npc: Npc): string | null {
  if (!npc.tags.includes('diverged')) return null;
  const def = npc.institute ? instituteDef(npc.institute.replace('inst_', '')) : undefined;
  const years = state.seminary ? 0 : Math.max(0, Math.round((state.clock.week - Number(state.flags.ordination_week ?? 0)) / 52));
  return `${def ? def.short.replace(/^the /, '') : 'a religious'}${years ? `, ${years} years now` : ''}. Nothing to gain from you and nothing to lose to you.`;
}
