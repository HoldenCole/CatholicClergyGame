import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { religiousOrders } from '@/content/religious';
import { generateProvince, membersOf, PROVINCE } from '@/generation/province';
import type { Npc } from '@/types';

const seeds = religiousOrders.flatMap((o) => o.provinces.map((p) => ({ order: o, seed: p })));

describe('a province can be instantiated (E3 R1.0, §12)', () => {
  it('every real province of both orders generates, deterministically, with its territory, houses, and men', () => {
    expect(seeds.length).toBe(7);
    for (const { order, seed } of seeds) {
      const p = generateProvince(createRng(`prov-${seed.id}`), order, seed, 2010);
      expect(generateProvince(createRng(`prov-${seed.id}`), order, seed, 2010)).toEqual(p);
      expect(p.province.order).toBe(order.key);
      expect(p.province.dioceseIds.length).toBeGreaterThanOrEqual(seed.dioceses[0]);
      expect(p.province.dioceseIds.length).toBeLessThanOrEqual(seed.dioceses[1]);
      for (const id of seed.dioceseIds) expect(p.province.dioceseIds, id).toContain(id);
      expect(p.dioceses.map((d) => d.presetId)).toEqual(p.province.dioceseIds);
      expect(p.dioceses.filter((d) => d.generated).length).toBe(p.province.dioceseIds.length - seed.dioceseIds.length);
      // Every house sits in a diocese of the territory; the presets each hold one; the curia is where the seed says.
      for (const h of p.houses) expect(p.province.dioceseIds, h.name).toContain(h.dioceseId);
      for (const id of seed.dioceseIds) expect(p.houses.some((h) => h.dioceseId === id), id).toBe(true);
      const curia = p.houses.find((h) => h.id === p.province.curiaHouseId)!;
      expect(curia.kind).toBe('curia');
      const curiaDiocese = p.dioceses.find((d) => d.presetId === curia.dioceseId)!;
      if (p.dioceses.some((d) => d.preset.see === seed.curia)) expect(curiaDiocese.preset.see).toBe(seed.curia);
      expect(p.houses.some((h) => h.kind === 'novitiate')).toBe(true);
      expect(p.houses.length).toBeGreaterThanOrEqual(PROVINCE.houses[p.province.trajectory][0] > p.province.dioceseIds.length * 2 ? 3 : Math.min(PROVINCE.houses[p.province.trajectory][0], p.province.dioceseIds.length * 2));
      expect(new Set(p.houses.map((h) => h.name)).size).toBe(p.houses.length);
      // The men.
      const byId = Object.fromEntries(p.friars.map((f) => [f.id, f]));
      expect(p.province.friarIds.length).toBe(p.friars.length);
      for (const h of p.houses) {
        const members = membersOf(h, byId);
        expect(members.length).toBe(h.memberIds.length);
        expect(members.length).toBeGreaterThanOrEqual(3);
        expect(members.length).toBeLessThanOrEqual(40);
        expect(h.memberIds).toContain(h.priorId);
        expect(byId[h.priorId]!.tags).toContain('prior');
        expect(members.every((m) => m.tags.includes(`house:${h.id}`) && m.tags.includes(`order:${order.key}`) && m.role === 'religious')).toBe(true);
        expect(h.cohesion).toBeGreaterThanOrEqual(0);
        expect(h.observance).toBeLessThanOrEqual(100);
        expect(h.budget).toBeGreaterThan(0);
      }
      const provincial = byId[p.province.provincialId]!;
      expect(provincial.tags).toContain('provincial');
      expect(provincial.tags).toContain(`house:${curia.id}`);
      expect(p.province.councilIds.length).toBe(PROVINCE.council);
      expect(p.province.councilIds.every((id) => byId[id]!.tags.includes('councilor'))).toBe(true);
      expect(p.province.provincialSince).toBeLessThanOrEqual(2010);
      expect(p.province.provincialSince).toBeGreaterThan(2010 - order.governance.provincialTermYears);
      expect(p.province.complication.length).toBeGreaterThan(10);
      expect(p.province.factions.observant + p.province.factions.progressive).toBeGreaterThan(0.4);
      // Novices and students live where formation is.
      const novitiate = p.houses.find((h) => h.kind === 'novitiate')!;
      expect(membersOf(novitiate, byId).some((m) => m.tags.includes('vows:novice'))).toBe(true);
    }
  });

  it('a province is not the same twice: different seeds give different men, houses, and territories', () => {
    const { order, seed } = seeds[0]!;
    const runs = Array.from({ length: 60 }, (_, i) => generateProvince(createRng(`v-${i}`), order, seed, 2010));
    const provincials = runs.map((r) => r.friars.find((f) => f.id === r.province.provincialId)!);
    expect(new Set(provincials.map((n) => `${n.name.first} ${n.name.last}`)).size).toBeGreaterThan(50);
    expect(new Set(runs.map((r) => r.province.trajectory)).size).toBe(3);
    expect(new Set(runs.map((r) => r.province.dioceseIds.filter((d) => d.startsWith('synth_')).sort().join(','))).size).toBeGreaterThan(30);
    expect(new Set(runs.map((r) => r.houses.length)).size).toBeGreaterThan(3);
    // The age pyramid follows the trajectory: shrinking provinces are older.
    const meanAge = (rs: typeof runs) => {
      const men = rs.flatMap((r) => r.friars.filter((f) => f.tags.includes('vows:solemn')));
      return men.reduce((a, f) => a + (2010 - f.birthYear), 0) / men.length;
    };
    const shrinking = runs.filter((r) => r.province.trajectory === 'shrinking');
    const growing = runs.filter((r) => r.province.trajectory === 'growing');
    expect(meanAge(shrinking)).toBeGreaterThan(meanAge(growing) + 3);
    expect(shrinking.every((r) => r.province.finances.retirementBurden >= 0)).toBe(true);
    // Alignment and stats roll independently of each other (CLAUDE.md rule 4).
    const men: Npc[] = runs.flatMap((r) => r.friars);
    const corr = (xs: number[], ys: number[]) => {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; }
      return sxy / Math.sqrt(sxx * syy);
    };
    for (const key of ['administration', 'charisma', 'theology', 'piety'] as const) expect(Math.abs(corr(men.map((m) => m.alignment), men.map((m) => m.stats[key]))), key).toBeLessThan(0.08);
    expect(new Set(men.map((m) => m.hiddenTrait)).size).toBe(7);
  });
});
