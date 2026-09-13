import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { finishNpc, rollBaseStats, addStats, rollAlignment } from '@/generation/npc';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { applyEffects } from '@/engine/effects';
import { residentRelief } from './resident';

/** Requested in playtesting; numbers invented. */
export const FORMED = {
  /** Weeks a summer seminarian stays. */
  weeks: 10,
  /** The chance a seminarian comes in June: to a pastor, and to a vicar the pastor hands one to. */
  chancePastor: 0.7,
  chanceVicar: 0.4,
  /** Weeks after he leaves before an unwritten evaluation writes itself. */
  evaluationGrace: 4,
  /** Years before a man formed may come back a priest, and the chance each year after. */
  returnYears: 4,
  returnChance: 0.5,
  /** Blocks of the week each of them gives back. */
  seminarianRelief: 1,
  deaconRelief: 0.5,
  vicarRelief: 2,
} as const;

export type Verdict = 'strong' | 'reserved' | 'concerned';

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

function pid(state: GameState): string | undefined {
  return state.assignment?.parishId;
}

export function seminarianOf(state: GameState): Npc | undefined {
  const id = state.parish?.seminarian?.npcId;
  const npc = id ? state.npcs[id] : undefined;
  return npc && npc.status === 'active' ? npc : undefined;
}

export function deaconOf(state: GameState): Npc | undefined {
  const p = pid(state);
  return p ? Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes('deacon') && n.tags.includes(`parish:${p}`)) : undefined;
}

export function returnedVicarOf(state: GameState): Npc | undefined {
  const id = state.parish?.vicarId;
  const npc = id ? state.npcs[id] : undefined;
  return npc && npc.status === 'active' ? npc : undefined;
}

/** Blocks of the week the men around him give back: a seminarian in summer, a deacon, the vicar he formed. */
export function helpRelief(state: GameState): number {
  let relief = 0;
  if (seminarianOf(state) && !state.flags['seminarian:evaluation_due']) relief += FORMED.seminarianRelief;
  if (deaconOf(state)) relief += FORMED.deaconRelief;
  if (returnedVicarOf(state)) relief += FORMED.vicarRelief;
  relief += residentRelief(state);
  return relief;
}

