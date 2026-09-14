import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { PROMOTION, readiness, scoreCandidate, yearsToSaturate } from '@/systems/promotion';
import { degreeOf, npcCandidate, playerCandidate, rivalsFor } from '@/systems/openings';
import { generateDiocese } from '@/generation/diocese';
import { driftYear } from '@/systems/drift';
import { presetById } from '@/content/dioceses';
import { parishState } from './week.test';
import type { Candidate, GameState, Opening } from '@/types';

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c',
    isPlayer: false,
    name: 'Fr. Test',
    stats: { administration: 45, charisma: 45, theology: 45, knowledge: 45, piety: 45 },
    credentials: [],
    yearsOrdained: 4,
    ordinationAge: 29,
    age: 33,
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

const pastor: Opening = { id: 'o1', kind: 'pastor', parishId: 'p', urgency: 60, needsSpanish: false, needsAdmin: false, alignment: 0, week: 500, label: 'Pastor' };
const chancery: Opening = { ...pastor, id: 'o2', kind: 'chancery', parishId: null, label: 'Chancery' };

describe('a short diocese promotes faster', () => {
  it('the years saturate sooner where the need is high', () => {
    expect(yearsToSaturate('pastor', 60)).toBe(12);
    expect(yearsToSaturate('pastor', 100)).toBeCloseTo(12 * PROMOTION.hasteFloor);
    expect(yearsToSaturate('pastor', 0)).toBe(12);
    const green = candidate({ yearsOrdained: 4 });
    expect(readiness(green, pastor, 100).value).toBeGreaterThan(readiness(green, pastor, 60).value + 5);
    // A man past the saturation point gains nothing more: the haste favors the young.
    const seasoned = candidate({ yearsOrdained: 20, age: 49 });
    expect(readiness(seasoned, pastor, 100).value).toBe(readiness(seasoned, pastor, 60).value);
    const rng = () => createRng('x');
    const bishop = { alignment: 0 };
    expect(scoreCandidate(green, pastor, bishop, 100, rng()).readiness).toBeGreaterThan(scoreCandidate(green, pastor, bishop, 60, rng()).readiness);
  });

  it('the field of rivals narrows with the shortage', () => {
    const s = parishState('rivals');
    const at = (shortage: number) => {
      const st = { ...s, world: { ...s.world!, diocese: { ...s.world!.diocese, hidden: { ...s.world!.diocese.hidden, shortage } } } };
      return Array.from({ length: 40 }, (_, i) => rivalsFor(st, pastor, createRng(`r-${i}`)).length);
    };
    const short = at(5);
    const stretched = at(3);
    expect(Math.max(...short)).toBe(2);
    expect(Math.min(...short)).toBe(2);
    expect(Math.max(...stretched)).toBe(4);
  });

  it('Houston and Washington stay critically short through the drift; the rest can move', () => {
    const base = parishState('drift');
    for (const id of ['houston', 'washington']) {
      const preset = presetById(id)!;
      for (let i = 0; i < 40; i++) {
        const g = generateDiocese(createRng(`floor-${id}-${i}`), preset, 2010);
        let s: GameState = { ...base, world: { ...base.world!, diocese: g.diocese } };
        for (let y = 2011; y <= 2017; y++) s = driftYear(s, createRng(`d-${id}-${i}-${y}`), y).state;
        expect(s.world!.diocese.hidden.shortage, id).toBe(5);
        expect(s.world!.diocese.visible.clergyNeed, id).toBe('critically_short');
      }
    }
    const ny = presetById('new_york')!;
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(generateDiocese(createRng(`ny-${i}`), ny, 2010).diocese.hidden.shortage);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('a life before the seminary counts', () => {
  it('years worked count toward the years, up to half the saturation', () => {
    const fresh = candidate({ yearsOrdained: 4 });
    const worked = candidate({ yearsOrdained: 4, careerYears: 10, ordinationAge: 39, age: 43 });
    const r = readiness(worked, pastor);
    expect(r.value).toBeGreaterThan(readiness(fresh, pastor).value + 8);
    expect(r.reasons).toContain('a life before the seminary');
    // Half the saturation at most: twenty years worked are no better than twelve.
    expect(readiness(candidate({ careerYears: 20 }), pastor).value).toBe(readiness(candidate({ careerYears: 12 }), pastor).value);
    // A vicar's post does not care.
    const vicar: Opening = { ...pastor, kind: 'parochial_vicar' };
    expect(readiness(worked, vicar).value).toBe(readiness(candidate({ yearsOrdained: 4, ordinationAge: 39, age: 43 }), vicar).value);
    // Enough years worked read as 'the years' outright.
    expect(readiness(candidate({ yearsOrdained: 6, careerYears: 12 }), pastor).reasons).toContain('the years, counting the ones before the seminary');
  });

  it('degrees and credentials count, more for the chancery', () => {
    const plain = candidate();
    const doctor = candidate({ degree: 'doctoral' });
    expect(readiness(doctor, pastor).value).toBe(readiness(plain, pastor).value + PROMOTION.degreeBonus.pastor.doctoral);
    expect(readiness(doctor, chancery).value).toBe(readiness(plain, chancery).value + PROMOTION.degreeBonus.chancery.doctoral);
    expect(readiness(doctor, chancery).reasons).toContain('the degree he came in with');
    const cpa = candidate({ credentials: ['partial_cpa'], degree: 'college' });
    expect(readiness(cpa, pastor).value).toBe(readiness(plain, pastor).value + PROMOTION.credentialBonus.pastor.partial_cpa!);
    // The cap holds.
    const stacked = candidate({ credentials: ['JCL', 'JCD', 'MBA', 'partial_cpa'], degree: 'doctoral' });
    expect(readiness(stacked, chancery).value).toBe(readiness(plain, chancery).value + PROMOTION.credentialCap);
    expect(degreeOf('doctoral')).toBe('doctoral');
    expect(degreeOf('masters_2')).toBe('masters');
    expect(degreeOf('high_school')).toBeNull();
  });

  it('the player candidate carries his years worked and his degree; rolled priests carry a little', () => {
    const s = parishState('cand');
    const c = s.character!;
    const st = { ...s, character: { ...c, background: { ...c.background, career: 'accountant' as const, yearsWorked: 9, path: 'masters_2' as const } } };
    const me = playerCandidate(st);
    expect(me.careerYears).toBe(9);
    expect(me.degree).toBe('masters');
    const npc = Object.values(s.npcs).find((n) => n.role === 'priest')!;
    const rival = npcCandidate(npc, 2020, createRng('n'));
    expect(rival.careerYears).toBe(0);
  });
});
