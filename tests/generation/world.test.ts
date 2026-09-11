import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { generateCandidates, installWorld, revealFor } from '@/generation/world';
import { generateDiocese } from '@/generation/diocese';
import { diocesePresets } from '@/content/dioceses';
import { driftYear } from '@/systems/drift';
import { assignFirstParish, scoreParish } from '@/systems/assignment';
import { testCharacter } from '../helpers/fixtures';
import type { GameState, Stats } from '@/types';

describe('generation/world', () => {
  const runs = Array.from({ length: 300 }, (_, i) => generateCandidates(createRng(`w-${i}`), 2010));

  it('rolls all five presets, in preset order, from one seed', () => {
    const c = runs[0]!;
    expect(c.map((x) => x.presetId)).toEqual(['new_york', 'chicago', 'los_angeles', 'houston', 'washington']);
    expect(generateCandidates(createRng('w-0'), 2010)).toEqual(c);
    expect(generateCandidates(createRng('w-1'), 2010)).not.toEqual(c);
  });

  it('every preset keeps its character while the state varies', () => {
    for (const presetId of ['new_york', 'houston']) {
      const dioceses = runs.map((r) => r.find((c) => c.presetId === presetId)!.diocese);
      // There is always a shortage: only 'stretched' and 'critically_short' can roll now.
      expect(new Set(dioceses.map((d) => d.visible.clergyNeed)).size).toBe(2);
      expect(new Set(dioceses.map((d) => d.visible.tension)).size).toBe(3);
      expect(new Set(dioceses.map((d) => d.hidden.financial)).size).toBe(3);
      expect(new Set(dioceses.map((d) => d.visible.bishop.name)).size).toBeGreaterThan(200);
      expect(new Set(dioceses.map((d) => d.hidden.bishop.management)).size).toBe(4);
      expect(new Set(dioceses.map((d) => d.visible.complication)).size).toBeGreaterThanOrEqual(3);
      expect(dioceses.every((d) => d.visible.character.length >= 2 && d.visible.character.length <= 4)).toBe(true);
    }
    const houston = runs.map((r) => r.find((c) => c.presetId === 'houston')!.diocese);
    const dc = runs.map((r) => r.find((c) => c.presetId === 'washington')!.diocese);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(houston.map((d) => d.hidden.shortage))).toBeGreaterThan(mean(dc.map((d) => d.hidden.shortage)) + 0.8);
  });

  it('the visible half never carries hidden fields', () => {
    const d = runs[0]![0]!.diocese;
    const visibleJson = JSON.stringify(d.visible);
    for (const key of ['factions', 'hostility', 'shortage', 'financial', 'ambition', 'knowsYou', 'cannotTolerate', 'scandal', 'hiddenComplication', 'chanceryIds']) {
      expect(visibleJson.includes(`"${key}"`), key).toBe(false);
    }
    expect(d.visible.bishop).not.toHaveProperty('alignment');
  });

  it('parishes are spread across the five kinds, plus the cathedral, with pastors and one live problem each', () => {
    const c = runs[0]![1]!;
    const kinds = new Set(c.parishes.map((p) => p.kind));
    for (const k of ['flagship_suburban', 'struggling_urban', 'immigrant_growing', 'rural', 'difficult']) expect(kinds.has(k as typeof c.parishes[number]['kind']), k).toBe(true);
    expect(c.parishes.length).toBeGreaterThanOrEqual(18);
    // The real churches keep their names and years; the rolled ones roll; no two share a name in one place.
    const real = c.parishes.filter((p) => p.founded);
    expect(real.length).toBeGreaterThanOrEqual(12);
    expect(new Set(c.parishes.map((p) => `${p.name}|${p.place}`)).size).toBe(c.parishes.length);
    const cathedral = c.parishes.find((p) => p.cathedral)!;
    expect(cathedral.terrain).toBe('urban');
    expect(cathedral.school).toBe('none');
    expect(c.npcs.find((n) => n.id === cathedral.pastorId)?.title).toBe('Msgr.');
    for (const p of c.parishes) {
      expect(c.npcs.find((n) => n.id === p.pastorId)?.tags).toContain('pastor');
      expect(p.problem).toBeTruthy();
      expect(p.weeklyCollections).toBeGreaterThan(0);
    }
    const immigrant = runs.map((r) => r[2]!.parishes.find((p) => p.kind === 'immigrant_growing' && !p.founded)!);
    expect(immigrant.filter((p) => p.needsSpanish).length).toBeGreaterThan(immigrant.length * 0.8);
    const chanceries = runs.map((r) => r[0]!.npcs.filter((n) => n.role === 'official').length);
    expect(Math.min(...chanceries)).toBe(6);
    expect(Math.max(...chanceries)).toBe(8);
  });

  it('a son of the diocese gets a reveal in prose', () => {
    const c = runs[0]![0]!;
    expect(revealFor(c, 'bishop_temperament', createRng('r'))).toMatch(/rewards/);
    expect(revealFor(c, 'chancery_figure', createRng('r'))).toMatch(/memos/);
    expect(revealFor(c, 'complication', createRng('r'))).toMatch(/kitchen table/);
  });

  it('generateDiocese is deterministic per stream', () => {
    const preset = diocesePresets[0]!;
    expect(generateDiocese(createRng('d'), preset, 2010)).toEqual(generateDiocese(createRng('d'), preset, 2010));
  });
});

