import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import {
  canRequest,
  clearRequestAnswer,
  closeRequest,
  fileRequest,
  markRequested,
  refuseRequestedMove,
  REQUEST,
  REQUESTABLE_POSTS,
  requestAnswerDue,
  requestChance,
  requestHistory,
  requestOf,
  requestWord,
  requestYear,
  roleForRequest,
  withdrawRequest,
} from '@/systems/request';
import { requestedChoice } from '@/systems/choice';
import { chooseAssignment } from '@/systems/choice';
import { scoreCandidate, PROMOTION } from '@/systems/promotion';
import { playerCandidate } from '@/systems/openings';
import type { GameState, Opening, Parish } from '@/types';

/** A man who has been in his parish long enough for the chancery to read a letter. */
function settled(seed = 'req', overrides: Partial<GameState> = {}): GameState {
  const s = parishState(seed, overrides);
  return { ...s, clock: { ...s.clock, week: s.clock.week + 120 }, parish: { ...s.parish!, arcStartWeek: s.clock.week } };
}

function elsewhere(s: GameState): Parish {
  return s.world!.parishes.find((p) => p.id !== s.parish!.parishId)!;
}

describe('systems/request', () => {
  it('a deacon may not write, and a priest may', () => {
    const s = settled();
    expect(canRequest(s).ok).toBe(true);
    const deacon = { ...s, flags: { ...s.flags, ordained: false } };
    expect(canRequest(deacon).ok).toBe(false);
    expect(() => fileRequest(deacon, { kind: 'parish', parishId: elsewhere(s).id })).toThrow();
  });

  it('one letter stands at a time, and the second withdraws the first', () => {
    const s = settled();
    const others = s.world!.parishes.filter((p) => p.id !== s.parish!.parishId);
    let next = fileRequest(s, { kind: 'parish', parishId: others[0]!.id });
    expect(requestOf(next)?.label).toContain(others[0]!.name);
    next = fileRequest(next, { kind: 'parish', parishId: others[1]!.id });
    expect(requestOf(next)?.label).toContain(others[1]!.name);
    expect(requestOf(next)?.asked).toBe(2);
    const closed = requestHistory(next).filter((r) => r.outcome === 'withdrawn');
    expect(closed).toHaveLength(1);
  });

  it('asking twice inside five years costs the chancery, and the first is free', () => {
    const s = settled();
    const others = s.world!.parishes.filter((p) => p.id !== s.parish!.parishId);
    const before = s.character!.reputation.chancery;
    const one = fileRequest(s, { kind: 'parish', parishId: others[0]!.id });
    expect(one.character!.reputation.chancery).toBe(before);
    const two = fileRequest(one, { kind: 'post', offerId: 'pv_hospital_chaplain' });
    expect(two.character!.reputation.chancery).toBe(before + REQUEST.chanceryPerExtra);
  });

  it('a man may not ask for the parish he is already in, nor for a mitre', () => {
    const s = settled();
    expect(() => fileRequest(s, { kind: 'parish', parishId: s.parish!.parishId })).toThrow();
    expect(() => fileRequest(s, { kind: 'post', offerId: 'ep_diocesan_bishop' })).toThrow();
    expect(REQUESTABLE_POSTS).not.toContain('ep_diocesan_bishop');
    expect(REQUESTABLE_POSTS).not.toContain('ep_auxiliary_bishop');
  });

  it('withdrawing closes the file and leaves nothing standing', () => {
    const s = fileRequest(settled(), { kind: 'post', offerId: 'pv_rome_study' });
    const back = withdrawRequest(s);
    expect(requestOf(back)).toBeNull();
    expect(back.request?.outcome).toBe('withdrawn');
  });

  it('a new man is told to wait, and the years in the post open the file', () => {
    const fresh = parishState('fresh');
    const filed = fileRequest(fresh, { kind: 'parish', parishId: elsewhere(fresh).id });
    expect(requestChance(filed).blocked).toBeTruthy();
    expect(requestWord(requestChance(filed))).toBe(requestChance(filed).blocked);
    const later = { ...filed, clock: { ...filed.clock, week: filed.clock.week + 140 } };
    expect(requestChance(later).blocked).toBeNull();
  });

  it('an opening where he asked, and a chancery that likes him, move the odds', () => {
    const s = settled();
    const there = elsewhere(s);
    const plain = fileRequest(s, { kind: 'parish', parishId: there.id });
    const open: Opening = { id: 'open_there', kind: 'pastor', parishId: there.id, urgency: 70, needsSpanish: false, needsAdmin: false, alignment: 0, week: s.clock.week, label: `Pastor of ${there.name}` };
    const wanted = { ...plain, openings: [open] };
    expect(requestChance(wanted).value).toBeGreaterThan(requestChance(plain).value);
    const liked = { ...wanted, character: { ...wanted.character!, reputation: { ...wanted.character!.reputation, chancery: 70 } } };
    expect(requestChance(liked).value).toBeGreaterThan(requestChance(wanted).value);
    expect(requestChance(liked).reasons.join(' ')).toContain('open');
  });

  it('the letter is read by the board: the opening he named scores higher for him', () => {
    const s = settled();
    const there = elsewhere(s);
    const filed = fileRequest(s, { kind: 'parish', parishId: there.id });
    const open: Opening = { id: 'open_there', kind: 'pastor', parishId: there.id, urgency: 60, needsSpanish: false, needsAdmin: false, alignment: 0, week: s.clock.week, label: `Pastor of ${there.name}` };
    const marked = markRequested({ ...filed, openings: [open] });
    expect(marked.openings[0]!.requested).toBe(true);
    const me = playerCandidate(marked);
    const bishop = marked.world!.diocese.hidden.bishop;
    const plain = scoreCandidate(me, open, bishop, 50, createRng('score'));
    const asked = scoreCandidate(me, marked.openings[0]!, bishop, 50, createRng('score'));
    expect(asked.total - plain.total).toBeCloseTo(PROMOTION.requestedBonus, 5);
    expect(asked.reasons.join(' ')).toContain('by name');
  });

  it('a letter left standing four years is closed by the vicar for clergy', () => {
    const s = settled('lapse');
    const filed = fileRequest(s, { kind: 'parish', parishId: elsewhere(s).id });
    const old = { ...filed, clock: { ...filed.clock, week: filed.clock.week + 52 * REQUEST.lapseYears } };
    // A seed that does not grant it: the file is closed instead.
    let closed = old;
    for (let i = 0; i < 50 && requestOf(closed); i++) {
      const step = requestYear(closed, createRng(`lapse:${i}`));
      closed = step.state;
      if (step.answering) closed = { ...closed, flags: {} };
    }
    expect(requestOf(closed)).toBeNull();
  });

  it('when it is acted on, the answer comes by letter a few weeks later', () => {
    const s = settled('grant');
    const there = elsewhere(s);
    let state = fileRequest(s, { kind: 'parish', parishId: there.id });
    state = { ...state, character: { ...state.character!, reputation: { ...state.character!.reputation, chancery: 90 } }, openings: [{ id: 'o', kind: 'pastor', parishId: there.id, urgency: 90, needsSpanish: false, needsAdmin: false, alignment: 0, week: state.clock.week, label: 'x' }] };
    let answering = false;
    for (let i = 0; i < 60 && !answering; i++) {
      const step = requestYear(state, createRng(`grant:${i}`));
      answering = step.answering;
      if (answering) state = step.state;
    }
    expect(answering).toBe(true);
    expect(requestAnswerDue(state)).toBe(false);
    const due = { ...state, clock: { ...state.clock, week: state.clock.week + REQUEST.waitWeeks[1] } };
    expect(requestAnswerDue(due)).toBe(true);
    const choice = requestedChoice(due);
    expect(choice).toBeTruthy();
    expect(choice!.options).toHaveLength(2);
    expect(choice!.options[0]!.requested).toBe('go');
    expect(choice!.options[1]!.requested).toBe('stay');
    expect(choice!.options[0]!.headline).toContain(there.name);
  });

  it('going closes the post he is in and moves him where he asked', () => {
    const s = settled('go');
    const there = elsewhere(s);
    const filed = fileRequest(s, { kind: 'parish', parishId: there.id });
    const choice = requestedChoice(filed)!;
    const state: GameState = { ...filed, mode: { kind: 'assignment_choice', options: choice.options, why: choice.why } };
    const moved = chooseAssignment(state, 'requested', createRng('go'));
    expect(moved.assignment!.parishId).toBe(there.id);
    expect(moved.parish).toBeNull();
    expect(moved.tenures?.length).toBe(1);
    expect(moved.request?.outcome).toBe('granted');
    expect(moved.mode.kind).toBe('assignment');
  });

  it('staying is allowed, and costs, and closes the file', () => {
    const s = settled('stay');
    const filed = fileRequest(s, { kind: 'parish', parishId: elsewhere(s).id });
    const choice = requestedChoice(filed)!;
    const before = filed.character!.reputation.chancery;
    const state: GameState = { ...filed, mode: { kind: 'assignment_choice', options: choice.options, why: choice.why } };
    const stayed = chooseAssignment(state, 'stay', createRng('stay'));
    expect(stayed.parish).not.toBeNull();
    expect(stayed.character!.reputation.chancery).toBe(before + REQUEST.refusalCost);
    expect(stayed.request?.outcome).toBe('refused');
    expect(stayed.flags['request:refused']).toBe(true);
    expect(stayed.mode.kind).toBe('clock');
  });

  it('a vicar without the years goes as a vicar, and a pastor goes as a pastor', () => {
    const s = settled('role');
    const there = elsewhere(s);
    expect(roleForRequest(s, there)).toBe('parochial_vicar');
    const pastor = { ...s, assignment: { ...s.assignment!, role: 'pastor' as const } };
    expect(roleForRequest(pastor, there)).toBe('pastor');
  });

  it('a posting he asked for is laid out as a posting, not a parish', () => {
    const s = settled('post');
    const filed = fileRequest(s, { kind: 'post', offerId: 'pv_hospital_chaplain' });
    const choice = requestedChoice(filed)!;
    expect(choice.options[0]!.posting).toBe('pv_hospital_chaplain');
    const state: GameState = { ...filed, mode: { kind: 'assignment_choice', options: choice.options, why: choice.why } };
    const gone = chooseAssignment(state, 'requested', createRng('post'));
    expect(gone.study?.program).toBe('hospital_chaplain');
    expect(gone.parish).toBeNull();
    // beginStudy closes the tenure itself; it is written once, not twice.
    expect(gone.tenures?.length).toBe(1);
  });

  it('the answer, once cleared, leaves no beat and no flag behind', () => {
    const s = settled('clear');
    const filed = closeRequest(clearRequestAnswer(fileRequest(s, { kind: 'post', offerId: 'pv_rome_study' })), 'granted');
    expect(filed.flags['request:answer_week']).toBeUndefined();
    expect(filed.beats.some((b) => b.label === 'The vicar for clergy writes')).toBe(false);
    expect(refuseRequestedMove(filed)).toEqual(filed);
  });
});

