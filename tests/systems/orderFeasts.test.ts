import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder, religiousOrders } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { HOUSE_PATRON_KEY, ORDER_FEAST_KEYS, orderFeastDefs, orderFeastLine, orderFeastsOfWeek, upcomingOrderFeasts } from '@/systems/religious/feasts';
import { evaluateCondition } from '@/engine/conditions';
import { toDayNumber } from '@/engine/calendar';
import { allEvents } from '@/content';
import { parishState } from './week.test';
import { friarWeekHook, parishWeekHook } from '@/engine/weekHook';

function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === 'priory') ?? gen.houses[0]!).id;
  const base = seminaryState(seed);
  const c = testCharacter({ reputation: { ...base.character!.reputation, community: 30, province: 30 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 4 }, mode: { kind: 'clock' }, flags: { ...s.flags, ordained: true, ordination_week: week, [`order:${order}`]: true }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

const weekOf = (s: GameState, year: number, month: number, day: number) => Math.floor((toDayNumber({ year, month, day }) - s.clock.startDay) / 7);

describe('the orders’ calendars', () => {
  it('each order keeps its founder and its own days as data, and the house adds its patron', () => {
    for (const o of religiousOrders) {
      expect(o.feasts.length).toBeGreaterThanOrEqual(8);
      expect(o.feasts.some((f) => f.kind === 'founder' && f.rank === 'solemnity')).toBe(true);
      for (const f of o.feasts) { expect(f.month).toBeGreaterThanOrEqual(1); expect(f.month).toBeLessThanOrEqual(12); expect(f.day).toBeGreaterThanOrEqual(1); expect(f.day).toBeLessThanOrEqual(31); expect(ORDER_FEAST_KEYS).toContain(f.key); }
    }
    expect(ORDER_FEAST_KEYS).toContain(HOUSE_PATRON_KEY);
    const s = friar('feasts-op');
    const defs = orderFeastDefs(s);
    expect(defs.some((f) => f.key === 'dominic')).toBe(true);
    expect(defs.length).toBeGreaterThanOrEqual(religiousOrder('OP').feasts.length);
    expect(orderFeastDefs(parishState('no-order'))).toEqual([]);
  });

  it('finds the feasts of the week, the condition reads them, and the line has no holes', () => {
    const s = friar('feasts-week');
    const at = (w: number): GameState => ({ ...s, clock: { ...s.clock, week: w } });
    const dominic = at(weekOf(s, 2018, 8, 8));
    expect(orderFeastsOfWeek(dominic).map((f) => f.key)).toContain('dominic');
    expect(evaluateCondition({ type: 'feast', key: 'dominic' }, dominic, {})).toBe(true);
    expect(evaluateCondition({ type: 'feast', key: 'augustine' }, dominic, {})).toBe(false);
    expect(evaluateCondition({ type: 'feast', key: 'dominic' }, at(weekOf(s, 2018, 3, 4)), {})).toBe(false);
    const osa = friar('feasts-osa', 'OSA');
    const augustine = { ...osa, clock: { ...osa.clock, week: weekOf(osa, 2018, 8, 28) } };
    expect(orderFeastsOfWeek(augustine).map((f) => f.key)).toEqual(expect.arrayContaining(['augustine', 'monica']));
    for (const f of orderFeastDefs(s)) {
      const line = orderFeastLine(f, createRng(f.key));
      expect(line).toMatch(/ this week\. /);
      expect(line).not.toMatch(/\{\w+\}/);
    }
    const ahead = upcomingOrderFeasts(at(weekOf(s, 2018, 8, 1)), 3);
    expect(ahead[0]!.key).toBe('dominic');
    expect(ahead.map((f) => f.day)).toEqual([...ahead.map((f) => f.day)].sort((a, b) => a - b));
  });

  it('a friar’s week writes the feast into the record and can fire the feast’s own scene; a parish week fires its feast’s scene', () => {
    const s = friar('feasts-hook');
    const w = weekOf(s, 2019, 8, 8);
    const pool = allEvents.filter((e) => (e.requires ?? []).some((c) => c.type === 'feast'));
    const deps = { pool, draw: () => [] } as never;
    let sawLine = false;
    let sawScene = false;
    for (let i = 0; i < 12 && !(sawLine && sawScene); i++) {
      const r = friarWeekHook(deps)({ ...s, seed: `${s.seed}${i}`, clock: { ...s.clock, week: w } }, createRng(`fh${i}`), []);
      if (r.digest.flatMap((d) => d.lines).some((l) => /^The feast of St\. Dominic this week\. /.test(l))) sawLine = true;
      if (r.pending.some((p) => p.eventId.startsWith('opf_dominic')) || r.digest.flatMap((d) => d.lines).some((l) => /Founder's Day/.test(l))) sawScene = true;
    }
    expect(sawLine).toBe(true);
    expect(sawScene).toBe(true);
    const p = parishState('feasts-parish');
    const easter = weekOf(p, 2019, 4, 21);
    let fired = false;
    for (let i = 0; i < 12 && !fired; i++) {
      const r = parishWeekHook(deps)({ ...p, clock: { ...p.clock, week: easter } }, createRng(`ph${i}`), []);
      if (r.pending.some((pe) => pe.eventId.startsWith('fe_')) || r.digest.flatMap((d) => d.lines).some((l) => /Church Full|The Church Full/.test(l))) fired = true;
    }
    expect(fired).toBe(true);
  });
});
