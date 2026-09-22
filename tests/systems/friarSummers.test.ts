import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { availableSummers, chooseSummer, summerOptionsFor } from '@/engine/seminary';
import { religiousSummerOptions, summerOptions } from '@/content/seminary';
import { clubsForPhase } from '@/systems/clubs';
import { summersOnRecord } from '@/systems/standing';

function student(seed: string, order: OrderKey, year: number): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === 'priory') ?? gen.houses[0]!).id;
  const base = seminaryState(seed);
  const s = installProvince(base, gen, 2010, first);
  return { ...s, seminary: { ...s.seminary!, year }, flags: { ...s.flags, [`order:${order}`]: true } };
}

describe('a friar’s formation years have the order’s summers and the studium’s circles', () => {
  it('a diocesan seminarian keeps the seminary’s summers; a novice has the novitiate’s; a student has the order’s', () => {
    const dio = seminaryState('dio');
    expect(summerOptionsFor(dio)).toBe(summerOptions);
    expect(availableSummers(dio).map((o) => o.option.id)).toContain('hospital');
    const novice = student('nov', 'OP', 1);
    const noviceIds = summerOptionsFor(novice).map((o) => o.id);
    expect(noviceIds).toEqual(expect.arrayContaining(['novitiate_garden', 'novitiate_pilgrimage']));
    expect(noviceIds).not.toContain('op_mission');
    expect(noviceIds).not.toContain('hospital');
    const op = student('op', 'OP', 4);
    const opIds = summerOptionsFor(op).map((o) => o.id);
    expect(opIds).toEqual(expect.arrayContaining(['op_mission', 'op_parish', 'op_summer_latin', 'op_preaching_summer', 'friar_hospital', 'friar_spanish']));
    expect(opIds).not.toContain('osa_school');
    expect(opIds).not.toContain('novitiate_garden');
    expect(opIds).not.toContain('home_parish');
    const osa = student('osa', 'OSA', 3);
    const osaIds = summerOptionsFor(osa).map((o) => o.id);
    expect(osaIds).toEqual(expect.arrayContaining(['osa_school', 'osa_mission', 'osa_shrine', 'osa_reading_summer']));
    expect(osaIds).not.toContain('op_mission');
    // The Augustinian pre-novitiate is a priory year: the novitiate's summers.
    expect(summerOptionsFor(student('osa1', 'OSA', 1)).map((o) => o.id)).toContain('novitiate_garden');
    for (const o of religiousSummerOptions) { expect(o.campaign).toBe('religious'); expect(o.houses?.length).toBeGreaterThan(0); expect(o.effects.length).toBeGreaterThan(0); }
  });

  it('choosing an order’s summer lands its effects, writes the record, and the seminary’s own is refused', () => {
    const op = { ...student('choose', 'OP', 4), mode: { kind: 'summer' as const, year: 4 } };
    const before = op.character!.reputation.province ?? 0;
    const after = chooseSummer(op, 'op_mission');
    expect(after.mode.kind).toBe('clock');
    expect(after.seminary!.summers[4]).toBe('op_mission');
    expect(after.character!.reputation.province).toBe(before + 4);
    expect(after.flags['summer:mission']).toBe(true);
    expect(summersOnRecord(after.seminary)).toEqual([{ year: 4, label: "The province's mission" }]);
    expect(after.career.at(-1)?.text).toMatch(/the province's mission/);
    expect(() => chooseSummer(op, 'hospital')).toThrow();
  });

  it('a student friar’s circles are the studium’s: the order’s seminary clubs, the shared ones, never the rector’s table', () => {
    const op = student('clubs', 'OP', 3);
    const ids = clubsForPhase(op).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['novice_master_table', 'students_preaching_workshop', 'studium_greek', 'friars_garden', 'studium_schola', 'thomists']));
    expect(ids).not.toContain('rectors_table');
    expect(ids).not.toContain('tlm_society');
    expect(ids).not.toContain('admin_warriors');
    expect(ids).not.toContain('students_reading_circle');
    expect(ids).not.toContain('province_thomists');
    const osa = clubsForPhase(student('clubs2', 'OSA', 3)).map((c) => c.id);
    expect(osa).toContain('students_reading_circle');
    expect(osa).not.toContain('students_preaching_workshop');
    const dio = clubsForPhase(seminaryState('dioclubs')).map((c) => c.id);
    expect(dio).toContain('rectors_table');
    expect(dio).not.toContain('novice_master_table');
  });
});
