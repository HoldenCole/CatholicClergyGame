import { describe, it, expect } from 'vitest';
import { seminaryState, testNpc } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { generateFormators } from '@/generation/formators';
import { houseFlags, startSeminary } from '@/engine/seminary';
import { evaluate, RECTOR_REPORT, zeroPillars } from '@/systems/formation';
import { formationStanding } from '@/systems/standing';
import { CHOICE, earnsChoice } from '@/systems/choice';
import { parishState } from './week.test';
import { eventById } from '@/content';
import type { GameState, SeminaryState } from '@/types';

function withRector(seed: string, regard: number, viceRegard = 0): GameState {
  const s = seminaryState(seed);
  return {
    ...s,
    npcs: {
      ...s.npcs,
      rector: { ...s.npcs.rector!, relationship: regard, tags: ['rector', 'rector:academic'] },
      vice_rector: testNpc('vice_rector', { role: 'formator', title: 'Fr.', tags: ['vice_rector', 'vice_rector:enforcer'], relationship: viceRegard }),
    },
  };
}

describe('the rector and the vice-rector', () => {
  it('the house is rolled apart from the men: every style and temper turns up, and no pairing is fixed', () => {
    const styles = new Set<string>();
    const tempers = new Set<string>();
    const pairs = new Set<string>();
    let warmDisciplinarians = 0;
    for (let i = 0; i < 300; i++) {
      const f = generateFormators(createRng(`house-${i}`), 2010);
      const rector = f.find((n) => n.id === 'rector')!;
      const vice = f.find((n) => n.id === 'vice_rector')!;
      const style = rector.tags.find((t) => t.startsWith('rector:'))!;
      const temper = vice.tags.find((t) => t.startsWith('vice_rector:'))!;
      styles.add(style);
      tempers.add(temper);
      pairs.add(`${style}|${temper}`);
      if (style === 'rector:disciplinarian' && rector.relationship > 0) warmDisciplinarians++;
    }
    expect(styles.size).toBe(3);
    expect(tempers.size).toBe(2);
    expect(pairs.size).toBe(6);
    expect(warmDisciplinarians).toBeGreaterThan(10);
  });

  it('the seminary writes the house as flags the scenes read', () => {
    const s = startSeminary(withRector('flags', 0), ['c1']);
    expect(s.flags['rector:academic']).toBe(true);
    expect(s.flags['vice_rector:enforcer']).toBe(true);
    expect(houseFlags(seminaryState('bare'))).toEqual({});
    for (const [id, flag] of [['house_rector_academic', 'rector:academic'], ['house_vice_list', 'vice_rector:enforcer'], ['house_vice_confidant', 'vice_rector:confidant'], ['house_rector_disciplinarian', 'rector:disciplinarian'], ['house_rector_pastoral', 'rector:pastoral']] as const) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'flag' && c.key === flag), id).toBe(true);
      expect(e.choices.some((c) => c.roll), id).toBe(true);
    }
    expect(eventById('house_prefect')!.choices.some((c) => c.effects.some((x) => x.target === 'flag' && x.key === 'seminary_leader'))).toBe(true);
  });

  it("the rector's report turns the evaluation: a warm rector forgives one weak pillar, a cold one withholds a clean year", () => {
    const base = seminaryState('report').seminary!;
    const oneWeak: SeminaryState = { ...base, year: 3, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 }, pillarScores: { human: 4, spiritual: 12, intellectual: 12, pastoral: 12 } };
    const plain = evaluate({ seminary: oneWeak, newConcerns: [], flags: {} });
    expect(plain.result).toBe('ADVANCED_WITH_CONCERNS');
    const warm = evaluate({ seminary: oneWeak, newConcerns: [], flags: {}, rectorRegard: RECTOR_REPORT.forgives });
    expect(warm.result).toBe('ADVANCED');
    expect(warm.notes).toContain("The rector's report carried the year.");
    // Two notes, or a concern, are not forgiven by regard.
    const concern = evaluate({ seminary: oneWeak, newConcerns: ['Missed the Office for a month'], flags: {}, rectorRegard: 60 });
    expect(concern.result).toBe('ADVANCED_WITH_CONCERNS');
    const clean: SeminaryState = { ...base, year: 3, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 }, pillarScores: { human: 12, spiritual: 12, intellectual: 12, pastoral: 12 } };
    expect(evaluate({ seminary: clean, newConcerns: [], flags: {} }).result).toBe('ADVANCED');
    const cold = evaluate({ seminary: clean, newConcerns: [], flags: {}, rectorRegard: RECTOR_REPORT.withholds });
    expect(cold.result).toBe('ADVANCED_WITH_CONCERNS');
    expect(cold.notes).toContain("The rector's report was cool.");
    // Determinism: the same input, the same record.
    expect(evaluate({ seminary: clean, newConcerns: [], flags: {}, rectorRegard: -30 })).toEqual(cold);
    void zeroPillars;
  });

  it("both men's regard counts in standing, and the rector's alone puts a man at the ordination table", () => {
    const cold = formationStanding(withRector('st', -30, -20));
    const warm = formationStanding(withRector('st', 40, 30));
    expect(warm.value).toBeGreaterThan(cold.value);
    expect(warm.reasons).toContain('the rector spoke for you');
    expect(warm.reasons).toContain('the vice-rector speaks for you');
    expect(cold.reasons).toContain("the vice-rector's list has your name on it");
    const worldless = withRector('table', 40);
    expect(earnsChoice(worldless, 'ordination')).toBe(false);
    // With a world and a thin file, the rector's regard alone earns the table.
    const p = parishState('table2');
    const thin = { ...p, seminary: { ...seminaryState('thin').seminary!, evaluations: [{ year: 2, result: 'ADVANCED_WITH_CONCERNS', pillars: zeroPillars(), notes: [] }, { year: 3, result: 'ADVANCED_WITH_CONCERNS', pillars: zeroPillars(), notes: [] }] }, flags: { ordained: true, ordination_week: 0 } } as GameState;
    const noRector = { ...thin, npcs: { ...thin.npcs, rector: testNpc('rector', { role: 'formator', tags: ['rector'], relationship: 0 }) } };
    expect(formationStanding(noRector).value).toBeLessThan(CHOICE.ordinationStanding);
    expect(earnsChoice(noRector, 'ordination')).toBe(false);
    const loved = { ...thin, npcs: { ...thin.npcs, rector: testNpc('rector', { role: 'formator', tags: ['rector'], relationship: CHOICE.rectorRegard }) } };
    expect(earnsChoice(loved, 'ordination')).toBe(true);
  });
});
