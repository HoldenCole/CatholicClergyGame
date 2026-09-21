import { describe, it, expect } from 'vitest';
import { feastDays, feastsInWeek, upcomingFeasts, keepsFeast, FEAST_KEYS, FEAST_PULL, feastPull, feastIncident } from '@/engine/feasts';
import { nameDayOf, nameDayWeek, NAMEDAY } from '@/systems/anniversaries';
import { createRng } from '@/engine/rng';
import { resolveWeek } from '@/systems/week';
import { fromDayNumber, toDayNumber } from '@/engine/calendar';
import { createClock } from '@/engine/time';
import { patronalOf } from '@/generation/patronal';
import { parishState } from '../systems/week.test';
import { evaluateAll } from '@/engine/conditions';

const d = (n: number) => { const x = fromDayNumber(n); return `${x.year}-${x.month}-${x.day}`; };

describe('engine/feasts', () => {
  it('places the movable feasts of 2024 where the US calendar does', () => {
    const f = feastDays(2024);
    expect(d(f.easter)).toBe('2024-3-31');
    expect(d(f.ash_wednesday)).toBe('2024-2-14');
    expect(d(f.holy_thursday)).toBe('2024-3-28');
    expect(d(f.easter_vigil)).toBe('2024-3-30');
    expect(d(f.divine_mercy)).toBe('2024-4-7');
    expect(d(f.ascension)).toBe('2024-5-12');
    expect(d(f.pentecost)).toBe('2024-5-19');
    expect(d(f.corpus_christi)).toBe('2024-6-2');
    expect(d(f.christ_the_king)).toBe('2024-11-24');
    expect(d(f.epiphany)).toBe('2024-1-7');
    expect(d(f.santo_nino)).toBe('2024-1-21');
    expect(d(f.tet)).toBe('2024-2-10');
    expect(d(f.holy_family)).toBe('2024-12-29');
  });

  it('finds the feasts of a week and keeps the communities\' feasts only for their communities', () => {
    const sunday = toDayNumber({ year: 2024, month: 12, day: 8 });
    const s = parishState('feasts');
    const parish = s.world!.parishes.find((p) => p.id === s.assignment!.parishId)!;
    const latino = { ...parish, ethnic: { ...parish.ethnic, latino: 0.3 } };
    const anglo = { ...parish, ethnic: { anglo: 1 } };
    expect(feastsInWeek(sunday, latino)).toEqual(expect.arrayContaining(['immaculate_conception', 'guadalupe']));
    expect(feastsInWeek(sunday, anglo)).not.toContain('guadalupe');
    expect(keepsFeast(anglo, 'tet')).toBe(false);
    expect(keepsFeast({ ...anglo, ethnic: { vietnamese: 0.2 } }, 'tet')).toBe(true);
  });

  it('the patronal feast comes from the name, by feast key or by date, and a stranger gets a fixed day', () => {
    expect(patronalOf('St. Michael', 'p1')).toMatchObject({ month: 9, day: 29 });
    expect(patronalOf('Our Lady of Guadalupe', 'p1')).toMatchObject({ feast: 'guadalupe' });
    expect(patronalOf('Sacred Heart', 'p1')).toMatchObject({ feast: 'sacred_heart' });
    expect(patronalOf('St. Thomas More', 'p1')).toMatchObject({ month: 6, day: 22 });
    expect(patronalOf('St. Thomas', 'p1')).toMatchObject({ month: 7, day: 3 });
    const odd = patronalOf('Nuestra Señora del Camino', 'parish_9');
    expect(odd.month).toBeGreaterThanOrEqual(1);
    expect(odd).toEqual(patronalOf('Nuestra Señora del Camino', 'parish_9'));
    const days = feastDays(2024, patronalOf('Sacred Heart', 'x'));
    expect(days.patronal).toBe(days.sacred_heart);
  });

  it('lists the feasts ahead in order, this week first, and the feast condition reads the week', () => {
    const s = parishState('ahead');
    const clock = createClock({ year: 2024, month: 2, day: 11 });
    const parish = s.world!.parishes.find((p) => p.id === s.assignment!.parishId)!;
    const ahead = upcomingFeasts(clock, parish, 3);
    expect(ahead[0]!.key).toBe('ash_wednesday');
    expect(ahead[0]!.weeks).toBe(0);
    expect(ahead.map((f) => f.day)).toEqual([...ahead.map((f) => f.day)].sort((a, b) => a - b));
    const inWeek = { ...s, clock };
    expect(evaluateAll([{ type: 'feast', key: 'ash_wednesday' }], inWeek)).toBe(true);
    expect(evaluateAll([{ type: 'feast', key: 'easter' }], inWeek)).toBe(false);
  });

  it('every feast has lines for what happened on it, and the pull fills the pews on the great ones', () => {
    for (const key of FEAST_KEYS) {
      const line = feastIncident(key, (pool) => pool[0]!);
      expect(line, key).toBeTruthy();
      expect(feastIncident(key, (pool) => { expect(pool.length).toBeGreaterThanOrEqual(3); return pool[0]!; })).toBeTruthy();
    }
    expect(FEAST_PULL.christmas!.attendance).toBeGreaterThan(1.4);
    expect(FEAST_PULL.easter!.attendance).toBeGreaterThan(1.4);
    expect(feastPull(['christmas'])).toEqual(FEAST_PULL.christmas);
    expect(feastPull([])).toEqual({ attendance: 1, collections: 1 });
    expect(feastPull(['candlemas'])).toEqual({ attendance: 1, collections: 1 });
    // Easter Sunday 2018 was 1 April; the week of it is fuller than the ordinary Sunday two months on.
    const s = parishState('feast-pull');
    const weekOf = (year: number, month: number, day: number) => Math.floor((toDayNumber({ year, month, day }) - s.clock.startDay) / 7);
    const run = (w: number) => resolveWeek({ ...s, clock: { ...s.clock, week: w }, parish: { ...s.parish!, attendance: 0.5 } }, createRng('fixed'));
    const easter = run(weekOf(2018, 4, 1));
    const june = run(weekOf(2018, 6, 10));
    expect(easter.ledger.attendance).toBeGreaterThan(june.ledger.attendance * 1.3);
    expect(easter.ledger.lines.some((l) => /^Easter Sunday this week\. .+/.test(l))).toBe(true);
    expect(easter.ledger.lines.every((l) => !/\{\w+\}/.test(l))).toBe(true);
  });

  it('the name day is a line and a small lift in the week the saint falls, and nothing in other weeks', () => {
    expect(nameDayOf('Michael')).toMatchObject({ month: 9, day: 29 });
    expect(nameDayOf('José')).toMatchObject({ month: 3, day: 19 });
    expect(nameDayOf('Zebulon')).toBeNull();
    const s = parishState('nameday');
    const named = { ...s, character: { ...s.character!, name: { first: 'Michael', last: 'Kowalski' } } };
    const weekOf = (year: number, month: number, day: number) => Math.floor((toDayNumber({ year, month, day }) - s.clock.startDay) / 7);
    const on = nameDayWeek({ ...named, clock: { ...named.clock, week: weekOf(2018, 9, 29) } });
    expect(on.line).toMatch(/name day/);
    expect(on.line).toMatch(/St\. Michael/);
    expect(on.state.character!.reputation.parishioners).toBe((named.character.reputation.parishioners ?? 0) + NAMEDAY.laity);
    expect(on.state.character!.stats.piety).toBeGreaterThan(named.character.stats.piety);
    const off = nameDayWeek({ ...named, clock: { ...named.clock, week: weekOf(2018, 9, 29) + 2 } });
    expect(off.line).toBeNull();
    expect(off.state.character!.stats.piety).toBe(named.character.stats.piety);
  });
});
