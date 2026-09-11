import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateClass, generateClassmate } from '@/generation/classmates';
import { generateFormators } from '@/generation/formators';
import { generateFamily } from '@/generation/family';
import { creationContent } from '@/content/creation';
import { namePools } from '@/content/names';
import { testCharacter } from '../helpers/fixtures';
import type { Npc } from '@/types';

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe('generation/classmates', () => {
  const men: Npc[] = [];
  const sizes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const cls = generateClass(createRng(`class-${i}`), 2010);
    sizes.push(cls.length);
    if (i < 300) men.push(...cls);
  }

  it('is deterministic per seed and differs across seeds', () => {
    expect(generateClass(createRng('a'), 2010)).toEqual(generateClass(createRng('a'), 2010));
    expect(generateClass(createRng('a'), 2010)).not.toEqual(generateClass(createRng('b'), 2010));
  });

  it('class size rolls across the whole range', () => {
    const seen = new Set(sizes);
    for (let s = 6; s <= 12; s++) expect(seen.has(s), `size ${s}`).toBe(true);
  });

  it('no attribute collapses to one value', () => {
    const count = (f: (n: Npc) => string) => new Set(men.map(f));
    expect(count((n) => n.origin).size).toBe(6);
    expect(count((n) => n.hiddenTrait).size).toBe(7);
    expect(count((n) => n.struggle).size).toBe(8);
    expect(count((n) => String(n.formation?.field)).size).toBe(9);
    expect(count((n) => String(n.formation?.career)).size).toBeGreaterThanOrEqual(8);
    expect(count((n) => `${n.name.first} ${n.name.last}`).size).toBeGreaterThan(men.length * 0.6);
    expect(men.filter((n) => n.alignment < -20).length).toBeGreaterThan(men.length * 0.15);
    expect(men.filter((n) => n.alignment > 20).length).toBeGreaterThan(men.length * 0.15);
    expect(men.filter((n) => n.formation!.entryAge >= 30).length).toBeGreaterThan(men.length * 0.05);
    expect(men.filter((n) => n.formation!.entryAge <= 19).length).toBeGreaterThan(men.length * 0.05);
    for (const key of ['administration', 'charisma', 'theology', 'knowledge', 'piety'] as const) {
      const values = men.map((n) => n.stats[key]);
      expect(Math.max(...values) - Math.min(...values), key).toBeGreaterThan(30);
    }
  });

  it('alignment is uncorrelated with ambition, stats, and background', () => {
    const al = men.map((n) => n.alignment);
    expect(Math.abs(correlation(al, men.map((n) => n.ambition)))).toBeLessThan(0.08);
    for (const key of ['administration', 'charisma', 'theology', 'knowledge', 'piety'] as const) {
      expect(Math.abs(correlation(al, men.map((n) => n.stats[key]))), key).toBeLessThan(0.08);
    }
    expect(Math.abs(correlation(al, men.map((n) => n.formation!.entryAge)))).toBeLessThan(0.08);
    expect(Math.abs(correlation(men.map((n) => n.ambition), men.map((n) => n.stats.administration)))).toBeLessThan(0.08);
  });

  it('background shapes stats: philosophy men lean theological, business men administrative', () => {
    const phil = men.filter((n) => n.formation?.field === 'philosophy');
    const biz = men.filter((n) => n.formation?.field === 'business');
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(phil.map((n) => n.stats.theology))).toBeGreaterThan(mean(biz.map((n) => n.stats.theology)) + 5);
    expect(mean(biz.map((n) => n.stats.administration))).toBeGreaterThan(mean(phil.map((n) => n.stats.administration)) + 5);
  });

  it('names follow origin', () => {
    const latinoSurnames = new Set([...namePools.mexican.last, ...namePools.central_american.last, ...namePools.caribbean.last]);
    const latino = men.filter((n) => n.origin === 'latino_immigrant');
    expect(latino.length).toBeGreaterThan(20);
    expect(latino.filter((n) => latinoSurnames.has(n.name.last)).length).toBe(latino.length);
    const urbanSurnames = new Set([...namePools.irish.last, ...namePools.italian.last, ...namePools.polish.last, ...namePools.german.last, ...namePools.african_american.last, ...namePools.filipino.last]);
    const urban = men.filter((n) => n.origin === 'urban_ethnic');
    expect(urban.filter((n) => urbanSurnames.has(n.name.last)).length).toBe(urban.length);
  });

  it('a single classmate has formation details', () => {
    const one = generateClassmate(createRng('one'), 0, 2010);
    expect(one.id).toBe('cm_1');
    expect(one.role).toBe('classmate');
    expect(one.formation?.entryAge).toBeGreaterThanOrEqual(18);
    expect(one.birthYear).toBe(2010 - one.formation!.entryAge);
  });
});

describe('generation/formators and family', () => {
  it('formators carry their tags and professors sit on opposite wings', () => {
    for (let i = 0; i < 200; i++) {
      const f = generateFormators(createRng(`f-${i}`), 2010);
      const byTag = Object.fromEntries(f.map((n) => [n.tags[0], n]));
      expect(byTag.rector).toBeTruthy();
      expect(byTag.professor_trad!.alignment).toBeLessThan(-30);
      expect(byTag.professor_prog!.alignment).toBeGreaterThan(30);
      expect(byTag.bishop!.title).toBe('Bishop');
      expect(byTag.spiritual_director!.stats.piety).toBeGreaterThan(50);
      expect(new Set(f.map((n) => n.id)).size).toBe(7);
    }
  });

  it('family follows the chosen shape', () => {
    const character = testCharacter();
    const origin = creationContent.origins.find((o) => o.id === 'urban_ethnic')!;
    const widowed = creationContent.families.find((f) => f.id === 'widowed_mother')!;
    const fam = generateFamily(createRng('fam'), character, widowed, origin);
    expect(fam.find((n) => n.id === 'mother')?.status).toBe('active');
    expect(fam.find((n) => n.id === 'mother')?.tags).toContain('dependent');
    expect(fam.find((n) => n.id === 'father')?.status).toBe('dead');
    expect(fam.filter((n) => n.tags.includes('sibling'))).toHaveLength(0);
    expect(fam.find((n) => n.tags.includes('home_pastor') || n.tags.includes('mentor_priest'))).toBeTruthy();
    for (const n of fam.filter((n) => n.role === 'family')) expect(n.name.last).toBe('Reilly');

    const large = creationContent.families.find((f) => f.id === 'large')!;
    const big = generateFamily(createRng('big'), { ...character, background: { ...character.background, motive: 'grief', tie: 'seminary' } }, large, origin);
    expect(big.filter((n) => n.tags.includes('sibling'))).toHaveLength(5);
    expect(big.find((n) => n.role === 'priest')).toBeUndefined();
    expect(big.find((n) => n.id === 'father')?.relationship).toBeGreaterThan(0);
  });
});
