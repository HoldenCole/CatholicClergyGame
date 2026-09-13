import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { currentParish, dialAvailability, frictionOf, migrateLiturgy, rollLiturgy, rollTaste, selectedOf, setDial, weeklyCost } from '@/systems/liturgy';
import { evaluateCondition } from '@/engine/conditions';
import { facultyGate, preTraditionisCustodes } from '@/systems/decor';
import { actionById } from '@/content/parish';
import { evaluateAll } from '@/engine/conditions';
import { driversOf, HARD_KINDS, sinceArrival, turnaroundOf, turnaroundStep } from '@/systems/trajectory';
import { trust } from '@/systems/promotion';
import { playerCandidate } from '@/systems/openings';
import { dateOf } from '@/engine/time';
import type { GameState, Parish } from '@/types';

function pastor(seed: string): GameState {
  const s = parishState(seed);
  return { ...s, assignment: { ...s.assignment!, role: 'pastor' } };
}

describe("the Latin question and the communities' Masses", () => {
  it('the language dial holds one answer about the English Mass; the communities dial holds any number alongside it', () => {
    const s = pastor('dials');
    const parish = currentParish(s)!;
    const latino: Parish = { ...parish, ethnic: { ...parish.ethnic, latino: 0.4, vietnamese: 0.2, polish: 0 }, liturgy: { ...parish.liturgy!, language: 'some_latin', communities: '' } };
    const t: GameState = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? latino : p)) } };
    const dials = dialAvailability(t);
    const lang = dials.find((d) => d.def.id === 'language')!;
    expect(lang.def.multi).toBeUndefined();
    expect(lang.options.map((o) => o.def.id)).toEqual(['english', 'some_latin', 'latin_ordinary']);
    const comm = dials.find((d) => d.def.id === 'communities')!;
    expect(comm.def.multi).toBe(true);
    expect(comm.options.find((o) => o.def.id === 'spanish_mass')!.available).toBe(true);
    expect(comm.options.find((o) => o.def.id === 'polish_mass')!.available).toBe(false);
    // Add Spanish, keep the Latin; add Vietnamese too; drop Spanish.
    let u = setDial(t, 'communities', 'spanish_mass');
    expect(selectedOf(currentParish(u)!, 'communities')).toEqual(['spanish_mass']);
    expect(currentParish(u)!.liturgy!.language).toBe('some_latin');
    u = setDial(u, 'communities', 'vietnamese_mass');
    expect(selectedOf(currentParish(u)!, 'communities')).toEqual(['spanish_mass', 'vietnamese_mass']);
    expect(weeklyCost(currentParish(u)!)).toBeGreaterThanOrEqual(30);
    expect(evaluateCondition({ type: 'liturgy', key: 'communities', value: 'spanish_mass' }, u, {})).toBe(true);
    expect(evaluateCondition({ type: 'liturgy', key: 'language', value: 'some_latin' }, u, {})).toBe(true);
    u = setDial(u, 'communities', 'spanish_mass');
    expect(selectedOf(currentParish(u)!, 'communities')).toEqual(['vietnamese_mass']);
    // The communities never count against the people's taste.
    expect(frictionOf(currentParish(u)!)).toBe(frictionOf(currentParish(t)!));
    // No position is written for adding a Mass; one is for a Latin turn.
    expect(u.character!.positions.length).toBe(t.character!.positions.length);
  });

  it("an older record's Spanish Mass on the language dial moves over, and rolled parishes carry both dials", () => {
    const s = pastor('migrate');
    const parish = currentParish(s)!;
    const old: Parish = { ...parish, liturgy: { ...parish.liturgy!, language: 'spanish_mass' } };
    delete (old.liturgy as Record<string, string>).communities;
    const moved = migrateLiturgy(old);
    expect(moved.liturgy!.language).toBe('english');
    expect(selectedOf(moved, 'communities')).toEqual(['spanish_mass']);
    const rng = createRng('roll');
    const latino: Parish = { ...parish, ethnic: { ...parish.ethnic, latino: 0.5 } };
    const taste = rollTaste(rng, latino);
    expect(taste.communities).toBeUndefined();
    const rolled = rollLiturgy(rng, latino, taste);
    expect(typeof rolled.communities).toBe('string');
    expect(['english', 'some_latin', 'latin_ordinary']).toContain(rolled.language);
  });
});

describe('the older Mass before the 2021 norms', () => {
  function inYear(s: GameState, year: number, month: number): GameState {
    let t = s;
    for (let i = 0; i < 52 * 20 && !(dateOf(t.clock).year === year && dateOf(t.clock).month === month); i++) t = { ...t, clock: { ...t.clock, week: t.clock.week + 1 } };
    return t;
  }
  it('needs no faculties before Traditionis Custodes, only the Latin, and what was begun before stands after', () => {
    const base = parishState('tlm');
    const early = inYear(base, 2019, 5);
    expect(preTraditionisCustodes(early)).toBe(true);
    expect(facultyGate(early).ok).toBe(false);
    const trained: GameState = { ...early, character: { ...early.character!, credentials: [...early.character!.credentials, 'latin'] } };
    expect(facultyGate(trained).ok).toBe(true);
    expect(facultyGate(trained).canAsk).toBe(false);
    const older = actionById('older_mass')!;
    expect(evaluateAll(older.requires ?? [], trained)).toBe(true);
    expect(evaluateAll(older.requires ?? [], early)).toBe(false);
    const late = inYear(trained, 2022, 3);
    expect(preTraditionisCustodes(late)).toBe(false);
    expect(evaluateAll(older.requires ?? [], late)).toBe(false);
    expect(facultyGate(late).ok).toBe(false);
    const begun: GameState = { ...late, flags: { ...late.flags, 'older_mass:said': true } };
    expect(evaluateAll(older.requires ?? [], begun)).toBe(true);
    expect(facultyGate(begun).ok).toBe(true);
    expect(facultyGate(begun).why).toMatch(/what stood then stands/);
    expect(older.setsFlag).toBe('older_mass:said');
  });
});

