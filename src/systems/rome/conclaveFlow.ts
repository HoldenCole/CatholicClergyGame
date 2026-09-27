import type { Conclave, GameState, Letter } from '@/types';
import { sundayOf } from '@/engine/time';
import { papalHistory, papalPools } from '@/content/rome';
import { createRng } from '@/engine/rng';
import { roman } from './papacy';
import { conclaveMarks, conclaveOpens, holdConclave, openConclave, PLAYER, playerIsElector } from './conclave';
import { nuncioView } from './nuncioView';
import { scheduleCollegeScene } from './college';
import { beginPontificate } from './pontificate';

/**
 * E1 R1.5 — the conclave as the man lives it: it opens fifteen days after the
 * see falls vacant when he is an elector and the record does not already name
 * the next pope; he hears the general congregations and may speak, casts his
 * ballot, and may let himself be seen as willing or not; the ballots run; the
 * name is his to accept or refuse if it is his own. Everything is decided by
 * the conclave engine; this file moves the man through it.
 */

/** Whether the next pope is the record's (a 1978 or a 2013 conclave): then there is no played conclave, only the letter. */
function recordDecides(state: GameState): boolean {
  const v = state.rome?.vacancy;
  if (!v) return true;
  const prior = state.rome!.popes.find((p) => p.id === v.priorId);
  if (!prior?.historical) return false;
  const i = papalHistory.findIndex((h) => `hist:${h.key}` === prior.id);
  return i >= 0 && i + 1 < papalHistory.length;
}

/** At the week's end: the conclave opens with the man inside, or comes back to him if he left it open. */
export function maybeOpenConclave(state: GameState): GameState {
  const r = state.rome;
  if (!r?.vacancy || r.vacancy.winnerId || state.mode.kind !== 'clock' || state.pending.length > 0) return state;
  if (!playerIsElector(state) || recordDecides(state) || !r.college?.length || !conclaveOpens(state)) return state;
  const conclave = r.conclave ?? openConclave(state, nuncioView(state).value);
  return { ...state, rome: { ...r, conclave }, mode: { kind: 'conclave' } };
}

/** Before the vote: his ballot, his speech in the congregations, and how he lets himself be seen. */
export function conclaveAct(state: GameState, action: 'vote' | 'speech' | 'signal', value: string): GameState {
  const c = state.rome?.conclave;
  if (!c || c.electedId) return state;
  const actions: Conclave['actions'] = { ...c.actions };
  if (action === 'vote' && c.candidateIds.includes(value) && value !== PLAYER) actions.vote = value;
  if (action === 'speech' && ['continuity', 'reform', 'pastor', 'governance'].includes(value)) actions.speech = value as NonNullable<Conclave['actions']['speech']>;
  if (action === 'signal' && (value === 'willing' || value === 'unwilling') && c.candidateIds.includes(PLAYER)) actions.signal = value;
  return { ...state, rome: { ...state.rome!, conclave: { ...c, actions } } };
}

/** Extra omnes: the doors close, and the ballots are counted until a name has two thirds. */
export function holdTheConclave(state: GameState): GameState {
  if (!state.rome?.conclave || state.rome.conclave.electedId) return state;
  return { ...state, rome: { ...state.rome, conclave: holdConclave(state, nuncioView(state).value) } };
}

/** Three names a new pope might take, from the regnal names with the next ordinal. */
export function regnalChoices(state: GameState): string[] {
  const rng = createRng(`${state.seed}:regnal:${state.rome?.vacancy?.sinceDay ?? 0}`);
  const ordinals = state.rome?.ordinals ?? {};
  return rng.shuffle(Object.keys(papalPools.regnal)).slice(0, 3).map((base) => {
    const n = (ordinals[base] ?? papalPools.regnal[base] ?? 0) + 1;
    return n === 1 ? base : `${base} ${roman(n)}`;
  });
}

/**
 * The name, answered. His own name, accepted, ends the life as a priest's and
 * begins the pontificate (R1.6); refused, the College votes again
 * without him. Another man's name closes the conclave: he is proclaimed on
 * the election day, and the man's ballots are remembered.
 */
export function answerConclave(state: GameState, accept: boolean, name?: string): GameState {
  const c = state.rome?.conclave;
  if (!c?.electedId) return state;
  const week = state.clock.week;
  if (c.electedId === PLAYER) {
    // Accepto: the pontificate begins, and is played until it ends (R1.6, §10).
    if (accept) return { ...beginPontificate(state, name ?? regnalChoices(state)[0]!), speed: 'PAUSED' };
    const declined: GameState = { ...state, flags: { ...state.flags, 'conclave:refused': true }, rome: { ...state.rome!, conclave: { ...stripElected(c), declined: true } } };
    return holdTheConclave(declined);
  }
  const day = sundayOf(state.clock);
  const v = state.rome!.vacancy!;
  const rounds = c.ballots?.length ?? 1;
  const electionDay = Math.max(day + 1, v.sinceDay + 15 + Math.ceil(rounds / 4));
  const marks = conclaveMarks(c);
  const { conclave: _c, ...rome } = state.rome!;
  let next: GameState = {
    ...state,
    rome: { ...rome, vacancy: { ...v, winnerId: c.electedId, electionDay } },
    flags: { ...state.flags, 'conclave:voted_in': true, 'conclave:voted_winner': marks.votedWinner, 'conclave:had_votes': marks.hadVotes },
    mode: { kind: 'clock' },
    career: [...state.career, { week, kind: 'note', text: `Voted in the conclave${marks.hadVotes ? ', and heard your own name read out in the Sistine Chapel' : ''}.` }],
  };
  next = scheduleCollegeScene(next, 'after');
  return next;
}

function stripElected(c: Conclave): Conclave {
  const { electedId: _e, ballots: _b, ...rest } = c;
  return rest;
}

/** The ballots as the man remembers them, for the panel. */
export function ballotLines(state: GameState, c: Conclave): string[] {
  const name = (id: string) => (id === PLAYER ? 'you' : state.rome?.college?.find((x) => x.id === id)?.name ?? id);
  return (c.ballots ?? []).map((b) => `Ballot ${b.round}: ${Object.entries(b.tallies).sort((x, y) => y[1] - x[1]).filter(([, n]) => n > 0).map(([id, n]) => `${name(id)} ${n}`).join(', ')}`);
}

export type { Letter };
