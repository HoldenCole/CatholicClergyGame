import { cohesionPietyFactor } from './religious/house';
import { friendPietyFactor } from './religious/friendship';
import { restlessPietyFactor } from './religious/restless';
import type { Charism, Direction, DirectorOption, GameState, Match, Npc, Temperament, Trouble } from '@/types';
import type { Rng } from '@/engine/rng';
import { instituteDef } from '@/content/institutes';
import { visitingDirector } from '@/generation/institutes';
import { dateOf } from '@/engine/time';

/**
 * Spiritual direction. DESIGN.md §9.4.
 *
 * The relationship begins in seminary Y1 and can run forty years: the longest
 * single thread in the game. It is the only reliable maintenance channel for
 * Piety, which otherwise only decays, and the match between a director's
 * charism and temperament and the trouble a man actually brings decides which
 * crises he survives. A mismatch is worse than no director at all.
 *
 * Everything said in direction is sealed: see engine/internalForum.ts. Nothing
 * in this file writes to reputation, and nothing may be added here that does.
 */
export const DIRECTION = {
  /** Men offered in Y1. */
  offered: [3, 4] as [number, number],
  /** Dominicans among them, always: they staff seminaries everywhere. */
  dominicans: 2,
  /** How much of the Piety drain a week of kept direction takes off, at a good match. */
  slow: { good: 0.55, fair: 0.35, poor: 0.1 } as Record<Match, number>,
  /** A mismatch is worse than nothing: the hour is spent and the man is not heard. */
  mismatchDrain: 0.02,
  /** Weeks of direction that count as kept up. Miss them and the slowing lapses. */
  keptWithin: 6,
  /** A new man after a loss is not as good at once: weeks before the relationship reads true. */
  settleWeeks: 78,
  /** The chance a provincial moves a director in a given year. He is not the bishop's to keep. */
  reassignedPerYear: 0.05,
  /** Noticed by other priests after this long without one. */
  noticedWeeks: 104,
} as const;

/** What each temperament is for, and what it is useless at. §9.4 */
const SERVES: Record<Temperament, Trouble[]> = {
  brisk: ['overwork', 'scruples'],
  contemplative: ['dark_night', 'doubt'],
  scholarly: ['doubt', 'scruples'],
  warm: ['loneliness', 'dark_night'],
  severe: ['anger', 'scruples'],
};

/** A charism helps a second kind of trouble, so two Dominicans are not the same man. */
const CHARISM_HELPS: Partial<Record<Charism, Trouble[]>> = {
  contemplative: ['dark_night'],
  scholarship: ['doubt'],
  preaching: ['doubt'],
  charity: ['loneliness'],
  poverty: ['overwork'],
  healthcare: ['overwork'],
  teaching: ['scruples'],
  mission: ['anger'],
  tradition: ['scruples'],
};

export const TEMPERAMENT_WORD: Record<Temperament, string> = {
  brisk: 'brisk and practical',
  contemplative: 'quiet, and slow to answer',
  scholarly: 'a reader, who will give you a book',
  warm: 'warm, and hard to shock',
  severe: 'severe, and not interested in comfort',
};

export const TROUBLE_WORD: Record<Trouble, string> = {
  dark_night: 'a prayer that has gone dark',
  overwork: 'a man drowning in administration',
  doubt: 'doubt about the whole of it',
  loneliness: 'loneliness',
  scruples: 'scruples',
  anger: 'anger he cannot put down',
};

/** How well this director serves that trouble. */
export function matchFor(d: Direction | undefined, trouble: Trouble): Match {
  if (!d) return 'poor';
  const serves = SERVES[d.temperament].includes(trouble);
  const helps = (CHARISM_HELPS[d.charism] ?? []).includes(trouble);
  if (serves && helps) return 'good';
  if (serves || helps) return 'fair';
  return 'poor';
}

/** The trouble a man is actually in, read from his own state. The director does not get to choose it. */
export function troubleOf(state: GameState): Trouble {
  const c = state.character;
  if (!c) return 'doubt';
  if ((c.stats.piety ?? 50) < 35) return 'dark_night';
  if ((state.strain ?? 0) >= 60) return 'overwork';
  if (state.flags.doubt_open || state.threads?.doubt) return 'doubt';
  if (c.stats.theology >= 65 && c.stats.piety < 50) return 'doubt';
  if ((c.reputation.brother_priests ?? 0) < 0) return 'loneliness';
  return 'scruples';
}

export function directionOf(state: GameState): Direction | undefined {
  const d = state.character?.direction;
  // Week zero is a real week: a relationship that ended in it has ended.
  return d && d.endedWeek === undefined ? d : undefined;
}

/** The man himself, when he is still in the game. */
export function directorNpc(state: GameState): Npc | undefined {
  const d = directionOf(state);
  return d ? state.npcs[d.npcId] : undefined;
}

