import type { Letter, Chapter, ChapterLevel, ChapterOffice, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { createRng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { religiousOrder } from '@/content/religious';
import { BALLOT, runElection, type Elector } from '../ballot';
import { contendersOf, electorsOf, PLAYER_ID, scoreFor, type Contender, type Voter } from './electorate';

/**
 * Chapters and elections. E3 §3.6–3.7: no one is a declared candidate;
 * every elector scores every eligible man; the ballots run round by round
 * in systems/ballot.ts; the higher superior confirms; the man elected may
 * decline; the term ends and he returns to the ranks. Deterministic from
 * the save's seed and the chapter's week. Tunables are invented.
 */
export const CHAPTER = {
  /** How the player's words in the chapter move the electors who like him: a share of them shift toward the man he spoke for. */
  speakShift: 0.35,
  steerShift: 0.6,
  /** What lobbying does to how ambitious he looks. E3 §3.6 "The ambition inversion". */
  ambition: { speak: 4, speakAgain: 10, steer: 12, willing: 6, unwilling: -3, decline: -8, accept: 3, yearly: -4, humble: -3 },
  /** Standing when steering is seen: too visibly backfires. */
  steerSeen: [{ target: 'reputation', key: 'province', delta: -6 }, { target: 'reputation', key: 'community', delta: -3 }],
  speakTwiceSeen: [{ target: 'reputation', key: 'province', delta: -3 }],
  /** Confirmation by the higher superior: almost always. */
  confirm: { base: 0.96, superiorsFloor: -40, whenLow: 0.6, twiceRefusedFloor: 0.3 },
  /** Declining: honor when the man was legible and humble; a cost when the province needed him. */
  decline: {
    honored: [{ target: 'reputation', key: 'province', delta: 5 }, { target: 'reputation', key: 'superiors', delta: 3 }],
    cost: [{ target: 'reputation', key: 'superiors', delta: -8 }, { target: 'reputation', key: 'province', delta: -3 }],
  },
  accept: [{ target: 'reputation', key: 'superiors', delta: 4 }],
  /** Returning to the ranks well or badly. E3 §3.7. */
  returned: {
    well: [{ target: 'reputation', key: 'province', delta: 8 }, { target: 'reputation', key: 'community', delta: 5 }, { target: 'stat', key: 'piety', delta: 2 }],
    badly: [{ target: 'reputation', key: 'province', delta: -10 }, { target: 'reputation', key: 'community', delta: -8 }, { target: 'reputation', key: 'superiors', delta: -6 }],
  },
} as const;

function termYears(state: GameState, office: ChapterOffice): number {
  const g = religiousOrder(state.religious!.order).governance;
  return office === 'prior' ? g.priorTermYears : office === 'provincial' ? g.provincialTermYears : g.generalTermYears;
}

/** Open a chapter: its electors and its eligible men, nothing decided. */
export function openChapter(state: GameState, level: ChapterLevel, bodyId: string, office?: ChapterOffice): GameState {
  const r = state.religious;
  if (!r) return state;
  const electors = electorsOf(state, level, bodyId);
  const candidates = office ? contendersOf(state, office, bodyId) : [];
  const chapter: Chapter = {
    id: `chapter:${level}:${bodyId}:${state.clock.week}`,
    level,
    week: state.clock.week,
    bodyId,
    electorIds: electors.map((e) => e.id),
    candidateIds: candidates.map((c) => c.id),
    actions: { spokeFor: [] },
    ballots: [],
    ...(office ? { office } : {}),
  };
  return { ...state, religious: { ...r, chapter } };
}

function withActions(state: GameState, patch: (a: Chapter['actions']) => Chapter['actions']): GameState {
  const r = state.religious;
  if (!r?.chapter) return state;
  return { ...state, religious: { ...r, chapter: { ...r.chapter, actions: patch(r.chapter.actions) } } };
}

function moreAmbition(state: GameState, delta: number): GameState {
  const r = state.religious;
  if (!r) return state;
  return { ...state, religious: { ...r, perceivedAmbition: Math.max(0, Math.min(100, r.perceivedAmbition + delta)) } };
}

/** As an elector: the man he votes for, every round. */
export function castVote(state: GameState, candidateId: string): GameState {
  return withActions(state, (a) => ({ ...a, vote: candidateId }));
}

/** Speak for a man in the discussion. Once is heard; twice is too visibly, and raises his own perceived ambition. */
export function speakFor(state: GameState, candidateId: string): GameState {
  const r = state.religious;
  if (!r?.chapter) return state;
  const again = r.chapter.actions.spokeFor.length >= 1;
  let next = withActions(state, (a) => ({ ...a, spokeFor: [...a.spokeFor, candidateId] }));
  next = moreAmbition(next, again ? CHAPTER.ambition.speakAgain : CHAPTER.ambition.speak);
  if (again) next = applyEffects(next, [...CHAPTER.speakTwiceSeen], {}, 'speaking too much at chapter');
  return next;
}

/** Quietly steer a bloc. Effective, and it backfires when seen, which it is whenever the roll says so. */
export function steerBloc(state: GameState, candidateId: string, rng: Rng): GameState {
  let next = withActions(state, (a) => ({ ...a, steered: candidateId }));
  next = moreAmbition(next, CHAPTER.ambition.steer);
  if (rng.chance(0.5)) next = applyEffects(next, [...CHAPTER.steerSeen], {}, 'seen steering a bloc');
  return next;
}

/** As a potential candidate: let it be known, privately and carefully. */
export function signalWillingness(state: GameState, signal: 'willing' | 'unwilling'): GameState {
  const next = withActions(state, (a) => ({ ...a, signal }));
  return moreAmbition(next, signal === 'willing' ? CHAPTER.ambition.willing : CHAPTER.ambition.unwilling);
}

/** The electors as the ballot engine takes them: each man's private scores, with the player's own actions folded in. */
export function buildElectors(state: GameState, chapter: Chapter, voters: Voter[], contenders: Contender[]): Elector[] {
  const office = chapter.office!;
  const seed = `${state.seed}:${chapter.id}`;
  return voters.map((v) => {
    const scores: Record<string, number> = {};
    for (const c of contenders) scores[c.id] = scoreFor(state, seed, v, c, office);
    const e: Elector = { id: v.id, scores };
    if (v.isPlayer) {
      // His own ballot: the man he named, or his best score; and he does not drift.
      if (chapter.actions.vote && scores[chapter.actions.vote] !== undefined) scores[chapter.actions.vote] = 1000;
      e.fickle = 0;
      return e;
    }
    // Those who like him hear him: a share of his standing with them goes to the man he spoke for; more if he steered.
    const warmth = Math.max(0, v.relationshipWithPlayer) / 100;
    for (const id of chapter.actions.spokeFor) if (scores[id] !== undefined) scores[id]! += 100 * CHAPTER.speakShift * warmth;
    if (chapter.actions.steered && scores[chapter.actions.steered] !== undefined) scores[chapter.actions.steered]! += 100 * CHAPTER.steerShift * warmth;
    // Friends in the field: the men of his own house.
    e.friends = contenders.filter((c) => c.houseId && c.houseId === v.houseId && c.id !== v.id).map((c) => c.id);
    return e;
  });
}

/** Run the ballots. The result is written on the chapter, round by round, for the scene. */
export function holdElection(state: GameState): GameState {
  const r = state.religious;
  const chapter = r?.chapter;
  if (!r || !chapter?.office) return state;
  const voters = electorsOf(state, chapter.level, chapter.bodyId).filter((v) => chapter.electorIds.includes(v.id));
  const contenders = contendersOf(state, chapter.office, chapter.bodyId).filter((c) => chapter.candidateIds.includes(c.id));
  if (!voters.length || !contenders.length) return state;
  const electors = buildElectors(state, chapter, voters, contenders);
  const rules = { ...BALLOT, noise: BALLOT.noise * (religiousOrder(r.order).mechanics.democracy ?? 1) };
  const result = runElection(createRng(`${state.seed}:${chapter.id}:ballots`), electors, contenders.map((c) => c.id), rules);
  const ballots = result.rounds.map((round) => ({ round: round.round, tallies: round.tallies, field: round.field, absolute: round.absolute }));
  return { ...state, religious: { ...r, chapter: { ...chapter, ballots, ended: result.ended, outcome: { electedId: result.electedId, accepted: false, confirmed: false } } } };
}

/** Confirmation by the higher superior: almost always given; the refusal is rare and dramatic. */
export function confirmChance(state: GameState, electedId: string): number {
  const c = state.character;
  if (electedId !== PLAYER_ID || !c) return CHAPTER.confirm.base;
  const superiors = c.reputation.superiors ?? 0;
  if (superiors <= CHAPTER.confirm.superiorsFloor) return CHAPTER.confirm.whenLow;
  if (state.religious!.obedience.refused >= 2) return CHAPTER.confirm.twiceRefusedFloor;
  return CHAPTER.confirm.base;
}

/**
 * The man elected answers, and the higher superior confirms or refuses.
 * An NPC accepts; the player says. A declined or refused election goes to
 * the runner-up on the last ballot, marked as a second choice.
 */
export function resolveElection(state: GameState, rng: Rng, playerAccepts = true): GameState {
  const r = state.religious;
  const chapter = r?.chapter;
  if (!r || !chapter?.office || !chapter.outcome) return state;
  let next = state;
  let electedId = chapter.outcome.electedId;
  let second = false;
  const accepted = electedId === PLAYER_ID ? playerAccepts : true;
  if (!accepted) {
    next = declineElection(next);
    electedId = runnerUp(chapter, electedId);
    second = true;
  }
  let confirmed = rng.chance(confirmChance(next, electedId));
  if (!confirmed) {
    next = { ...next, flags: { ...next.flags, [`chapter:refused:${chapter.office}`]: next.clock.week } };
    electedId = runnerUp(chapter, electedId);
    second = true;
    confirmed = true;
  }
  const outcome = { electedId, accepted: true, confirmed, ...(second ? { second: true } : {}) };
  next = { ...next, religious: { ...next.religious!, chapter: { ...next.religious!.chapter!, outcome } } };
  return seat(next, chapter.office, chapter.bodyId, electedId);
}

function runnerUp(chapter: Chapter, notId: string): string {
  const last = chapter.ballots.at(-1);
  if (!last) return notId;
  return Object.entries(last.tallies).filter(([id]) => id !== notId).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? notId;
}

/** Declining carries honor in some cases and costs in others; twice ends the question for good. */
export function declineElection(state: GameState): GameState {
  const r = state.religious;
  const chapter = r?.chapter;
  if (!r || !chapter?.office) return state;
  const office = chapter.office;
  const declined = { ...(r.declined ?? {}), [office]: (r.declined?.[office] ?? 0) + 1 };
  const honored = r.perceivedAmbition < 35;
  let next = applyEffects({ ...state, religious: { ...r, declined } }, [...(honored ? CHAPTER.decline.honored : CHAPTER.decline.cost)], {}, honored ? 'an election declined with grace' : 'an election declined when the province needed him');
  next = moreAmbition(next, CHAPTER.ambition.decline);
  return next;
}

/** Put the elected man in office: the player's term, or the NPC's post on the house or the province. */
function seat(state: GameState, office: ChapterOffice, bodyId: string, electedId: string): GameState {
  const r = state.religious!;
  const week = state.clock.week;
  const years = termYears(state, office);
  if (electedId === PLAYER_ID) {
    const consecutive = r.office?.office === office && r.office.bodyId === bodyId ? r.office.consecutive + 1 : 1;
    let next = applyEffects(state, [...CHAPTER.accept], {}, 'an election accepted');
    next = moreAmbition(next, CHAPTER.ambition.accept);
    next = { ...next, religious: { ...next.religious!, office: { office, bodyId, startWeek: week, endWeek: week + years * 52, consecutive } }, flags: { ...next.flags, [`office:${office}`]: week } };
    return { ...next, career: [...next.career, { week, kind: 'promotion', text: office === 'prior' ? `Elected prior of ${next.orderHouses?.[bodyId]?.name ?? 'the house'}.` : `Elected ${religiousOrder(r.order).governance.provincialTitle}.` }] };
  }
  const flags = { ...state.flags, [`terms:${office}:${electedId}`]: Number(state.flags[`terms:${office}:${electedId}`] ?? 0) + 1 };
  if (office === 'prior') {
    const house = state.orderHouses?.[bodyId];
    if (!house) return state;
    const npcs = { ...state.npcs };
    const old = npcs[house.priorId];
    if (old && old.id !== electedId) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== 'prior') };
    const elected = npcs[electedId];
    if (elected && !elected.tags.includes('prior')) npcs[electedId] = { ...elected, tags: [...elected.tags, 'prior'] };
    return { ...state, flags, npcs, orderHouses: { ...state.orderHouses, [bodyId]: { ...house, priorId: electedId } } };
  }
  if (office === 'provincial' && state.province) {
    const npcs = { ...state.npcs };
    const old = npcs[state.province.provincialId];
    if (old && old.id !== electedId) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== 'provincial') };
    const elected = npcs[electedId];
    if (elected && !elected.tags.includes('provincial')) npcs[electedId] = { ...elected, tags: [...elected.tags, 'provincial'] };
    const year = Math.floor(week / 52) + 2010;
    return { ...state, flags, npcs, province: { ...state.province, provincialId: electedId, provincialSince: year } };
  }
  return { ...state, flags };
}

