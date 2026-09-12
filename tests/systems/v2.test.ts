import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { milesBetween, nearestParishes } from '@/systems/map';
import { coverAvailability, deaneryPriests, deaneryWeek, formDeanery, setCover, DEANERY } from '@/systems/deanery';
import { delegatedDials, mayChangeDial, setDial } from '@/systems/liturgy';
import { adminFloorFor, bossLoad, planWeek, weekBudget } from '@/systems/week';
import { evaluateSeminarian, helpRelief, returnOfTheFormed, seminarianOf, seminarianWeek, summerSeminarian, FORMED } from '@/systems/formed';
import { createClock } from '@/engine/time';
import { resolveSelector } from '@/engine/selectors';
import { evaluateAll } from '@/engine/conditions';
import { buildSave, deserialize, serialize } from '@/engine/save';
import type { GameState } from '@/types';

describe('the map of the diocese', () => {
  it('every parish has a place, the cathedral at the center, and miles follow the size', () => {
    const s = parishState('map');
    const world = s.world!;
    for (const p of world.parishes) {
      expect(typeof p.x).toBe('number');
      expect(p.x!).toBeGreaterThanOrEqual(0);
      expect(p.x!).toBeLessThanOrEqual(100);
    }
    const cathedral = world.parishes.find((p) => p.cathedral);
    if (cathedral) expect([cathedral.x, cathedral.y]).toEqual([50, 50]);
    const [a, b] = world.parishes;
    expect(milesBetween(a!, b!, 'huge')).toBeGreaterThanOrEqual(milesBetween(a!, b!, 'small'));
    const near = nearestParishes(world.parishes, a!, 'medium', 3);
    expect(near).toHaveLength(3);
    expect(near.map((p) => p.id)).not.toContain(a!.id);
    // A save without places gets the same places twice.
    const save = buildSave(s, createRng(s.seed), null);
    const stripped = JSON.parse(serialize(save));
    for (const p of stripped.state.world.parishes) { delete p.x; delete p.y; }
    const x = deserialize(JSON.stringify(stripped)).state.world!.parishes.map((p) => p.x);
    const y = deserialize(JSON.stringify(stripped)).state.world!.parishes.map((p) => p.x);
    expect(x).toEqual(y);
    expect(x.every((v) => typeof v === 'number')).toBe(true);
  });
});

describe('the deanery', () => {
  it('forms from the map with a dean and neighbors, cover needs regard and gives a block back, and the selectors resolve', () => {
    const s = parishState('deanery');
    expect(s.parish!.deanery).toBeDefined();
    expect(s.flags['deanery:member']).toBe(true);
    const priests = deaneryPriests(s);
    expect(priests.length).toBeGreaterThanOrEqual(3);
    expect(priests[0]!.miles).toBeLessThanOrEqual(priests[priests.length - 1]!.miles);
    expect(resolveSelector(s, '@dean')).not.toBeNull();
    expect(resolveSelector(s, '@deanery_priest', createRng('sel'))).not.toBeNull();
    const first = priests[0]!.npc;
    expect(coverAvailability(s, first.id).ok).toBe(first.relationship >= DEANERY.coverRegard);
    const warm: GameState = { ...s, npcs: { ...s.npcs, [first.id]: { ...first, relationship: 30 } } };
    const trading = setCover(warm, first.id);
    expect(trading.flags['deanery:cover']).toBe(true);
    expect(weekBudget(trading) - planWeek(trading).mandatory).toBeGreaterThan(weekBudget(warm) - planWeek(warm).mandatory);
    const after = deaneryWeek(trading);
    expect(after.npcs[first.id]!.relationship).toBeGreaterThan(30);
    expect(setCover(after, null).flags['deanery:cover']).toBe(false);
    // A rival on an opening raises the flag.
    const rivalled: GameState = { ...s, openings: [{ id: 'o', kind: 'pastor', parishId: priests[1]!.parish.id, urgency: 50, needsSpanish: false, needsAdmin: false, alignment: 0, week: 0, label: 'a parish', deaneryRivalId: first.id, applied: false }] };
    expect(deaneryWeek(rivalled).flags['deanery:rival']).toBe(true);
    expect(evaluateAll([{ type: 'flag', key: 'deanery:rival', value: true }], deaneryWeek(rivalled))).toBe(true);
    // Forming again for the same parish gives the same deanery.
    expect(formDeanery(s, createRng('d')).parish!.deanery!.parishIds).toEqual(formDeanery(s, createRng('d')).parish!.deanery!.parishIds);
  });
});