/** Whether the hour has been kept lately: the slowing lapses when it has not. */
export function directionKept(state: GameState): boolean {
  const d = directionOf(state);
  if (!d || d.weeksKept === 0) return false;
  const last = state.flags['direction:week'];
  return typeof last === 'number' && state.clock.week - last <= DIRECTION.keptWithin;
}

/**
 * The factor on this week's Piety drain. One is the full drain; a kept hour
 * with the right man takes nearly half of it off. A director who cannot hear
 * this particular trouble is slightly worse than none, because the hour is
 * spent anyway.
 */
export function pietyFactor(state: GameState, hours: number): number {
  // The house he lives in modulates the drain for an order whose mechanics say so. E3 §7.2.
  return directionFactor(state, hours) * cohesionPietyFactor(state) * friendPietyFactor(state) * restlessPietyFactor(state);
}

function directionFactor(state: GameState, hours: number): number {
  const d = directionOf(state);
  if (!d) return 1;
  if (hours <= 0) return directionKept(state) ? 1 - DIRECTION.slow[matchFor(d, troubleOf(state))] * 0.4 : 1;
  const match = matchFor(d, troubleOf(state));
  if (match === 'poor') return 1 + DIRECTION.mismatchDrain;
  return 1 - DIRECTION.slow[match];
}

/** One week: the hour is noted, and the relationship deepens by keeping it. */
export function directionWeek(state: GameState, hours: number): GameState {
  const d = directionOf(state);
  const c = state.character;
  if (!d || !c || hours <= 0) return state;
  return {
    ...state,
    character: { ...c, direction: { ...d, weeksKept: d.weeksKept + 1 } },
    flags: { ...state.flags, 'direction:week': state.clock.week },
  };
}

/** A man who may direct: a priest, never a sister, a brother, or a lay professor, and not the men of the external forum. */
function mayDirect(n: Npc): boolean {
  if (n.status !== 'active') return false;
  if (n.tags.includes('rector') || n.tags.includes('formation_advisor') || n.tags.includes('diverged')) return false;
  if (!(n.role === 'religious' || n.tags.includes('spiritual_director') || n.role === 'formator')) return false;
  if (n.title !== 'Fr.' && n.title !== 'Msgr.') return false;
  const def = n.institute ? instituteDef(n.institute.replace('inst_', '')) : undefined;
  return !def?.women;
}

function houseOf(n: Npc): string {
  return n.institute ?? 'diocesan';
}

function toOption(n: Npc): DirectorOption {
  const temperament: Temperament = n.temperament ?? 'warm';
  const charism: Charism = n.charism ?? 'contemplative';
  const house = n.institute ? instituteDef(n.institute.replace('inst_', '')) : undefined;
  const serves = SERVES[temperament];
  const poorAt = (Object.keys(TROUBLE_WORD) as Trouble[]).find((t) => !serves.includes(t) && !(CHARISM_HELPS[charism] ?? []).includes(t))!;
  return {
    npcId: n.id,
    name: `${n.title} ${n.name.first} ${n.name.last}`,
    line: house ? `${house.short.replace(/^the /, 'a ').replace(/s$/, '')}, ${TEMPERAMENT_WORD[temperament]}` : `a diocesan priest, ${TEMPERAMENT_WORD[temperament]}`,
    charism,
    temperament,
    good: `good to a man with ${TROUBLE_WORD[serves[0]!]}`,
    poor: `no use at all to a man with ${TROUBLE_WORD[poorAt]}`,
  };
}

/**
 * The men offered in Y1. Two Dominicans always, because the Order of Preachers
 * staffs seminaries everywhere; when the diocese has fewer than two, visiting
 * friars are added to the house and to the state. The rest come one from each
 * other house and the diocese, so three men are never three of one order.
 */
export function offerDirectors(state: GameState, rng: Rng): { state: GameState; options: DirectorOption[] } {
  let next = state;
  const pool = () => Object.values(next.npcs).filter(mayDirect).sort((a, b) => a.id.localeCompare(b.id));
  const dominicans = () => pool().filter((n) => n.institute === 'inst_dominicans');
  const year = dateOf(next.clock).year;
  for (let i = 0; dominicans().length < DIRECTION.dominicans && i < DIRECTION.dominicans; i++) {
    const friar = visitingDirector(rng.derive(`visiting:${i}`), year, 'dominicans', i);
    next = { ...next, npcs: { ...next.npcs, [friar.id]: friar } };
  }
  const want = rng.int(DIRECTION.offered[0], DIRECTION.offered[1]);
  const chosen: Npc[] = rng.shuffle(dominicans()).slice(0, DIRECTION.dominicans);
  // One from each other house, in a rolled order, then whoever is left if the houses run out.
  const rest = pool().filter((n) => !chosen.includes(n) && n.institute !== 'inst_dominicans');
  const houses = rng.shuffle([...new Set(rest.map(houseOf))]);
  for (const h of houses) {
    if (chosen.length >= want) break;
    const men = rest.filter((n) => houseOf(n) === h);
    chosen.push(rng.pick(men));
  }
  for (const n of rng.shuffle(rest.filter((n) => !chosen.includes(n)))) {
    if (chosen.length >= want) break;
    chosen.push(n);
  }
  return { state: next, options: chosen.map(toOption) };
}

