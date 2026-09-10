import { describe, it, expect } from 'vitest';
import { allEvents } from '@/content';
import { isEligible } from '@/engine/events';
import { parishState } from '../systems/week.test';
import { testNpc } from '../helpers/fixtures';
import type { GameState } from '@/types';

const FAMILIES = ['supportive', 'opposed', 'widowed_mother', 'large', 'estranged', 'dependent'];

describe('content/family', () => {
  it('every family background has family drama waiting for it, and none of it is loud', () => {
    const pool = allEvents.filter((e) => e.id.startsWith('fam_'));
    expect(pool.length).toBeGreaterThanOrEqual(12);
    for (const e of pool) {
      expect(e.baseWeight, e.id).toBeLessThanOrEqual(4);
      expect(e.suppressYears, e.id).toBeGreaterThanOrEqual(4);
      expect(e.flavorPrompt, e.id).toBeUndefined();
    }
    const base = parishState('family');
    for (const family of FAMILIES) {
      const s: GameState = {
        ...base,
        flags: { ...base.flags, ordained: true, ordination_week: -520, [`family:${family}`]: true },
        npcs: {
          ...base.npcs,
          mother: testNpc('mother', { role: 'family', title: '', tags: ['mother'], name: { first: 'Mary', last: 'Reilly' } }),
          father: testNpc('father', { role: 'family', title: '', tags: ['father'], name: { first: 'John', last: 'Reilly' } }),
          sibling_1: testNpc('sibling_1', { role: 'family', title: '', tags: ['sibling'], relationship: 30, name: { first: 'Anne', last: 'Reilly' } }),
        },
      };
      const eligible = pool.filter((e) => isEligible(e, s));
      expect(eligible.length, family).toBeGreaterThanOrEqual(family === 'estranged' ? 2 : 3);
    }
  });
});
