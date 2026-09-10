import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '@/engine/conditions';
import { applyEffect, EffectError } from '@/engine/effects';
import {
  applyChoice,
  defaultChoice,
  drawEvents,
  eventWeight,
  fireEvent,
  isEligible,
  visibleChoices,
} from '@/engine/events';
import { createRng } from '@/engine/rng';
import { renderText } from '@/engine/text';
import { resolveSelector } from '@/engine/selectors';
import { seminaryState, testEvent } from '../helpers/fixtures';
import type { GameEvent, GameState } from '@/types';

describe('engine/conditions', () => {
  const state = seminaryState();
  const ev = (c: Parameters<typeof evaluateCondition>[0], s: GameState = state) => evaluateCondition(c, s);

  it('evaluates every condition type', () => {
    expect(ev({ type: 'stat', key: 'piety', op: '>=', value: 40 })).toBe(true);
    expect(ev({ type: 'stat', key: 'piety', op: '>=', value: 41 })).toBe(false);
    expect(ev({ type: 'reputation', key: 'chancery', op: '<=', value: 0 })).toBe(true);
    expect(ev({ type: 'relationship', npcId: '@closest_classmate', op: '>=', value: 30 })).toBe(true);
    expect(ev({ type: 'relationship', npcId: '@rival_classmate', op: '<=', value: -10 })).toBe(true);
    expect(ev({ type: 'relationship', npcId: 'nobody', op: '>=', value: 0 })).toBe(false);
    expect(ev({ type: 'credential', key: 'STB' })).toBe(false);
    expect(ev({ type: 'flag', key: 'x', value: false })).toBe(true);
    expect(ev({ type: 'flag', key: 'x', value: true }, { ...state, flags: { x: 1 } })).toBe(true);
    expect(ev({ type: 'flag', key: 'x', value: true }, { ...state, flags: { x: 0 } })).toBe(false);
    expect(ev({ type: 'alignment', op: '<=', value: 0 })).toBe(true);
    expect(ev({ type: 'outspokenness', op: '>=', value: 1 })).toBe(false);
    expect(ev({ type: 'phase', value: 'seminary' })).toBe(true);
    expect(ev({ type: 'season', value: 'ordinary' })).toBe(true);
    expect(ev({ type: 'pillar', key: 'human', op: '>=', value: 0 })).toBe(true);
    expect(ev({ type: 'year', op: '<=', value: 1 })).toBe(true);
    expect(ev({ type: 'thread', key: 't', open: false })).toBe(true);
    expect(ev({ type: 'not', inner: { type: 'phase', value: 'pastor' } })).toBe(true);
    expect(ev({ type: 'any', inner: [{ type: 'phase', value: 'pastor' }, { type: 'phase', value: 'seminary' }] })).toBe(true);
    expect(ev({ type: 'all', inner: [{ type: 'phase', value: 'pastor' }, { type: 'phase', value: 'seminary' }] })).toBe(false);
  });

  it('resolves selectors by tag, relationship, and index', () => {
    expect(resolveSelector(state, '@rector')?.id).toBe('rector');
    expect(resolveSelector(state, '@closest_classmate')?.id).toBe('c1');
    expect(resolveSelector(state, '@rival_classmate')?.id).toBe('c2');
    expect(resolveSelector(state, '@classmate:1')?.id).toBe('c2');
    expect(resolveSelector(state, '@random_classmate', createRng('x'))?.role).toBe('classmate');
    expect(resolveSelector(state, '@nobody')).toBeNull();
    expect(resolveSelector(state, 'c3')?.id).toBe('c3');
  });

  it('ignores departed NPCs', () => {
    const gone = { ...state, npcs: { ...state.npcs, c1: { ...state.npcs.c1!, status: 'left' as const } } };
    expect(resolveSelector(gone, '@closest_classmate')?.id).toBe('c3');
  });
});

describe('engine/text', () => {
  it('substitutes player, NPC, and extra tokens and leaves unknown ones visible', () => {
    const state = seminaryState();
    const out = renderText(
      '{first_name} {surname} saw {@rector} and {@rector.full}; {@closest_classmate} ({@closest_classmate.last}) in {diocese}. {mystery}',
      state,
      {},
      { diocese: 'Chicago' },
    );
    expect(out).toBe('Thomas Reilly saw Msgr. Kearney and Msgr. James Kearney; Paul (Nowak) in Chicago. {mystery}');
  });

  it('honors bindings over live resolution', () => {
    const state = seminaryState();
    expect(renderText('{@closest_classmate}', state, { '@closest_classmate': 'c3' })).toBe('Kevin');
  });
});