describe('the parish nobody wanted, turning around', () => {
  it('a hard parish a year in with the numbers up earns credit with the board, once, and the sheet says what drives it', () => {
    const s = pastor('turn');
    const rec = currentParish(s)!;
    const hard: Parish = { ...rec, kind: 'difficult' };
    let t: GameState = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === rec.id ? hard : p)) } };
    expect(HARD_KINDS.has('difficult')).toBe(true);
    const arrival = t.parish!.arrival!;
    // A year later, everything better than at arrival.
    t = {
      ...t,
      clock: { ...t.clock, week: arrival.week + 60 },
      parish: { ...t.parish!, attendance: arrival.attendance + 0.15, finance: { ...t.parish!.finance, averageCollection: arrival.collections * 1.5, debt: Math.max(0, arrival.debt - 50000) } },
      world: { ...t.world!, parishes: t.world!.parishes.map((p) => (p.id === rec.id ? { ...hard, buildings: { ...hard.buildings, church: Math.min(100, hard.buildings.church + 20), rectory: Math.min(100, hard.buildings.rectory + 20), hall: Math.min(100, hard.buildings.hall + 20) } } : p)) },
    };
    const traj = sinceArrival(t)!;
    expect(traj.score).toBeGreaterThanOrEqual(3);
    expect(turnaroundOf(t)).toBe(1);
    const c = playerCandidate(t);
    expect(c.turnaround).toBe(1);
    expect(trust(c).reasons).toContain('turned around the parish nobody wanted');
    expect(trust(c).value).toBeGreaterThan(trust({ ...c, turnaround: 0 }).value);
    const noticed = turnaroundStep(t);
    expect(noticed.line).toMatch(/turning around/);
    expect(noticed.state.flags[`turnaround:${rec.id}`]).toBe(true);
    expect(noticed.state.character!.traits).toContain('turned a parish around');
    expect(turnaroundStep(noticed.state).line).toBeNull();
    // Not for the flagship, and not in the first year.
    expect(turnaroundOf({ ...t, world: { ...t.world!, parishes: t.world!.parishes.map((p) => (p.id === rec.id ? { ...p, kind: 'flagship_suburban' } : p)) } })).toBe(0);
    expect(turnaroundOf({ ...t, clock: { ...t.clock, week: arrival.week + 20 } })).toBe(0);
    const drivers = driversOf(t);
    expect(drivers.map((d) => d.label)).toEqual(['Attendance', 'Collections', 'Debt', 'The groups', 'The buildings']);
    expect(drivers[2]!.lines[0]).toMatch(/paid down/);
  });
});

describe('the people and the bishop say it', () => {
  it('the week the turnaround lands the parish says it to your face, six weeks on the bishop writes, and the next visitation says it from the microphone', async () => {
    const { parishWeekHook, resolvePending } = await import('@/engine/weekHook');
    const { eventById, eventsForPhase } = await import('@/content');
    const { TURNAROUND_LETTER_WEEKS, wasDying } = await import('@/systems/trajectory');
    const { visitationStep } = await import('@/systems/visitation');
    const s = pastor('say-it');
    const rec = currentParish(s)!;
    const arrival = s.parish!.arrival!;
    // A parish of any kind counts when the numbers at arrival say dying.
    const dying: GameState = { ...s, parish: { ...s.parish!, arrival: { ...arrival, attendance: 0.2 } } };
    expect(wasDying(dying)).toBe(true);
    let t: GameState = {
      ...dying,
      clock: { ...dying.clock, week: arrival.week + 60 },
      parish: { ...dying.parish!, attendance: 0.5, finance: { ...dying.parish!.finance, averageCollection: arrival.collections * 1.6, debt: Math.max(0, arrival.debt - 60000) } },
      world: { ...dying.world!, parishes: dying.world!.parishes.map((p) => (p.id === rec.id ? { ...p, buildings: { ...p.buildings, church: Math.min(100, p.buildings.church + 25), rectory: Math.min(100, p.buildings.rectory + 25), hall: Math.min(100, p.buildings.hall + 25) } } : p)) },
    };
    expect(turnaroundOf(t)).toBe(1);
    const deps = { pool: eventsForPhase('pastor'), lookup: eventById };
    t = parishWeekHook(deps)(t, createRng('w'), []);
    expect(t.pending.map((e) => e.eventId)).toContain('ta_the_parish_notices');
    expect(t.flags['turnaround:letter_week']).toBe(t.clock.week + TURNAROUND_LETTER_WEEKS);
    t = resolvePending(t, t.pending.find((e) => e.eventId === 'ta_the_parish_notices')!, 'thank_them', createRng('r'), deps);
    expect(t.character!.traits).toContain('gave the credit away');
    // Six weeks on, the bishop's letter, unasked.
    t = { ...t, clock: { ...t.clock, week: t.clock.week + TURNAROUND_LETTER_WEEKS }, pending: [], mode: { kind: 'clock' } };
    t = parishWeekHook(deps)(t, createRng('w2'), []);
    expect(t.pending.map((e) => e.eventId)).toContain('ta_bishops_letter');
    expect(t.flags['turnaround:letter_week']).toBeUndefined();
    // The next visitation says it from the microphone, and only once.
    const v = visitationStep({ ...t, pending: [], mode: { kind: 'clock' }, parish: { ...t.parish!, visitationYear: 0 }, clock: { ...t.clock, week: t.clock.week + 52 } }, createRng('v'), deps.pool);
    expect(v.event?.id).toBe('vs_turnaround');
  });
});
