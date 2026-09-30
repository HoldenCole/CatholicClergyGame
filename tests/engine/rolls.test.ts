import { describe, expect, it } from 'vitest';
import { applyChoice, fireEvent, rollChance, rollChoice } from '@/engine/events';
import { resolvePendingWithOutcome } from '@/engine/weekHook';
import { createRng } from '@/engine/rng';
import { choiceMeaning } from '@/systems/choiceMeaning';
import { seminaryState, testEvent } from '../helpers/fixtures';
import type { Choice, GameEvent, GameState } from '@/types';

const rolled: Choice = {
  id: 'try',
  label: 'Try it',
  outcome: 'The authored outcome, which the branch replaces when the dice are thrown.',
  effects: [{ target: 'stat', key: 'knowledge', delta: 1 }],
  roll: {
    chance: 0.5,
    stat: 'theology',
    per: 100,
    success: { outcome: 'It went well, and the room noticed, and the professor said so at the door.', effects: [{ target: 'stat', key: 'theology', delta: 2 }] },
    failure: { outcome: 'It did not go well, and the room noticed that too, and nobody said anything at the door.', effects: [{ target: 'stat', key: 'piety', delta: 1 }] },
  },
};

function withStat(s: GameState, theology: number): GameState {
  return { ...s, character: { ...s.character!, stats: { ...s.character!.stats, theology } } };
}

describe('choice rolls (owner\'s feedback: some things always fire, some are dice)', () => {
  it('the odds move with the stat and stay between one in twenty and nineteen in twenty', () => {
    const s = seminaryState('odds');
    expect(rollChance(rolled.roll!, withStat(s, 50))).toBe(0.5);
    expect(rollChance(rolled.roll!, withStat(s, 80))).toBeCloseTo(0.8, 5);
    expect(rollChance(rolled.roll!, withStat(s, 0))).toBe(0.05);
    expect(rollChance(rolled.roll!, withStat(s, 100))).toBe(0.95);
    expect(rollChance({ ...rolled.roll!, stat: undefined as never, per: undefined as never }, withStat(s, 100))).toBe(0.5);
  });

  it('is deterministic in the seed, the scene, and the week, and the branch\'s effects and prose come on top of the base', () => {
    const e = testEvent({ id: 'dice', choices: [rolled, { id: 'no', label: 'No', effects: [], outcome: 'Nothing was tried, and nothing came of it, and the week went on as weeks do.' }] });
    const s = withStat(seminaryState('dice'), 50);
    const fired = fireEvent(s, e, createRng('f'));
    const queued = { ...fired.state, pending: [fired.pending] };
    const a = applyChoice(queued, e, fired.pending, 'try', () => undefined);
    const b = applyChoice(queued, e, fired.pending, 'try', () => undefined);
    expect(a.rolled).toBeDefined();
    expect(a.rolled).toBe(b.rolled);
    expect(a.state).toEqual(b.state);
    expect(rollChoice(queued, e, rolled)).toBe(a.rolled);
    expect(a.outcome).toBe(rolled.roll![a.rolled!].outcome);
    expect(a.state.character!.stats.knowledge).toBe(s.character!.stats.knowledge + 1);
    if (a.rolled === 'success') expect(a.state.character!.stats.theology).toBe(50 + 2);
    else expect(a.state.character!.stats.piety).toBe(s.character!.stats.piety + 1);
    expect(a.state.history.at(-1)).toEqual({ eventId: 'dice', choiceId: 'try', week: 0, rolled: a.rolled });
    // Another week, other dice; and a sure man is nearly sure.
    const later = { ...queued, clock: { ...queued.clock, week: 7 } };
    const outcomes = new Set<string>();
    for (let w = 0; w < 40; w++) outcomes.add(rollChoice({ ...later, clock: { ...later.clock, week: w } }, e, rolled)!);
    expect(outcomes.size).toBe(2);
    let wins = 0;
    for (let w = 0; w < 40; w++) if (rollChoice(withStat({ ...later, clock: { ...later.clock, week: w } }, 100), e, rolled) === 'success') wins++;
    expect(wins).toBeGreaterThanOrEqual(34);
    // A choice without dice rolls nothing and keeps its own prose.
    const plain = applyChoice(queued, e, fired.pending, 'no', () => undefined);
    expect(plain.rolled).toBeUndefined();
    expect(plain.outcome).toBe(e.choices[1]!.outcome);
    expect(plain.state.history.at(-1)).toEqual({ eventId: 'dice', choiceId: 'no', week: 0 });
  });

  it('what came of it is handed to the sheet, rendered, with the scene and the choice', () => {
    const e: GameEvent = testEvent({ id: 'dice2', title: 'The Exam', choices: [rolled] });
    const s = withStat(seminaryState('sheet'), 50);
    const fired = fireEvent(s, e, createRng('f'));
    const queued = { ...fired.state, pending: [fired.pending] };
    const r = resolvePendingWithOutcome(queued, fired.pending, 'try', createRng('r'), { pool: [e], lookup: (id) => (id === 'dice2' ? e : undefined) });
    expect(r.outcome).toMatchObject({ eventId: 'dice2', choiceId: 'try', week: 0, title: 'The Exam', label: 'Try it' });
    expect(r.outcome!.rolled).toBeDefined();
    expect(r.outcome!.text).toBe(rolled.roll![r.outcome!.rolled!].outcome);
    expect(r.state.pending).toEqual([]);
    expect(r.state.digest.at(-1)!.lines.at(-1)).toBe('The Exam: Try it.');
    // The meaning line says the odds in words, and the stat that moves them.
    expect(choiceMeaning(rolled)).toMatch(/Even odds, better with theology/);
    expect(choiceMeaning({ ...rolled, roll: { ...rolled.roll!, chance: 0.8 } })).toMatch(/Likely to go your way/);
    expect(choiceMeaning({ ...rolled, roll: { ...rolled.roll!, chance: 0.2 } })).toMatch(/A long shot/);
  });

  it('the internal forum seals the branches too', () => {
    const e = testEvent({ id: 'sealed', internalForum: true, choices: [{ ...rolled, effects: [], roll: { ...rolled.roll!, success: { outcome: rolled.roll!.success.outcome, effects: [{ target: 'reputation', key: 'chancery', delta: 5 }] } } }] });
    const s = seminaryState('sealed');
    const fired = fireEvent(s, e, createRng('f'));
    const queued = { ...fired.state, pending: [fired.pending] };
    const sure = withStat(queued, 100);
    expect(rollChoice(sure, e, e.choices[0]!)).toBe('success');
    expect(() => applyChoice(sure, e, fired.pending, 'try', () => undefined)).toThrow();
  });
});
