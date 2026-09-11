import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { evaluateCondition } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import { bondCounts, bondsPhrase, bondsWeek, parishPeople } from '@/systems/bonds';
import { laneOf } from '@/systems/digest';
import { lifeOf } from '@/systems/life';
import { die } from '@/engine/career';
import type { GameState } from '@/types';

describe('a parish that remembers you', () => {
  it('names its people, two of them kin, and the week writes bonds on them at sacramental care', () => {
    const s = parishState('bonds');
    const people = parishPeople(s);
    expect(people.length).toBeGreaterThanOrEqual(6);
    const surnames = people.map((n) => n.name.last);
    expect(new Set(surnames).size).toBeLessThan(surnames.length);
    let next: GameState = s;
    let lines = 0;
    for (let i = 0; i < 80; i++) {
      const r = bondsWeek({ ...next, clock: { ...next.clock, week: next.clock.week + i } }, 'standard', createRng(`b${i}`));
      next = r.state;
      if (r.line) { lines++; expect(r.line).toMatch(/^You (baptized|married|buried|anointed|sat with|prepared) /); expect(laneOf(r.line)).toBe('people'); }
    }
    expect(lines).toBeGreaterThan(2);
    const counts = bondCounts(next);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(lines);
    // Spread across families, and the person warms.
    const bonded = parishPeople(next).filter((n) => (n.bonds?.length ?? 0) > 0);
    expect(bonded.length).toBeGreaterThan(1);
    expect(bonded[0]!.relationship).toBeGreaterThan(s.npcs[bonded[0]!.id]!.relationship);
    expect(bondsPhrase(bonded[0]!)).toMatch(/you/);
    // Minimum care writes fewer; none without people.
    let few = 0;
    for (let i = 0; i < 80; i++) if (bondsWeek({ ...s, clock: { ...s.clock, week: i } }, 'min', createRng(`b${i}`)).line) few++;
    expect(few).toBeLessThan(lines);
    expect(bondsWeek({ ...s, assignment: null }, 'standard', createRng('x')).line).toBeNull();
  });

  it('content reaches the people through the bond effect, condition, and selector', () => {
    const s = parishState('bonds-content');
    const [person] = parishPeople(s);
    expect(evaluateCondition({ type: 'bond', kind: 'any', op: '>=', value: 1 }, s)).toBe(false);
    expect(resolveSelector(s, '@bonded_parishioner', createRng('sel'))).toBeNull();
    const after = applyEffects(s, [{ target: 'bond', key: '@who', value: 'buried:her husband' }], { '@who': person!.id });
    expect(after.npcs[person!.id]!.bonds).toEqual([{ kind: 'buried', week: s.clock.week, who: 'her husband' }]);
    expect(after.npcs[person!.id]!.relationship).toBe(person!.relationship + 4);
    expect(evaluateCondition({ type: 'bond', kind: 'buried', op: '>=', value: 1 }, after)).toBe(true);
    expect(evaluateCondition({ type: 'bond', kind: 'married', op: '>=', value: 1 }, after)).toBe(false);
    expect(resolveSelector(after, '@bonded_parishioner', createRng('sel'))?.id).toBe(person!.id);
    const quarrel = applyEffects(after, [{ target: 'bond', key: person!.id, value: 'quarreled:the family' }]);
    expect(quarrel.npcs[person!.id]!.relationship).toBe(after.npcs[person!.id]!.relationship - 6);
  });

  it('the ending counts the sacraments and names the people who carry the most of you', () => {
    let s = parishState('bonds-life');
    const [a, b] = parishPeople(s);
    s = applyEffects(s, [
      { target: 'bond', key: a!.id, value: 'baptized:her daughter' },
      { target: 'bond', key: a!.id, value: 'buried:her husband' },
      { target: 'bond', key: b!.id, value: 'married:the two of them' },
    ]);
    const life = lifeOf(die({ ...s, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 10 } }));
    expect(life.sacraments).toEqual({ baptized: 1, married: 1, buried: 1, anointed: 0 });
    expect(life.remembered).toHaveLength(1);
    expect(life.remembered[0]!.npc.id).toBe(a!.id);
    expect(life.remembered[0]!.phrase).toMatch(/whose daughter you baptized and whose husband you buried/);
  });
});
