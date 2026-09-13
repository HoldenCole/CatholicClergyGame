import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { resolveWeek } from '@/systems/week';
import { createRng } from '@/engine/rng';
import { explainAttendance, explainCollections, explainReputation, MOVERS_WEEKS, trimMovers } from '@/systems/movers';
import { applyEffects } from '@/engine/effects';
import type { GameState } from '@/types';

describe('systems/movers: the why behind the numbers', () => {
  it('a week writes reasons for what moved the people, and the quarter trims them', () => {
    const s = parishState('why');
    const routine = { ...s.parish!.routine, discretionary: { visits: 2 } };
    const withVisits: GameState = { ...s, parish: { ...s.parish!, routine } };
    const after = resolveWeek(withVisits, createRng('w')).state;
    const reasons = explainReputation(after, 'parishioners');
    expect(reasons.some((r) => /visit/i.test(r.label) && r.amount > 0)).toBe(true);
    expect(after.movers!.some((m) => m.why === 'the Mass as set')).toBe(true);
    const old: GameState = { ...after, clock: { ...after.clock, week: after.clock.week + MOVERS_WEEKS + 1 } };
    expect(trimMovers(old).movers).toEqual([]);
  });

  it('effects applied with a reason are remembered under it', () => {
    const s = parishState('reason');
    const next = applyEffects(s, [{ target: 'reputation', key: 'chancery', delta: 6 }, { target: 'stat', key: 'piety', delta: 1 }], {}, 'The Finance Council');
    // The reputation and the stat are both remembered, each under the reason.
    expect(next.movers).toHaveLength(2);
    expect(explainReputation(next, 'chancery')).toEqual([{ label: 'The Finance Council', amount: 6 }]);
    expect(explainReputation(next, 'parishioners')).toEqual([]);
  });

  it('the pews and the plate explain themselves and add up', () => {
    const s = parishState('sum');
    const pews = explainAttendance(s);
    expect(pews.target).toBeGreaterThan(0.15);
    expect(pews.reasons.some((r) => r.label.startsWith('the rolls'))).toBe(true);
    const plate = explainCollections(s);
    expect(plate.usual).toBeGreaterThan(0);
    expect(plate.factors.length).toBeGreaterThanOrEqual(2);
    expect(plate.costs.some((c) => c.label === 'running costs')).toBe(true);
  });
});