describe('engine/effects', () => {
  const state = seminaryState();

  it('applies each supported target', () => {
    let s = applyEffect(state, { target: 'stat', key: 'piety', delta: 5 });
    expect(s.character?.stats.piety).toBeCloseTo(45);
    s = applyEffect(s, { target: 'reputation', key: 'chancery', delta: -7 });
    expect(s.character?.reputation.chancery).toBe(-7);
    s = applyEffect(s, { target: 'relationship', key: '@rector', delta: 12 });
    expect(s.npcs.rector?.relationship).toBe(12);
    s = applyEffect(s, { target: 'flag', key: 'met_rector', value: true });
    s = applyEffect(s, { target: 'flag', key: 'late_count', delta: 1 });
    s = applyEffect(s, { target: 'flag', key: 'late_count', delta: 1 });
    expect(s.flags).toMatchObject({ met_rector: true, late_count: 2 });
    s = applyEffect(s, { target: 'pillar', key: 'spiritual', delta: 3 });
    expect(s.seminary?.pillarScores.spiritual).toBe(3);
    s = applyEffect(s, { target: 'alignment', key: '', delta: -15 });
    expect(s.character?.alignment).toBe(-15);
    s = applyEffect(s, { target: 'outspokenness', key: '', delta: 10 });
    s = applyEffect(s, { target: 'honesty', key: '', delta: 2 });
    s = applyEffect(s, { target: 'credential', key: 'STB' });
    s = applyEffect(s, { target: 'credential', key: 'STB' });
    expect(s.character?.credentials).toEqual(['STB']);
    s = applyEffect(s, { target: 'trait', key: 'reads a document properly' });
    s = applyEffect(s, { target: 'archetype', key: 'teaching', delta: 2 });
    expect(s.character?.archetypeLeaning.teaching).toBe(2);
    s = applyEffect(s, { target: 'concern', key: 'Isolated from classmates' });
    expect(s.seminary?.concerns).toEqual(['Isolated from classmates']);
    s = applyEffect(s, { target: 'risk', key: 'old_debt', value: 'An unpaid debt', delta: 2 });
    expect(s.character?.latentRisks[0]).toEqual({ id: 'old_debt', label: 'An unpaid debt', severity: 2 });
    s = applyEffect(s, { target: 'npc', key: '@rival_classmate', value: 'left' });
    expect(s.npcs.c2?.status).toBe('left');
    s = applyEffect(s, { target: 'end', key: 'left_seminary', value: 'He went home.' });
    expect(s.mode).toEqual({ kind: 'ended', ending: 'left_seminary', summary: 'He went home.' });
    expect(s.speed).toBe('PAUSED');
  });

  it('is pure and throws on effects the state cannot take', () => {
    applyEffect(state, { target: 'stat', key: 'piety', delta: 5 });
    expect(state.character?.stats.piety).toBe(40);
    expect(() => applyEffect({ ...state, character: null }, { target: 'stat', key: 'piety', delta: 5 })).toThrow(EffectError);
    expect(() => applyEffect(state, { target: 'money', key: 'x', delta: 5 })).toThrow(EffectError);
  });
});

