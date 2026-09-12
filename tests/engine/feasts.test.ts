import { describe, it, expect } from 'vitest';
import { feastDays, feastsInWeek, upcomingFeasts, keepsFeast } from '@/engine/feasts';
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
});