/** Close the chapter's file. The record of it stays on the player's terms if he was seated. */
export function closeChapter(state: GameState): GameState {
  const r = state.religious;
  if (!r?.chapter) return state;
  const { chapter: _c, ...rest } = r;
  return { ...state, religious: rest };
}

/** The term ends: he returns to the ranks, well or badly, and is assigned by his successor like anyone else. E3 §3.7. */
export function returnToRanks(state: GameState, how: 'well' | 'badly'): GameState {
  const r = state.religious;
  if (!r?.office) return state;
  const term = { office: r.office.office, startWeek: r.office.startWeek, endWeek: state.clock.week };
  const { office: _o, ...rest } = r;
  let next: GameState = { ...state, religious: { ...rest, termsServed: [...r.termsServed, term] }, flags: { ...state.flags, [`returned:${how}`]: state.clock.week } };
  delete next.flags[`office:${term.office}`];
  next = applyEffects(next, [...CHAPTER.returned[how]], {}, how === 'well' ? 'a term ended well' : 'a term ended badly');
  if (how === 'well') next = moreAmbition(next, CHAPTER.ambition.humble);
  return { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `The term as ${term.office} ended, and he returned to the ranks${how === 'well' ? '.' : ', and not gracefully.'}` }] };
}

/** A year passes: perceived ambition fades; a term that has run out ends. */
export function chapterYear(state: GameState): GameState {
  const r = state.religious;
  if (!r) return state;
  return moreAmbition(state, CHAPTER.ambition.yearly);
}

