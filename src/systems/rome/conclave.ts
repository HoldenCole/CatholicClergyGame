import type { Cardinal, Conclave, GameState } from '@/types';
import { createRng } from '@/engine/rng';
import { fromDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';
import { runElection, type BallotRules, type Elector } from '../ballot';
import { seeDefs } from '@/content/sees';

/**
 * E1 R1.5 — the conclave (§7), on the ballot machinery the friars' chapters
 * use. The electors are the cardinals under eighty on the day the see fell
 * vacant; the men they can elect are the papabili (and the man himself, when
 * the College reads him so). Each elector weighs a man by how near his
 * reading is, where he comes from, his age, and how the College rates him;
 * the rounds need two thirds, and after the thirtieth the two leaders go to a
 * runoff in which they do not vote. The name that comes out follows from what
 * the room was. Deterministic from the seed. Weights are invented and flagged.
 */
export const CONCLAVE: BallotRules = {
  threshold: 2 / 3,
  majorityRounds: 30,
  narrowTo: 2,
  maxRounds: 36,
  shiftRate: 0.35,
  fadingBelow: 0.5,
  noise: 4,
  narrowNeedsThreshold: true,
  narrowedAbstain: true,
};

export const ELECTOR = {
  age: 80,
  papabili: 5,
  /** What an elector weighs: a man's reading against his own, the College's rating, a man of his own region, an age near seventy. */
  gap: 0.5,
  papabile: 50,
  region: 8,
  ageIdeal: 72,
  agePer: 1.5,
  /** The man himself: how high the College must rate him to be among those it could turn to. */
  playerFloor: 0.3,
  /** Letting it be known you would serve costs you in every elector's eyes; letting it be known you would not, a little. */
  willing: -8,
  unwilling: -2,
  speech: 5,
} as const;

export const PLAYER = 'player';

function ageOn(born: number, day: number): number {
  return fromDayNumber(day).year - born;
}

export function electorsOn(college: Cardinal[], day: number): Cardinal[] {
  return college.filter((c) => c.diesDay > day && ageOn(c.born, day) < ELECTOR.age);
}

/** The men the College would look to: its highest-rated electors, a little rolled. */
export function papabiliOf(seed: string, college: Cardinal[], day: number): Cardinal[] {
  const rng = createRng(`${seed}:papabili:${day}`);
  return electorsOn(college, day)
    .map((c) => ({ c, w: c.papabile + rng.next() * 0.15 }))
    .sort((a, b) => b.w - a.w)
    .slice(0, ELECTOR.papabili)
    .map((x) => x.c);
}

function playerBorn(state: GameState): number {
  const c = state.character!;
  return c.entryYear - c.background.entryAge;
}

/** Whether the man is a cardinal under eighty on the day the see fell vacant. */
export function playerIsElector(state: GameState): boolean {
  const since = state.rome?.vacancy?.sinceDay;
  if (!state.flags.cardinal || !state.character || since === undefined) return false;
  return ageOn(playerBorn(state), since) < ELECTOR.age;
}

/** How the College rates the man as a possible pope, 0..1: his standing in Rome, the chair he holds, and what he said in the congregations. */
export function playerPapabile(state: GameState, view: number): number {
  const c = state.character!;
  let p = (view / 100) * 0.35 + ((c.reputation.rome ?? 0) / 100) * 0.25;
  if (state.see && seeDefs.find((d) => d.id === state.see!.id)?.great) p += 0.1;
  if (state.flags['curia:secretary']) p += 0.08;
  const speech = state.rome?.conclave?.actions.speech;
  if (speech === 'pastor' && c.stats.charisma >= 60) p += 0.1;
  if (speech === 'governance' && c.stats.administration >= 60) p += 0.1;
  return Math.max(0, Math.min(1, p));
}

interface Man {
  id: string;
  temperament: number;
  region: string;
  born: number;
  papabile: number;
}

function weigh(elector: Man, man: Man, day: number): number {
  const age = ageOn(man.born, day);
  return man.papabile * ELECTOR.papabile - Math.abs(elector.temperament - man.temperament) * ELECTOR.gap + (elector.region === man.region ? ELECTOR.region : 0) - Math.abs(age - ELECTOR.ageIdeal) * ELECTOR.agePer;
}

export interface Room {
  electors: Elector[];
  candidates: string[];
}

/**
 * The room as it stands: every elector's view of every man it could elect.
 * The man himself, when he is an elector, votes as he has chosen; when he is
 * a candidate, the room weighs him too, and how he let himself be seen.
 */
export function buildRoom(state: GameState, college: Cardinal[], day: number, conclave: Conclave | null, playerMan: Man | null): Room {
  const electors = electorsOn(college, day);
  const men: Man[] = (conclave ? conclave.candidateIds : papabiliOf(state.seed, college, day).map((c) => c.id))
    .map((id) => (id === PLAYER ? playerMan : college.find((c) => c.id === id)))
    .filter((m): m is Man => !!m);
  const speech = conclave?.actions.speech;
  const late = state.rome?.popes[state.rome.popes.length - 1]?.temperament ?? 0;
  const out: Elector[] = electors.map((e) => {
    const scores: Record<string, number> = {};
    for (const m of men) {
      let w = weigh(e, m, day);
      if (speech === 'reform' && m.temperament > 20) w += ELECTOR.speech;
      if (speech === 'continuity' && Math.abs(m.temperament - late) < 30) w += ELECTOR.speech;
      if (m.id === PLAYER && conclave?.actions.signal) w += conclave.actions.signal === 'willing' ? ELECTOR.willing : ELECTOR.unwilling;
      scores[m.id] = w;
    }
    return { id: e.id, scores };
  });
  if (conclave && playerMan && state.flags.cardinal) {
    const vote = conclave.actions.vote;
    out.push({ id: PLAYER, scores: Object.fromEntries(men.map((m) => [m.id, m.id === vote ? 100 : 0])), fickle: vote ? 0 : 0.3 });
  }
  return { electors: out, candidates: men.map((m) => m.id) };
}

/** The man as the room sees him. */
export function playerMan(state: GameState, view: number): Man {
  const region = 'North America';
  return { id: PLAYER, temperament: state.character!.alignment, region, born: playerBorn(state), papabile: playerPapabile(state, view) };
}

/** A conclave the man is not in: the College elects from its own. */
export function collegeElects(state: GameState, college: Cardinal[], day: number): Cardinal | null {
  const room = buildRoom(state, college, day, null, null);
  if (!room.electors.length || !room.candidates.length) return null;
  const result = runElection(createRng(`${state.seed}:conclave:${day}`), room.electors, room.candidates, CONCLAVE);
  return college.find((c) => c.id === result.electedId) ?? null;
}

/** The conclave opens with the man inside: the papabili, and his own name if the College reads him as one. */
export function openConclave(state: GameState, view: number): Conclave {
  const day = state.rome!.vacancy!.sinceDay;
  const college = state.rome!.college ?? [];
  const papabili = papabiliOf(state.seed, college, day).map((c) => c.id);
  const me = playerMan(state, view);
  const candidateIds = me.papabile >= ELECTOR.playerFloor ? [...papabili, PLAYER] : papabili;
  return { candidateIds, electorIds: [...electorsOn(college, day).map((c) => c.id), PLAYER], actions: {} };
}

/** Into the Sistine Chapel: the ballots, round by round, and the name. */
export function holdConclave(state: GameState, view: number): Conclave {
  const conclave = state.rome!.conclave!;
  const day = state.rome!.vacancy!.sinceDay;
  const college = state.rome!.college ?? [];
  const me = playerMan(state, view);
  const excluded = conclave.declined ? { ...conclave, candidateIds: conclave.candidateIds.filter((id) => id !== PLAYER) } : conclave;
  const room = buildRoom(state, college, day, excluded, me);
  const result = runElection(createRng(`${state.seed}:conclave:${day}:${conclave.declined ? 'again' : 'first'}`), room.electors, room.candidates, CONCLAVE);
  return { ...excluded, ballots: result.rounds.map((r) => ({ round: r.round, tallies: r.tallies, field: r.field })), electedId: result.electedId };
}

/** Whether the man got votes in any round, and whether he voted for the man elected. */
export function conclaveMarks(conclave: Conclave): { hadVotes: boolean; votedWinner: boolean } {
  return { hadVotes: (conclave.ballots ?? []).some((b) => (b.tallies[PLAYER] ?? 0) > 0), votedWinner: !!conclave.actions.vote && conclave.actions.vote === conclave.electedId };
}

/** The day the conclave opens, fifteen days after the see falls vacant (Universi Dominici Gregis, flagged). */
export function conclaveOpens(state: GameState): boolean {
  const v = state.rome?.vacancy;
  return !!v && sundayOf(state.clock) >= v.sinceDay + 14;
}
