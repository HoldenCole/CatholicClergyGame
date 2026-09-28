import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { dateOf } from '@/engine/time';
import { finishNpc, rollBaseStats, addStats, rollAlignment } from '@/generation/npc';
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
  // A man of this parish who entered on your watch comes back to it first.
  const own = Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes('seminarian') && n.tags.includes('from_parish') && n.tags.includes(`parish:${p}`) && !n.tags.includes('summered'));
  if (own) {
    const marked = { ...own, tags: [...own.tags, 'summered'] };
    const next: GameState = {
      ...state,
      npcs: { ...state.npcs, [own.id]: marked },
      parish: { ...state.parish, seminarian: { npcId: own.id, startWeek: state.clock.week, endWeek: state.clock.week + FORMED.weeks } },
      flags: { ...state.flags, 'seminarian:here': true, 'seminarian:own': true },
    };
    return { state: next, line: `The seminary sent back your own: ${own.name.first} ${own.name.last}, who served this altar as a boy, for the summer. The parish has already decided how he is doing.` };
  }
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

/**
 * The men he formed, grown (D5). A parish of the diocese whose pastor has
 * died, retired, or been moved gets a new one each year: a man he had as a
 * seminarian, when one is old enough, carrying the verdict he wrote; else a
 * priest of the diocese nobody knew. The deanery's seats follow.
 */
export const GROWN = {
  /** Chance a vacant parish goes to a man he formed, when one is due. */
  formedChance: 0.5,
  /** Regard a man formed carries into the parish, by the verdict written on him. */
  regard: { strong: 30, reserved: 5, concerned: -25 } as Record<Verdict, number>,
} as const;

export function fillVacantParishes(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const world = state.world;
  if (!world || !state.character) return { state, lines: [] };
  const year = calendarYear(state);
  const lines: string[] = [];
  let next = state;
  const mine = state.assignment?.parishId;
  for (const p of world.parishes) {
    if (p.cathedral || p.id === mine) continue;
    const pastor = next.npcs[p.pastorId];
    if (pastor && pastor.status === 'active' && pastor.tags.includes(`pastor:${p.id}`)) continue;
    const r = rng.derive(`fill:${p.id}:${year}`);
    const due = (next.formed ?? []).filter((f) => !f.returned && year - f.year >= FORMED.returnYears);
    const formed = due.length && r.chance(GROWN.formedChance) ? r.pick(due) : null;
    const did = next.world!.diocese.presetId;
    let npc: Npc;
    if (formed) {
      const old = next.npcs[formed.npcId];
      const first = formed.name.split(' ')[0]!;
      const last = formed.name.split(' ').slice(1).join(' ');
      npc = {
        ...(old ?? finishNpc(r, { id: formed.npcId, name: { first, last }, role: 'priest', title: 'Fr.', birthYear: year - 34, origin: 'suburban', stats: rollBaseStats(r, 30, 60) })),
        id: `${formed.npcId}_pastor`,
        role: 'priest',
        title: 'Fr.',
        status: 'active',
        relationship: GROWN.regard[formed.verdict],
        tags: ['priest', 'pastor', `pastor:${p.id}`, 'formed_by_you', `diocese:${did}`],
        marks: [{ week: next.clock.week, delta: GROWN.regard[formed.verdict], why: `the ${formed.verdict} evaluation you wrote in ${formed.year}` }],
      };
      next = { ...next, formed: (next.formed ?? []).map((x) => (x === formed ? { ...x, returned: true } : x)) };
      lines.push(`Fr. ${formed.name}, whom you had as a seminarian in ${formed.year}, is pastor of ${p.name} now. ${formed.verdict === 'strong' ? 'He wrote to say so, and to thank you.' : formed.verdict === 'concerned' ? 'He has read what you wrote about him; the deanery will be interesting.' : 'He remembers the summer.'}`);
    } else {
      const heritage = rollHeritage(r, CLERGY_HERITAGE);
      const birthYear = year - r.int(36, 62);
      const name = rollMaleName(r, heritage, eraForBirthYear(birthYear));
      npc = finishNpc(r, { id: `pastor_${p.id}_${year}`, name, role: 'priest', title: 'Fr.', birthYear, origin: 'suburban', stats: rollBaseStats(r, 30, 60), tags: ['priest', 'pastor', `pastor:${p.id}`, `diocese:${did}`], relationship: r.int(-5, 10) });
    }
    next = { ...next, npcs: { ...next.npcs, [npc.id]: npc }, world: { ...next.world!, parishes: next.world!.parishes.map((x) => (x.id === p.id ? { ...x, pastorId: npc.id } : x)) } };
  }
  return { state: next, lines };
}

/** At a succession: one of the men he formed, strong and twenty years on, may be the one Rome names. */
export function formedAsBishop(state: GameState, rng: Rng): { npcId: string; name: string; year: number } | null {
  const year = calendarYear(state);
  const due = (state.formed ?? []).filter((f) => f.verdict === 'strong' && year - f.year >= GROWN_BISHOP.years);
  if (!due.length || !rng.chance(GROWN_BISHOP.chance)) return null;
  const f = rng.pick(due);
  return { npcId: f.npcId, name: f.name, year: f.year };
}

export const GROWN_BISHOP = { years: 20, chance: 0.15 } as const;
