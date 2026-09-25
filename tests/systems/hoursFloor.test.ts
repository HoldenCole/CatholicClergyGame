import { describe, expect, it } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { parishState } from './week.test';
import { seminaryBudget } from '@/systems/seminaryWeek';
import { planWeek, HOURS_PER_AP } from '@/systems/week';
import { HOURS } from '@/systems/hours';
import { clubHours } from '@/systems/clubs';
import { createRng } from '@/engine/rng';
import { joinClub } from '@/systems/clubs';
import type { GameState } from '@/types';

describe('the week always leaves him at least ten free hours, and the extras meet in their own time', () => {
  it('in seminary, a sick week and a short work week still leave ten', () => {
    const s = seminaryState('floor');
    expect(seminaryBudget(s)).toBeGreaterThanOrEqual(HOURS.freeFloor);
    const sick: GameState = { ...s, strain: 100 };
    expect(seminaryBudget(sick)).toBeGreaterThanOrEqual(HOURS.freeFloor);
  });

  it('in a parish, a week the obligations overrun still leaves ten hours for what he chooses', () => {
    const s = parishState('floor');
    const squeezed: GameState = { ...s, parish: { ...s.parish!, apNextWeek: -12, routine: { ...s.parish!.routine, discretionary: { visits: 4, extra_confessions: 3 } } } };
    const plan = planWeek(squeezed);
    const free = Object.values(plan.discretionary).reduce((a, b) => a + b, 0) + plan.slack;
    expect(free * HOURS_PER_AP).toBeGreaterThanOrEqual(HOURS.freeFloor - 0.5);
  });

  it('a parish priest\'s circles cost the week nothing, however many he joins', () => {
    const s = parishState('circles');
    let joined = joinClub(s, 'priests_running', createRng('a'));
    joined = joinClub(joined, 'deanery_table', createRng('b'));
    expect(clubHours(joined)).toBeGreaterThan(0);
    const a = planWeek(s);
    const b = planWeek(joined);
    expect(b.mandatory).toBe(a.mandatory);
    expect(b.slack).toBe(a.slack);
  });
});
