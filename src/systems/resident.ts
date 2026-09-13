import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from '@/generation/npc';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { noteMover } from './movers';

/**
 * A retired priest in residence: help at the altar, opinions at dinner,
 * and an arc that ends in a funeral. Requested in playtesting; numbers invented.
 */
export const RESIDENT = {
  ages: [74, 86] as const,
  /** Blocks of the week he gives back while he is well enough. */
  relief: 0.5,
  wellEnough: 35,
  /** Health lost a week, on average, and the roll around it. */
  decline: 0.18,
  declineSpread: 0.25,
  /** Once frail, the chance each week that the end comes. */
  deathChanceFrail: 0.015,
  /** What the parish thinks of a pastor who keeps the old man, per week, when they get on. */
  parishionersPerWeek: 0.06,
  /** Relationship drift a week from the gap in their alignments. */
  frictionGap: 40,
  frictionPerWeek: -0.15,
  warmthPerWeek: 0.08,
} as const;

export function residentOf(state: GameState): Npc | undefined {
  const id = state.parish?.resident?.npcId;
  const npc = id ? state.npcs[id] : undefined;
  return npc && npc.status === 'active' ? npc : undefined;
}

export function residentRelief(state: GameState): number {
  const r = state.parish?.resident;
  return r && residentOf(state) && r.health >= RESIDENT.wellEnough ? RESIDENT.relief : 0;
}

export function residentHealthWord(health: number): string {
  return health >= 70 ? 'well, for his years' : health >= RESIDENT.wellEnough ? 'slowing down' : health > 12 ? 'frail' : 'failing';
}

function calendarYear(state: GameState): number {
  return dateOf(state.clock).year;
}

/** The vicar for clergy's man moves in: rolled, not picked. */
export function residentArrives(state: GameState, rng: Rng): GameState {
  const pid = state.assignment?.parishId;
  if (!pid || !state.parish) return state;
  const year = calendarYear(state);
  const age = rng.int(RESIDENT.ages[0], RESIDENT.ages[1]);
  const birthYear = year - age;
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const npc = finishNpc(rng, {
    id: `resident_${pid}_${state.clock.week}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'priest',
    title: rng.chance(0.35) ? 'Msgr.' : 'Fr.',
    birthYear,
    origin: rng.pick(['urban_ethnic', 'rural', 'suburban'] as const),
    stats: addStats(rollBaseStats(rng, 30, 65), { piety: 10, theology: 5 }),
    tags: ['resident', 'retired_pastor', `parish:${pid}`],
    alignment: rollAlignment(rng, (state.world?.diocese.visible.disposition ?? 0) * 0.3, 35),
    relationship: rng.int(5, 20),
  });
  const flags: GameState['flags'] = { ...state.flags, 'resident:here': true };
  delete flags['resident:pending'];
  return {
    ...state,
    npcs: { ...state.npcs, [npc.id]: { ...npc, status: 'active' } },
    parish: { ...state.parish, resident: { npcId: npc.id, arrivedWeek: state.clock.week, health: rng.int(55, 90) } },
    flags,
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `${npc.title} ${npc.name.first} ${npc.name.last}, ${age}, retired, moved into the rectory.` }],
  };
}

/** One week with the old man in the house: help, warmth or friction, and the years. */
export function residentWeek(state: GameState, rng: Rng): { state: GameState; line: string | null; died: boolean } {
  let next = state;
  if (state.flags['resident:pending'] && !residentOf(state) && state.parish) {
    next = residentArrives(state, rng.derive('arrives'));
    const npc = residentOf(next)!;
    return { state: next, line: `${npc.title} ${npc.name.first} ${npc.name.last}, retired after forty years of parishes, moved into the room at the top of the stairs with two suitcases and a chalice. He asked for nothing but the seven o'clock Mass.`, died: false };
  }
  const npc = residentOf(next);
  const r = next.parish?.resident;
  if (!npc || !r || !next.parish) return { state: next, line: null, died: false };
  const c = next.character!;
  const health = Math.max(0, r.health - RESIDENT.decline - rng.float(-RESIDENT.declineSpread, RESIDENT.declineSpread));
  const gap = Math.abs(npc.alignment - c.alignment);
  const drift = gap > RESIDENT.frictionGap ? RESIDENT.frictionPerWeek : RESIDENT.warmthPerWeek;
  const relationship = Math.max(-100, Math.min(100, npc.relationship + drift));
  next = { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, relationship } }, parish: { ...next.parish, resident: { ...r, health } } };
  if (relationship >= 0 && health >= RESIDENT.wellEnough) {
    const rep = next.character!.reputation;
    next = noteMover({ ...next, character: { ...next.character!, reputation: { ...rep, parishioners: Math.min(100, rep.parishioners + RESIDENT.parishionersPerWeek) } } }, 'parishioners', RESIDENT.parishionersPerWeek, 'the old priest in the rectory');
  }
  let line: string | null = null;
  const flags = { ...next.flags };
  if (health < RESIDENT.wellEnough && !flags['resident:frail']) {
    flags['resident:frail'] = true;
    line = `${npc.title} ${npc.name.last} did not come down for the seven o'clock. He is in his room, and he does not want the doctor, and he is going to get the doctor.`;
  }
  const dies = health <= 0 || (health < RESIDENT.wellEnough && rng.chance(RESIDENT.deathChanceFrail));
  if (dies) {
    delete flags['resident:here'];
    delete flags['resident:frail'];
    flags['resident:died'] = true;
    next = {
      ...next,
      flags,
      npcs: { ...next.npcs, [npc.id]: { ...next.npcs[npc.id]!, status: 'dead' } },
      parish: { ...next.parish!, resident: null },
      career: [...next.career, { week: next.clock.week, kind: 'note', text: `${npc.title} ${npc.name.first} ${npc.name.last} died in the rectory, ${calendarYear(next) - npc.birthYear}.` }],
    };
    return { state: next, line: `${npc.title} ${npc.name.first} ${npc.name.last} died in the night, in the room at the top of the stairs. The sacristan found the seven o'clock vestments laid out.`, died: true };
  }
  return { state: { ...next, flags }, line, died: false };
}
