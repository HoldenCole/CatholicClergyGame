import { describe, expect, it } from 'vitest';
import { parishSays } from '@/systems/review';
import { parishState } from './week.test';
import type { GameState } from '@/types';

describe('what the parish says in the review', () => {
  it('comes from where the hours went, and never repeats last year', () => {
    const s = parishState('said');
    const starved: GameState = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, obligations: { ...s.parish!.routine.obligations, confessions: 'min' }, discretionary: { ...s.parish!.routine.discretionary, visits: 3 } }, care: 0.8 } };
    const first = parishSays(starved);
    expect(first.key.startsWith('confessions_min')).toBe(true);
    const again = parishSays({ ...starved, flags: { ...starved.flags, 'review:said': first.key } });
    expect(again.key).not.toBe(first.key);
    const third = parishSays({ ...starved, clock: { ...starved.clock, week: starved.clock.week + 52 }, flags: { ...starved.flags, 'review:said': again.key } });
    expect(third.key).not.toBe(again.key);
    const seen: GameState = { ...s, parish: { ...s.parish!, care: 0.9, routine: { ...s.parish!.routine, discretionary: { ...s.parish!.routine.discretionary, visits: 3, groups: 1 } } } };
    expect(parishSays(seen).key.startsWith('full')).toBe(true);
  });
});
