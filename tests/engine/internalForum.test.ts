import { describe, it, expect } from 'vitest';
import { applyInternalForum, InternalForumError, isSealed, leaks, SEALED_TARGETS } from '@/engine/internalForum';
import { applyChoice, fireEvent } from '@/engine/events';
import { createRng } from '@/engine/rng';
import { allEvents, eventById } from '@/content';
import { seminaryState } from '../helpers/fixtures';
import type { Effect, GameEvent, GameState } from '@/types';

/** A sealed scene, built here rather than authored, so the engine is what is tested. */
function sealedEvent(effects: Effect[]): GameEvent {
  return {
    id: 'test_sealed',
    internalForum: true,
    phase: 'seminary',
    yearGate: [1, 2, 3, 4, 5, 6, 7],
    pressure: ['doubt'],
    severity: 'ROUTINE',
    category: 'formation',
    baseWeight: 1,
    suppressYears: 1,
    title: 'In the internal forum',
    body: 'x'.repeat(200),
    choices: [{ id: 'say_it', label: 'Say it', effects }],
  };
}

describe('the internal forum is sealed, and the engine enforces it', () => {
  it('accepts what stays inside the room and refuses everything else', () => {
    expect([...SEALED_TARGETS].sort()).toEqual(['flag', 'stat', 'thread']);
    expect(isSealed({ target: 'stat', key: 'piety', delta: 2 })).toBe(true);
    expect(isSealed({ target: 'flag', key: 'sd_disclosed', value: true })).toBe(true);
    expect(isSealed({ target: 'reputation', key: 'chancery', delta: 1 })).toBe(false);
    expect(isSealed({ target: 'relationship', key: '@rector', delta: 5 })).toBe(false);
    expect(leaks([{ target: 'stat', key: 'piety', delta: 1 }, { target: 'reputation', key: 'chancery', delta: 1 }])).toHaveLength(1);
  });

  it('a reputation effect inside the seal fails loudly, and says why', () => {
    const s = seminaryState('seal');
    expect(() => applyInternalForum(s, [{ target: 'reputation', key: 'chancery', delta: 3 }])).toThrow(InternalForumError);
    expect(() => applyInternalForum(s, [{ target: 'reputation', key: 'chancery', delta: 3 }])).toThrow(/sealed/);
    // Every way a thing could get out of the room is refused, one by one.
    for (const bad of [
      { target: 'reputation', key: 'chancery', delta: 1 },
      { target: 'relationship', key: '@rector', delta: 5 },
      { target: 'npc', key: '@rector', value: 'dead' },
      { target: 'position', key: 'latin', delta: 1 },
      { target: 'trait_known', key: '@rector' },
      { target: 'money', key: 'parish', delta: 10 },
    ] as Effect[]) {
      expect(() => applyInternalForum(s, [bad]), bad.target).toThrow(InternalForumError);
    }
    // And what belongs to the man himself goes through.
    const after = applyInternalForum(s, [{ target: 'stat', key: 'piety', delta: 3 }, { target: 'flag', key: 'sd_disclosed', value: true }]);
    expect(after.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
    expect(after.flags.sd_disclosed).toBe(true);
  });

  it('a sealed event resolved through the engine cannot leak, whatever its choice says', () => {
    const s = seminaryState('fire');
    const ok = sealedEvent([{ target: 'stat', key: 'piety', delta: 2 }]);
    const fired = fireEvent(s, ok, createRng('a'));
    const done = applyChoice(fired.state, ok, fired.pending, 'say_it', () => undefined);
    expect(done.state.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
    expect(done.state.character!.reputation).toEqual(s.character!.reputation);

    const bad = sealedEvent([{ target: 'reputation', key: 'chancery', delta: 5 }]);
    const fired2 = fireEvent(s, bad, createRng('b'));
    expect(() => applyChoice(fired2.state, bad, fired2.pending, 'say_it', () => undefined)).toThrow(InternalForumError);

    // The same effect on an ordinary event is fine: the seal is the flag, not the effect.
    const open: GameEvent = { ...bad, id: 'test_open', internalForum: false };
    const fired3 = fireEvent(s, open, createRng('c'));
    expect(() => applyChoice(fired3.state, open, fired3.pending, 'say_it', () => undefined)).not.toThrow();
  });

  it('every authored direction scene is sealed, and none of them can reach the rector', () => {
    const sealed = allEvents.filter((e) => e.internalForum);
    expect(sealed.length).toBeGreaterThanOrEqual(8);
    for (const e of sealed) {
      for (const ch of e.choices) {
        for (const eff of ch.effects) expect(SEALED_TARGETS, `${e.id} › ${ch.id}`).toContain(eff.target);
      }
    }
    // The first hour is sealed; the mission preached in the parish is not.
    expect(eventById('sd_the_first_hour')!.internalForum).toBe(true);
    expect(eventById('rl_diverged_mission')!.internalForum).toBeUndefined();
  });
});

/** A guard against the rule being quietly dropped later. */
describe('the seal holds for a whole state', () => {
  it('nothing in a sealed scene touches reputation, the evaluation, or another NPC', () => {
    const s: GameState = seminaryState('whole');
    const before = JSON.stringify({ reputation: s.character!.reputation, npcs: s.npcs, seminary: s.seminary });
    const ev = sealedEvent([{ target: 'stat', key: 'piety', delta: 4 }, { target: 'flag', key: 'x', value: true }]);
    const fired = fireEvent(s, ev, createRng('w'));
    const after = applyChoice(fired.state, ev, fired.pending, 'say_it', () => undefined).state;
    expect(JSON.stringify({ reputation: after.character!.reputation, npcs: after.npcs, seminary: after.seminary })).toBe(before);
  });
});
