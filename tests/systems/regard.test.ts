import { describe, expect, it } from 'vitest';
import { seminaryState, testEvent, testNpc } from '../helpers/fixtures';
import { REGARD, inTouch, mark, noteMarks, regardLine, regardWeek, restOf, touch } from '@/systems/regard';
import { applyChoice } from '@/engine/events';
import { circleOf, inCircle } from '@/systems/circle';
import { yearOf } from '@/ui/portraits/spec';
import type { GameState } from '@/types';

function withNpc(state: GameState, id: string, over: Parameters<typeof testNpc>[1] = {}): GameState {
  return { ...state, npcs: { ...state.npcs, [id]: testNpc(id, over) } };
}

function weeks(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = regardWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } });
  return s;
}

describe('regard that settles', () => {
  it('rests where the history says: who they are, the marks, the bonds, the quarrels', () => {
    expect(restOf(testNpc('a', { role: 'family' }))).toBe(REGARD.base.family);
    expect(restOf(testNpc('b', { role: 'classmate' }))).toBe(REGARD.base.classmate);
    expect(restOf(testNpc('c', { role: 'priest', marks: [{ week: 1, delta: 20, why: 'x' }] }))).toBe(10);
    expect(restOf(testNpc('d', { role: 'lay', bonds: [{ kind: 'baptized', week: 1, who: 'her son' }, { kind: 'buried', week: 2, who: 'her mother' }] }))).toBe(8);
    expect(restOf(testNpc('e', { role: 'lay', bonds: [{ kind: 'quarreled', week: 1, who: 'them' }] }))).toBe(-REGARD.quarrelCost);
    // The marks are capped, either way, and the rest stays in its band.
    expect(restOf(testNpc('f', { role: 'priest', marks: Array.from({ length: 10 }, (_, i) => ({ week: i, delta: 30, why: 'x' })) }))).toBe(REGARD.markCap);
  });

  it('a friendship nobody tends drifts back toward where it rests, and a pinned one falls faster', () => {
    const s0 = seminaryState('regard');
    const s = withNpc(s0, 'pinned', { role: 'priest', relationship: 100 });
    const later = weeks(s, 52);
    const now = later.npcs['pinned']!.relationship;
    expect(now).toBeLessThan(100);
    expect(now).toBeGreaterThan(restOf(later.npcs['pinned']!));
    // Above the kept band it falls faster than below it.
    const a = weeks(withNpc(s0, 'p', { role: 'priest', relationship: 90 }), 10).npcs['p']!.relationship;
    const b = weeks(withNpc(s0, 'q', { role: 'priest', relationship: 40 }), 10).npcs['q']!.relationship;
    expect(90 - a).toBeGreaterThan(40 - b);
    // It settles, and stops at the resting point.
    const settled = weeks(withNpc(s0, 'r', { role: 'classmate', relationship: 12 }), 300).npcs['r']!.relationship;
    expect(settled).toBeCloseTo(REGARD.base.classmate, 1);
    // A cold one mends upward too.
    const mended = weeks(withNpc(s0, 'm', { role: 'family', relationship: 0 }), 700).npcs['m']!.relationship;
    expect(mended).toBeCloseTo(REGARD.base.family, 1);
  });

  it('being in touch holds it where it is', () => {
    const s0 = seminaryState('touch');
    const s = withNpc(s0, 'k', { role: 'priest', relationship: 80 });
    const kept = { ...s, npcs: { ...s.npcs, k: touch(s.npcs['k']!, s.clock.week) } };
    expect(inTouch(kept, kept.npcs['k']!)).toBe(true);
    const after = weeks(kept, REGARD.contactWeeks);
    expect(after.npcs['k']!.relationship).toBe(80);
    const later = weeks(after, 10);
    expect(later.npcs['k']!.relationship).toBeLessThan(80);
  });

  it('a scene that moves a man enough is remembered on him, and the people in it were seen', () => {
    const s0 = withNpc(seminaryState('marks'), 'x', { role: 'priest', relationship: 10 });
    const s = withNpc(s0, 'y', { role: 'priest', relationship: 10 });
    const ev = testEvent({ id: 'ev_mark', title: 'The Phone at Eleven', choices: [{ id: 'a', label: 'A', effects: [{ target: 'relationship', key: '@x', delta: 12 }, { target: 'relationship', key: '@y', delta: 2 }] }] });
    const pending = { eventId: ev.id, severity: ev.severity, category: ev.category, week: s.clock.week, bindings: { '@x': 'x', '@y': 'y' } };
    const next = applyChoice(s, ev, pending, 'a', () => undefined).state;
    expect(next.npcs['x']!.marks).toEqual([{ week: s.clock.week, delta: 12, why: 'The Phone at Eleven' }]);
    expect(next.npcs['y']!.marks ?? []).toHaveLength(0);
    expect(next.npcs['y']!.contactWeek).toBe(s.clock.week);
    // The mark moves where he rests.
    expect(restOf(next.npcs['x']!)).toBe(6);
    // Marks are kept to a dozen.
    let n = next.npcs['x']!;
    for (let i = 0; i < 20; i++) n = mark(n, { week: i, delta: 8, why: `m${i}` });
    expect(n.marks).toHaveLength(REGARD.marksKept);
    expect(noteMarks(s, s, [], 'nothing')).toBe(s);
  });

  it('a friend has a since, and loses it only when the regard is gone', () => {
    const s0 = seminaryState('since');
    let s = withNpc(s0, 'f', { role: 'priest', relationship: 30 });
    s = regardWeek(s);
    expect(s.npcs['f']!.friendSince).toBeUndefined();
    s = { ...s, npcs: { ...s.npcs, f: { ...s.npcs['f']!, relationship: 45 } } };
    s = regardWeek(s);
    const since = s.npcs['f']!.friendSince;
    expect(since).toBe(s.clock.week);
    const year = (w: number) => yearOf(s.clock.startDay, w);
    expect(regardLine(s, s.npcs['f']!, year)).toMatch(/^a friend, since \d{4}, (drifting|settled|kept)$/);
    s = { ...s, npcs: { ...s.npcs, f: { ...s.npcs['f']!, relationship: 30 } } };
    s = regardWeek(s);
    expect(s.npcs['f']!.friendSince).toBe(since);
    s = { ...s, npcs: { ...s.npcs, f: { ...s.npcs['f']!, relationship: 10 } } };
    s = regardWeek(s);
    expect(s.npcs['f']!.friendSince).toBeUndefined();
  });
});