describe('systems/drift', () => {
  it('about one run in four sees a new bishop across six seminary years', () => {
    let changed = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const { state } = newGame({ seed: `drift-${i}`, start: { year: 2010, month: 8, day: 20 } });
      const cands = generateCandidates(createRng(`drift-${i}`), 2010);
      let s = installWorld(state, cands[1]!, 2010);
      const rng = createRng(`drift-rng-${i}`);
      let sawNew = false;
      for (let year = 2011; year <= 2016; year++) {
        const r = driftYear(s, rng, year);
        s = r.state;
        if (r.newBishop) sawNew = true;
      }
      if (sawNew) changed++;
      expect(s.world!.diocese.visible.bishop.age).toBe(2016 - s.npcs[s.world!.diocese.hidden.bishop.npcId]!.birthYear);
    }
    expect(changed / N).toBeGreaterThan(0.18);
    expect(changed / N).toBeLessThan(0.36);
  });

  it('a new bishop retires the old one and rewrites the visible card', () => {
    const { state } = newGame({ seed: 'succ', start: { year: 2010, month: 8, day: 20 } });
    const cands = generateCandidates(createRng('succ'), 2010);
    const s = installWorld(state, cands[0]!, 2010);
    const oldId = s.world!.diocese.hidden.bishop.npcId;
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const r = driftYear(s, createRng(`s-${i}`), 2011);
      if (r.newBishop) {
        found = true;
        expect(r.state.npcs[oldId]!.status).toBe('retired');
        expect(r.state.npcs[r.newBishop.id]!.tags).toContain('bishop');
        expect(r.state.world!.diocese.visible.bishop.yearsInOffice).toBe(0);
        expect(r.state.world!.bishopHistory).toEqual([oldId, r.newBishop.id]);
      }
    }
    expect(found).toBe(true);
  });
});

describe('systems/assignment', () => {
  function stateWith(flags: Record<string, boolean>, stats: Partial<Stats> = {}, presetIndex = 2): GameState {
    const { state } = newGame({ seed: 'assign', start: { year: 2010, month: 8, day: 20 } });
    const cands = generateCandidates(createRng('assign'), 2010);
    const s = installWorld(state, cands[presetIndex]!, 2010);
    const c = testCharacter();
    return { ...s, character: { ...c, stats: { ...c.stats, ...stats } }, flags };
  }

  it('a Spanish speaker who asked for a Latino parish goes to the immigrant parish', () => {
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      const s = stateWith({ speaks_spanish: true, pref_latino: true, 'home_terrain:latino': true });
      const a = assignFirstParish(s, createRng(`a-${i}`));
      if (s.world!.parishes.find((p) => p.id === a.parishId)!.kind === 'immigrant_growing') hits++;
    }
    expect(hits).toBeGreaterThan(80);
  });

  it('without Spanish the immigrant parish scores low, and a ledger-reader scores the indebted one high', () => {
    const s = stateWith({ 'home_terrain:suburban': true }, { administration: 70 });
    const world = s.world!;
    const immigrant = world.parishes.find((p) => p.kind === 'immigrant_growing')!;
    const flagship = world.parishes.find((p) => p.kind === 'flagship_suburban')!;
    expect(scoreParish(s, world, flagship).score).toBeGreaterThan(scoreParish(s, world, immigrant).score);
    const indebted = world.parishes.filter((p) => p.debt >= 1_000_000);
    for (const p of indebted) expect(scoreParish(s, world, p).reasons.join(' ')).toMatch(/ledger/);
  });

  it('writes a letter with reasons and the pastor’s name', () => {
    const s = stateWith({ pref_wherever: true });
    const a = assignFirstParish(s, createRng('letter'));
    expect(a.letter).toMatch(/Dear Father Reilly/);
    expect(a.letter).toMatch(/Parochial Vicar/);
    expect(a.reasons.length).toBeGreaterThan(0);
    expect(a.startWeek).toBe(0);
  });
});
