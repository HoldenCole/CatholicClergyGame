import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { decide, fit, maturityModifier, readiness, scoreCandidate, trust } from '@/systems/promotion';
import type { Candidate, Opening } from '@/types';

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c',
    isPlayer: false,
    name: 'Fr. Test',
    stats: { administration: 45, charisma: 45, theology: 45, knowledge: 45, piety: 45 },
    credentials: [],
    yearsOrdained: 6,
    ordinationAge: 29,
    age: 35,
    alignment: 0,
    outspokenness: 0,
    chancery: 0,
    bishopRelationship: 0,
    vouchers: 0,
    results: 20,
    speaksSpanish: false,
    affiliation: 0,
    indispensable: false,
    currentRole: 'parochial_vicar',
    ...overrides,
  };
}

const pastorOpening: Opening = {
  id: 'o1',
  kind: 'pastor',
  parishId: 'parish_2',
  urgency: 60,
  needsSpanish: false,
  needsAdmin: false,
  alignment: 0,
  week: 500,
  label: 'Pastor of St. Athanasius',
};

const bishop = { alignment: 0 };

/** Deterministic score without noise, for tables. */
function noNoise() {
  return { float: () => 0 } as unknown as ReturnType<typeof createRng>;
}

describe('systems/promotion', () => {
  it.each([
    [25, 25, -8],
    [25, 30, -4],
    [25, 35, 0],
    [29, 32, -4],
    [30, 33, 4],
    [34, 36, 10],
    [40, 45, 10],
    [44, 50, 6],
    [50, 55, 3],
  ])('maturity: ordained at %i, now %i → %i', (ordained, age, expected) => {
    expect(maturityModifier(ordained, age)).toBeCloseTo(expected, 5);
  });

  it('readiness rewards the stats the post needs, years, credentials, and results', () => {
    const green = candidate({ yearsOrdained: 1, results: 0 });
    const seasoned = candidate({ yearsOrdained: 12, results: 50, stats: { ...candidate().stats, administration: 70 } });
    expect(readiness(seasoned, pastorOpening).value).toBeGreaterThan(readiness(green, pastorOpening).value + 25);
    const cpa = candidate({ credentials: ['partial_cpa'] });
    expect(readiness(cpa, pastorOpening).value).toBe(readiness(candidate(), pastorOpening).value + 6);
    expect(readiness(cpa, { ...pastorOpening, kind: 'chancery' }).reasons).toContain('the credentials');
  });

  it('trust runs on chancery standing, the bishop, and vouchers', () => {
    expect(trust(candidate({ chancery: 60 })).value).toBeGreaterThan(trust(candidate()).value);
    expect(trust(candidate({ vouchers: 2 })).value).toBe(trust(candidate()).value + 16);
    expect(trust(candidate({ vouchers: 5 })).value).toBe(trust(candidate()).value + 24);
  });

  it('fit can be negative and is amplified by outspokenness in both directions', () => {
    const latino = { ...pastorOpening, needsSpanish: true };
    expect(fit(candidate(), latino, bishop).value).toBeLessThan(0);
    expect(fit(candidate({ speaksSpanish: true }), latino, bishop).value).toBeGreaterThan(20);
    const quietOpposed = candidate({ alignment: -60, outspokenness: 0 });
    const loudOpposed = candidate({ alignment: -60, outspokenness: 80 });
    const loudAligned = candidate({ alignment: 5, outspokenness: 80 });
    const trad = { alignment: 5 };
    const sQuiet = scoreCandidate(quietOpposed, pastorOpening, trad, 50, noNoise());
    const sLoud = scoreCandidate(loudOpposed, pastorOpening, trad, 50, noNoise());
    const sLoudAligned = scoreCandidate(loudAligned, pastorOpening, trad, 50, noNoise());
    expect(sLoud.total).toBeLessThan(sQuiet.total);
    expect(sLoudAligned.total).toBeGreaterThan(scoreCandidate(candidate({ alignment: 5 }), pastorOpening, trad, 50, noNoise()).total);
    expect(sLoud.reasons).toContain('loud, and it hurt');
    expect(sLoudAligned.reasons).toContain('loud, and it helped');
  });

  it('an affiliation is an asset under one bishop and a liability under the next', () => {
    const c = candidate({ affiliation: -1, alignment: -30 });
    const underTrad = fit(c, pastorOpening, { alignment: -40 }).value;
    const underProg = fit(c, pastorOpening, { alignment: 40 }).value;
    expect(underTrad - underProg).toBeGreaterThan(20);
  });

  it.each([
    ['need dominates in a shortage', { need: 95 }, { need: 20 }, true],
    ['the late vocation with a business background beats the green man for a pastorate', { ordinationAge: 36, age: 40, yearsOrdained: 4, stats: { administration: 65, charisma: 50, theology: 40, knowledge: 45, piety: 45 } }, { ordinationAge: 26, age: 30, yearsOrdained: 4 }, true],
    ['the indispensable man is passed over', { indispensable: true, stats: { administration: 80, charisma: 50, theology: 45, knowledge: 45, piety: 45 } }, { stats: { administration: 55, charisma: 55, theology: 45, knowledge: 45, piety: 45 } }, false],
    ['a vouching classmate matters', { vouchers: 2 }, { vouchers: 0 }, true],
  ] as const)('%s', (_label, a, b, aWins) => {
    const needA = 'need' in a ? a.need : 50;
    const needB = 'need' in b ? b.need : 50;
    const ca = candidate({ ...('need' in a ? {} : a) } as Partial<Candidate>);
    const cb = candidate({ ...('need' in b ? {} : b) } as Partial<Candidate>);
    const sa = scoreCandidate(ca, pastorOpening, bishop, needA, noNoise()).total;
    const sb = scoreCandidate(cb, pastorOpening, bishop, needB, noNoise()).total;
    expect(sa > sb).toBe(aWins);
  });

  it('decide ranks candidates deterministically for a seed and explains the outcome to the player', () => {
    const player = candidate({ id: 'player', isPlayer: true, name: 'You', chancery: 20, yearsOrdained: 5 });
    const rival = candidate({ id: 'rival', name: 'Fr. Rival', chancery: 60, yearsOrdained: 11, results: 50 });
    const d1 = decide(pastorOpening, [player, rival], bishop, 50, createRng('d'));
    const d2 = decide(pastorOpening, [player, rival], bishop, 50, createRng('d'));
    expect(d1).toEqual(d2);
    expect(d1.ranked).toHaveLength(2);
    if (d1.winner.id === 'rival') expect(d1.reasons[0]).toBe('Fr. Rival was chosen');
    else expect(d1.reasons.length).toBeGreaterThan(0);
    // Across many seeds the stronger rival wins most of the time, not always: noise is ±10.
    let rivalWins = 0;
    for (let i = 0; i < 200; i++) if (decide(pastorOpening, [player, rival], bishop, 50, createRng(`d-${i}`)).winner.id === 'rival') rivalWins++;
    expect(rivalWins).toBeGreaterThan(150);
    expect(rivalWins).toBeLessThan(200);
  });
});