describe("the pastor's temperament", () => {
  it('a vicar gets one temperament, and it decides the dials he may set and the load he carries', () => {
    const s = parishState('boss', {}, true);
    const flags = ['boss:mentor', 'boss:micromanager', 'boss:absent'].filter((f) => s.flags[f]);
    expect(flags).toHaveLength(1);
    const clean: GameState = { ...s, flags: { ...s.flags, 'boss:mentor': false, 'boss:micromanager': false, 'boss:absent': false } };
    const mentor: GameState = { ...clean, flags: { ...clean.flags, 'boss:mentor': true } };
    const micro: GameState = { ...clean, flags: { ...clean.flags, 'boss:micromanager': true } };
    const absent: GameState = { ...clean, flags: { ...clean.flags, 'boss:absent': true } };
    expect(delegatedDials(mentor)).toEqual(['music', 'homily']);
    expect(delegatedDials(micro)).toEqual([]);
    expect(delegatedDials(absent)).toContain('language');
    expect(mayChangeDial(mentor, 'music').ok).toBe(true);
    expect(mayChangeDial(mentor, 'language').ok).toBe(false);
    expect(mayChangeDial(micro, 'music').ok).toBe(false);
    expect(adminFloorFor(micro)).toBe(adminFloorFor(clean) + 1);
    expect(bossLoad(absent)).toBe(1);
    expect(bossLoad(mentor)).toBe(0);
    const parish = mentor.world!.parishes.find((p) => p.id === mentor.assignment!.parishId)!;
    const other = ['organ_hymns', 'chant', 'folk_group'].find((o) => o !== parish.liturgy!.music)!;
    expect(setDial(mentor, 'music', other).world!.parishes.find((p) => p.id === parish.id)!.liturgy!.music).toBe(other);
    expect(() => setDial(micro, 'music', other)).toThrow();
  });
});

describe('the men you form', () => {
  function june(seed: string, role: 'pastor' | 'parochial_vicar' = 'pastor'): GameState {
    const base = parishState(seed);
    return { ...base, assignment: { ...base.assignment!, role }, clock: createClock({ year: 2024, month: 6, day: 2 }) };
  }

  it('a seminarian comes in June, gives a block back, leaves after ten weeks, is evaluated, and comes back years later', () => {
    const s = june('sem');
    let came: ReturnType<typeof summerSeminarian> | null = null;
    for (let i = 0; i < 20 && !came?.line; i++) came = summerSeminarian(s, createRng(`june:${i}`));
    expect(came!.line).toMatch(/seminarian/);
    let next = came!.state;
    const sem = seminarianOf(next)!;
    expect(next.flags['seminarian:here']).toBe(true);
    expect(resolveSelector(next, '@seminarian')?.id).toBe(sem.id);
    expect(helpRelief(next)).toBe(FORMED.seminarianRelief);
    expect(summerSeminarian(next, createRng('again')).line).toBeNull();
    next = { ...next, clock: { ...next.clock, week: next.parish!.seminarian!.endWeek } };
    const gone = seminarianWeek(next);
    expect(gone.line).toMatch(/evaluation/);
    expect(gone.state.flags['seminarian:evaluation_due']).toBe(true);
    expect(helpRelief(gone.state)).toBe(0);
    expect(() => evaluateSeminarian(next, 'strong')).toThrow();
    const written = evaluateSeminarian(gone.state, 'strong');
    expect(written.formed).toHaveLength(1);
    expect(written.formed![0]!.verdict).toBe('strong');
    expect(written.npcs[sem.id]!.status).toBe('left');
    expect(written.parish!.seminarian).toBeUndefined();
    // Unwritten, it writes itself.
    const late = { ...gone.state, clock: { ...gone.state.clock, week: gone.state.clock.week + FORMED.evaluationGrace } };
    const auto = seminarianWeek(late);
    expect(auto.state.formed![0]!.verdict).toBe('reserved');
    // Years on, he may come back as the vicar.
    const later: GameState = { ...written, clock: createClock({ year: 2024 + FORMED.returnYears + 1, month: 1, day: 7 }) };
    let back: ReturnType<typeof returnOfTheFormed> | null = null;
    for (let i = 0; i < 20 && !back?.line; i++) back = returnOfTheFormed(later, createRng(`back:${i}`));
    expect(back!.line).toMatch(/parochial vicar/);
    expect(back!.state.flags['seminarian:returned']).toBe(true);
    expect(helpRelief(back!.state)).toBe(FORMED.vicarRelief);
    expect(resolveSelector(back!.state, '@seminarian')?.relationship).toBe(30);
    expect(back!.state.formed![0]!.returned).toBe(true);
  });

  it('a deacon on the staff is flagged and gives half a block back, and the selector finds him', () => {
    let found: GameState | null = null;
    for (let i = 0; i < 30 && !found; i++) {
      const s = parishState(`deacon:${i}`);
      if (s.flags['deacon:here']) found = s;
    }
    expect(found).not.toBeNull();
    expect(resolveSelector(found!, '@deacon')?.title).toBe('Deacon');
    expect(helpRelief(found!)).toBeGreaterThanOrEqual(FORMED.deaconRelief);
  });
});
