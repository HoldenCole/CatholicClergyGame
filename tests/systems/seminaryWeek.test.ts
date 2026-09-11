import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { routineHours, seminaryBudget, seminaryWeek, setSeminaryActivity } from '@/systems/seminaryWeek';
import { seminaryActivities } from '@/content/seminary';
import type { GameState } from '@/types';

describe('systems/seminaryWeek', () => {
  it('content covers every location with sane rates', () => {
    expect(seminaryActivities.length).toBeGreaterThanOrEqual(8);
    for (const a of seminaryActivities) {
      expect(a.maxAp, a.id).toBeGreaterThanOrEqual(1);
      expect(a.digest.length, a.id).toBeGreaterThanOrEqual(2);
      for (const v of Object.values(a.pillars)) expect(v).toBeLessThanOrEqual(0.06);
    }
  });

  it('hours are clamped to the activity and to the week', () => {
    let s = seminaryState('routine');
    const budget = seminaryBudget(s);
    expect(budget).toBeGreaterThanOrEqual(4);
    s = setSeminaryActivity(s, 'holy_hour', 9);
    expect(s.seminary!.routine!.holy_hour).toBe(3);
    s = setSeminaryActivity(s, 'study', 9);
    expect(routineHours(s.seminary!)).toBe(budget);
    s = setSeminaryActivity(s, 'holy_hour', 0);
    expect(s.seminary!.routine!.holy_hour).toBeUndefined();
    expect(() => setSeminaryActivity(s, 'nap', 1)).toThrow();
  });

  it('a week moves pillars, stats, and the people he spent it with, and writes a line', () => {
    let s = seminaryState('week');
    s = setSeminaryActivity(s, 'holy_hour', 2);
    s = setSeminaryActivity(s, 'common_room', 2);
    const before = s;
    const r = seminaryWeek(s, createRng('w'));
    expect(r.state.seminary!.pillarScores.spiritual).toBeGreaterThan(before.seminary!.pillarScores.spiritual);
    expect(r.state.seminary!.pillarScores.human).toBeGreaterThan(before.seminary!.pillarScores.human);
    expect(r.state.character!.stats.piety).toBeGreaterThan(before.character!.stats.piety);
    const warmed = Object.values(r.state.npcs).some((n) => n.role === 'classmate' && n.relationship > (before.npcs[n.id]?.relationship ?? 0));
    expect(warmed).toBe(true);
    expect(r.line).toMatch(/chapel|tabernacle|holy hour/);
    expect(r.line).toMatch(/common room|professor|late night/);
    const idle = seminaryWeek(before.seminary ? { ...before, seminary: { ...before.seminary, routine: {} } } : before, createRng('w'));
    expect(idle.line).toMatch(/nowhere in particular/);
  });

  it('forty hours of Spanish become a credential and the flag content reads', () => {
    let s: GameState = setSeminaryActivity(seminaryState('spanish'), 'spanish', 2);
    let earnedLine = '';
    for (let i = 0; i < 25; i++) {
      const r = seminaryWeek({ ...s, clock: { ...s.clock, week: s.clock.week + i } }, createRng(`s${i}`));
      s = { ...r.state, clock: s.clock };
      if (/confessions in Spanish/.test(r.line)) earnedLine = r.line;
    }
    expect(s.character!.credentials).toContain('spanish');
    expect(s.flags.speaks_spanish).toBe(true);
    expect(earnedLine).not.toBe('');
    expect(s.character!.credentials.filter((c) => c === 'spanish')).toHaveLength(1);
  });
});
