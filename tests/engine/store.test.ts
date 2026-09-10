import { describe, it, expect, beforeEach } from 'vitest';
import { currentRng, setWeekDraw, useGameStore } from '@/engine/store';
import { noDraw } from '@/engine/clock';

const start = { year: 2010, month: 8, day: 20 };

describe('engine/store', () => {
  beforeEach(() => {
    setWeekDraw(noDraw);
    useGameStore.getState().newGame({ seed: 'store-test', start });
  });

  it('starts paused at week 0 in seminary', () => {
    const { game } = useGameStore.getState();
    expect(game?.clock.week).toBe(0);
    expect(game?.speed).toBe('PAUSED');
    expect(game?.phase).toBe('seminary');
    expect(useGameStore.getState().tick()).toBeNull();
  });

  it('MANUAL ticks one week at a time and does not retain a rewind point', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    expect(s.tick(10)?.kind).toBe('manual');
    expect(useGameStore.getState().game?.clock.week).toBe(1);
    expect(useGameStore.getState().previous).toBeNull();
  });

  it('AUTO runs to a flagged event and retains the prior week', () => {
    setWeekDraw((state) =>
      state.clock.week === 6
        ? [{ eventId: 'ev', severity: 'MAJOR', category: 'personal', week: 6 }]
        : [],
    );
    const s = useGameStore.getState();
    s.setSpeed('AUTO');
    const stop = s.runToStop();
    expect(stop?.kind).toBe('event');
    expect(useGameStore.getState().game?.clock.week).toBe(6);
    expect(useGameStore.getState().previous?.state.clock.week).toBe(5);
  });

  it('rewind restores the prior week, the RNG stream, and drops to MANUAL', () => {
    setWeekDraw((_state, rng) => {
      rng.next(); // consume the stream so the rewind must restore it
      return [];
    });
    const s = useGameStore.getState();
    s.setSpeed('AUTO');
    s.tick(4);
    const before = useGameStore.getState().previous;
    expect(before?.state.clock.week).toBe(3);
    const expectedNext = JSON.stringify(before?.rngState);

    s.rewind();
    const after = useGameStore.getState();
    expect(after.game?.clock.week).toBe(3);
    expect(after.game?.speed).toBe('MANUAL');
    expect(after.previous).toBeNull();
    expect(JSON.stringify(currentRng()?.getState())).toBe(expectedNext);
  });

  it('rewind is a no-op without a retained week', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    s.tick();
    s.rewind();
    expect(useGameStore.getState().game?.clock.week).toBe(1);
  });

  it('export and import round-trip the game and pause it', () => {
    const s = useGameStore.getState();
    s.setSpeed('AUTO');
    s.tick(20);
    s.setInterrupt('scandal', 'never');
    const json = s.exportSave();

    useGameStore.getState().newGame({ seed: 'other', start });
    useGameStore.getState().importSave(json);
    const after = useGameStore.getState();
    expect(after.error).toBeNull();
    expect(after.game?.seed).toBe('store-test');
    expect(after.game?.clock.week).toBe(20);
    expect(after.game?.speed).toBe('PAUSED');
    expect(after.game?.interrupts.scandal).toBe('never');
    expect(after.previous?.state.clock.week).toBe(19);
    expect(after.exportSave()).toBe(useGameStore.getState().exportSave());
  });

  it('a bad import sets an error and leaves the game untouched', () => {
    const s = useGameStore.getState();
    s.importSave('{"version":1}');
    const after = useGameStore.getState();
    expect(after.error).toMatch(/state/);
    expect(after.game?.seed).toBe('store-test');
    after.clearError();
    expect(useGameStore.getState().error).toBeNull();
  });

  it('running only sticks in AUTO or SKIP', () => {
    const s = useGameStore.getState();
    s.setRunning(true);
    expect(useGameStore.getState().running).toBe(false);
    s.setSpeed('AUTO');
    s.setRunning(true);
    expect(useGameStore.getState().running).toBe(true);
    s.setSpeed('PAUSED');
    expect(useGameStore.getState().running).toBe(false);
  });
});
