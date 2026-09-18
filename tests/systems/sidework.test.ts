import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { dropWork, sideWorkWeek, startWork, workLine, workLoad, workOf, workOffers, worksDone } from '@/systems/sidework';
import { BROTHERS, askBrother, brotherLines, brothersOf, brothersWeek, favoursFrom, keptWord } from '@/systems/brothers';
import { sideWorkDef } from '@/content/parish';
import { planWeek } from '@/systems/week';
import type { GameState } from '@/types';

function able(seed = 'work'): GameState {
  const s = parishState(seed);
  const c = s.character!;
  return { ...s, character: { ...c, stats: { ...c.stats, theology: 70, knowledge: 70, charisma: 70, administration: 70 }, reputation: { ...c.reputation, brother_priests: 40, chancery: 40 } } };
}

describe('systems/sidework', () => {
  it('one at a time, gated on what a man actually is', () => {
    const s = able();
    const offers = workOffers(s);
    expect(offers.length).toBeGreaterThanOrEqual(8);
    expect(offers.find((o) => o.def.id === 'book')!.available).toBe(true);
    // The translation wants a Roman degree.
    expect(offers.find((o) => o.def.id === 'translation')!.available).toBe(false);
    const started = startWork(s, 'book');
    expect(workOf(started)!.def.id).toBe('book');
    expect(workOffers(started).every((o) => !o.available)).toBe(true);
    expect(() => startWork(started, 'radio')).toThrow();
  });

  it('the hours come off the week for as long as it runs', () => {
    const s = able('hours');
    const before = planWeek(s).mandatory;
    const started = startWork(s, 'book');
    expect(workLoad(started)).toBe(sideWorkDef('book')!.apPerWeek);
    expect(planWeek(started).mandatory).toBeGreaterThan(before);
    const dropped = dropWork(started);
    expect(dropped.state.sideWork).toBeNull();
    expect(workLoad(dropped.state)).toBe(0);
    expect(dropped.line).toContain('stopped work');
  });

  it('milestones pass in order, once each, and the end either lands or does not', () => {
    const s = able('run');
    const def = sideWorkDef('book')!;
    let next = startWork(s, 'book');
    const lines: string[] = [];
    for (let i = 0; i <= def.weeks; i++) {
      next = { ...next, clock: { ...next.clock, week: next.clock.week + 1 } };
      const step = sideWorkWeek(next, createRng(`w:${i}`));
      next = step.state;
      if (step.line) lines.push(step.line);
    }
    // Two milestones plus an ending.
    expect(lines.length).toBe(def.milestones.length + 1);
    expect(next.sideWork).toBeNull();
    const landed = !!next.flags['work:published'];
    const failed = !!next.flags['work:unpublished'];
    expect(landed || failed).toBe(true);
    if (landed) expect(worksDone(next)).toContain('wrote a book');
  });

  it('a man who has built the right thing is spared the risk', () => {
    const s = able('safe');
    const def = sideWorkDef('book')!;
    // Knowledge at 65 is the `unless` on the book: it cannot come to nothing.
    let next = startWork(s, 'book');
    next = { ...next, clock: { ...next.clock, week: next.sideWork!.endWeek } };
    // Milestones still report themselves on the way past, one a week, and then it ends.
    for (let i = 0; i < def.milestones.length + 1; i++) next = sideWorkWeek(next, createRng('certain')).state;
    expect(next.flags['work:published']).toBe(true);
    expect(next.flags['work:unpublished']).toBeUndefined();
    expect(def.risk).toBeTruthy();
  });

  it('the sheet says where it stands', () => {
    const s = startWork(able('line'), 'radio');
    expect(workLine(s)).toContain('radio');
    expect(workLine(able('none'))).toBeNull();
  });
});

describe('systems/brothers', () => {
  it('the hours land on the man he has left longest', () => {
    const s = able('brothers');
    const men = brothersOf(s);
    expect(men.length).toBeGreaterThan(0);
    const after = brothersWeek(s, 1, createRng('b'));
    const moved = men.filter((m) => (after.npcs[m.id]?.relationship ?? 0) > m.relationship);
    expect(moved.length).toBe(1);
    expect(after.flags[`kept:${moved[0]!.id}`]).toBe(after.clock.week);
    expect(keptWord(after, after.npcs[moved[0]!.id]!)).toBe('this year');
  });

  it('a friendship nobody tends drifts back toward civil, and stops there', () => {
    const s = able('drift');
    const man = brothersOf(s)[0]!;
    let warm: GameState = { ...s, npcs: { ...s.npcs, [man.id]: { ...man, relationship: 60 } } };
    for (let i = 0; i < 400; i++) warm = brothersWeek({ ...warm, clock: { ...warm.clock, week: warm.clock.week + 1 } }, 0, createRng(`d:${i}`));
    const now = warm.npcs[man.id]!.relationship;
    expect(now).toBeLessThan(60);
    expect(now).toBeGreaterThanOrEqual(BROTHERS.floor);
  });

  it('a favour is gated on the man and on what he is, and costs him something', () => {
    const s = able('favour');
    const man = brothersOf(s)[0]!;
    const warm = { ...s, npcs: { ...s.npcs, [man.id]: { ...man, relationship: 50, tags: [...man.tags, 'chancery'] } } };
    const offers = favoursFrom(warm, warm.npcs[man.id]!);
    expect(offers.find((f) => f.def.id === 'ear')!.available).toBe(true);
    expect(offers.find((f) => f.def.id === 'word')!.available).toBe(true);
    const cold = { ...s, npcs: { ...s.npcs, [man.id]: { ...man, relationship: 0 } } };
    expect(favoursFrom(cold, cold.npcs[man.id]!).every((f) => !f.available)).toBe(true);
    const asked = askBrother(warm, man.id, 'word');
    expect(asked.state.npcs[man.id]!.relationship).toBe(50 - BROTHERS.favourCost);
    expect(asked.state.character!.reputation.chancery).toBeGreaterThan(warm.character!.reputation.chancery);
    expect(asked.line).toContain(man.name.last);
    // And not twice.
    expect(() => askBrother(asked.state, man.id, 'word')).toThrow();
  });

  it('a weekend covered gives the week back, and an ear gives something else', () => {
    const s = able('cover');
    const man = brothersOf(s)[0]!;
    const warm = { ...s, npcs: { ...s.npcs, [man.id]: { ...man, relationship: 50 } } };
    const covered = askBrother(warm, man.id, 'cover');
    expect(covered.state.parish!.apNextWeek).toBeGreaterThan(warm.parish!.apNextWeek);
    const heard = askBrother(warm, man.id, 'ear');
    expect(heard.state.strain ?? 0).toBeLessThanOrEqual(warm.strain ?? 0);
    expect(heard.state.character!.stats.piety).toBeGreaterThan(warm.character!.stats.piety);
  });

  it('the sheet lists who he could telephone tonight', () => {
    const s = able('sheet');
    const lines = brotherLines(s);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.regard.length).toBeGreaterThan(0);
    expect(lines[0]!.kept).toBe('not since the seminary');
  });
});
