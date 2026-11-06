import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { diocesePresets } from '@/content/dioceses';
import { generateCandidates } from '@/generation/world';
import { namedPosting } from '@/engine/study';
import { renderText } from '@/engine/text';
import { parishState } from '../systems/week.test';
import { synthPreset } from '@/generation/dioceseSynth';
import { synthPool } from '@/content/dioceses/synth';
import type { NamedPostingCity } from '@/types';

/** The three playable orders' own institutions are generated analogs, never named (rule 13). */
const ORDER_INSTITUTIONS = /Villanova|Providence College|Merrimack|Siena College|St\. Bonaventure|Dominican University/i;

describe('the postings and the institutions by their real names', () => {
  it('every preset names its campus chaplaincy, its hospital, and its prison, and its seminary where it has one, in full', () => {
    for (const p of diocesePresets) {
      const required: NamedPostingCity[] = ['campus', 'hospital', 'prison', ...(p.institutions.includes('major_seminary') ? (['seminary'] as NamedPostingCity[]) : [])];
      for (const city of required) {
        const n = p.postings?.[city];
        expect(n, `${p.id} ${city}`).toBeTruthy();
        for (const k of ['school', 'residence', 'label', 'line'] as const) expect(n![k].length, `${p.id} ${city} ${k}`).toBeGreaterThanOrEqual(k === 'label' ? 2 : 4);
        expect(n!.line, `${p.id} ${city}`).not.toMatch(ORDER_INSTITUTIONS);
      }
      // Every institution it lists has a name and a line, and it names nothing it does not list.
      for (const i of p.institutions) {
        const n = p.institutionNames?.[i];
        expect(n, `${p.id} ${i}`).toBeTruthy();
        expect(n!.name.length).toBeGreaterThan(3);
        expect(n!.line.length).toBeGreaterThan(10);
        expect(n!.name).not.toMatch(ORDER_INSTITUTIONS);
      }
      for (const k of Object.keys(p.institutionNames ?? {})) expect(p.institutions, `${p.id} names ${k}`).toContain(k);
    }
  });

  it("the diocese card's opportunities carry the names, and the sheet's fold has them", () => {
    const cands = generateCandidates(createRng('named'), 2010);
    for (const c of cands) {
      const preset = diocesePresets.find((p) => p.id === c.presetId)!;
      for (const i of preset.institutions) expect(c.diocese.visible.opportunities.some((o) => o.startsWith(preset.institutionNames![i]!.name)), `${c.presetId} ${i}`).toBe(true);
      expect(c.diocese.visible.institutionNames).toEqual(preset.institutionNames);
    }
  });

  it('a posting takes the name of the place, and the letters say it', () => {
    const s = parishState('named:post');
    const preset = diocesePresets.find((p) => p.id === s.world!.diocese.presetId)!;
    expect(namedPosting(s, 'hospital')!.school).toBe(preset.postings!.hospital!.school);
    expect(namedPosting(s, 'campus')!.label).toBe(preset.postings!.campus!.label);
    expect(namedPosting(s, 'chancery')).toBeUndefined();
    const line = renderText('{hospital}; {campus}; {prison}; {seminary_name}; {university}', s);
    expect(line).toContain(preset.postings!.hospital!.school);
    expect(line).toContain(preset.postings!.campus!.school);
    expect(line).toContain(preset.postings!.prison!.school);
    expect(line).toContain(preset.seminaryName);
    expect(line).toContain(preset.institutionNames!.catholic_university!.name);
  });

  it('a generated diocese names nothing', () => {
    const p = synthPreset(createRng('named:synth'), synthPool.sees[0]!);
    expect(Object.keys(p.postings ?? {})).toHaveLength(0);
    expect(Object.keys(p.institutionNames ?? {})).toHaveLength(0);
  });
});
