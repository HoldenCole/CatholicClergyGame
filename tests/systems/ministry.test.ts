import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { resolveWeek } from '@/systems/week';
import { MINISTRY, emptyMinistry, ministryLine, ministryOf, ministryRows, ministryWeek, parishWeekBook, priestsInHouse } from '@/systems/ministry';
import { profileOf, impactsOf } from '@/systems/profile';
import type { GameState, Quality } from '@/types';

const STANDARD: Record<string, Quality> = { sunday_masses: 'standard', weekday_masses: 'standard', confessions: 'standard', meetings: 'standard', sacramental_prep: 'standard' };

/** Fifty-two weeks of the same routine, without the rest of the loop. */
function aYear(state: GameState, obligations = STANDARD, extra = 0): GameState {
  let s = state;
  for (let i = 0; i < 52; i++) s = ministryWeek(s, obligations, extra);
  return s;
}

describe('systems/ministry', () => {
  it('an empty book is all zeroes and prints nothing', () => {
    const book = emptyMinistry();
    expect(Object.values(book).every((v) => v === 0)).toBe(true);
    const s = { ...parishState('empty'), ministry: book };
    expect(ministryRows(s)).toEqual([]);
    expect(ministryLine(s)).toBeNull();
  });

  it('a year of the ordinary routine counts a priest\'s year of Masses', () => {
    const s = aYear(parishState('year'));
    const book = ministryOf(s);
    // Three on Sunday and five in the week: about four hundred a year.
    expect(Math.round(book.masses)).toBe(52 * 8);
    expect(Math.round(book.confessions)).toBe(52 * 12);
    expect(book.baptisms).toBeGreaterThan(0);
    expect(book.funerals).toBeGreaterThan(0);
    expect(ministryLine(s)).toContain('Masses');
  });

  it('the numbers are of the right order for a parish that size', () => {
    const base = parishState('size');
    const parish = base.world!.parishes.find((p) => p.id === base.parish!.parishId)!;
    const book = ministryOf(aYear(base));
    const thousands = parish.households / 1000;
    // A share of what a parish that size asks for in a year, never more than the parish itself would record.
    expect(book.baptisms).toBeLessThanOrEqual(MINISTRY.perThousand.baptisms * thousands * 1.6);
    expect(book.weddings).toBeLessThanOrEqual(MINISTRY.perThousand.weddings * thousands * 1.6);
    expect(book.funerals).toBeLessThanOrEqual(MINISTRY.perThousand.funerals * thousands * 2);
  });

  it('a minimal week says fewer Masses and hears fewer confessions than an invested one', () => {
    const s = parishState('quality');
    const min = parishWeekBook(s, { ...STANDARD, sunday_masses: 'min', weekday_masses: 'min', confessions: 'min' });
    const invested = parishWeekBook(s, { ...STANDARD, sunday_masses: 'invested', weekday_masses: 'invested', confessions: 'invested' });
    expect(min.masses!).toBeLessThan(invested.masses!);
    expect(min.confessions!).toBeLessThan(invested.confessions!);
    // Hours in the box count: each block is another handful of penitents.
    const withBlocks = parishWeekBook(s, STANDARD, 2);
    expect(withBlocks.confessions!).toBe(parishWeekBook(s, STANDARD).confessions! + 2 * MINISTRY.confessions.perBlock);
  });

  it('an aging parish buries more than it baptizes, and a young one the other way', () => {
    const s = parishState('generations');
    const parishes = s.world!.parishes;
    const here = parishes.find((p) => p.id === s.parish!.parishId)!;
    const old = { ...s, world: { ...s.world!, parishes: parishes.map((p) => (p.id === here.id ? { ...p, generational: 'aging' as const } : p)) } };
    const young = { ...s, world: { ...s.world!, parishes: parishes.map((p) => (p.id === here.id ? { ...p, generational: 'young' as const } : p)) } };
    const a = parishWeekBook(old, STANDARD);
    const y = parishWeekBook(young, STANDARD);
    expect(a.funerals!).toBeGreaterThan(a.baptisms!);
    expect(y.baptisms!).toBeGreaterThan(y.funerals!);
  });

  it('a house with more priests divides the work', () => {
    const s = parishState('house');
    expect(priestsInHouse(s)).toBeGreaterThanOrEqual(2); // a vicar has a pastor over him
    const alone = { ...s, parish: { ...s.parish!, role: 'pastor' as const }, assignment: { ...s.assignment!, role: 'pastor' as const } };
    expect(priestsInHouse(alone)).toBe(1);
    expect(parishWeekBook(alone, STANDARD).baptisms!).toBeGreaterThan(parishWeekBook(s, STANDARD).baptisms!);
  });

  it('the weekly loop itself fills the book', () => {
    const s = parishState('loop');
    const { state } = resolveWeek(s, createRng('loop'));
    expect(ministryOf(state).masses).toBeGreaterThan(0);
    expect(ministryOf(state).confessions).toBeGreaterThan(0);
  });
});

describe('systems/profile', () => {
  it('reads a man back to himself', () => {
    const s = aYear(parishState('profile'));
    const p = profileOf(s);
    expect(p.name).toContain('Reilly');
    expect(p.age).toBeGreaterThan(20);
    expect(p.post).toMatch(/vicar|Pastor/i);
    expect(p.ministry.find((r) => r.key === 'masses')!.value).toBe(52 * 8);
    expect(p.line).toContain('priest');
    expect(p.tenures.length).toBeGreaterThanOrEqual(1);
  });

  it('a man not yet ordained has an empty book and says so', () => {
    const s = { ...parishState('deacon'), flags: {} };
    const p = profileOf(s);
    expect(p.yearsOrdained).toBe(0);
    expect(p.line).toContain('Not yet ordained');
  });

  it('a parish handed on turning, in a hard place, reads as a turnaround', () => {
    const s = parishState('impact');
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const hard = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, kind: 'difficult' as const } : p)) } };
    const withTenure: GameState = {
      ...hard,
      tenures: [{ kind: 'parish', label: 'Pastor', place: `${parish.name}, ${parish.place}`, parishId: parish.id, startWeek: 0, endWeek: 312, verdict: 'Turning around', left: 'moved by the board' }],
    };
    const impacts = impactsOf(withTenure).filter((i) => i.turnaround);
    expect(impacts.length).toBeGreaterThanOrEqual(1);
    expect(impacts[0]!.years).toBe(6);
  });
});
