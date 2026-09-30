import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { buildChoice, chooseAssignment } from '@/systems/choice';
import { offerById } from '@/content/offers';
import type { GameState } from '@/types';

/** A man the week he comes home from the Gregorian with the licentiate, at the board's table. */
function homeWithSTL(seed: string, theology: number): GameState {
  const s = parishState(seed);
  return {
    ...s,
    clock: { ...s.clock, week: s.clock.week + 52 * 5 },
    character: { ...s.character!, credentials: [...s.character!.credentials, 'STL', 'italian'], reputation: { ...s.character!.reputation, rome: 25, chancery: 25 }, stats: { ...s.character!.stats, theology } },
    flags: { ...s.flags, rome_alumnus: true, home_from: 'degree' },
    offerHistory: [...s.offerHistory, { offerId: 'pv_rome_study', week: s.clock.week + 52 * 5, decision: 'completed' }],
    parish: null,
    offers: [],
  };
}

describe('the doctorate follows the licentiate', () => {
  it("home with the licentiate, staying on for the doctorate is on the table for a man the director will take, and not for one he will not", () => {
    const s = homeWithSTL('std:choice', 62);
    const choice = buildChoice(s, createRng('c'), 'degree', s.assignment!);
    expect(choice?.options.some((o) => o.id === 'doctorate' && o.posting === 'pv_rome_doctorate')).toBe(true);
    const weak = buildChoice(homeWithSTL('std:weak', 50), createRng('c'), 'degree', s.assignment!);
    expect(weak?.options.some((o) => o.id === 'doctorate')).toBe(false);
    // Only the week he comes home: a year later it is the bishop's letter, not the table.
    const later = { ...s, clock: { ...s.clock, week: s.clock.week + 52 } };
    expect(buildChoice(later, createRng('c'), 'degree', s.assignment!)?.options.some((o) => o.id === 'doctorate')).toBe(false);
  });

  it('choosing it sends him straight back to the Gregorian, with the risk the letter would have carried', () => {
    const s = homeWithSTL('std:go', 62);
    const choice = buildChoice(s, createRng('c'), 'degree', s.assignment!)!;
    const at = { ...s, mode: { kind: 'assignment_choice' as const, options: choice.options, why: choice.why } };
    let failures = 0;
    for (let i = 0; i < 40; i++) {
      const gone = chooseAssignment(at, 'doctorate', createRng(`go${i}`));
      expect(gone.phase).toBe('study');
      expect(gone.study?.program).toBe('rome_std');
      expect(gone.study?.city).toBe('rome');
      expect(gone.flags['study:rome']).toBe(true);
      expect(gone.offerHistory.at(-1)).toMatchObject({ offerId: 'pv_rome_doctorate', decision: 'accepted' });
      if (gone.study?.failed) failures++;
    }
    // Theology at 62 is under the safe line: some of the forty do not finish. At 75 none do.
    expect(failures).toBeGreaterThan(0);
    expect(failures).toBeLessThan(40);
    const strong = homeWithSTL('std:strong', 75);
    const sc = buildChoice(strong, createRng('c'), 'degree', strong.assignment!)!;
    for (let i = 0; i < 20; i++) expect(chooseAssignment({ ...strong, mode: { kind: 'assignment_choice', options: sc.options, why: sc.why } }, 'doctorate', createRng(`s${i}`)).study?.failed).toBe(false);
    // The letter home is promised to a strong theologian too.
    expect(offerById('pv_rome_doctorate')!.guarantee).toBeDefined();
  });
});
