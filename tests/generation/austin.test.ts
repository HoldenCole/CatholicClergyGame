import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { diocesePresets, mapDataById, presetById } from '@/content/dioceses';
import { generateCandidates } from '@/generation/world';
import { metropoliaOfSee } from '@/content/metropolias';
import { synthPool } from '@/content/dioceses/synth';
import { project } from '@/generation/geo';

describe('the Diocese of Austin', () => {
  const preset = presetById('austin')!;

  it('is a preset in the presets\' schema, with real churches by name, place, year, and coordinates, and a cathedral', () => {
    expect(preset).toBeTruthy();
    expect(diocesePresets.map((p) => p.id)).toContain('austin');
    expect(preset.parishSeeds.length).toBeGreaterThanOrEqual(60);
    expect(preset.parishSeeds.filter((s) => s.cathedral)).toHaveLength(1);
    for (const s of preset.parishSeeds) {
      expect(s.real, s.patrons[0]).toBeTruthy();
      expect(typeof s.real!.founded).toBe('number');
      expect(typeof s.real!.lat).toBe('number');
      expect(typeof s.real!.lon).toBe('number');
      // On the sheet: the map is wide enough for Waco and the Brazos.
      const at = project(preset, s.real!.lat!, s.real!.lon!);
      expect(at.x, s.real!.name).toBeGreaterThan(2);
      expect(at.x, s.real!.name).toBeLessThan(98);
      expect(at.y, s.real!.name).toBeGreaterThan(2);
      expect(at.y, s.real!.name).toBeLessThan(98);
    }
    // No two real churches of the same name in the same place.
    const keys = preset.parishSeeds.map((s) => `${s.real!.name}|${s.real!.place}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Every named place is on the map.
    for (const pl of preset.places ?? []) expect(project(preset, pl.lat, pl.lon).x, pl.name).toBeGreaterThan(2);
    // The kinds are spread: a growing diocese of the Hill Country and the Blackland.
    const kinds = new Set(preset.parishSeeds.map((s) => s.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it('is a suffragan see of Galveston-Houston, and the synth pool no longer carries it', () => {
    expect(metropoliaOfSee('Austin')?.rank).toBe('suffragan');
    expect(metropoliaOfSee('Austin')?.def.metropolitan.see).toBe('Galveston-Houston');
    expect(synthPool.sees.some((s) => s.see === 'Austin')).toBe(false);
  });

  it('rolls a world: every real church where it stands, the province around it with an archbishop in Houston', () => {
    const cands = generateCandidates(createRng('austin'), 2010);
    const c = cands.find((x) => x.presetId === 'austin')!;
    expect(c).toBeTruthy();
    expect(c.parishes).toHaveLength(preset.parishSeeds.length);
    expect(c.parishes.filter((p) => p.cathedral)).toHaveLength(1);
    expect(c.parishes.find((p) => p.cathedral)!.name).toBe('St. Mary Cathedral');
    expect(c.parishes.some((p) => p.name === 'Sts. Cyril and Methodius' && p.place === 'Granger')).toBe(true);
    expect(c.diocese.visible.metropolia?.rank).toBe('suffragan');
    expect(c.diocese.visible.metropolia?.metropolitanSee).toBe('Galveston-Houston');
    expect(c.diocese.hidden.romeConnection).toBe(2);
    // Deterministic.
    const again = generateCandidates(createRng('austin'), 2010).find((x) => x.presetId === 'austin')!;
    expect(JSON.stringify(again.parishes)).toBe(JSON.stringify(c.parishes));
  });

  it('has a map of its own land: the diocese outline from its counties, the Colorado and the Brazos, Lake Travis, the highways, and its towns', () => {
    const map = mapDataById('austin')!;
    expect(map).toBeTruthy();
    expect(map.diocese.length).toBeGreaterThanOrEqual(1);
    expect(map.diocese[0]![0]!.length).toBeGreaterThan(50);
    expect(map.rivers.map((r) => r.name)).toContain('Colorado');
    expect(map.rivers.map((r) => r.name)).toContain('Brazos');
    expect(map.lakes.map((l) => l.name)).toContain('Lake Travis');
    expect(map.roads.length).toBeGreaterThan(50);
    expect(map.counties.length).toBeGreaterThan(25);
    expect(map.towns.map((t) => t.name)).toContain('Waco');
    // Everything on the sheet, with its margin.
    for (const ring of map.diocese[0]!) for (const [x, y] of ring) { expect(x).toBeGreaterThanOrEqual(-7.5); expect(x).toBeLessThanOrEqual(107.5); expect(y).toBeGreaterThanOrEqual(-7.5); expect(y).toBeLessThanOrEqual(107.5); }
  });
});
