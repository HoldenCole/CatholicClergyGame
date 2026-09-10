import { describe, it, expect } from 'vitest';
import { runClock, type WeekDraw } from '@/engine/clock';
import { newGame } from '@/engine/game';
import { buildSave, deserialize, rngFromSave, serialize, SaveError } from '@/engine/save';
import type { GameState } from '@/types';

/** A draw that fires a variety of events, using the RNG so the stream matters. */
const busyDraw: WeekDraw = (state, rng) => {
  if (!rng.chance(0.15)) return [];
  const severity = rng.pick(['ROUTINE', 'NOTABLE', 'MAJOR'] as const);
  const category = rng.pick(['finance', 'admin', 'group', 'classmate'] as const);
  return [{ eventId: `ev-${state.clock.week}`, severity, category, week: state.clock.week }];
};

/** Play forward: AUTO through interrupts, resolving each pending event with a fixed choice. */
function play(seed: string, weeks: number): { state: GameState; json: string } {
  const g = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  let state: GameState = {
    ...g.state,
    speed: 'AUTO',
    beats: [{ kind: 'evaluation', week: 40, label: 'Annual evaluation' }],
  };
  const rng = g.rng;
  let previous = null;
  while (state.clock.week < weeks) {
    const r = runClock(state, rng, { maxWeeks: weeks - state.clock.week, draw: busyDraw });
    state = r.state;
    previous = r.beforeLast;
    // "Resolve" every pending event with its first choice, moving it into history.
    state = {
      ...state,
      history: [...state.history, ...state.pending.map((p) => ({ eventId: p.eventId, choiceId: 'a', week: p.week }))],
      pending: [],
    };
  }
  const save = buildSave(state, rng, previous, { 'ev-3': 'cached prose' });
  return { state, json: serialize(save) };
}

describe('engine/save', () => {
  it('round-trips a busy state with deep equality', () => {
    const { json } = play('roundtrip', 200);
    const save = deserialize(json);
    expect(serialize(save)).toBe(json);
    expect(save.state.clock.week).toBe(200);
    expect(save.state.history.length).toBeGreaterThan(10);
    expect(save.previous?.state.clock.week).toBe(199);
    expect(save.prose['ev-3']).toBe('cached prose');
  });

  it('resumes the RNG stream exactly from a save', () => {
    const g = newGame({ seed: 'resume', start: { year: 2010, month: 8, day: 20 } });
    for (let i = 0; i < 25; i++) g.rng.next();
    const json = serialize(buildSave(g.state, g.rng, null));
    const resumed = rngFromSave(deserialize(json));
    const a = Array.from({ length: 5 }, () => g.rng.next());
    const b = Array.from({ length: 5 }, () => resumed.next());
    expect(b).toEqual(a);
  });

  it('a replay from the same seed and choices is byte-identical', () => {
    const a = play('replay-seed', 300);
    const b = play('replay-seed', 300);
    expect(a.json).toBe(b.json);
    expect(a.state).toEqual(b.state);
  });

  it('a different seed produces a different save', () => {
    const a = play('seed-one', 120);
    const b = play('seed-two', 120);
    expect(a.json).not.toBe(b.json);
  });

  it('stable serialization ignores key insertion order', () => {
    const g = newGame({ seed: 'order' });
    const reordered = JSON.parse(JSON.stringify(g.state));
    const shuffled: Record<string, unknown> = {};
    for (const key of Object.keys(reordered).reverse()) shuffled[key] = reordered[key];
    const s1 = serialize(buildSave(g.state, g.rng, null));
    const s2 = serialize(buildSave(shuffled as unknown as GameState, g.rng, null));
    expect(s1).toBe(s2);
  });

  it('rejects malformed saves with SaveError', () => {
    expect(() => deserialize('nope')).toThrow(SaveError);
    expect(() => deserialize('[]')).toThrow(SaveError);
    expect(() => deserialize(JSON.stringify({ version: 99 }))).toThrow(/version/);
    const g = newGame({ seed: 'bad' });
    const good = JSON.parse(serialize(buildSave(g.state, g.rng, null)));
    const noSeed = { ...good, state: { ...good.state, seed: '' } };
    expect(() => deserialize(JSON.stringify(noSeed))).toThrow(/seed/);
    const badSpeed = { ...good, state: { ...good.state, speed: 'FAST' } };
    expect(() => deserialize(JSON.stringify(badSpeed))).toThrow(/speed/);
    const noRng = { ...good, rngState: undefined };
    expect(() => deserialize(JSON.stringify(noRng))).toThrow(/rngState/);
  });
});
