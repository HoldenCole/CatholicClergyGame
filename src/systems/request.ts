import type { CareerRequest, GameState, Opening, Parish, RequestTarget, Role } from '@/types';
import type { Rng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { studyProgram } from '@/content/study';
import { CAREER, yearsOrdained } from '@/engine/career';
import { playerCandidate } from './openings';
import { parishYears } from './choice';
import { turnaroundOf, wasDying } from './trajectory';

/**
 * The letter to the vicar for clergy: the post a man has asked for by name.
 * DESIGN.md §7.6.
 *
 * The preference form of §7.4 names a kind of place. This names a place. It
 * stands in the file until the board reads it at the end of his arc, or until
 * the vicar for clergy acts on it sooner because the man is strong or the place
 * is short. Numbers here are invented; the shape is the design's.
 */
export const REQUEST = {
  /** Weeks in a post before the chancery will read a letter about leaving it. */
  minWeeksInPost: 78,
  /** Where the place he asked for is short, it will read one sooner. */
  urgentWeeksInPost: 52,
  /** Chancery regard lost for each letter past the first in five years. */
  chanceryPerExtra: -3,
  askedWindowWeeks: 52 * 5,
  /** Years a letter stands before the vicar for clergy closes the file. */
  lapseYears: 4,
  /** How much likelier a posting he asked for by name is to be offered. */
  offerWeight: 4,
  /** Weeks between the decision and the letter arriving. */
  waitWeeks: [2, 5] as [number, number],
  /** Chancery regard lost for asking and then saying no. */
  refusalCost: -8,
  /** What moves the chance the vicar for clergy acts on it in a given year. */
  chance: {
    base: 0.06,
    perChancery: 0.0018,
    perYearOrdained: 0.004,
    openThere: 0.18,
    vacantThere: 0.1,
    perShortage: 0.02,
    perBishopRegard: 0.0012,
    perYearStanding: 0.03,
    /** A man his parish cannot spare is held where he is. DESIGN §4.3. */
    indispensable: -0.12,
    turnaroundHere: -0.08,
    /** Asking well above his standing. */
    reach: -0.12,
    floor: 0.01,
    ceiling: 0.55,
  },
} as const;

/**
 * The postings a man may ask for. The episcopal ones are not here and never
 * will be: a mitre is the nuncio's business, and a man who writes to the
 * chancery asking for one has said something about himself.
 */
export const REQUESTABLE_POSTS: readonly string[] = [
  'pv_hospital_chaplain',
  'pv_university_chaplain',
  'pv_rome_study',
  'pv_canon_law_licentiate',
  'pv_seminary_faculty',
  'pv_bishops_secretary',
  'pa_vicar_general',
  // The special assignments. DESIGN §7.7. A man may ask for the penitentiary or the missions; a deployment comes on orders.
  'pa_penitentiary_chaplain',
  'pv_mission_loan',
  'pa_seminary_director',
  'pa_schools_superintendent',
] as const;

/** The letter standing in the file, if one is. */
export function requestOf(state: GameState): CareerRequest | null {
  const r = state.request;
  return r && !r.outcome ? r : null;
}

export function requestedParish(state: GameState): Parish | undefined {
  const target = requestOf(state)?.target;
  if (!target || target.kind !== 'parish') return undefined;
  return state.world?.parishes.find((p) => p.id === target.parishId);
}

export function postLabel(offerId: string): string {
  const def = offerById(offerId);
  const program = def?.accept.commitment?.away ? studyProgram(def.accept.commitment.away) : undefined;
  return program?.label ?? def?.title ?? offerId;
}

export function targetLabel(state: GameState, target: RequestTarget): string {
  if (target.kind === 'post') return postLabel(target.offerId);
  const parish = state.world?.parishes.find((p) => p.id === target.parishId);
  return parish ? `${parish.name}, ${parish.place}` : 'a parish';
}

/** The role he would go in: a pastorate wants the canonical years, and a vicar goes as a vicar until he has them. */
export function roleForRequest(state: GameState, parish: Parish): Role {
  const role = state.assignment?.role;
  if (role === 'pastor' || role === 'administrator') return 'pastor';
  const open = state.openings.some((o) => o.parishId === parish.id && (o.kind === 'pastor' || o.kind === 'administrator'));
  return open && parishYears(state) >= CAREER.minYearsForPastor ? 'pastor' : 'parochial_vicar';
}

/** Whether he may write at all, and what to tell him if he may not. */
export function canRequest(state: GameState): { ok: boolean; why: string } {
  if (!state.flags.ordained || !state.character) return { ok: false, why: 'A deacon does not write to the vicar for clergy about his next parish.' };
  if (state.see) return { ok: false, why: 'A bishop asks Rome, not the vicar for clergy, and Rome does not take requests.' };
  return { ok: true, why: '' };
}

function weeksInPost(state: GameState): number {
  if (state.parish) return state.clock.week - state.parish.arcStartWeek;
  if (state.study) return state.clock.week - state.study.startWeek;
  return 0;
}

/** The letter goes in. A second withdraws the first, and the chancery counts. */
export function fileRequest(state: GameState, target: RequestTarget): GameState {
  const gate = canRequest(state);
  if (!gate.ok) throw new Error(gate.why);
  if (target.kind === 'post' && !REQUESTABLE_POSTS.includes(target.offerId)) throw new Error('That is not a post a man may ask for.');
  if (target.kind === 'parish' && target.parishId === state.parish?.parishId) throw new Error('You are already there.');
  const c = state.character!;
  const prior = state.requests ?? [];
  const recent = prior.filter((r) => state.clock.week - r.week < REQUEST.askedWindowWeeks).length;
  const label = targetLabel(state, target);
  const request: CareerRequest = { target, label, week: state.clock.week, asked: prior.length + 1 };
  // A man who asks for everything is a man who is never where he is.
  const cost = recent > 0 ? REQUEST.chanceryPerExtra : 0;
  const withdrawn = state.request && !state.request.outcome ? [{ ...state.request, answeredWeek: state.clock.week, outcome: 'withdrawn' as const }] : [];
  const flags: GameState['flags'] = { ...state.flags, [REQUEST_FLAGS.standing]: true };
  delete flags[target.kind === 'parish' ? REQUEST_FLAGS.forPost : REQUEST_FLAGS.forParish];
  flags[target.kind === 'parish' ? REQUEST_FLAGS.forParish : REQUEST_FLAGS.forPost] = true;
  return {
    ...state,
    flags,
    request,
    requests: [...prior.filter((r) => r !== state.request), ...withdrawn, request],
    character: cost ? { ...c, reputation: { ...c.reputation, chancery: Math.max(-100, c.reputation.chancery + cost) } } : c,
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Wrote to the vicar for clergy asking for ${label}.` }],
  };
}

/** He takes it back, and nothing is held against him but the asking. */
export function withdrawRequest(state: GameState): GameState {
  const r = requestOf(state);
  if (!r) return state;
  const next = closeRequest(state, 'withdrawn');
  return { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `Withdrew the letter about ${r.label}.` }] };
}

/** Close the file with an outcome, without moving anyone. */
export function closeRequest(state: GameState, outcome: CareerRequest['outcome']): GameState {
  const r = requestOf(state);
  if (!r) return state;
  const closed: CareerRequest = { ...r, answeredWeek: state.clock.week, ...(outcome ? { outcome } : {}) };
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of [REQUEST_FLAGS.standing, REQUEST_FLAGS.forParish, REQUEST_FLAGS.forPost]) delete flags[k];
  if (outcome) flags[`request:${outcome}`] = true;
  return { ...state, flags, request: closed, requests: (state.requests ?? []).map((x) => (x === r ? closed : x)) };
}

/** The opening that is the post he asked for, if the board has one. */
export function requestedOpening(state: GameState): Opening | undefined {
  const parish = requestedParish(state);
  return parish ? state.openings.find((o) => o.parishId === parish.id) : undefined;
}

/** Mark the opening he asked for, so the board reads the letter and not just the name on a list. */
export function markRequested(state: GameState): GameState {
  const open = requestedOpening(state);
  if (!open) return state;
  return { ...state, openings: state.openings.map((o) => (o.id === open.id ? { ...o, requested: true } : o)) };
}

export interface RequestChance {
  value: number;
  reasons: string[];
  /** Why it cannot be acted on at all this year, if it cannot. */
  blocked: string | null;
}

/** How likely the vicar for clergy is to act on the standing letter this year, and why. */
export function requestChance(state: GameState): RequestChance {
  const r = requestOf(state);
  const reasons: string[] = [];
  if (!r) return { value: 0, reasons, blocked: 'Nothing is in the file.' };
  const c = REQUEST.chance;
  const me = playerCandidate(state);
  const weeks = weeksInPost(state);
  const parish = requestedParish(state);
  const open = parish ? state.openings.some((o) => o.parishId === parish.id) : false;
  const vacant = parish ? !state.npcs[parish.pastorId] || state.npcs[parish.pastorId]?.status !== 'active' : false;
  const shortage = state.world?.diocese.hidden.shortage ?? 3;
  let p: number = c.base;
  p += Math.max(0, me.chancery) * c.perChancery;
  if (me.chancery >= 40) reasons.push('the chancery thinks well of you');
  p += Math.min(25, yearsOrdained(state)) * c.perYearOrdained;
  if (open) {
    p += c.openThere;
    reasons.push('the place you asked for is open');
  }
  if (vacant) {
    p += c.vacantThere;
    reasons.push('it has no priest of its own');
  }
  p += shortage * c.perShortage;
  if (shortage >= 5) reasons.push('the diocese is short everywhere, and short dioceses move men');
  const bishop = state.world ? state.npcs[state.world.diocese.hidden.bishop.npcId] : undefined;
  p += (bishop?.relationship ?? 0) * c.perBishopRegard;
  if ((bishop?.relationship ?? 0) >= 30) reasons.push('the bishop is warm to you');
  else if ((bishop?.relationship ?? 0) <= -20) reasons.push('the bishop is cool to you, and it is his signature on the letter');
  const standingYears = (state.clock.week - r.week) / 52;
  p += Math.min(3, standingYears) * c.perYearStanding;
  if (standingYears >= 2) reasons.push('the letter has been in the file a while');
  if (me.indispensable) {
    p += c.indispensable;
    reasons.push('you are the reason this parish is still standing, which is a cage');
  }
  if (state.parish && wasDying(state) && turnaroundOf(state) > 0 && turnaroundOf(state) < 40) {
    p += c.turnaroundHere;
    reasons.push('the parish you are in is turning, and the board can see it');
  }
  // A vicar with three years asking for the parish the diocese watches is reaching.
  if (parish && roleForRequest(state, parish) === 'parochial_vicar' && parish.households >= 2500 && me.chancery < 40) {
    p += c.reach;
    reasons.push('it is above where the board has you just now');
  }
  const value = Math.min(c.ceiling, Math.max(c.floor, p));
  const need = open || vacant || shortage >= 5 ? REQUEST.urgentWeeksInPost : REQUEST.minWeeksInPost;
  const blocked =
    !state.parish ? 'The board will read it when the years here end.' :
    weeks < need ? `You have not been here long enough for the chancery to read it: ${Math.ceil((need - weeks) / 52 * 10) / 10} year${need - weeks > 52 ? 's' : ''} more, or an opening there.` :
    null;
  return { value, reasons, blocked };
}

/** Where it stands, in words, for the sheet. Numbers stay off this page. */
export function requestWord(chance: RequestChance): string {
  if (chance.blocked) return chance.blocked;
  const v = chance.value;
  return v >= 0.35 ? 'The vicar for clergy could act on it any year now.' :
    v >= 0.2 ? 'It has a real chance of being acted on before your arc ends.' :
    v >= 0.1 ? 'It will most likely wait for the board.' :
    'It will wait for the board, and the board may not agree.';
}

export interface RequestStep {
  state: GameState;
  /** Set when the chancery has decided to move him and the letter is on its way. */
  answering: boolean;
  line: string | null;
}

export const REQUEST_FLAGS = {
  answerWeek: 'request:answer_week',
  /** Content reads these: a letter is in the file, and what sort of thing it names. */
  standing: 'request:standing',
  forParish: 'request:for_parish',
  forPost: 'request:for_post',
} as const;
export const REQUEST_BEAT = 'The vicar for clergy writes';

/**
 * A year passes with a letter in the file: the vicar for clergy acts on it,
 * or the file grows older, or it is closed.
 */
export function requestYear(state: GameState, rng: Rng): RequestStep {
  const r = requestOf(state);
  if (!r) return { state, answering: false, line: null };
  if (typeof state.flags[REQUEST_FLAGS.answerWeek] === 'number') return { state, answering: false, line: null };
  // The post he asked for may have stopped existing: a parish is always there, a posting is not.
  if (r.target.kind === 'post' && !offerById(r.target.offerId)) return { state: closeRequest(state, 'lapsed'), answering: false, line: null };
  const standing = (state.clock.week - r.week) / 52;
  const chance = requestChance(state);
  if (!chance.blocked && rng.chance(chance.value)) {
    const week = state.clock.week + rng.int(REQUEST.waitWeeks[0], REQUEST.waitWeeks[1]);
    const beats = [...state.beats.filter((b) => !(b.kind === 'assignment' && b.label === REQUEST_BEAT)), { kind: 'assignment' as const, week, label: REQUEST_BEAT }].sort((a, b) => a.week - b.week);
    return {
      state: { ...state, beats, flags: { ...state.flags, [REQUEST_FLAGS.answerWeek]: week } },
      answering: true,
      line: `The vicar for clergy telephoned about the letter you wrote. He would not say what the bishop has decided, only that something will come in writing.`,
    };
  }
  if (standing >= REQUEST.lapseYears) {
    return {
      state: closeRequest({ ...state, career: [...state.career, { week: state.clock.week, kind: 'note', text: `The file on ${r.label} was closed without an answer.` }] }, 'lapsed'),
      answering: false,
      line: `The vicar for clergy wrote back about ${r.label}, four years on, to say that the file is closed and that you are of course free to write again. It is the politest no in the diocese.`,
    };
  }
  return { state, answering: false, line: null };
}

/** The week the answer is due. */
export function requestAnswerDue(state: GameState): boolean {
  const week = state.flags[REQUEST_FLAGS.answerWeek];
  return typeof week === 'number' && state.clock.week >= week && !!requestOf(state);
}

/** Clear the pending answer, however it went. */
export function clearRequestAnswer(state: GameState): GameState {
  const flags = { ...state.flags };
  delete flags[REQUEST_FLAGS.answerWeek];
  return { ...state, flags, beats: state.beats.filter((b) => !(b.kind === 'assignment' && b.label === REQUEST_BEAT)) };
}

/** He asked, the chancery moved, and he said no. It is remembered. */
export function refuseRequestedMove(state: GameState): GameState {
  const r = requestOf(state);
  const c = state.character;
  if (!r || !c) return state;
  const next = closeRequest(clearRequestAnswer(state), 'refused');
  return {
    ...next,
    character: { ...next.character!, reputation: { ...c.reputation, chancery: Math.max(-100, c.reputation.chancery + REQUEST.refusalCost) } },
    flags: { ...next.flags, 'request:refused': true },
    career: [...next.career, { week: next.clock.week, kind: 'note', text: `Asked for ${r.label}, was offered it, and stayed where you were.` }],
  };
}

/** The file, for the sheets: what he has asked for over a life. */
export function requestHistory(state: GameState): CareerRequest[] {
  return (state.requests ?? []).filter((r, i, all) => all.indexOf(r) === i);
}
