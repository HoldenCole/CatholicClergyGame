import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { generateCandidates, installWorld } from '@/generation/world';
import { availableSummers, chooseSummer, summersOffered } from '@/engine/seminary';
import { summerOptions } from '@/content/seminary';
import { evaluateCondition } from '@/engine/conditions';
import type { GameState } from '@/types';

function inDiocese(seed: string, presetId: string): GameState {
  const s = seminaryState(seed);
  const cands = generateCandidates(createRng(seed), 2010);
  return installWorld(s, cands.find((c) => c.presetId === presetId)!, 2010);
}

describe('the summers a diocese has to offer', () => {
  it('every summer is its own: unique ids, a flag on the record, and a regular parish and a Spanish parish among them', () => {
    const ids = summerOptions.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of summerOptions) {
      expect(o.effects.some((e) => e.target === 'flag' && e.key === `summer:${o.id}`), o.id).toBe(o.id !== 'home_parish' && o.id !== 'language_immersion');
      expect(o.blurb.split(/\s+/).length, o.id).toBeGreaterThanOrEqual(10);
      expect(o.outcome.split(/\s+/).length, o.id).toBeGreaterThanOrEqual(20);
    }
    expect(ids).toContain('parish');
    expect(ids).toContain('spanish_parish');
    // Two or three of the diocese's own for each preset.
    for (const pid of ['new_york', 'chicago', 'los_angeles', 'houston', 'washington', 'philadelphia', 'boston', 'san_francisco', 'miami', 'new_orleans']) {
      const own = summerOptions.filter((o) => o.where?.some((c) => c.type === 'diocese' && c.key === undefined && c.value === pid));
      expect(own.length, pid).toBeGreaterThanOrEqual(2);
    }
  });

  it("a diocese's summers are listed only where the generated world answers for them; without a world only the plain ones are", () => {
    const chicago = inDiocese('sum:chi', 'chicago');
    const offered = summersOffered(chicago).map((o) => o.id);
    expect(offered).toContain('parish');
    expect(offered).toContain('hard_parish');
    expect(offered).toContain('chi_merged');
    expect(offered).toContain('chi_jail');
    expect(offered).not.toContain('ny_bronx');
    expect(offered).not.toContain('nola_river');
    // The facts of the world gate the rest: Chicago has Charities and a university, and parishes that need Spanish.
    expect(evaluateCondition({ type: 'diocese', key: 'institution', value: 'catholic_charities' }, chicago)).toBe(true);
    expect(offered).toContain('charities');
    expect(evaluateCondition({ type: 'diocese', key: 'spanish' }, chicago)).toBe(chicago.world!.parishes.some((p) => p.needsSpanish));
    expect(offered.includes('spanish_parish')).toBe(chicago.world!.parishes.some((p) => p.needsSpanish));
    expect(offered.includes('polish_parish')).toBe(chicago.world!.parishes.some((p) => (p.ethnic.polish ?? 0) >= 0.3));
    // A huge see has no mission circuit; the Gulf has a storm season and the Midwest does not.
    expect(offered).not.toContain('rural_circuit');
    expect(offered).not.toContain('storm_season');
    const nola = inDiocese('sum:nola', 'new_orleans');
    const gulf = summersOffered(nola).map((o) => o.id);
    expect(gulf).toContain('storm_season');
    expect(gulf).toContain('rural_circuit');
    expect(gulf).toContain('nola_river');
    expect(gulf).not.toContain('chi_jail');
    // No world yet: nothing that asks the world is listed.
    const bare = summersOffered(seminaryState('sum:bare')).map((o) => o.id);
    expect(bare).toContain('parish');
    expect(bare).not.toContain('charities');
    expect(bare).not.toContain('chi_jail');
  });

  it('a summer spent once is not offered again, and choosing it again is refused', () => {
    let s = inDiocese('sum:once', 'houston');
    s = { ...s, mode: { kind: 'summer', year: 1 }, seminary: { ...s.seminary!, year: 1 } };
    expect(availableSummers(s).find((o) => o.option.id === 'hou_ring')!.available).toBe(true);
    s = chooseSummer(s, 'hou_ring');
    expect(s.flags['summer:hou_ring']).toBe(true);
    expect(s.seminary!.summers[1]).toBe('hou_ring');
    s = { ...s, mode: { kind: 'summer', year: 2 }, seminary: { ...s.seminary!, year: 2 } };
    const again = availableSummers(s).find((o) => o.option.id === 'hou_ring')!;
    expect(again.available).toBe(false);
    expect(again.taken).toBe(true);
    expect(() => chooseSummer(s, 'hou_ring')).toThrow(/unavailable/);
    // Six summers can be spent without repeating one.
    expect(availableSummers(s).filter((o) => o.available).length).toBeGreaterThanOrEqual(6);
  });
});
