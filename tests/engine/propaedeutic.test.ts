import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { startSeminary } from '@/engine/seminary';
import { evaluate, firstFormationYear, zeroPillars } from '@/systems/formation';

describe('the propaedeutic year is a switch', () => {
  it('a seminary without one begins in philosophy, and the first year is forgiven once whichever year it is', () => {
    const base = seminaryState('prop');
    const withYear = startSeminary(base, ['c1', 'c2', 'c3'], 'St. Test', true);
    expect(withYear.seminary!.year).toBe(1);
    expect(withYear.seminary!.propaedeutic).toBeUndefined();
    expect(withYear.mode).toEqual({ kind: 'year_start', year: 1 });
    expect(firstFormationYear(withYear.seminary!)).toBe(1);
    const without = startSeminary(base, ['c1', 'c2', 'c3'], 'St. Test', false);
    expect(without.seminary!.year).toBe(2);
    expect(without.seminary!.propaedeutic).toBe(false);
    expect(without.mode).toEqual({ kind: 'year_start', year: 2 });
    expect(firstFormationYear(without.seminary!)).toBe(2);
    // A failing second year: held back where year one was the propaedeutic, forgiven where it was the first.
    const failing = { ...without.seminary!, emphasis: { human: 1, spiritual: 1, intellectual: 1, pastoral: 1 }, pillarScores: { ...zeroPillars(), human: 1 } };
    const first = evaluate({ seminary: failing, newConcerns: [], flags: {} });
    expect(first.result).toBe('ADVANCED_WITH_CONCERNS');
    expect(first.notes).toContain('A poor first year, forgiven once.');
    const { propaedeutic: _p, ...ran } = failing; void _p;
    const second = evaluate({ seminary: ran, newConcerns: [], flags: {} });
    expect(second.result).toBe('HELD_BACK');
    // The default is the year: a save that never heard of the switch reads as it did.
    expect(startSeminary(base, ['c1']).seminary!.year).toBe(1);
  });
});