describe('engine/events', () => {
  const state = seminaryState();

  it('checks phase, year gate, requires, once, suppression, and selector resolution', () => {
    expect(isEligible(testEvent(), state)).toBe(true);
    expect(isEligible(testEvent({ phase: 'pastor' }), state)).toBe(false);
    expect(isEligible(testEvent({ yearGate: [2, 3] }), state)).toBe(false);
    expect(isEligible(testEvent({ requires: [{ type: 'stat', key: 'piety', op: '>=', value: 90 }] }), state)).toBe(false);
    expect(isEligible(testEvent({ once: true }), { ...state, firedOnce: ['ev'] })).toBe(false);
    expect(isEligible(testEvent(), { ...state, suppressedUntil: { ev: 10 } })).toBe(false);
    expect(isEligible(testEvent(), { ...state, suppressedUntil: { ev: 0 } })).toBe(true);
    expect(isEligible(testEvent({ body: 'Talk to {@spiritual_director}.' }), state)).toBe(false);
    expect(isEligible(testEvent({ body: 'Talk to {@rector}.' }), state)).toBe(true);
  });

  it('weights by bias multipliers that apply', () => {
    const e = testEvent({
      baseWeight: 10,
      bias: [
        { when: { type: 'flag', key: 'motive:grief', value: true }, multiplier: 3 },
        { when: { type: 'stat', key: 'piety', op: '>=', value: 90 }, multiplier: 0 },
      ],
    });
    expect(eventWeight(e, state)).toBe(10);
    expect(eventWeight(e, { ...state, flags: { 'motive:grief': true } })).toBe(30);
    const saintly = { ...state, character: { ...state.character!, stats: { ...state.character!.stats, piety: 95 } } };
    expect(eventWeight(e, saintly)).toBe(0);
  });

  it('draws without replacement, weighted, and deterministically', () => {
    const pool: GameEvent[] = [
      testEvent({ id: 'a', baseWeight: 1 }),
      testEvent({ id: 'b', baseWeight: 1 }),
      testEvent({ id: 'c', baseWeight: 100 }),
      testEvent({ id: 'd', baseWeight: 0 }),
      testEvent({ id: 'e', phase: 'pastor', baseWeight: 100 }),
    ];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const picks = drawEvents(pool, state, createRng(`draw-${i}`), 2);
      expect(new Set(picks.map((p) => p.id)).size).toBe(2);
      for (const p of picks) counts[p.id] = (counts[p.id] ?? 0) + 1;
    }
    expect(counts.c).toBe(300);
    expect(counts.d).toBeUndefined();
    expect(counts.e).toBeUndefined();
    expect(drawEvents(pool, state, createRng('same'), 3)).toEqual(drawEvents(pool, state, createRng('same'), 3));
  });

  it('fireEvent binds selectors and sets suppression and once', () => {
    const e = testEvent({ id: 'bind', body: '{@closest_classmate} and {@random_classmate}', once: true, suppressYears: 3 });
    const r = fireEvent(state, e, createRng('fire'));
    expect(r.pending.bindings['@closest_classmate']).toBe('c1');
    expect(['c1', 'c2', 'c3']).toContain(r.pending.bindings['@random_classmate']);
    expect(r.state.suppressedUntil.bind).toBe(3 * 52);
    expect(r.state.firedOnce).toContain('bind');
    expect(isEligible(e, r.state)).toBe(false);
  });

  it('hides unavailable choices only when marked hidden, and picks defaults', () => {
    const e = testEvent({
      choices: [
        { id: 'locked', label: 'L', requires: [{ type: 'stat', key: 'theology', op: '>=', value: 99 }], effects: [] },
        { id: 'secret', label: 'S', hidden: true, requires: [{ type: 'flag', key: 'nope', value: true }], effects: [] },
        { id: 'plain', label: 'P', effects: [] },
        { id: 'routine', label: 'R', default: true, effects: [] },
      ],
    });
    const views = visibleChoices(e, state, {});
    expect(views.map((v) => `${v.choice.id}:${v.available}`)).toEqual(['locked:false', 'plain:true', 'routine:true']);
    expect(defaultChoice(e, state, {})?.id).toBe('routine');
  });

  it('applyChoice applies effects, positions, threads, follow-ups, and history', () => {
    const followUp = testEvent({ id: 'later', body: 'later' });
    const e = testEvent({
      id: 'first',
      choices: [
        {
          id: 'speak',
          label: 'Say it in class',
          volume: 'semi_public',
          positionTopic: 'tlm',
          positionValue: -50,
          effects: [
            { target: 'relationship', key: '@closest_classmate', delta: 5 },
            { target: 'pillar', key: 'intellectual', delta: 2 },
          ],
          opensThread: 'tlm_remark',
          followUpId: 'later',
        },
        { id: 'quiet', label: 'Keep quiet', effects: [], resolvesThread: 'tlm_remark' },
      ],
    });
    const fired = fireEvent(state, e, createRng('x'));
    const queued = { ...fired.state, pending: [fired.pending] };
    const lookup = (id: string) => (id === 'later' ? followUp : undefined);
    const r = applyChoice(queued, e, fired.pending, 'speak', lookup);
    expect(r.state.npcs.c1?.relationship).toBe(35);
    expect(r.state.seminary?.pillarScores.intellectual).toBe(2);
    expect(r.state.character?.positions).toHaveLength(1);
    expect(r.state.character?.outspokenness).toBeGreaterThan(0);
    expect(r.state.character?.alignment).toBeLessThan(0);
    expect(r.state.threads.tlm_remark?.openedBy).toBe('first');
    expect(r.state.history).toEqual([{ eventId: 'first', choiceId: 'speak', week: 0 }]);
    expect(r.state.pending).toEqual([]);
    expect(r.followUp?.id).toBe('later');

    const fired2 = fireEvent(r.state, e, createRng('y'));
    const r2 = applyChoice({ ...fired2.state, pending: [fired2.pending] }, e, fired2.pending, 'quiet', lookup, true);
    expect(r2.state.threads.tlm_remark).toBeUndefined();
    expect(r2.state.history[1]).toEqual({ eventId: 'first', choiceId: 'quiet', week: 0, auto: true });
    expect(r2.followUp).toBeNull();
  });

  it('applyChoice refuses an unavailable choice', () => {
    const e = testEvent({
      choices: [{ id: 'locked', label: 'L', requires: [{ type: 'stat', key: 'theology', op: '>=', value: 99 }], effects: [] }],
    });
    const fired = fireEvent(state, e, createRng('x'));
    expect(() => applyChoice(fired.state, e, fired.pending, 'locked', () => undefined)).toThrow(/not available/);
  });
});
