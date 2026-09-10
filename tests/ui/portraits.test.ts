import { describe, it, expect } from 'vitest';
import { adjustSpec, facesFor, parseSpec, portraitForNpc, serializeSpec, specFrom, SPEC_LABELS, SPEC_RANGES, type PortraitSpec } from '@/ui/portraits/spec';
import { testNpc } from '../helpers/fixtures';

describe('ui/portraits', () => {
  it('a spec round-trips and every attribute varies across a thousand faces without collapsing', () => {
    const seen: Record<string, Set<number>> = {};
    for (let i = 0; i < 1000; i++) {
      const s = specFrom(`face:${i}`);
      for (const k of Object.keys(SPEC_RANGES) as (keyof PortraitSpec)[]) (seen[k] ??= new Set()).add(s[k]);
      expect(parseSpec(serializeSpec(s))).toEqual(s);
    }
    for (const k of Object.keys(SPEC_RANGES) as (keyof PortraitSpec)[]) expect(seen[k]!.size, k).toBe(SPEC_RANGES[k]);
    // Hair and skin do not travel together.
    const pairs = new Set(Array.from({ length: 1000 }, (_, i) => { const s = specFrom(`face:${i}`); return `${s.skin}:${s.hairColor}`; }));
    expect(pairs.size).toBeGreaterThan(30);
  });

  it('the same person always has the same face, and a bishop dresses like one', () => {
    const b = testNpc('bishop', { role: 'bishop', title: 'Bishop', birthYear: 1955 });
    const a = portraitForNpc(b, 2020);
    expect(portraitForNpc(b, 2020)).toEqual(a);
    expect(a.dress).toBe('bishop');
    expect(a.age).toBe(65);
    const mother = testNpc('mother', { role: 'family', title: '', name: { first: 'Mary', last: 'Reilly' } });
    expect(portraitForNpc(mother, 2020).female).toBe(true);
    expect(portraitForNpc(mother, 2020).spec.facial).toBe(0);
    expect(facesFor('seed', 0)).toHaveLength(8);
    expect(facesFor('seed', 0)).not.toEqual(facesFor('seed', 1));
    expect(parseSpec('p1')).toBeNull();
  });

  it('every value has a name, old faces still parse, and adjusting wraps', () => {
    for (const k of Object.keys(SPEC_RANGES) as (keyof PortraitSpec)[]) expect(SPEC_LABELS[k].values, k).toHaveLength(SPEC_RANGES[k]);
    const v1 = parseSpec('v1:2.3.4.0.1.2.1.0.2');
    expect(v1).not.toBeNull();
    expect(v1!.nose).toBe(0);
    expect(v1!.mark).toBe(0);
    const s = specFrom('wrap');
    const forward = adjustSpec({ ...s, hairStyle: SPEC_RANGES.hairStyle - 1 }, 'hairStyle', 1);
    expect(forward.hairStyle).toBe(0);
    expect(adjustSpec({ ...s, skin: 0 }, 'skin', -1).skin).toBe(SPEC_RANGES.skin - 1);
  });
});