describe('the circle', () => {
  it('lists the people who matter, grouped as the shelf groups them, the living and the warm first', () => {
    let s = seminaryState('circle');
    s = withNpc(s, 'mum', { role: 'family', relationship: 50, tags: ['mother'] });
    s = withNpc(s, 'cm', { role: 'classmate', relationship: 20 });
    s = withNpc(s, 'cold', { role: 'classmate', relationship: -20 });
    s = withNpc(s, 'nobody', { role: 'priest', relationship: 3 });
    s = withNpc(s, 'bonded', { role: 'lay', relationship: 5, bonds: [{ kind: 'buried', week: 1, who: 'his father' }], tags: ['parish:elsewhere'] });
    s = withNpc(s, 'dead', { role: 'priest', relationship: 60, status: 'dead' });
    expect(inCircle(s.npcs['nobody']!)).toBe(false);
    const rows = circleOf(s);
    const ids = rows.map((r) => r.npc.id);
    expect(ids).toContain('mum');
    expect(ids).toContain('bonded');
    expect(ids).not.toContain('nobody');
    expect(rows.find((r) => r.npc.id === 'mum')!.group).toBe('family');
    expect(rows.find((r) => r.npc.id === 'bonded')!.group).toBe('former');
    expect(rows.find((r) => r.npc.id === 'bonded')!.history).toMatch(/father you buried/);
    expect(rows.find((r) => r.npc.id === 'dead')!.status).toBe('dead');
    expect(ids.indexOf('cm')).toBeLessThan(ids.indexOf('cold'));
  });
});
