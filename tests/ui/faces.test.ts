import { describe, it, expect } from 'vitest';
import { facesFor, heritageOfName, HERITAGE_LOOKS, specFrom } from '@/ui/portraits/spec';
import { eventById } from '@/content';

describe('faces with a background', () => {
  it('draws complexion, hair, and eyes from the background, and stays deterministic and varied', () => {
    const irish = facesFor('seed', 0, 40, 'irish');
    const nigerian = facesFor('seed', 0, 40, 'nigerian');
    const meanSkin = (xs: { skin: number }[]) => xs.reduce((n, s) => n + s.skin, 0) / xs.length;
    expect(meanSkin(irish)).toBeLessThan(meanSkin(nigerian) - 2);
    for (const s of irish) expect(HERITAGE_LOOKS.irish.skin).toContain(s.skin);
    for (const s of nigerian) expect(HERITAGE_LOOKS.nigerian.hairColor).toContain(s.hairColor);
    // Independent rolls: faces, noses, mouths still vary within a background.
    expect(new Set(nigerian.map((s) => s.face)).size).toBeGreaterThan(3);
    expect(new Set(irish.map((s) => s.hairStyle)).size).toBeGreaterThan(5);
    expect(JSON.stringify(facesFor('seed', 0, 8, 'irish'))).toBe(JSON.stringify(facesFor('seed', 0, 8, 'irish')));
    expect(JSON.stringify(facesFor('seed', 0, 8, 'irish'))).not.toBe(JSON.stringify(facesFor('seed', 0, 8, null)));
    // The same seed without a background is the old face, so saved characters keep theirs.
    expect(specFrom('x:y:z')).toEqual(specFrom('x:y:z', null));
  });

  it('reads a background off a surname the pools know', () => {
    expect(heritageOfName('Kowalski')).toBe('polish');
    expect(heritageOfName('Nguyen')).toBe('vietnamese');
    expect(heritageOfName('Zzyzx')).toBeNull();
  });
});

describe('the rail', () => {
  it('reinstalling it changes the church', () => {
    const e = eventById('pa_altar_rail')!;
    const reinstall = e.choices.find((c) => c.id === 'reinstall')!;
    expect(reinstall.effects.some((x) => x.target === 'decor' && x.key === 'church:altar_rail' && x.value === 'rail_wood')).toBe(true);
  });
});
