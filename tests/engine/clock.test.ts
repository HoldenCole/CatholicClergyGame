import { describe, it, expect } from 'vitest';
import { advanceWeek, runClock, stopAfterWeek, type WeekDraw } from '@/engine/clock';
import { newGame } from '@/engine/game';
import type { GameState, PendingEvent, Severity } from '@/types';

function fresh(speed: GameState['speed'] = 'MANUAL'): ReturnType<typeof newGame> {
  const g = newGame({ seed: 'clock-test', start: { year: 2021, month: 8, day: 22 } });
  return { ...g, state: { ...g.state, speed } };
}

const fireAt =
  (week: number, severity: Severity, category: PendingEvent['category'] = 'personal'): WeekDraw =>
  (state) =>
    state.clock.week === week ? [{ eventId: `ev-${week}`, severity, category, week, bindings: {} }] : [];

describe('engine/clock', () => {
  it('advanceWeek moves one week and writes a digest line', () => {
    const { state, rng } = fresh();
    const r = advanceWeek(state, rng);
    expect(r.state.clock.week).toBe(1);
    expect(r.state.digest).toHaveLength(1);
    expect(r.state.digest[0]?.lines[0]).toBe('Week of 29 August 2021 · Ordinary Time');
    expect(state.clock.week).toBe(0); // pure
  });

  it('crosses a year boundary with a year_end beat and bumps gameYear', () => {
    const { state, rng } = fresh();
    let cur = state;
    let beats: string[] = [];
    for (let i = 0; i < 53; i++) {
      const r = advanceWeek(cur, rng);
      cur = r.state;
      beats = beats.concat(r.reachedBeats.map((b) => b.kind));
    }
    expect(cur.gameYear).toBe(2);
    expect(beats).toEqual(['year_end']);
  });

  it('consumes scheduled beats when reached', () => {
    const { state, rng } = fresh();
    const withBeat: GameState = {
      ...state,
      beats: [{ kind: 'evaluation', week: 2, label: 'Annual evaluation' }],
    };
    const r1 = advanceWeek(withBeat, rng);
    expect(r1.reachedBeats).toEqual([]);
    const r2 = advanceWeek(r1.state, rng);
    expect(r2.reachedBeats.map((b) => b.kind)).toEqual(['evaluation']);
    expect(r2.state.beats).toEqual([]);
  });

  it('PAUSED never advances', () => {
    const { state, rng } = fresh('PAUSED');
    const r = runClock(state, rng);
    expect(r.weeksAdvanced).toBe(0);
    expect(r.stop.kind).toBe('paused');
  });

  it('MANUAL advances exactly one week', () => {
    const { state, rng } = fresh('MANUAL');
    const r = runClock(state, rng, { maxWeeks: 20 });
    expect(r.weeksAdvanced).toBe(1);
    expect(r.stop.kind).toBe('manual');
  });

  it('AUTO runs until an event the config flags', () => {
    const { state, rng } = fresh('AUTO');
    const r = runClock(state, rng, { maxWeeks: 30, draw: fireAt(5, 'NOTABLE', 'finance') });
    expect(r.weeksAdvanced).toBe(5);
    expect(r.stop).toMatchObject({ kind: 'event', event: { eventId: 'ev-5' } });
    expect(r.state.pending).toHaveLength(1);
  });

  it('AUTO passes over a routine finance event under the default config', () => {
    const { state, rng } = fresh('AUTO');
    const r = runClock(state, rng, { maxWeeks: 10, draw: fireAt(3, 'ROUTINE', 'finance') });
    expect(r.stop.kind).toBe('cap');
    expect(r.weeksAdvanced).toBe(10);
    expect(r.state.pending).toHaveLength(1); // still queued, just not interrupting
  });

  it('AUTO stops on a beat', () => {
    const { state, rng } = fresh('AUTO');
    const withBeat: GameState = {
      ...state,
      beats: [{ kind: 'assignment', week: 4, label: 'Summer assignment' }],
    };
    const r = runClock(withBeat, rng, { maxWeeks: 30 });
    expect(r.weeksAdvanced).toBe(4);
    expect(r.stop).toMatchObject({ kind: 'beat', beat: { kind: 'assignment' } });
  });

  it('SKIP ignores non-critical events but stops on CRITICAL and on beats', () => {
    const { state, rng } = fresh('SKIP');
    const r1 = runClock(state, rng, { maxWeeks: 20, draw: fireAt(2, 'MAJOR', 'scandal') });
    expect(r1.stop.kind).toBe('cap');

    const { state: s2, rng: rng2 } = fresh('SKIP');
    const r2 = runClock(s2, rng2, { maxWeeks: 20, draw: fireAt(2, 'CRITICAL', 'scandal') });
    expect(r2.weeksAdvanced).toBe(2);
    expect(r2.stop.kind).toBe('event');

    const { state: s3, rng: rng3 } = fresh('SKIP');
    const r3 = runClock(s3, rng3, { maxWeeks: 60 });
    expect(r3.stop).toMatchObject({ kind: 'beat', beat: { kind: 'year_end' } });
    expect(r3.weeksAdvanced).toBe(53);
  });

  it('returns the snapshot before the last week for rewind', () => {
    const { state, rng } = fresh('AUTO');
    const r = runClock(state, rng, { maxWeeks: 7 });
    expect(r.beforeLast?.state.clock.week).toBe(6);
    expect(r.state.clock.week).toBe(7);
  });

  it('stopAfterWeek honors the interrupt config', () => {
    const { state } = fresh('AUTO');
    const ev: PendingEvent = { eventId: 'x', severity: 'ROUTINE', category: 'admin', week: 1, bindings: {} };
    expect(stopAfterWeek('AUTO', { ...state, pending: [ev] }, [])).toBeNull();
    const loud = { ...state, interrupts: { ...state.interrupts, admin: 'ROUTINE' as const } };
    expect(stopAfterWeek('AUTO', { ...loud, pending: [ev] }, [])).toMatchObject({ kind: 'event' });
  });
});
