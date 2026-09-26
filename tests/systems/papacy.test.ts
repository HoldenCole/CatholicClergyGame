import { describe, it, expect } from 'vitest';
import { newGame } from '@/engine/game';
import { papalHistory, papalPools } from '@/content/rome';
import { generatePope, papacyWeek, popesOfHisLife, recordEndDay, reigning, roman, romeOn, sedeVacante } from '@/systems/rome/papacy';
import { toDayNumber } from '@/engine/calendar';
import { offerById } from '@/content/offers';
import { isOfferEligible } from '@/engine/offers';
import { parishState } from './week.test';
import type { GameState } from '@/types';

const day = (y: number, m: number, d: number) => toDayNumber({ year: y, month: m, day: d });

/** Run only Rome forward, week by week, from a new game. */
function live(seed: string, startYear: number, years: number): GameState {
  let s = newGame({ seed, startYear }).state;
  for (let w = 0; w < years * 52; w++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    s = papacyWeek(s).state;
  }
  return s;
}

describe('the papal record, as data', () => {
  it('runs in order without overlap, and names no pope still living', () => {
    for (let i = 1; i < papalHistory.length; i++) {
      const prev = papalHistory[i - 1]!;
      const next = papalHistory[i]!;
      expect(prev.ended < next.elected).toBe(true);
      expect(next.elected <= next.ended).toBe(true);
    }
    expect(papalHistory[0]!.elected <= '1950-01-01').toBe(true);
    expect(papalHistory.every((p) => p.name !== 'Leo XIV')).toBe(true);
    expect(Object.keys(papalPools.regnal)).not.toContain('Leo');
  });

  it('writes Roman numerals', () => {
    expect([roman(1), roman(4), roman(9), roman(14), roman(17), roman(24)]).toEqual(['I', 'IV', 'IX', 'XIV', 'XVII', 'XXIV']);
  });
});

describe('Rome on the day the game begins', () => {
  it('is the record while the record lasts, and the vacancies are where they were', () => {
    expect(romeOn('a', day(1950, 8, 20)).popes[0]!.name).toBe('Pius XII');
    expect(romeOn('a', day(1978, 9, 10)).popes[0]!.name).toBe('John Paul I');
    expect(romeOn('a', day(2010, 8, 22)).popes[0]!.name).toBe('Benedict XVI');
    const between = romeOn('a', day(2013, 3, 3));
    expect(between.vacancy?.cause).toBe('resigned');
    expect(between.vacancy?.electionDay).toBe(day(2013, 3, 13));
    const after = romeOn('a', day(2025, 4, 27));
    expect(after.vacancy?.priorId).toBe('hist:francis');
  });

  it('after the record the popes are generated from the seed: the same world, the same pope', () => {
    const a = romeOn('seed-x', day(2032, 1, 4));
    const b = romeOn('seed-x', day(2032, 1, 4));
    expect(a).toEqual(b);
    const p = a.popes[0]!;
    expect(p.historical).toBe(false);
    expect(p.name.startsWith('Leo')).toBe(false);
    expect(p.electedDay).toBeGreaterThan(recordEndDay());
  });
});

describe('the see falls vacant, and the conclave elects', () => {
  it('Benedict renounces, the see is vacant, and Francis is elected, each with a letter', () => {
    let s = newGame({ seed: 'b', startYear: 2013 }).state;
    // The game opens in August 2013: go back to February by starting in 2012 instead.
    s = newGame({ seed: 'b', startYear: 2012 }).state;
    expect(reigning(s)?.name).toBe('Benedict XVI');
    const letters: string[] = [];
    for (let w = 0; w < 40; w++) {
      s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
      const r = papacyWeek(s);
      s = r.state;
      letters.push(...r.letters.map((l) => l.title));
    }
    expect(letters).toEqual(['Benedict XVI has renounced the papacy', 'Habemus papam: Francis']);
    expect(reigning(s)?.name).toBe('Francis');
    expect(popesOfHisLife(s)[0]).toMatch(/^Benedict XVI \(from 2012–2013\)$/);
  });

  it('a generated pope takes the next ordinal of his name', () => {
    const first = generatePope('ord', 1, day(2030, 1, 1), [], {});
    const again = generatePope('ord', 1, day(2030, 1, 1), [], { [first.pope.name.split(' ').slice(0, -1).join(' ') || first.pope.name]: 40 });
    expect(first.pope.name).not.toBe(again.pope.name);
  });
});

describe('a life under several popes', () => {
  it('forty years from 2010 live under two to six popes, the same ones on every replay', () => {
    const counts: number[] = [];
    for (const seed of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']) {
      const s = live(seed, 2010, 40);
      counts.push(s.rome!.popes.length);
      expect(live(seed, 2010, 40).rome!.popes.map((p) => p.name)).toEqual(s.rome!.popes.map((p) => p.name));
      expect(s.rome!.popes.slice(0, 2).map((p) => p.name)).toEqual(['Benedict XVI', 'Francis']);
    }
    for (const n of counts) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('generated popes vary: where they come from and how they read', () => {
    const froms = new Set<string>();
    const temps: number[] = [];
    for (let i = 0; i < 200; i++) {
      const p = generatePope(`v${i}`, 1, day(2026, 1, 1), [], {}).pope;
      froms.add(p.from);
      temps.push(p.temperament);
    }
    expect(froms.size).toBeGreaterThan(10);
    expect(Math.min(...temps)).toBeLessThan(-30);
    expect(Math.max(...temps)).toBeGreaterThan(30);
  });
});

describe('sede vacante freezes papal acts only', () => {
  it('no episcopal letter is eligible while the see is vacant', () => {
    const base = parishState('vac');
    const c = base.character!;
    const s: GameState = { ...base, phase: 'pastor', assignment: { ...base.assignment!, role: 'pastor' }, character: { ...c, reputation: { ...c.reputation, chancery: 80, rome: 60 } }, flags: { ...base.flags, terna_named: true, ordination_week: base.clock.week - 52 * 22 } };
    const def = offerById('ep_auxiliary_bishop')!;
    const open = { ...s, rome: { popes: s.rome?.popes ?? [] } };
    const vacant = { ...s, rome: { popes: s.rome?.popes ?? [], vacancy: { sinceDay: 0, electionDay: 1e9, cause: 'died' as const, priorId: 'x' } } };
    expect(sedeVacante(vacant)).toBe(true);
    expect(isOfferEligible(def, vacant)).toBe(false);
    // With a pope, the same man may be eligible; the freeze is the only difference being tested.
    if (isOfferEligible(def, open)) expect(isOfferEligible(def, vacant)).toBe(false);
  });
});
