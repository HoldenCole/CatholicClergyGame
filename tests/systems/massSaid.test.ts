import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import { massSaid, olderMassNorm } from '@/systems/massSaid';
import { policiesByDate } from '@/systems/rome/policy';
import { dateOf, sundayOf } from '@/engine/time';
import type { GameState } from '@/types';

/** The state in that month, with the law as Rome's documents left it on that day. */
function inYear(s: GameState, year: number, month: number): GameState {
  let t = s;
  for (let i = 0; i < 52 * 20 && !(dateOf(t.clock).year === year && dateOf(t.clock).month === month); i++) t = { ...t, clock: { ...t.clock, week: t.clock.week + 1 } };
  return { ...t, rome: { ...t.rome!, policies: policiesByDate(sundayOf(t.clock)) } };
}

describe('the Mass you say', () => {
  it('a seminarian does not yet say Mass, and is told what the house says and what the older form will ask of him', () => {
    const s = seminaryState('mass:sem');
    const m = massSaid(s);
    expect(m.celebrant).toBe(false);
    expect(m.standing).toBe('not_yet');
    expect(m.line).toMatch(/do not yet say Mass/);
    expect(m.line).toMatch(/Mass of Paul VI/);
    expect(m.older).toMatch(/1962 Missal/);
    expect(m.older).toMatch(/Latin/);
  });

  it('a priest in a parish says the reformed Missal in the languages of his Masses, and the older form reads the law of the day', () => {
    const base = parishState('mass:parish');
    expect(base.flags.ordained).toBe(true);
    // Under Summorum Pontificum: free, but for the Latin.
    const early = inYear(base, 2019, 5);
    const e = massSaid(early);
    expect(e.celebrant).toBe(true);
    expect(e.form).toBe('ordinary');
    expect(e.line).toMatch(/^The Mass of Paul VI, in English/);
    expect(olderMassNorm(early)).toMatch(/Summorum Pontificum/);
    expect(e.standing).toBe('no_latin');
    const trained: GameState = { ...early, character: { ...early.character!, credentials: [...early.character!.credentials, 'latin'] } };
    expect(massSaid(trained).standing).toBe('free');
    // Faculties mean nothing while Rome leaves it free: a man who holds them simply may.
    expect(massSaid({ ...early, flags: { ...early.flags, can_celebrate_tlm: true } }).standing).toBe('free');
    expect(massSaid({ ...early, flags: { ...early.flags, can_celebrate_tlm: true } }).older).not.toMatch(/hold faculties/);
    // Under Traditionis Custodes: the bishop's faculties, man by man.
    const late = inYear(trained, 2022, 3);
    const l = massSaid(late);
    expect(olderMassNorm(late)).toMatch(/Traditionis Custodes/);
    expect(l.standing).toBe('by_leave');
    expect(l.older).toMatch(/faculties/);
    expect(l.older).toMatch(/Mass sheet/);
    // With faculties, and hours on the routine, he says it.
    const granted: GameState = { ...late, flags: { ...late.flags, can_celebrate_tlm: true }, parish: { ...late.parish!, routine: { ...late.parish!.routine, discretionary: { ...late.parish!.routine.discretionary, older_mass: 1 } } } };
    const g = massSaid(granted);
    expect(g.standing).toBe('faculties');
    expect(g.form).toBe('older');
    expect(g.line).toMatch(/older form besides/);
    expect(g.older).toMatch(/1 block a week/);
    // What was begun before the norms stands.
    const begun: GameState = { ...late, flags: { ...late.flags, 'older_mass:said': true } };
    expect(massSaid(begun).standing).toBe('begun');
    expect(massSaid(begun).older).toMatch(/what stood then stands/);
    // A parish that keeps the older form on Sunday says so, and whose altar it is.
    const keeps: GameState = { ...late, decor: { ...late.decor, [`parish:${late.assignment!.parishId}:church`]: { mass_form: 'mass_tlm' } } };
    expect(massSaid(keeps).line).toMatch(/keeps the older form on Sunday/);
    expect(massSaid(keeps).line).toMatch(/pastor's altar/);
  });

  it('the languages of the Masses he says are read from the schedule, and the Latin of the English Mass from the dial', () => {
    const s = inYear(parishState('mass:lang'), 2019, 5);
    const sched = s.parish!.schedule ?? undefined;
    const withSpanish: GameState = sched
      ? { ...s, parish: { ...s.parish!, schedule: { ...sched, masses: [...sched.masses, { id: 'mx', day: 'sun', minute: 13 * 60, language: 'spanish', celebrant: 'me', sunday: true }] } } }
      : s;
    if (sched) expect(massSaid(withSpanish).line).toMatch(/in Spanish on Sunday/);
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const latinOrdinary: GameState = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, liturgy: { ...(p.liturgy ?? {}), language: 'latin_ordinary' } } : p)) } };
    expect(massSaid(latinOrdinary).line).toMatch(/ordinary in Latin/);
  });

  it('the law is named in every era the record knows: closed, the indult, free, faculties', () => {
    const base = parishState('mass:eras');
    expect(olderMassNorm(inYear(base, 2019, 5))).toMatch(/any priest who can say/);
    expect(olderMassNorm(inYear(base, 2022, 3))).toMatch(/faculties, granted man by man/);
  });
});
