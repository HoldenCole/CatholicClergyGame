import { describe, it, expect } from 'vitest';
import { newGame } from '@/engine/game';
import { toDayNumber } from '@/engine/calendar';
import { recordAfter } from '@/content/rome';
import { documentsWeek, generatedDocument, romeAtStart } from '@/systems/rome/documents';
import { generatePope, papacyWeek, reigning, romeOn } from '@/systems/rome/papacy';
import { policyOf } from '@/systems/rome/policy';
import type { GameState } from '@/types';

const day = (y: number, m: number, d: number) => toDayNumber({ year: y, month: m, day: d });

/** Rome forward week by week: the popes and their documents. */
function live(seed: string, startYear: number, weeks: number): { s: GameState; letters: string[] } {
  let s = newGame({ seed, startYear }).state;
  const letters: string[] = [];
  for (let w = 0; w < weeks; w++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    const p = papacyWeek(s);
    s = p.state;
    const d = documentsWeek(s);
    s = d.state;
    letters.push(...p.letters.map((l) => l.title), ...d.letters.map((l) => l.title));
  }
  return { s, letters };
}

describe('the reign after Francis follows what is known of it, and its pope stays unnamed (E1 §9 A)', () => {
  it('the record holds it: elected 8 May 2025, living on the record\'s last day, the older Mass eased', () => {
    expect(recordAfter).toBeDefined();
    expect(recordAfter!.elected).toBe('2025-05-08');
    expect(recordAfter!.holds).toContain('older_mass');
    expect(recordAfter!.acts.some((a) => a.axis === 'older_mass' && a.value === 'indult')).toBe(true);
  });

  it('every world elects him on 8 May 2025, never as Leo, near the middle, and has him living through the record\'s last day', () => {
    const known = toDayNumber({ year: 2026, month: 11, day: 10 });
    const temps: number[] = [];
    for (let i = 0; i < 120; i++) {
      const p = romeOn(`after-${i}`, day(2026, 11, 8)).popes[0]!;
      expect(p.historical).toBe(false);
      expect(p.afterRecord).toBe(true);
      expect(p.electedDay).toBe(day(2025, 5, 8));
      expect(p.name.startsWith('Leo')).toBe(false);
      expect(p.endDay!).toBeGreaterThan(known);
      temps.push(p.temperament);
    }
    expect(Math.min(...temps)).toBeGreaterThan(-40);
    expect(Math.max(...temps)).toBeLessThan(40);
    expect(temps.reduce((a, b) => a + b, 0) / temps.length).toBeGreaterThan(-5);
    expect(temps.reduce((a, b) => a + b, 0) / temps.length).toBeLessThan(15);
  });

  it('a life that begins in 2027 begins under the eased law, in every world', () => {
    for (let i = 0; i < 120; i++) {
      const r = romeAtStart(`after-start-${i}`, day(2027, 8, 20));
      expect(r.policies!.older_mass!.value, `after-start-${i}`).toBe('indult');
      expect(r.policies!.older_mass!.by).not.toBe('Traditionis Custodes');
    }
  });

  it('a life lived through it hears the vacancy, the election in May, and the instruction that eases the older Mass', () => {
    const { s, letters } = live('after-live', 2024, 52 * 3);
    const pope = s.rome!.popes.find((p) => p.afterRecord)!;
    expect(pope.electedDay).toBe(day(2025, 5, 8));
    expect(letters).toContain('Francis has died');
    expect(letters).toContain(`Habemus papam: ${pope.name}`);
    expect(policyOf(s, 'older_mass')).toBe('indult');
    const doc = s.rome!.issued!.find((d) => d.axis === 'older_mass' && d.value === 'indult')!;
    expect(doc).toMatchObject({ kind: 'instruction', popeId: pope.id, from: 'faculties' });
    expect(doc.day).toBeGreaterThanOrEqual(day(2026, 1, 15));
    expect(doc.day).toBeLessThanOrEqual(day(2026, 9, 30));
    expect(letters).toContain(`From Rome: ${doc.title}`);
    expect(reigning(s)?.id).toBe(pope.id);
    // The same world on every replay.
    expect(live('after-live', 2024, 52 * 3).s.rome!.issued).toEqual(s.rome!.issued);
  });

  it('his own documents never move the older Mass, however he reads; any other generated pope\'s may', () => {
    for (const temperament of [-95, 95]) {
      const base = generatePope('held', 1, day(2025, 5, 8), [], {}, undefined, true).pope;
      const pope = { ...base, temperament };
      const other = { ...base, afterRecord: false, temperament };
      const policies = romeAtStart('held', day(2025, 4, 1)).policies!;
      let moved = 0;
      for (let k = 0; k < 3000; k++) {
        const d = generatedDocument(`held-${k}`, k, pope, policies);
        expect(d?.axis).not.toBe('older_mass');
        if (generatedDocument(`held-${k}`, k, other, policies)?.axis === 'older_mass') moved++;
      }
      expect(moved).toBeGreaterThan(0);
    }
  });
});
