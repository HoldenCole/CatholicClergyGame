import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { resolveWeek, careOfPlan, planWeek, attendanceTarget } from '@/systems/week';
import { focusGroup, groupTrend, groupsWeek, parishGroups, sustainShares, GROUPS } from '@/systems/groups';
import { controlsMoney, debtPayable, payDebt } from '@/systems/finance';
import { seminaryWeek, setSeminaryActivity, hoursGainsSentence, activityBuilds } from '@/systems/seminaryWeek';
import { seminaryState } from '../helpers/fixtures';
import type { GameState } from '@/types';

function withRoutine(s: GameState, discretionary: Record<string, number>): GameState {
  return { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, discretionary } } };
}

function weeks(s: GameState, n: number, seed: string): GameState {
  let next = s;
  for (let i = 0; i < n; i++) {
    next = resolveWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`${seed}:${i}`)).state;
  }
  return next;
}

describe('the hours pay off visibly', () => {
  it('a focused group takes all the sustaining hours and rises; spread thin, they merely hold', () => {
    const s = parishState('focus');
    const groups = parishGroups(s);
    expect(groups.length).toBeGreaterThanOrEqual(3);
    const target = groups[0]!;
    const spread = sustainShares(s, 2);
    expect(Object.keys(spread).length).toBe(groups.filter((g) => !g.suppressed && !g.hostile).length);
    const focused = focusGroup(s, target.id);
    const shares = sustainShares(focused, 2);
    expect(shares).toEqual({ [target.id]: 2 });
    // One hour a week on one group beats its decay by a wide margin.
    expect(groupTrend(focused, focused.groups[target.id]!, 1)).toBeGreaterThan(GROUPS.decayPerWeek);
    const after = groupsWeek(focused, 2, createRng('gw')).state;
    expect(after.groups[target.id]!.vitality).toBeGreaterThan(target.vitality + 3);
    for (const g of groups.slice(1)) expect(after.groups[g.id]!.vitality).toBeLessThan(g.vitality);
  });

  it('care from visits and confessions lifts attendance and so collections over a season', () => {
    const base = parishState('care');
    const quiet = weeks(withRoutine(base, { study: 3 }), 26, 'quiet');
    const present = weeks(withRoutine(base, { visits: 4, extra_confessions: 2 }), 26, 'present');
    // The week trims what does not fit, so care is measured on the plan, not the ask.
    const planned = careOfPlan(planWeek(withRoutine(base, { visits: 4, extra_confessions: 2 })));
    expect(planned).toBeGreaterThan(0.4);
    // Seasons trim the week further; over half a year it lands somewhere below the plan.
    expect(present.parish!.care!).toBeGreaterThan(planned * 0.6);
    expect(quiet.parish!.care!).toBeLessThan(0.1);
    expect(present.parish!.attendance).toBeGreaterThan(quiet.parish!.attendance + 0.05);
    expect(present.parish!.finance.averageCollection).toBeGreaterThan(quiet.parish!.finance.averageCollection);
    expect(attendanceTarget(base, 1)).toBeGreaterThan(attendanceTarget(base, 0));
  });

  it('a pastor can pay the debt down from cash, keeping a reserve; a vicar cannot', () => {
    const base = parishState('debt');
    const rec = base.world!.parishes.find((p) => p.id === base.parish!.parishId)!;
    // Cash well above any reserve the parish's collections could ask for.
    const vicar: GameState = { ...base, parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 2000000, debt: 150000 } } };
    expect(controlsMoney(vicar)).toBe(false);
    expect(debtPayable(vicar)).toBe(0);
    expect(payDebt(vicar, 50000)).toBe(vicar);
    const pastor: GameState = { ...vicar, assignment: { ...vicar.assignment!, role: 'pastor' }, parish: { ...vicar.parish!, role: 'pastor' } };
    const reserve = Math.round(rec.weeklyCollections * 0.82 * 8);
    expect(debtPayable(pastor)).toBe(Math.min(150000, 2000000 - reserve));
    const paid = payDebt(pastor, 50000);
    expect(paid.parish!.finance.debt).toBe(100000);
    expect(paid.parish!.finance.cash).toBe(1950000);
    expect(paid.career[paid.career.length - 1]!.text).toMatch(/\$50,000/);
    const all = payDebt(paid, 10_000_000);
    expect(all.parish!.finance.debt).toBe(Math.max(0, 100000 - debtPayable(paid)));
    const broke: GameState = { ...pastor, parish: { ...pastor.parish!, finance: { ...pastor.parish!.finance, cash: 1000 } } };
    expect(debtPayable(broke)).toBe(0);
  });

  it('seminary hours build the stats they say they build, and the evaluation can say so', () => {
    let s = seminaryState('sem-hours');
    s = { ...s, seminary: { ...s.seminary!, year: 3 } };
    expect(activityBuilds('holy_hour')).toBe('piety');
    expect(activityBuilds('study')).toContain('theology');
    s = setSeminaryActivity(s, 'holy_hour', 3);
    s = setSeminaryActivity(s, 'study', 2);
    const before = s.character!.stats;
    for (let i = 0; i < 40; i++) {
      s = seminaryWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`sw:${i}`)).state;
    }
    expect(s.character!.stats.piety).toBeGreaterThan(before.piety + 8);
    expect(s.character!.stats.theology).toBeGreaterThan(before.theology + 2);
    expect(s.seminary!.hoursGains!.piety!).toBeGreaterThan(8);
    expect(hoursGainsSentence(s.seminary!)).toMatch(/piety/);
    expect(hoursGainsSentence({ ...s.seminary!, hoursGains: {} })).toBeNull();
  });
});