describe('a life played through', () => {
  it('the book fills as the years pass, and a letter filed mid-run does not break the clock', async () => {
    const { playCareer } = await import('../helpers/career');
    const { useGameStore } = await import('@/engine/store');
    const { ministryOf } = await import('@/systems/ministry');
    const { profileOf } = await import('@/systems/profile');
    const played = playCareer('book-run', 'chicago', 52 * 16);
    expect(played.mode.kind === 'ended' || played.clock.week >= 52 * 15).toBe(true);
    const book = ministryOf(played);
    if (played.flags.ordained) {
      expect(book.masses).toBeGreaterThan(200);
      const p = profileOf(played);
      expect(p.ministry.length).toBeGreaterThan(2);
      expect(p.tenures.length).toBeGreaterThanOrEqual(1);
    }
    // A letter goes in, and the clock keeps running with it in the file.
    const s = useGameStore.getState();
    const game = s.game!;
    if (game.parish && game.world) {
      const other = game.world.parishes.find((p) => p.id !== game.parish!.parishId)!;
      s.fileRequest({ kind: 'parish', parishId: other.id });
      expect(useGameStore.getState().error).toBeNull();
      expect(useGameStore.getState().game!.flags['request:standing']).toBe(true);
      for (let i = 0; i < 200; i++) {
        const now = useGameStore.getState().game!;
        if (now.mode.kind === 'ended') break;
        if (now.pending.length) break;
        if (now.mode.kind === 'letter') { useGameStore.getState().readLetter(); continue; }
        if (now.mode.kind === 'assignment') { useGameStore.getState().acceptAssignment(); continue; }
        if (now.mode.kind === 'assignment_choice') { useGameStore.getState().chooseAssignment(now.mode.options[0]!.id); continue; }
        if (now.mode.kind !== 'clock') break;
        useGameStore.getState().tick();
      }
      expect(useGameStore.getState().error).toBeNull();
    }
  }, 60_000);
});
