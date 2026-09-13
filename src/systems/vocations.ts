import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { finishNpc, rollAlignment, rollBaseStats } from '@/generation/npc';
import { eraForBirthYear, rollMaleName, rollHeritage, CLERGY_HERITAGE } from '@/generation/names';
import { applyEffects } from '@/engine/effects';
import { planWeek } from './week';

/**
 * The young men of the parish who might be called. Time spent with them
 * shows up years later as a seminarian sent back to you. Requested in
 * playtesting; numbers invented.
 */
export const VOCATIONS = {
  ages: [16, 24] as const,
  /** Interest gained per block of the week spent on them, and lost a week without. */
  perAp: 4,
  decay: 0.35,
  /** The vocations office makes the work pay more. */
  officeFactor: 1.5,
  /** He starts asking, and he is ready to go. */
  asking: 45,
  ready: 80,
} as const;

export function prospectsOf(state: GameState): { npc: Npc; interest: number; since: number }[] {
  return (state.parish?.vocations ?? [])
    .map((v) => ({ npc: state.npcs[v.npcId]!, interest: v.interest, since: v.since }))
    .filter((v) => v.npc && v.npc.status === 'active');
}

/** A young man of the parish, rolled. */
function prospect(state: GameState, rng: Rng, pid: string, i: number): Npc {
  const year = dateOf(state.clock).year;
  const age = rng.int(VOCATIONS.ages[0], VOCATIONS.ages[1]);
  const birthYear = year - age;
  const parish = state.world?.parishes.find((p) => p.id === pid);
  const heritage = rollHeritage(rng, { ...CLERGY_HERITAGE, ...(parish?.ethnic.latino && parish.ethnic.latino > 0.3 ? { mexican: 3, central_american: 2 } : {}) });
  return finishNpc(rng, {
    id: `prospect_${pid}_${state.clock.week}_${i}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'lay',
    title: '',
    birthYear,
    origin: parish?.terrain === 'latino' ? 'latino_immigrant' : parish?.terrain === 'rural' ? 'rural' : parish?.terrain === 'suburban' ? 'suburban' : 'urban_ethnic',
    stats: rollBaseStats(rng, 15, 45),
    tags: ['parishioner', 'prospect', `parish:${pid}`],
    alignment: rollAlignment(rng, (parish?.alignment ?? 0) * 0.5, 30),
    relationship: rng.int(0, 12),
  });
}

/** The parish's prospects, rolled once: one or two, more in a big parish. */
export function seedProspects(state: GameState, rng: Rng): GameState {
  const pid = state.assignment?.parishId;
  if (!pid || !state.parish || state.parish.vocations) return state;
  const parish = state.world?.parishes.find((p) => p.id === pid);
  const n = 1 + (parish && parish.households >= 800 ? 1 : 0) + (rng.chance(0.4) ? 1 : 0);
  const npcs = { ...state.npcs };
  const vocations = [];
  for (let i = 0; i < n; i++) {
    const npc = prospect(state, rng.derive(`prospect:${i}`), pid, i);
    npcs[npc.id] = npc;
    vocations.push({ npcId: npc.id, interest: rng.int(5, 25), since: state.clock.week });
  }
  return { ...state, npcs, parish: { ...state.parish, vocations } };
}

/** The week: the hours build interest, the flags follow it, and in June a ready man goes. */
export function vocationsWeek(state: GameState, rng: Rng): { state: GameState; line: string | null; entered: Npc | null } {
  if (!state.parish || !state.assignment || state.away) return { state, line: null, entered: null };
  let next = seedProspects(state, rng.derive('seed'));
  const plan = planWeek(next);
  const ap = plan.discretionary.vocations ?? 0;
  const factor = next.flags['office:vocations'] ? VOCATIONS.officeFactor : 1;
  const vocations = (next.parish!.vocations ?? []).map((v) => ({ ...v, interest: Math.max(0, Math.min(100, v.interest + ap * VOCATIONS.perAp * factor - VOCATIONS.decay)) }));
  next = { ...next, parish: { ...next.parish!, vocations } };
  const live = prospectsOf(next);
  const flags: GameState['flags'] = { ...next.flags };
  const asking = live.some((v) => v.interest >= VOCATIONS.asking);
  const ready = live.some((v) => v.interest >= VOCATIONS.ready);
  if (asking) flags['vocation:asking'] = true; else delete flags['vocation:asking'];
  if (ready) flags['vocation:ready'] = true; else delete flags['vocation:ready'];
  next = { ...next, flags };
  const date = dateOf(next.clock);
  if (ready && date.month === 6 && date.day <= 7) {
    const going = live.filter((v) => v.interest >= VOCATIONS.ready).sort((a, b) => b.interest - a.interest)[0]!;
    const npc = going.npc;
    const pid = next.assignment!.parishId;
    const sent = { ...npc, tags: [...npc.tags.filter((t) => t !== 'prospect'), 'seminarian', 'from_parish'] };
    next = {
      ...next,
      npcs: { ...next.npcs, [npc.id]: sent },
      parish: { ...next.parish!, vocations: vocations.filter((v) => v.npcId !== npc.id) },
      flags: { ...next.flags, 'vocation:entered': Number(next.flags['vocation:entered'] ?? 0) + 1, [`vocation:sent:${pid}`]: true },
      career: [...next.career, { week: next.clock.week, kind: 'note', text: `${npc.name.first} ${npc.name.last} of the parish entered the seminary.` }],
    };
    next = applyEffects(next, [{ target: 'reputation', key: 'chancery', delta: 4 }, { target: 'reputation', key: 'parishioners', delta: 3 }, { target: 'reputation', key: 'brother_priests', delta: 2 }], {}, 'a vocation from the parish');
    return { state: next, line: `${npc.name.first} ${npc.name.last} is going to the seminary in August. His mother told the whole church at the door, and the church clapped, which it does not do.`, entered: sent };
  }
  return { state: next, line: null, entered: null };
}