/** The first week of June: a seminarian may come for the summer. */
export function summerSeminarian(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const p = pid(state);
  if (!p || !state.parish || state.parish.seminarian || state.away) return { state, line: null };
  const date = dateOf(state.clock);
  if (date.month !== 6 || date.day > 7) return { state, line: null };
  const chance = state.assignment?.role === 'pastor' ? FORMED.chancePastor : FORMED.chanceVicar;
  if (!rng.chance(chance)) return { state, line: null };
  const year = calendarYear(state);
  const birthYear = year - rng.int(23, 31);
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const npc = finishNpc(rng, {
    id: `seminarian_${p}_${state.clock.week}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'lay',
    title: '',
    birthYear,
    origin: rng.pick(['suburban', 'urban_ethnic', 'rural', 'convert'] as const),
    stats: addStats(rollBaseStats(rng, 25, 55), { theology: 10 }),
    tags: ['seminarian', `parish:${p}`],
    alignment: rollAlignment(rng, 0, 35),
    relationship: rng.int(0, 10),
  });
  const next: GameState = {
    ...state,
    npcs: { ...state.npcs, [npc.id]: npc },
    parish: { ...state.parish, seminarian: { npcId: npc.id, startWeek: state.clock.week, endWeek: state.clock.week + FORMED.weeks } },
    flags: { ...state.flags, 'seminarian:here': true },
  };
  const who = state.assignment?.role === 'pastor' ? 'The seminary sent' : 'The pastor took a seminarian for the summer and handed him to you:';
  return { state: next, line: `${who} ${npc.name.first} ${npc.name.last}, a seminarian, for the summer. He has the youth group and the hospital, and the room over the garage.` };
}

/** The end of the summer: the evaluation is due, and writes itself if it is not written. */
export function seminarianWeek(state: GameState): { state: GameState; line: string | null } {
  const sem = state.parish?.seminarian;
  const npc = seminarianOf(state);
  if (!sem || !npc || !state.parish) return { state, line: null };
  if (state.clock.week === sem.endWeek) {
    return { state: { ...state, flags: { ...state.flags, 'seminarian:evaluation_due': true } }, line: `${npc.name.first} ${npc.name.last} went back to the seminary. The rector wants your evaluation of him within the month.` };
  }
  if (state.clock.week >= sem.endWeek + FORMED.evaluationGrace && state.flags['seminarian:evaluation_due']) {
    const next = evaluateSeminarian(state, 'reserved');
    return { state: applyEffects(next, [{ target: 'reputation', key: 'chancery', delta: -1 }], {}, 'an evaluation the rector had to ask for twice'), line: 'The rector wrote again about the evaluation, and the vicar for clergy wrote a line of his own. Something reserved went in the file.' };
  }
  return { state, line: null };
}

/** Write the evaluation: what the seminary hears, and what the man remembers. */
export function evaluateSeminarian(state: GameState, verdict: Verdict): GameState {
  const npc = seminarianOf(state);
  if (!npc || !state.parish || !state.flags['seminarian:evaluation_due']) throw new Error('no evaluation is due');
  const { seminarian: _drop, ...parish } = state.parish;
  void _drop;
  const effects = verdict === 'strong' ? [{ target: 'reputation' as const, key: 'chancery', delta: 1 }] : verdict === 'concerned' ? [{ target: 'reputation' as const, key: 'chancery', delta: 2 }, { target: 'stat' as const, key: 'piety', delta: -0.5 }] : [];
  let next: GameState = {
    ...state,
    parish,
    npcs: { ...state.npcs, [npc.id]: { ...npc, status: 'left' } },
    flags: { ...state.flags, 'seminarian:here': false, 'seminarian:evaluation_due': false },
    formed: [...(state.formed ?? []), { npcId: npc.id, name: `${npc.name.first} ${npc.name.last}`, year: calendarYear(state), verdict }],
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Wrote the seminary a ${verdict} evaluation of ${npc.name.first} ${npc.name.last}.` }],
  };
  if (effects.length) next = applyEffects(next, effects, {}, `the evaluation of ${npc.name.first} ${npc.name.last}`);
  return next;
}

/** Years later, a man he formed may be sent to him as a priest. Checked at the year's turn. */
export function returnOfTheFormed(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const p = pid(state);
  if (!p || !state.parish || state.assignment?.role !== 'pastor' || state.parish.vicarId) return { state, line: null };
  const year = calendarYear(state);
  const due = (state.formed ?? []).filter((f) => !f.returned && year - f.year >= FORMED.returnYears);
  if (!due.length || !rng.chance(FORMED.returnChance)) return { state, line: null };
  const f = rng.pick(due);
  const old = state.npcs[f.npcId];
  const birthYear = old?.birthYear ?? year - 32;
  const relationship = f.verdict === 'strong' ? 30 : f.verdict === 'concerned' ? -25 : 5;
  const npc: Npc = {
    ...(old ?? finishNpc(rng, { id: f.npcId, name: { first: f.name.split(' ')[0]!, last: f.name.split(' ').slice(1).join(' ') }, role: 'priest', title: 'Fr.', birthYear, origin: 'suburban', stats: rollBaseStats(rng, 30, 60), relationship })),
    id: `${f.npcId}_returned`,
    role: 'priest',
    title: 'Fr.',
    status: 'active',
    relationship,
    tags: ['seminarian', `parish:${p}`, `vicar:${p}`],
  };
  const next: GameState = {
    ...state,
    npcs: { ...state.npcs, [npc.id]: npc },
    parish: { ...state.parish, vicarId: npc.id },
    formed: (state.formed ?? []).map((x) => (x.npcId === f.npcId ? { ...x, returned: true } : x)),
    flags: { ...state.flags, 'seminarian:returned': true },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Fr. ${f.name}, whom you had as a seminarian in ${f.year}, was sent to you as parochial vicar.` }],
  };
  return { state: next, line: `A letter of appointment: Fr. ${f.name}, the seminarian you had in ${f.year}, comes as your parochial vicar. ${f.verdict === 'strong' ? 'He asked for the parish.' : f.verdict === 'concerned' ? 'He has read what you wrote.' : 'He remembers the summer better than you do.'}` };
}
