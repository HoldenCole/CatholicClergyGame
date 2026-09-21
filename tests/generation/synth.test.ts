import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { synthPool } from '@/content/dioceses/synth';
import { diocesePresets } from '@/content/dioceses';
import { synthDiocese, synthPreset, synthSees } from '@/generation/dioceseSynth';

describe('dioceses without a preset (E3 §13.4)', () => {
  const sees = synthPool.sees;
  const runs = Array.from({ length: 120 }, (_, i) => synthDiocese(createRng(`s-${i}`), sees[i % sees.length]!, 2010));

  it('the pool is real see cities, none of them a preset\'s, spread over every region', () => {
    expect(sees.length).toBeGreaterThan(80);
    const presetSees = new Set(diocesePresets.map((p) => p.see));
    for (const s of sees) expect(presetSees.has(s.see), s.see).toBe(false);
    expect(new Set(sees.map((s) => s.id)).size).toBe(sees.length);
    for (const region of ['Northeast', 'Mid-Atlantic', 'Midwest', 'South', 'Southwest', 'Mountain West', 'West']) expect(synthSees([region]).length, region).toBeGreaterThanOrEqual(8);
    expect(synthSees(['Midwest'], ['chicago']).some((s) => s.see === 'Chicago')).toBe(false);
  });

  it('a synthesized preset is complete in the presets\' schema, and names no real church', () => {
    const preset = synthPreset(createRng('p'), sees[0]!);
    const authored = diocesePresets[0]!;
    for (const key of Object.keys(authored)) expect(preset, key).toHaveProperty(key);
    expect(preset.parishSeeds.every((s) => !s.real)).toBe(true);
    expect(preset.parishSeeds.filter((s) => s.cathedral).length).toBe(1);
    expect(preset.parishSeeds.length).toBe({ small: 14, medium: 20, large: 28, huge: 36 }[preset.size]);
    expect(preset.places!.length).toBeGreaterThan(10);
    expect(preset.map!.milesAcross).toBeGreaterThan(0);
    expect(Object.values(preset.financialWeights).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    for (const seed of preset.parishSeeds) {
      expect(seed.patrons.length).toBe(3);
      for (const place of seed.places) expect(preset.places!.some((p) => p.name === place), place).toBe(true);
    }
    expect(synthPreset(createRng('p'), sees[0]!)).toEqual(preset);
    expect(synthPreset(createRng('q'), sees[0]!)).not.toEqual(preset);
  });

  it('generateDiocese runs on it unchanged: a bishop, a chancery, houses, parishes with pastors, and the split halves', () => {
    for (const r of runs.slice(0, 30)) {
      expect(r.diocese.visible.name).toBe(r.preset.name);
      expect(r.parishes.length).toBe(r.preset.parishSeeds.length);
      expect(r.parishes.filter((p) => p.cathedral).length).toBe(1);
      expect(r.npcs.some((n) => n.role === 'bishop')).toBe(true);
      expect(r.npcs.filter((n) => n.role === 'official').length).toBeGreaterThan(0);
      expect(r.diocese.visible.houses.length).toBeGreaterThan(0);
      expect(r.diocese.visible.character.length).toBeGreaterThanOrEqual(2);
      const names = new Set(r.parishes.map((p) => `${p.name}|${p.place}`));
      expect(names.size).toBe(r.parishes.length);
      for (const p of r.parishes) expect(r.npcs.some((n) => n.id === p.pastorId), p.name).toBe(true);
      const visibleJson = JSON.stringify(r.diocese.visible);
      for (const key of ['factions', 'shortage', 'financial', 'ambition', 'knowsYou', 'scandal', 'hiddenComplication']) expect(visibleJson.includes(`"${key}"`), key).toBe(false);
    }
  });

  it('the state varies across seeds and sees: bishops, finances, tension, institutions, complications', () => {
    expect(new Set(runs.map((r) => r.diocese.visible.bishop.name)).size).toBeGreaterThan(60);
    expect(new Set(runs.map((r) => r.diocese.hidden.financial)).size).toBe(3);
    expect(new Set(runs.map((r) => r.diocese.visible.tension)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(runs.map((r) => r.diocese.visible.complication)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(runs.map((r) => r.preset.institutions.join(','))).size).toBeGreaterThan(10);
    expect(new Set(runs.map((r) => r.preset.wealth)).size).toBeGreaterThanOrEqual(4);
    expect(runs.every((r) => r.diocese.hidden.shortage >= 3)).toBe(true);
    // A Texas see rolls more immigrant parishes than a Vermont one.
    const tx = synthPreset(createRng('tx'), sees.find((s) => s.see === 'Brownsville')!);
    const vt = synthPreset(createRng('vt'), sees.find((s) => s.see === 'Burlington')!);
    expect(tx.parishSeeds.filter((s) => s.kind === 'immigrant_growing').length).toBeGreaterThan(vt.parishSeeds.filter((s) => s.kind === 'immigrant_growing').length);
    expect(tx.heritage.mexican).toBeGreaterThan(vt.heritage.mexican!);
  });

  it('a province\'s presence is read from the preset it was given', () => {
    const r = synthDiocese(createRng('op'), sees[3]!, 2010, { orders: { dominicans: { presence: 'strong' } } });
    expect(r.preset.orders!.dominicans!.presence).toBe('strong');
    expect(r.diocese.visible.houses.some((h) => h.order === 'dominican')).toBe(true);
  });
});
