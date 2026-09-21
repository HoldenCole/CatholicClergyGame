import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { applyRumourEffect, heardRumours, RUMOUR_KINDS, rumourCondition, rumourSubject, TALK, talkOf, talkReviewLine, talkWeek, watched, whatTheySay } from '@/systems/talk';
import { evaluateCondition } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import type { GameState, Npc } from '@/types';

function withMen(s: GameState): GameState {
  const base = Object.values(s.npcs).find((n) => n.role === 'lay')!;
  const mk = (id: string, tags: string[]): Npc => ({ ...base, id, role: 'classmate', status: 'active', title: 'Fr.', tags, relationship: 10, bonds: [] });
  return { ...s, npcs: { ...s.npcs, cm1: mk('cm1', []), cm2: mk('cm2', ['pastor']) } };
}

describe('the presbyterate as people who talk', () => {
  it('watches the deanery, the pastor above, the classmates; the first week only takes the snapshot', () => {
    const s = withMen(parishState('talk-watch'));
    const men = watched(s);
    expect(men.some((n) => n.id === 'cm1')).toBe(true);
    expect(men.some((n) => n.role === 'priest')).toBe(true);
    const r = talkWeek(s, createRng('t0'));
    expect(Object.keys(r.state.talk!.snapshot).length).toBe(men.length);
    expect(r.state.talk!.rumours.length).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it('a change in a watched man becomes talk, true or distorted, and reaches him at a venue later', () => {
    const s = withMen(parishState('talk-change'));
    let next = talkWeek(s, createRng('t0')).state;
    // A classmate is named to the chancery; another starts drinking.
    next = { ...next, clock: { ...next.clock, week: next.clock.week + 1 }, npcs: { ...next.npcs, cm1: { ...next.npcs.cm1!, tags: ['chancery'] }, cm2: { ...next.npcs.cm2!, tags: ['pastor', 'life:drinking', `life:since:${next.clock.week}`, `life:until:${next.clock.week + 104}`] } } };
    let seen: string[] = [];
    let heard = 0;
    for (let i = 0; i < 40; i++) {
      const r = talkWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`w${i}`));
      next = r.state;
      seen = next.talk!.rumours.map((x) => x.kind);
      heard += r.lines.length;
      for (const line of r.lines) { expect(line).not.toMatch(/\{\w+\}/); expect(line).toMatch(/^(At |The dean|A classmate|In the cathedral|Someone let you know|.+, a man who meant well)/); }
    }
    expect(seen).toEqual(expect.arrayContaining(['named_chancery', 'life_drinking']));
    expect(heard).toBeGreaterThan(0);
    const named = next.talk!.rumours.find((r) => r.kind === 'named_chancery')!;
    expect(named.about).toBe('cm1');
    expect(named.text).toMatch(/Fr\. \w+/);
    expect(named.text).not.toMatch(/\{/);
    // Once talked about, not again inside the repeat window.
    expect(next.talk!.rumours.filter((r) => r.kind === 'named_chancery' && r.about === 'cm1').length).toBe(1);
    expect(whatTheySay(next).every((r) => r.heardWeek !== undefined)).toBe(true);
  });

  it('his own record is talked about, moves his standing at once, and reaches the bishop unless he sets it straight', () => {
    const s = withMen(parishState('talk-you'));
    const snap = talkWeek(s, createRng('t0')).state;
    const week = snap.clock.week + 1;
    const cols: GameState = { ...snap, clock: { ...snap.clock, week }, flags: { ...snap.flags, 'column:last': week, 'town:winter_shelter': true } };
    let next = cols;
    let spawned = false;
    for (let i = 0; i < 12 && !spawned; i++) {
      next = talkWeek({ ...next, clock: { ...next.clock, week: week + i } }, createRng(`y${i}`)).state;
      spawned = next.talk!.rumours.some((r) => r.about === 'you');
    }
    expect(spawned).toBe(true);
    const mine = next.talk!.rumours.filter((r) => r.about === 'you');
    expect(mine.map((r) => r.kind)).toEqual(expect.arrayContaining(['shelter']));
    expect(mine.every((r) => typeof r.bishopWeek === 'number')).toBe(true);
    const standing = mine.reduce((a, r) => a + r.standing, 0);
    expect(next.character!.reputation.brother_priests).toBeCloseTo(cols.character!.reputation.brother_priests + standing, 3);
    // Run on until the bishop hears.
    let reached = false;
    for (let i = 0; i < 30 && !reached; i++) {
      next = talkWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`b${i}`)).state;
      reached = next.talk!.rumours.some((r) => r.about === 'you' && r.reachedBishop);
    }
    expect(reached).toBe(true);
    expect(next.career.some((c) => /^The bishop has heard what is being said/.test(c.text))).toBe(true);
    expect(next.character!.reputation.chancery).not.toBe(cols.character!.reputation.chancery);
    expect(talkReviewLine(next, cols.clock.week - 1)).toMatch(/went round about you/);
    // Set straight before it gets there: no bishop.
    const early = talkWeek({ ...cols, flags: { ...cols.flags } }, createRng('y0')).state;
    const heardEarly: GameState = { ...early, talk: { ...early.talk!, rumours: early.talk!.rumours.map((r) => (r.about === 'you' ? { ...r, heardWeek: early.clock.week, true: false } : r)) } };
    if (heardRumours(heardEarly).some((r) => r.about === 'you')) {
      expect(rumourCondition(heardEarly, { type: 'rumour', key: 'about_you_false' })).toBe(true);
      const corrected = applyRumourEffect(heardEarly, { target: 'rumour', key: 'correct', value: '' });
      expect(talkOf(corrected).rumours.find((r) => r.about === 'you')!.answered).toBe('correct');
      let later = corrected;
      for (let i = 0; i < 30; i++) later = talkWeek({ ...later, clock: { ...later.clock, week: later.clock.week + 1 } }, createRng(`c${i}`)).state;
      expect(talkOf(later).rumours.filter((r) => r.about === 'you' && r.answered === 'correct').every((r) => !r.reachedBishop)).toBe(true);
    }
  });

  it('the conditions and the selector read the latest heard rumour; the kinds are all authored', () => {
    for (const k of RUMOUR_KINDS) expect(k).toMatch(/^[a-z_]+$/);
    const s = withMen(parishState('talk-cond'));
    const week = s.clock.week;
    const talked: GameState = { ...s, talk: { snapshot: {}, rumours: [
      { id: 'a', kind: 'life_drinking', about: 'cm2', name: 'Fr. X', text: 'Fr. X is drinking again.', true: true, week: week - 3, heardWeek: week - 1, venue: 'deanery_meeting', standing: 0 },
      { id: 'b', kind: 'tired', about: 'you', name: 'Fr. Y', text: 'Fr. Y is drinking.', true: false, week: week - 3, heardWeek: week - 2, venue: 'phone', standing: -1, bishopWeek: week + 5 },
    ] } };
    expect(evaluateCondition({ type: 'rumour', key: 'about_other' }, talked, {})).toBe(true);
    expect(evaluateCondition({ type: 'rumour', key: 'about_you_false' }, talked, {})).toBe(true);
    expect(evaluateCondition({ type: 'rumour', key: 'about_you_true' }, talked, {})).toBe(false);
    expect(evaluateCondition({ type: 'rumour', key: 'reached_bishop' }, talked, {})).toBe(false);
    expect(rumourSubject(talked)?.id).toBe('cm2');
    expect(resolveSelector(talked, '@rumour_subject')?.id).toBe('cm2');
    const defended = applyRumourEffect(talked, { target: 'rumour', key: 'defend', value: '' });
    expect(talkOf(defended).rumours.find((r) => r.id === 'a')!.answered).toBe('defend');
    expect(evaluateCondition({ type: 'rumour', key: 'about_other' }, defended, {})).toBe(false);
    // Heard too long ago no longer counts.
    const stale: GameState = { ...talked, clock: { ...s.clock, week: week + TALK.heardWindow + 5 } };
    expect(evaluateCondition({ type: 'rumour', key: 'about_you_false' }, stale, {})).toBe(false);
    expect(evaluateCondition({ type: 'rumour', key: 'about_other' }, s, {})).toBe(false);
  });
});
