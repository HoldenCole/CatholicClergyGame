import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { resolveWeek } from '@/systems/week';
import { homilyAvailability, setHomily, weeksUntilChange, HOMILY } from '@/systems/homily';
import { candidatesFor, hire, letGo, staffOf, staffWeek, vacanciesOf } from '@/systems/staff';
import { awayAvailability, awayWeek, goAway, retreatDue, retreatYearEnd, vacationLeft, AWAY } from '@/systems/away';
import { allEvents } from '@/content';
import { currentParish } from '@/systems/liturgy';
import type { GameState } from '@/types';

function pastor(seed: string): GameState {
  const base = parishState(seed);
  return { ...base, assignment: { ...base.assignment!, role: 'pastor' }, parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 200000, debt: 0 } } };
}

describe('the Sunday homily as a lever', () => {
  it('a course lasts a month, moves what it says, and the reason shows', () => {
    const s = pastor('homily');
    expect(homilyAvailability(s).find((h) => h.def.id === 'readings')!.current).toBe(true);
    const news = setHomily(s, 'the_news');
    expect(news.parish!.homily?.topic).toBe('the_news');
    expect(weeksUntilChange(news)).toBe(HOMILY.changeEveryWeeks);
    expect(() => setHomily(news, 'vocations')).toThrow(/week/);
    const after = resolveWeek(news, createRng('w')).state;
    expect(after.character!.outspokenness).toBeGreaterThan(news.character!.outspokenness);
    expect(after.movers!.some((m) => m.key === 'public' && /homily on the week/.test(m.why))).toBe(true);
    const later: GameState = { ...after, clock: { ...after.clock, week: after.clock.week + HOMILY.changeEveryWeeks } };
    expect(homilyAvailability(later).find((h) => h.def.id === 'vocations')!.available).toBe(true);
  });
});

describe('staff hired and let go', () => {
  it('a vicar cannot; a pastor lets the secretary go, the desk empties, candidates come, and one is hired', () => {
    const vicar = parishState('staff');
    const desks = staffOf(vicar);
    const secretary = desks.find((d) => d.tag === 'secretary')!.npc!;
    expect(() => letGo(vicar, secretary.id)).toThrow(/pastor/);
    const s = pastor('staff');
    const gone = letGo(s, secretary.id);
    expect(gone.npcs[secretary.id]!.status).toBe('dismissed');
    expect(gone.flags['staff:let_go:secretary']).toBe(true);
    expect(gone.flags['staff:let_go_any']).toBe(true);
    expect(gone.character!.reputation.parishioners).toBeLessThan(s.character!.reputation.parishioners);
    expect(vacanciesOf(gone)).toContain('secretary');
    const week = staffWeek(gone, createRng('staff:week')).state;
    const candidates = week.parish!.hiring?.secretary ?? [];
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map((c) => c.name.last)).size).toBeGreaterThan(1);
    const hired = hire(week, candidates[1]!.id);
    expect(staffOf(hired).find((d) => d.tag === 'secretary')!.npc!.id).toBe(candidates[1]!.id);
    expect(hired.flags['staff:new:secretary']).toBe(true);
    expect(hired.parish!.hiring?.secretary).toBeUndefined();
    // Candidates are rolled from the seed: the same week gives the same three.
    const again = candidatesFor(gone, 'secretary', createRng('staff:week'), currentParish(gone)!);
    expect(again.map((c) => c.name.last)).toEqual(candidatesFor(gone, 'secretary', createRng('staff:week'), currentParish(gone)!).map((c) => c.name.last));
  });

  it('a member of staff who cannot stand the priest may give notice', () => {
    const s = pastor('quit');
    const dre = staffOf(s).find((d) => d.tag === 'dre')?.npc ?? staffOf(s)[0]!.npc!;
    const sour: GameState = { ...s, npcs: { ...s.npcs, [dre.id]: { ...dre, relationship: -60 } } };
    let left = false;
    for (let i = 0; i < 200 && !left; i++) {
      const w = staffWeek({ ...sour, clock: { ...sour.clock, week: i } }, createRng(`q:${i}`));
      left = w.state.npcs[dre.id]!.status === 'left';
    }
    expect(left).toBe(true);
  });
});

describe('the retreat and a vacation', () => {
  it('a week away rests the man, pays the supply, fires a scene, and the retreat is made for the year', () => {
    const s: GameState = { ...pastor('away'), strain: 60 };
    expect(retreatDue(s)).toBe(true);
    expect(vacationLeft(s)).toBe(AWAY.vacationWeeks);
    const options = awayAvailability(s);
    expect(options.find((o) => o.def.id === 'diocesan')!.available).toBe(true);
    const gone = goAway(s, 'diocesan');
    expect(gone.away?.kind).toBe('retreat');
    expect(gone.flags['away:retreat']).toBe(true);
    expect(gone.flags['away:place:diocesan']).toBe(true);
    expect(retreatDue(gone)).toBe(false);
    const week = awayWeek(gone, createRng('away'), allEvents);
    expect(week.state.strain).toBeLessThan(60);
    expect(week.state.parish!.finance.cash).toBeLessThan(s.parish!.finance.cash);
    expect(week.event?.id).toBe('aw_diocesan_retreat');
    expect(week.state.away).toBeNull();
    expect(week.state.flags['away:retreat']).toBe(false);
    // Two weeks of vacation, then none left.
    const beach = goAway(week.state, 'beach');
    expect(vacationLeft(beach)).toBe(0);
    expect(awayAvailability(beach).find((o) => o.def.id === 'cabin')!.available).toBe(false);
    const w1 = awayWeek(beach, createRng('b1'), allEvents);
    expect(w1.state.away?.weeksLeft).toBe(1);
    const w2 = awayWeek(w1.state, createRng('b2'), allEvents);
    expect(w2.state.away).toBeNull();
    expect(w2.event).toBeNull();
  });

  it('a year without a retreat is noticed', () => {
    const s = pastor('owed');
    const owed = retreatYearEnd(s);
    expect(owed.line).toMatch(/canon 276/i);
    expect(owed.state.flags['retreat:overdue']).toBe(true);
    expect(owed.state.character!.reputation.chancery).toBeLessThan(s.character!.reputation.chancery);
    const made = goAway(owed.state, 'diocesan');
    expect(made.flags['retreat:overdue']).toBe(false);
  });
});
