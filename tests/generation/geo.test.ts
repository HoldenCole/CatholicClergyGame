import { describe, it, expect } from 'vitest';
import { presetById } from '@/content/dioceses';
import { project, placeParish, milesAcrossOf } from '@/generation/geo';
import { generateCandidates, installWorld } from '@/generation/world';
import { newGame } from '@/engine/game';
import { createRng } from '@/engine/rng';
import { milesBetween } from '@/systems/map';
import { buildSave, deserialize, serialize } from '@/engine/save';

function worldOf(presetId: string, seed = 'geo') {
  const { state } = newGame({ seed, start: { year: 2017, month: 8, day: 20 } });
  const cand = generateCandidates(createRng(seed), 2010).find((c) => c.diocese.presetId === presetId)!;
  return installWorld(state, cand, 2010).world!;
}

describe('generation/geo: the real churches where they stand', () => {
  it('every preset carries a map and coordinates for every real church and named place', () => {
    for (const id of ['washington', 'chicago', 'new_york', 'los_angeles', 'houston']) {
      const p = presetById(id)!;
      expect(p.map, id).toBeDefined();
      const names = new Set((p.places ?? []).map((x) => x.name));
      for (const s of p.parishSeeds) {
        if (s.real) expect(typeof s.real.lat, `${id}: ${s.real.name}`).toBe('number');
        for (const pl of s.places) expect(names.has(pl), `${id}: ${pl}`).toBe(true);
      }
    }
  });

  it('projects the cathedral to the center and north to the top', () => {
    const p = presetById('washington')!;
    expect(project(p, p.map!.lat, p.map!.lon)).toEqual({ x: 50, y: 50 });
    const lourdes = project(p, 38.98, -77.093);
    expect(lourdes.y).toBeLessThan(50);
    expect(lourdes.x).toBeLessThan(50);
    const leonardtown = project(p, 38.25, -76.68);
    expect(leonardtown.y).toBeGreaterThan(90);
    expect(leonardtown.x).toBeGreaterThan(50);
  });

  it('in Washington, Lourdes is in Bethesda, Mercy in Potomac, Mary Mother of God in Chinatown, and Galveston is far from Houston', () => {
    const w = worldOf('washington');
    const by = (name: string) => w.parishes.find((p) => p.name === name)!;
    const cathedral = w.parishes.find((p) => p.cathedral)!;
    expect(cathedral.name).toMatch(/St\. Matthew/);
    expect([cathedral.x, cathedral.y]).toEqual([50, 50]);
    const lourdes = by('Our Lady of Lourdes');
    expect(lourdes.place).toBe('Bethesda');
    expect(lourdes.y).toBeLessThan(50);
    const mercy = by('Our Lady of Mercy');
    expect(mercy.place).toBe('Potomac');
    expect(mercy.x!).toBeLessThan(lourdes.x!);
    const chinatown = by('St. Mary Mother of God');
    expect(chinatown.place).toBe('Chinatown');
    expect(milesBetween(chinatown, cathedral, milesAcrossOf(presetById('washington')))).toBeLessThanOrEqual(2);
    const across = milesAcrossOf(presetById('washington'));
    expect(milesBetween(lourdes, by("St. Francis Xavier"), across)).toBeGreaterThan(40);
    // Rolled parishes land near their named place.
    const rolled = w.parishes.filter((p) => !p.founded && !p.cathedral);
    expect(rolled.length).toBeGreaterThan(0);
    for (const p of rolled) {
      const pl = presetById('washington')!.places!.find((x) => x.name === p.place)!;
      const at = project(presetById('washington')!, pl.lat, pl.lon);
      expect(Math.abs(p.x! - at.x) + Math.abs(p.y! - at.y), `${p.name}, ${p.place}`).toBeLessThan(7);
    }
    const h = worldOf('houston');
    const galveston = h.parishes.find((p) => p.name === 'St. Mary Cathedral Basilica')!;
    const houston = h.parishes.find((p) => p.cathedral)!;
    expect(milesBetween(galveston, houston, milesAcrossOf(presetById('houston')))).toBeGreaterThan(35);
    expect(galveston.y!).toBeGreaterThan(houston.y!);
  });

  it('placing is deterministic and a save without places gets the real churches back where they stand', () => {
    const p = presetById('chicago')!;
    const a = placeParish(createRng('x'), p, { place: 'Pilsen', terrain: 'latino' });
    const b = placeParish(createRng('x'), p, { place: 'Pilsen', terrain: 'latino' });
    expect(a).toEqual(b);
    const { state } = newGame({ seed: 'mig', start: { year: 2017, month: 8, day: 20 } });
    const cand = generateCandidates(createRng('mig'), 2010).find((c) => c.diocese.presetId === 'los_angeles')!;
    const s = installWorld(state, cand, 2010);
    const save = buildSave(s, createRng(s.seed), null);
    const stripped = JSON.parse(serialize(save));
    for (const x of stripped.state.world.parishes) { delete x.x; delete x.y; }
    const back = deserialize(JSON.stringify(stripped)).state.world!.parishes;
    const monica = back.find((x) => x.name === 'St. Monica')!;
    const original = s.world!.parishes.find((x) => x.name === 'St. Monica')!;
    expect([monica.x, monica.y]).toEqual([original.x, original.y]);
    expect(monica.x!).toBeLessThan(50);
  });
});