/** The options alone, from the men already in the state. Tests and sheets use it; the seminary uses offerDirectors. */
export function directorOptions(state: GameState, rng: Rng): DirectorOption[] {
  return offerDirectors(state, rng).options;
}

/** The choice is made. The chosen man is tagged so every authored scene that wants a director finds him. */
export function chooseDirector(state: GameState, npcId: string, confessorToo = true): GameState {
  const npc = state.npcs[npcId];
  const c = state.character;
  if (!npc || !c) return state;
  const npcs = { ...state.npcs };
  // One man holds the tag at a time: the old director keeps the relationship and loses the office.
  for (const [id, n] of Object.entries(npcs)) {
    if (id !== npcId && n.tags.includes('spiritual_director')) npcs[id] = { ...n, tags: n.tags.filter((t) => t !== 'spiritual_director') };
  }
  npcs[npcId] = { ...npc, tags: [...new Set([...npc.tags, 'spiritual_director'])] };
  const direction: Direction = {
    npcId,
    sinceWeek: state.clock.week,
    charism: npc.charism ?? 'contemplative',
    temperament: npc.temperament ?? 'warm',
    weeksKept: 0,
    confessorToo,
  };
  return {
    ...state,
    npcs,
    character: { ...c, direction },
    // Splitting the roles is a guarded move, and the house reads it that way.
    flags: { ...state.flags, 'direction:chosen': true, ...(confessorToo ? {} : { 'direction:split': true }) },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Chose ${npc.title} ${npc.name.last} as spiritual director.` }],
  };
}

/**
 * The relationship ends: a provincial moved him, or he died, or the man changed.
 * It lands hard, and the next one is not as good at once.
 */
export function endDirection(state: GameState, why: Direction['endedWhy']): GameState {
  const d = directionOf(state);
  const c = state.character;
  if (!d || !c) return state;
  const npc = state.npcs[d.npcId];
  const word = why === 'reassigned' ? 'was reassigned by his provincial' : why === 'died' ? 'died' : 'was left';
  return {
    ...state,
    character: { ...c, direction: { ...d, endedWeek: state.clock.week, ...(why ? { endedWhy: why } : {}) } },
    flags: { ...state.flags, 'direction:lost': true },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `${npc ? `${npc.title} ${npc.name.last}` : 'Your director'} ${word}, after ${Math.max(1, Math.round((state.clock.week - d.sinceWeek) / 52))} years of direction.` }],
  };
}

/** A year passes: a provincial somewhere decides something, with no notice and no appeal. */
export function directionYear(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const d = directionOf(state);
  if (!d) return { state, line: null };
  const npc = state.npcs[d.npcId];
  if (!npc || npc.status !== 'active') return { state: endDirection(state, 'died'), line: 'The letter came from the house: your director is dead. You had been going to him for years.' };
  if (npc.role === 'religious' && rng.chance(DIRECTION.reassignedPerYear)) {
    return {
      state: endDirection(state, 'reassigned'),
      line: `${npc.title} ${npc.name.last} has been moved by his provincial, with six weeks' notice and no reason given that concerns you. The last hour was the same as all the others, because neither of you knew.`,
    };
  }
  return { state, line: null };
}

/** How the thing stands, for the sheet. */
export function directionLine(state: GameState): string {
  const d = directionOf(state);
  if (!d) {
    const since = Number(state.flags['direction:lost'] ? state.clock.week : 0);
    return since || state.flags['direction:chosen'] ? 'No director, since the last one went.' : 'No spiritual director. Piety drains and nothing slows it.';
  }
  const npc = state.npcs[d.npcId];
  const years = Math.max(0, Math.round((state.clock.week - d.sinceWeek) / 52));
  const match = matchFor(d, troubleOf(state));
  const fit = match === 'good' ? 'the right man for what you are carrying' : match === 'fair' ? 'a fair ear for what you are carrying' : 'no use at all for what you are carrying';
  return `${npc ? `${npc.title} ${npc.name.last}` : 'Your director'}, ${TEMPERAMENT_WORD[d.temperament]}. ${years ? `${years} year${years === 1 ? '' : 's'} of it. ` : ''}Just now, ${fit}.`;
}
