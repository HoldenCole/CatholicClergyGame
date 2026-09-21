import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { BALLOT, runElection, shareOf, type Elector } from '@/systems/ballot';

/** n electors who all rank the candidates the same way. */
function bloc(prefix: string, n: number, scores: Record<string, number>, extra: Partial<Elector> = {}): Elector[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, scores, ...extra }));
}
const stubborn = { fickle: 0 };

describe('the electorate as a decision-maker (E3 §3.6, §13.5)', () => {
  const cases: { name: string; electors: Elector[]; candidates: string[]; ended: string; elected?: string; rounds?: number }[] = [
    { name: 'a clear majority on the first ballot', electors: [...bloc('a', 7, { A: 90, B: 40 }), ...bloc('b', 3, { A: 20, B: 80 })], candidates: ['A', 'B'], ended: 'majority', elected: 'A', rounds: 1 },
    { name: 'three even blocs whose second choice is one man: the compromise candidate wins', electors: [...bloc('a', 4, { A: 90, C: 60, B: 10 }), ...bloc('b', 4, { B: 90, C: 60, A: 10 }), ...bloc('c', 3, { C: 90, A: 10, B: 10 })], candidates: ['A', 'B', 'C'], ended: 'any', elected: 'C' },
    { name: 'two stubborn blocs that will not move: narrowed, and the larger takes it', electors: [...bloc('a', 6, { A: 90, B: 10, C: 50 }, stubborn), ...bloc('b', 5, { B: 90, A: 10, C: 50 }, stubborn), ...bloc('c', 2, { C: 90, A: 40, B: 30 }, stubborn)], candidates: ['A', 'B', 'C'], ended: 'narrowed', elected: 'A' },
    { name: 'one candidate: elected at once', electors: bloc('a', 5, { A: 50 }), candidates: ['A'], ended: 'majority', elected: 'A', rounds: 1 },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const r = runElection(createRng(c.name), c.electors, c.candidates);
      if (c.ended !== 'any') expect(r.ended).toBe(c.ended);
      if (c.elected) expect(r.electedId).toBe(c.elected);
      if (c.rounds) expect(r.rounds.length).toBe(c.rounds);
      // Every round's tallies count every ballot, and the first round is everyone's first choice.
      for (const round of r.rounds) expect(Object.values(round.tallies).reduce((a, b) => a + b, 0)).toBe(c.electors.length);
      expect(r.electors).toBe(c.electors.length);
    });
  }

  it('the same seed gives the same ballots; another seed can give another story', () => {
    const electors = [...bloc('a', 5, { A: 70, B: 60, C: 50 }), ...bloc('b', 5, { B: 70, A: 60, C: 50 }), ...bloc('c', 4, { C: 70, A: 60, B: 60 })];
    const one = runElection(createRng('x'), electors, ['A', 'B', 'C']);
    expect(runElection(createRng('x'), electors, ['A', 'B', 'C'])).toEqual(one);
    const outcomes = new Set(Array.from({ length: 40 }, (_, i) => runElection(createRng(`x-${i}`), electors, ['A', 'B', 'C']).electedId));
    expect(outcomes.size).toBeGreaterThan(1);
    const stories = new Set(Array.from({ length: 40 }, (_, i) => runElection(createRng(`x-${i}`), electors, ['A', 'B', 'C']).rounds.map((r) => JSON.stringify(r.tallies)).join('|')));
    expect(stories.size).toBeGreaterThan(5);
  });

  it('a fading man loses his electors round by round, and a friend is where they go first', () => {
    const electors: Elector[] = [
      ...bloc('a', 6, { A: 90, B: 50, C: 40 }, stubborn),
      ...bloc('b', 5, { B: 90, A: 50, C: 40 }, stubborn),
      // Two electors of a man with no chance, whose friend is B: they move to B and decide it.
      ...bloc('c', 2, { C: 90, A: 60, B: 10 }, { friends: ['B'], fickle: 1 }),
    ];
    const r = runElection(createRng('friend'), electors, ['A', 'B', 'C']);
    expect(r.rounds[0]!.tallies).toEqual({ A: 6, B: 5, C: 2 });
    expect(r.rounds[1]!.votes.c0).toBe('B');
    expect(r.electedId).toBe('B');
    expect(r.ended).toBe('majority');
    expect(shareOf(r.rounds.at(-1)!, 'B')).toBeCloseTo(7 / 13);
  });

  it('narrowing keeps the leading men after the majority rounds, and the rounds run out on a plurality', () => {
    const electors = [...bloc('a', 4, { A: 90, B: 10, C: 10, D: 10 }, stubborn), ...bloc('b', 4, { B: 90, A: 10, C: 10, D: 10 }, stubborn), ...bloc('c', 2, { C: 90, A: 10, B: 10, D: 10 }, stubborn), ...bloc('d', 1, { D: 90, A: 10, B: 10, C: 10 }, stubborn)];
    const r = runElection(createRng('narrow'), electors, ['A', 'B', 'C', 'D']);
    const after = r.rounds[BALLOT.majorityRounds]!;
    expect(after.field.sort()).toEqual(['A', 'B']);
    expect(after.absolute).toBe(false);
    // Two blocs of four, stubborn, with the narrowed electors of C and D splitting by their own scores: a tie holds until the rounds are out.
    expect(['A', 'B']).toContain(r.electedId);
    expect(r.rounds.length).toBeLessThanOrEqual(BALLOT.maxRounds);
  });

  it('an empty electorate or field is an error, not a quiet result', () => {
    expect(() => runElection(createRng('e'), [], ['A'])).toThrow();
    expect(() => runElection(createRng('e'), bloc('a', 3, { A: 1 }), [])).toThrow();
  });
});