/** Whether the player's term is up. */
export function termOver(state: GameState): boolean {
  const o = state.religious?.office;
  return !!o && state.clock.week >= o.endWeek;
}

/**
 * A chapter the man is neither in nor before: not an elector, not a
 * contender. He watches from the gallery, and there is nothing for him to
 * decide, so the vote is held and confirmed at once and he reads the
 * result as a letter. QOL: no clicking through a room he has no voice in.
 */
export function chapterFromTheGallery(state: GameState, rng: Rng): { state: GameState; letter?: Letter } {
  const r = state.religious;
  const chapter = r?.chapter;
  if (!r || !chapter?.office) return { state };
  if (chapter.electorIds.includes(PLAYER_ID) || chapter.candidateIds.includes(PLAYER_ID)) return { state };
  let next = holdElection(state);
  const out = next.religious?.chapter?.outcome;
  if (!out) return { state };
  next = resolveElection(next, rng, true);
  const elected = next.npcs[next.religious?.chapter?.outcome?.electedId ?? ''];
  const second = next.religious?.chapter?.outcome?.second;
  const order = religiousOrder(r.order);
  const what = chapter.office === 'prior' ? `prior of ${next.orderHouses?.[chapter.bodyId]?.name ?? 'the house'}` : chapter.office === 'provincial' ? order.governance.provincialTitle : 'the office';
  const rounds = next.religious?.chapter?.ballots.length ?? 0;
  next = closeChapter(next);
  const letter: Letter = {
    sort: 'provincial',
    title: chapter.office === 'prior' ? 'The house has elected' : 'The chapter has elected',
    body: [
      `${elected ? `${elected.title} ${elected.name.last}` : 'A man'} is ${what}, elected on the ${rounds === 1 ? 'first' : rounds === 2 ? 'second' : rounds === 3 ? 'third' : `${rounds}th`} ballot${second ? ', after the first choice declined or was not confirmed' : ''}. You were not of the body this time, and heard it from the gallery, which is where most of a province hears most things.`,
    ],
    week: state.clock.week,
  };
  return { state: next, letter };
}
