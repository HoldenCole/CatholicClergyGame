import { describe, it, expect } from 'vitest';
import { consistency, emptyReputation, isFigure, recordPosition } from '@/systems/reputation';
import { emptyStats } from '@/systems/stats';
import type { Character } from '@/types';

function character(overrides: Partial<Character> = {}): Character {
  return {
    name: { first: 'John', last: 'Doe' },
    portrait: 'p1',
    entryYear: 2010,
    background: {
      origin: 'suburban',
      tie: 'seminary',
      path: 'college',
      field: 'philosophy',
      career: null,
      yearsWorked: 0,
      motive: 'certainty',
      family: 'supportive',
      past: null,
      entryAge: 22,
    },
    stats: emptyStats(40),
    alignment: 0,
    outspokenness: 0,
    honesty: 0,
    reputation: emptyReputation(),
    credentials: [],
    traits: [],
    positions: [],
    latentRisks: [],
    hooks: [],
    archetype: null,
    archetypeLeaning: { pastoral: 0, teaching: 0, theological: 0, administrative: 0, missionary: 0 },
    ...overrides,
  };
}

describe('systems/reputation', () => {
  it('a public position raises outspokenness; a private one does not', () => {
    let c = character();
    c = recordPosition(c, { topic: 'tlm', value: -60, volume: 'private', week: 1 });
    expect(c.outspokenness).toBe(0);
    c = recordPosition(c, { topic: 'tlm', value: -60, volume: 'public', week: 2 });
    expect(c.outspokenness).toBeGreaterThan(0);
    expect(c.positions).toHaveLength(2);
  });

  it('alignment drifts toward what is said', () => {
    const c = recordPosition(character(), { topic: 'tlm', value: -80, volume: 'semi_public', week: 1 });
    expect(c.alignment).toBeLessThan(0);
    expect(c.alignment).toBeGreaterThan(-80);
  });

  it('consistency is 100 with no gap and falls with a private/public gap', () => {
    let c = character();
    expect(consistency(c)).toBe(100);
    c = recordPosition(c, { topic: 'x', value: -60, volume: 'private', week: 1 });
    c = recordPosition(c, { topic: 'x', value: -60, volume: 'public', week: 2 });
    expect(consistency(c)).toBe(100);
    c = recordPosition(c, { topic: 'y', value: -80, volume: 'private', week: 3 });
    c = recordPosition(c, { topic: 'y', value: 40, volume: 'public', week: 4 });
    expect(consistency(c)).toBeLessThan(80);
  });

  it('public reversals cost consistency', () => {
    let c = character();
    c = recordPosition(c, { topic: 'z', value: 60, volume: 'public', week: 1 });
    c = recordPosition(c, { topic: 'z', value: -60, volume: 'public', week: 50 });
    expect(consistency(c)).toBeLessThanOrEqual(85);
  });

  it('a figure needs both volume and bloc support', () => {
    const quiet = character({ outspokenness: 20, reputation: { ...emptyReputation(), traditional_bloc: 80 } });
    expect(isFigure(quiet)).toBe(false);
    const loudUnloved = character({ outspokenness: 80, alignment: -40 });
    expect(isFigure(loudUnloved)).toBe(false);
    const figure = character({
      outspokenness: 80,
      alignment: -40,
      reputation: { ...emptyReputation(), traditional_bloc: 60 },
    });
    expect(isFigure(figure)).toBe(true);
  });
});
