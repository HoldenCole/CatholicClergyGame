import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { generateCandidates, installWorld } from '@/generation/world';
import { assignFirstParish } from '@/systems/assignment';
import { startAssignment } from '@/engine/parish';
import { efficiencyWords, obligationAp, hoursOf, adminFloorFor, planWeek, resolveWeek, weekBudget } from '@/systems/week';
import { testCharacter } from '../helpers/fixtures';
import type { GameState } from '@/types';

export function parishState(seed = 'week', overrides: Partial<GameState> = {}): GameState {
  const { state } = newGame({ seed, start: { year: 2017, month: 8, day: 20 } });
  const cands = generateCandidates(createRng(seed), 2010);
  let s = installWorld(state, cands[1]!, 2010);
  s = { ...s, character: testCharacter(), phase: 'parochial_vicar', mode: { kind: 'clock' }, flags: { ordained: true, ordination_week: 0 }, ...overrides };
  const assignment = assignFirstParish(s, createRng(`${seed}:assign`));
  s = { ...s, assignment, mode: { kind: 'assignment', assignment } };
  return startAssignment({ ...s, mode: { kind: 'clock' } }, createRng(`${seed}:start`));
}

describe('systems/week', () => {
  it('a standard routine fits twelve blocks with room for the three it asks for', () => {
    const s = parishState();
    const plan = planWeek(s);
    expect(weekBudget(s)).toBe(12);
    // 2 + 0.75 + 1 + 1 + 1.5 at standard, ordinary time, vicar, less what a thriving group gives back and what his stats save.
    expect(plan.mandatory).toBeGreaterThanOrEqual(4.5);
    expect(plan.mandatory).toBeLessThanOrEqual(6.25);
    expect(Object.values(plan.discretionary).reduce((a, b) => a + b, 0)).toBe(3);
    expect(plan.neglected).toBe(false);
    expect(plan.obligations).toEqual(s.parish!.routine.obligations);
  });

  it('the daily Mass is half an hour a day, and skill shortens the work done properly', () => {
    expect(hoursOf(obligationAp('weekday_masses', 'standard'))).toBe(3);
    expect(hoursOf(obligationAp('weekday_masses', 'min'))).toBe(2);
    const dull = { piety: 30, theology: 30, knowledge: 30, charisma: 30, administration: 30 };
    const sharp = { piety: 30, theology: 80, knowledge: 75, charisma: 70, administration: 80 };
    expect(obligationAp('sunday_masses', 'standard', 0, dull)).toBe(2);
    expect(obligationAp('sunday_masses', 'standard', 0, sharp)).toBe(1.25);
    expect(obligationAp('meetings', 'standard', 0, sharp)).toBe(0.5);
    expect(obligationAp('sacramental_prep', 'standard', 0, sharp)).toBe(1);
    // The minimum is the minimum; nothing goes below an hour.
    expect(obligationAp('sunday_masses', 'min', 0, sharp)).toBe(1);
    expect(obligationAp('meetings', 'min', 3, sharp)).toBe(0.25);
    expect(efficiencyWords(sharp).length).toBeGreaterThanOrEqual(5);
    expect(efficiencyWords(dull)).toEqual([]);
    const s = parishState('sharp');
    const sharper = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, ...sharp } } };
    expect(planWeek(sharper).mandatory).toBeLessThan(planWeek(s).mandatory);
  });

  it('Holy Week forces something to be cut, in the fixed order', () => {
    let s = parishState();
    // 2018 Palm Sunday: 25 March. Find the week.
    let week = 0;
    for (; week < 60; week++) {
      const day = new Date((s.clock.startDay + week * 7) * 86_400_000);
      if (day.getUTCFullYear() === 2018 && day.getUTCMonth() === 2 && day.getUTCDate() === 25) break;
    }
    s = { ...s, clock: { ...s.clock, week } };
    s = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, obligations: { ...s.parish!.routine.obligations, sunday_masses: 'invested' } } } };
    const plan = planWeek(s);
    expect(plan.mandatory).toBeLessThanOrEqual(12);
    expect(plan.obligations.meetings).toBe('min');
    expect(Object.values(plan.discretionary).reduce((a, b) => a + b, 0)).toBeLessThan(3);
  });

  it('minimum everywhere buys back AP; a recycled homily streak costs lay support', () => {
    let s = parishState();
    const min = { sunday_masses: 'min', weekday_masses: 'min', confessions: 'min', meetings: 'min', sacramental_prep: 'min' } as const;
    s = { ...s, parish: { ...s.parish!, routine: { obligations: { ...min }, discretionary: { visits: 4, study: 1 } } } };
    // 1 + 0.5 + 0.5 + 0.75 + 1 at the minimum, which skill cannot shorten, less what a thriving group gives back.
    expect(planWeek(s).mandatory).toBeGreaterThanOrEqual(3);
    expect(planWeek(s).mandatory).toBeLessThanOrEqual(3.75);
    const before = s.character!.reputation.parishioners;
    const rng = createRng('min');
    for (let i = 0; i < 6; i++) s = resolveWeek(s, rng).state;
    expect(s.parish!.recycledHomilyStreak).toBe(6);
    // Visits at 4 AP earn lay support; the recycled homily bleeds it. Net should still fall over six weeks of streak.
    expect(s.character!.reputation.parishioners).toBeLessThan(before + 6 * 4 * 0.35);
  });

  it('investing pays in charisma and lay support; administration reduces the pastor floor', () => {
    let s = parishState();
    s = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, obligations: { ...s.parish!.routine.obligations, sunday_masses: 'invested' }, discretionary: { prayer: 1 } } } };
    const before = s.character!;
    const rng = createRng('inv');
    for (let i = 0; i < 10; i++) s = resolveWeek(s, rng).state;
    expect(s.character!.stats.charisma).toBeGreaterThan(before.stats.charisma);
    expect(s.character!.reputation.parishioners).toBeGreaterThan(before.reputation.parishioners);
    const pastor: GameState = { ...s, assignment: { ...s.assignment!, role: 'pastor' } };
    expect(adminFloorFor(pastor)).toBe(1);
    const able: GameState = { ...pastor, character: { ...pastor.character!, stats: { ...pastor.character!.stats, administration: 90 } } };
    expect(adminFloorFor(able)).toBe(0);
  });

  it('decay runs: unused theology atrophies, study halts it, admin load drains piety', () => {
    const base = parishState();
    const rng = createRng('decay');
    let noStudy: GameState = { ...base, parish: { ...base.parish!, routine: { ...base.parish!.routine, discretionary: { admin: 3 } } } };
    let study: GameState = { ...base, parish: { ...base.parish!, routine: { ...base.parish!.routine, discretionary: { study: 3 } } } };
    for (let i = 0; i < 20; i++) {
      noStudy = resolveWeek(noStudy, rng).state;
      study = resolveWeek(study, rng).state;
    }
    expect(noStudy.character!.stats.theology).toBeLessThan(base.character!.stats.theology);
    expect(study.character!.stats.theology).toBeGreaterThan(base.character!.stats.theology);
    expect(noStudy.character!.stats.piety).toBeLessThan(study.character!.stats.piety);
  });

  it('finance ticks: collections come in, the assessment goes out quarterly, buildings decay', () => {
    let s = parishState();
    const cash0 = s.parish!.finance.cash;
    const rng = createRng('fin');
    let assessed = 0;
    for (let i = 0; i < 26; i++) {
      const r = resolveWeek(s, rng);
      s = r.state;
      expect(r.ledger.collection).toBeGreaterThan(0);
      if (r.ledger.lines.some((l) => /assessment/.test(l))) assessed++;
    }
    expect(assessed).toBe(2);
    expect(s.parish!.finance.cash).not.toBe(cash0);
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(parish.buildings.church).toBeLessThan(100);
  });

  it('an authored AP penalty applies to the next week only', () => {
    const s = parishState();
    const hit: GameState = { ...s, parish: { ...s.parish!, apNextWeek: -3 } };
    expect(weekBudget(hit)).toBe(9);
    const after = resolveWeek(hit, createRng('ap')).state;
    expect(after.parish!.apNextWeek).toBe(0);
    expect(weekBudget(after)).toBe(12);
  });
});
