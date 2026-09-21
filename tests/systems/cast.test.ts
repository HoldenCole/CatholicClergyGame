import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { CAST_ROLES, castLine, castName, castRoleFor, castRoleOf, castYear, farewellLine, fillCast, isCastLine, openRoles, parishCast, roleFits } from '@/systems/cast';
import { castYearStep } from '@/engine/parish';
import { laneOf } from '@/systems/digest';
import { closeTenure } from '@/systems/tenures';
import type { GameState } from '@/types';

describe('the living cast of a parish', () => {
  it('gives most of the named parishioners a part, each part once, fitting their age and sex', () => {
    for (const seed of ['cast-a', 'cast-b', 'cast-c']) {
      const s = parishState(seed);
      const cast = parishCast(s);
      expect(cast.length).toBeGreaterThanOrEqual(5);
      const roles = cast.map((n) => castRoleOf(n)!);
      expect(new Set(roles).size).toBe(roles.length);
      const year = 2017;
      for (const n of cast) expect(roleFits(castRoleOf(n)!, year - n.birthYear, n.tags.includes('woman'))).toBe(true);
    }
    // Two runs do not hand out the parts in the same order.
    const a = parishState('cast-a').npcs;
    const b = parishState('cast-b').npcs;
    const partsA = Object.values(a).map((n) => castRoleOf(n)).filter(Boolean).join(',');
    const partsB = Object.values(b).map((n) => castRoleOf(n)).filter(Boolean).join(',');
    expect(partsA).not.toBe(partsB);
    expect(castRoleFor(createRng('x'), 20, false, [])).toBe('youth');
    expect(castRoleFor(createRng('x'), 72, true, [])).toBe('widow');
    expect(castRoleFor(createRng('x'), 72, true, [...CAST_ROLES])).toBeNull();
  });

  it('names people the way the parish does, and the week names one of them in the people lane', () => {
    const s = parishState('cast-lines');
    const cast = parishCast(s);
    const older = cast.find((n) => n.tags.includes('woman') && 2017 - n.birthYear >= 45);
    if (older) expect(castName(older, 2017)).toBe(`Mrs. ${older.name.last}`);
    let named = 0;
    for (let i = 0; i < 60; i++) {
      const line = castLine(s, createRng(`line${i}`));
      if (!line) continue;
      named++;
      expect(isCastLine(line)).toBe(true);
      expect(laneOf(line)).toBe('people');
      expect(line).not.toMatch(/\{\w+\}/);
    }
    expect(named).toBeGreaterThan(10);
    expect(named).toBeLessThan(45);
    expect(isCastLine('The parking lot was full at the 10:30 and empty at the 7:30, as usual.')).toBe(false);
    // Feast placeholders fill from the cast, or the plain word.
    const sacristan = cast.find((n) => castRoleOf(n) === 'sacristan');
    const filled = fillCast(s, 'Moved by {sacristan}.');
    expect(filled).toBe(sacristan ? `Moved by ${castName(sacristan, 2017)}.` : 'Moved by the sacristan.');
  });

  it('the year moves them: over many years people die and move and marry, the parts empty, and new faces take them', () => {
    const s = parishState('cast-years');
    let next: GameState = s;
    const kinds = { died: 0, moved: 0, married: 0, born: 0 };
    let arrivals = 0;
    for (let y = 1; y <= 40; y++) {
      const at: GameState = { ...next, clock: { ...next.clock, week: s.clock.week + y * 52 } };
      const r = castYearStep(at, createRng(`y${y}`));
      next = r.state;
      for (const line of r.lines) {
        expect(isCastLine(line)).toBe(true);
        expect(line).not.toMatch(/\{\w+\}/);
        if (/died/.test(line)) kinds.died++;
        else if (/moved|sold the house/.test(line)) kinds.moved++;
        else if (/married/.test(line)) kinds.married++;
        else if (/baby|new (girl|boy)|A (girl|boy) for/.test(line)) kinds.born++;
        else arrivals++;
      }
    }
    expect(kinds.died).toBeGreaterThan(0);
    expect(kinds.moved + kinds.married + kinds.born).toBeGreaterThan(0);
    expect(arrivals).toBeGreaterThan(0);
    const dead = Object.values(next.npcs).filter((n) => n.status === 'dead' && n.tags.includes('parishioner'));
    expect(dead.length).toBe(kinds.died);
    expect(next.career.some((c) => /^Buried /.test(c.text))).toBe(true);
    // The parish is still peopled: the parts refill.
    expect(parishCast(next).length).toBeGreaterThanOrEqual(4);
    // Deterministic.
    const again = castYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'));
    expect(castYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'))).toEqual(again);
    expect(openRoles(s).every((r) => CAST_ROLES.includes(r))).toBe(true);
  });

  it('the last Sunday names the people at the door when a parish tenure closes', () => {
    const s = parishState('cast-farewell');
    expect(farewellLine(s, createRng('f'))).toMatch(/^The last Sunday\./);
    const closed = closeTenure(s, 'moved');
    const lines = closed.digest.flatMap((d) => d.lines);
    expect(lines.some((l) => /^The last Sunday\./.test(l))).toBe(true);
    const died = closeTenure(s, 'died in harness');
    expect(died.digest.flatMap((d) => d.lines).some((l) => /^The last Sunday\./.test(l))).toBe(false);
  });
});
