import { describe, it, expect } from 'vitest';
import { runClock } from '@/engine/clock';
import { createRng } from '@/engine/rng';
import { parishWeekHook, resolvePending, type EventDeps } from '@/engine/weekHook';
import { setDiscretionary, setObligation, startAssignment } from '@/engine/parish';
import { buildSave, deserialize, rngFromSave, serialize } from '@/engine/save';
import { testEvent } from '../helpers/fixtures';
import { parishState } from '../systems/week.test';
import type { GameEvent, GameState } from '@/types';

function deps(): EventDeps {
  const pool: GameEvent[] = Array.from({ length: 12 }, (_, i) =>
    testEvent({
      id: `pv_ev${i}`,
      phase: 'parochial_vicar',
      severity: i % 3 === 0 ? 'ROUTINE' : 'NOTABLE',
      category: 'personal',
      suppressYears: 1,
      choices: [
        { id: 'a', label: 'A', default: true, effects: [{ target: 'reputation', key: 'parishioners', delta: 1 }] },
        { id: 'b', label: 'B', effects: [{ target: 'money', key: 'cash', delta: -1000 }] },
      ],
    }),
  );
  return { pool, lookup: (id) => pool.find((e) => e.id === id) };
}

describe('engine/parish', () => {
  it('startAssignment generates staff and parishioners, a routine, an arc, and played weeks', () => {
    const s = parishState('arc');
    const p = s.parish!;
    expect(p.role).toBe('parochial_vicar');
    expect(p.arcEndWeek - p.arcStartWeek).toBeGreaterThanOrEqual(2 * 52);
    expect(p.arcEndWeek - p.arcStartWeek).toBeLessThanOrEqual(8 * 52);
    expect(p.playedWeeks.length).toBeGreaterThanOrEqual(4);
    expect(p.staffIds.length).toBeGreaterThanOrEqual(1);
    const lay = Object.values(s.npcs).filter((n) => n.role === 'lay' && n.tags.includes(`parish:${p.parishId}`));
    expect(lay.length).toBeGreaterThanOrEqual(7);
    expect(s.flags['role:parochial_vicar']).toBe(true);
    expect(s.beats.find((b) => b.kind === 'assignment')?.week).toBe(p.arcEndWeek);
    expect(s.mode.kind).toBe('clock');
  });

  it('the routine is editable and validated by the planner', () => {
    let s = parishState('routine');
    s = setObligation(s, 'sunday_masses', 'invested');
    s = setDiscretionary(s, 'civic', 2);
    s = setDiscretionary(s, 'study', 0);
    expect(s.parish!.routine.obligations.sunday_masses).toBe('invested');
    expect(s.parish!.routine.discretionary).toEqual({ visits: 1, prayer: 1, civic: 2 });
  });

  it('AUTO plays a year: digest lines every week, events at played weeks, the routine resolving', () => {
    const d = deps();
    let s: GameState = { ...parishState('year'), speed: 'AUTO' };
    const scheduled = s.parish!.playedWeeks.filter((w) => w <= 52).length;
    const rng = createRng('year-run');
    let events = 0;
    for (let guard = 0; guard < 80 && s.clock.week < 52; guard++) {
      const r = runClock(s, rng, { maxWeeks: 52 - s.clock.week, hook: parishWeekHook(d) });
      s = r.state;
      if (s.pending.length) {
        events++;
        s = resolvePending(s, s.pending[0]!, 'a', rng, d);
      }
    }
    expect(s.clock.week).toBe(52);
    expect(s.parish!.weeksServed).toBe(52);
    expect(events + s.history.filter((h) => h.auto).length).toBe(scheduled);
    const week10 = s.digest.find((d) => d.week === 10)!;
    expect(week10.lines.some((l) => /Collections/.test(l))).toBe(true);
    expect(week10.lines.length).toBeGreaterThanOrEqual(3);
    expect(week10.lines.length).toBeLessThanOrEqual(6);
  });

  it('SKIP runs to the end of the arc and the bishop reassigns with carryover', () => {
    const d = deps();
    let s: GameState = { ...parishState('arc-end'), speed: 'SKIP' };
    s = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, parishioners: 40 } } };
    const rng = createRng('skip-arc');
    const end = s.parish!.arcEndWeek;
    for (let guard = 0; guard < 40 && s.mode.kind === 'clock'; guard++) {
      s = runClock(s, rng, { maxWeeks: 520, hook: parishWeekHook(d) }).state;
    }
    expect(s.mode.kind).toBe('assignment');
    expect(s.clock.week).toBe(end);
    expect(s.assignment!.parishId).not.toBe('__none__');
    expect(s.character!.reputation.parishioners).toBeLessThan(40);
    expect(s.flags.transfers).toBe(1);
    const again = startAssignment(s, rng);
    expect(again.parish!.arcStartWeek).toBe(end);
    expect(again.mode.kind).toBe('clock');
  });

  it('a mid-arc save resumes byte-identically', () => {
    const d = deps();
    const rngA = createRng('save');
    const rngB = createRng('save');
    let a: GameState = { ...parishState('save'), speed: 'SKIP' };
    let b: GameState = { ...parishState('save'), speed: 'SKIP' };
    a = runClock(a, rngA, { maxWeeks: 30, hook: parishWeekHook(d) }).state;
    b = runClock(b, rngB, { maxWeeks: 30, hook: parishWeekHook(d) }).state;
    const save = deserialize(serialize(buildSave(b, rngB, null)));
    const rngB2 = rngFromSave(save);
    const a2 = runClock(a, rngA, { maxWeeks: 40, hook: parishWeekHook(d) }).state;
    const b2 = runClock(save.state, rngB2, { maxWeeks: 40, hook: parishWeekHook(d) }).state;
    const sa = serialize(buildSave(a2, rngA, null)).split('\n');
    const sb = serialize(buildSave(b2, rngB2, null)).split('\n');
    const firstDiff = sa.findIndex((line, i) => line !== sb[i]);
    expect(firstDiff === -1 ? 'identical' : `line ${firstDiff}: ${sa[firstDiff]} vs ${sb[firstDiff]} (context: ${sa.slice(Math.max(0, firstDiff - 3), firstDiff).join(' | ')})`).toBe('identical');
  });
});
