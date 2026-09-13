import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { setDiscretionary, setObligation } from '@/engine/parish';
import { CONFESSOR, confessorOf, confessorPull, confessorWeek } from '@/systems/confessor';
import { visitationDue, visitationStep, visitationWeekOf, VISITATION } from '@/systems/visitation';
import { eventsForPhase } from '@/content';
import { attendanceTarget } from '@/systems/week';
import { dateOf } from '@/engine/time';
import type { GameState } from '@/types';

describe('a name as a confessor', () => {
  it('hours in the box build it, it decays without them, and it pulls on the pews', () => {
    let s = setDiscretionary(parishState('box'), 'extra_confessions', 3);
    s = setObligation(s, 'confessions', 'invested');
    let weeks = 0;
    while (confessorOf(s) < CONFESSOR.known && weeks < 60) {
      s = confessorWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
      weeks++;
    }
    expect(confessorOf(s)).toBeGreaterThanOrEqual(CONFESSOR.known);
    expect(s.flags['confessor:known']).toBe(true);
    expect(weeks).toBeLessThan(30);
    expect(confessorPull(s)).toBeGreaterThan(0);
    expect(attendanceTarget(s, 0.5, confessorPull(s))).toBeGreaterThan(attendanceTarget(s, 0.5, 0));
    // The light goes off: the name fades and the flag with it.
    let idle = setObligation(setDiscretionary(s, 'extra_confessions', 0), 'confessions', 'min');
    for (let i = 0; i < 80; i++) idle = confessorWeek({ ...idle, clock: { ...idle.clock, week: idle.clock.week + 1 } }).state;
    expect(confessorOf(idle)).toBeLessThan(CONFESSOR.known);
    expect(idle.flags['confessor:known']).toBeUndefined();
  });

  it('a confessor people drive to costs a little with the brothers each week, and the events exist for both thresholds', () => {
    const s: GameState = { ...parishState('sought'), character: { ...parishState('sought').character!, confessor: 70 } };
    const before = s.character!.reputation.brother_priests;
    const next = confessorWeek(setDiscretionary(s, 'extra_confessions', 2)).state;
    expect(next.character!.reputation.brother_priests).toBeLessThan(before);
    const pool = eventsForPhase('parochial_vicar');
    expect(pool.some((e) => e.id === 'cf_across_the_diocese')).toBe(true);
    expect(pool.some((e) => e.id === 'cf_deanery_grumble')).toBe(true);
  });
});

describe("the bishop's visitation", () => {
  function pastor(seed: string): GameState {
    const s = parishState(seed);
    return { ...s, assignment: { ...s.assignment!, role: 'pastor' } };
  }
  it('is due once a year in the parish week, for a pastor, and fires an authored scene', () => {
    const s = pastor('visit');
    const due = visitationWeekOf(s.parish!.parishId);
    expect(due).toBeGreaterThanOrEqual(VISITATION.firstWeek);
    expect(visitationDue({ ...s, assignment: { ...s.assignment!, role: 'parochial_vicar' } })).toBe(false);
    // Move the clock to the last week of the calendar year, past any parish's week.
    let t: GameState = s;
    while (dateOf(t.clock).month < 12 || dateOf(t.clock).day < 20) t = { ...t, clock: { ...t.clock, week: t.clock.week + 1 } };
    expect(visitationDue(t)).toBe(true);
    const pool = eventsForPhase('pastor');
    const r = visitationStep(t, createRng('v'), pool);
    expect(r.event?.beat).toBe('visitation');
    expect(r.state.parish!.visitationYear).toBe(dateOf(t.clock).year);
    expect(visitationDue(r.state)).toBe(false);
    // Next year it comes again.
    const nextYear: GameState = { ...r.state, clock: { ...r.state.clock, week: r.state.clock.week + 52 } };
    expect(visitationDue(nextYear)).toBe(true);
  });

  it('the scenes never draw on an ordinary week', () => {
    for (const e of eventsForPhase('pastor').filter((e) => e.id.startsWith('vs_'))) expect(e.beat, e.id).toBe('visitation');
  });
});
