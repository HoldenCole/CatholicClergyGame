import { describe, it, expect } from 'vitest';
import {
  emphasisPointsFor,
  evaluate,
  formationWeek,
  FORMATION,
  nameArchetype,
  philosophyDiscount,
  setEmphasis,
  validateEmphasis,
  zeroPillars,
} from '@/systems/formation';
import { seminaryState, testSeminary } from '../helpers/fixtures';
import type { GameState, Pillar } from '@/types';

const E = (h: number, s: number, i: number, p: number): Record<Pillar, number> => ({
  human: h,
  spiritual: s,
  intellectual: i,
  pastoral: p,
});

describe('systems/formation', () => {
  it('validates emphasis allocations', () => {
    expect(validateEmphasis(E(3, 3, 2, 2), 10)).toBeNull();
    expect(validateEmphasis(E(3, 3, 2, 1), 10)).toMatch(/exactly 10/);
    expect(validateEmphasis(E(7, 1, 1, 1), 10)).toMatch(/0–6/);
    expect(validateEmphasis(E(-1, 5, 3, 3), 10)).toMatch(/0–6/);
  });

  it('philosophy years give extra points to men with prior study', () => {
    const state = seminaryState(); // college, philosophy: full discount
    expect(philosophyDiscount(state)).toBeCloseTo(0.6);
    expect(emphasisPointsFor(state)).toBe(10);
    const y2 = { ...state, seminary: testSeminary({ year: 2 }) };
    expect(emphasisPointsFor(y2)).toBe(12);
    const hs: GameState = {
      ...y2,
      character: { ...state.character!, background: { ...state.character!.background, path: 'high_school', field: null } },
    };
    expect(emphasisPointsFor(hs)).toBe(10);
  });

  it('a year of emphasis accrues pillars and stats in proportion, and decays what is neglected', () => {
    let state = setEmphasis(seminaryState(), E(1, 6, 0, 3));
    const before = state.character!.stats;
    for (let i = 0; i < FORMATION.academicWeeks; i++) state = formationWeek(state);
    const sem = state.seminary!;
    expect(sem.pillarScores.spiritual).toBeCloseTo(12, 1);
    expect(sem.pillarScores.human).toBeCloseTo(2, 1);
    expect(sem.pillarScores.intellectual).toBe(0);
    const after = state.character!.stats;
    expect(after.piety).toBeGreaterThan(before.piety + 5);
    expect(after.theology).toBeLessThan(before.theology); // unused, atrophied
    expect(after.administration).toBeGreaterThan(before.administration); // pastoral share
  });

  it('evaluates ADVANCED for a balanced strong year', () => {
    const sem = testSeminary({ year: 2, emphasis: E(3, 3, 2, 2), pillarScores: E(6, 6, 5, 5) });
    const r = evaluate({ seminary: sem, newConcerns: [], flags: {} });
    expect(r.result).toBe('ADVANCED');
    expect(r.notes).toEqual([]);
  });

  it('flags zero emphasis and weak pillars as concerns', () => {
    const sem = testSeminary({ year: 2, emphasis: E(0, 5, 5, 0), pillarScores: E(0, 10, 10, 3) });
    const r = evaluate({ seminary: sem, newConcerns: ['Isolated from classmates'], flags: {} });
    expect(r.result).toBe('HELD_BACK'); // a pillar at 0 is failing
    const sem2 = testSeminary({ year: 2, emphasis: E(1, 4, 4, 1), pillarScores: E(2.5, 8, 8, 3) });
    const r2 = evaluate({ seminary: sem2, newConcerns: [], flags: {} });
    expect(r2.result).toBe('ADVANCED_WITH_CONCERNS');
    expect(r2.notes.join(' ')).toMatch(/Weak in human formation/);
  });

  it('never holds back or dismisses in the first year', () => {
    const sem = testSeminary({ year: 1, emphasis: E(0, 0, 10, 0), pillarScores: E(0, 0, 20, 0) });
    const r = evaluate({ seminary: sem, newConcerns: [], flags: { dismissal_pending: true } });
    expect(r.result).toBe('ADVANCED_WITH_CONCERNS');
  });

  it('dismisses on a serious flag, chronic neglect, or failing after being held back', () => {
    const base = testSeminary({ year: 3, emphasis: E(3, 3, 2, 2), pillarScores: E(6, 6, 5, 5) });
    expect(evaluate({ seminary: base, newConcerns: [], flags: { dismissal_pending: true } }).result).toBe('DISMISSED');
    const chronic = testSeminary({
      year: 4,
      emphasis: E(0, 4, 3, 3),
      pillarScores: E(0, 8, 6, 6),
      zeroStreak: { ...zeroPillars(), human: 2 },
    });
    expect(evaluate({ seminary: chronic, newConcerns: [], flags: {} }).result).toBe('DISMISSED');
    const failingTwice = testSeminary({ year: 3, emphasis: E(1, 1, 4, 4), pillarScores: E(1, 1, 8, 8), heldBackCount: 1 });
    expect(evaluate({ seminary: failingTwice, newConcerns: [], flags: {} }).result).toBe('DISMISSED');
    const failingOnce = { ...failingTwice, heldBackCount: 0 };
    expect(evaluate({ seminary: failingOnce, newConcerns: [], flags: {} }).result).toBe('HELD_BACK');
  });

  it('names an archetype from stats, pillars, and leaning', () => {
    const state = seminaryState();
    const scholar: GameState = {
      ...state,
      character: { ...state.character!, stats: { ...state.character!.stats, theology: 80, knowledge: 70 } },
    };
    expect(nameArchetype(scholar)).toBe('theological');
    const admin: GameState = {
      ...state,
      character: { ...state.character!, stats: { ...state.character!.stats, administration: 85 } },
    };
    expect(nameArchetype(admin)).toBe('administrative');
    const leaning: GameState = {
      ...state,
      character: {
        ...state.character!,
        archetypeLeaning: { ...state.character!.archetypeLeaning, missionary: 6 },
      },
    };
    expect(nameArchetype(leaning)).toBe('missionary');
  });
});
