import { describe, it, expect } from 'vitest';
import { playCareer } from '../helpers/career';

/**
 * DESIGN §15: two playthroughs from the same starting choices should diverge
 * visibly by the fourth seminary year. Same seed, same creation answers,
 * a different man at the decisions.
 */
describe('divergence', () => {
  it('two men from the same start are visibly different by the fourth year', () => {
    const weeks = 52 * 4;
    const a = playCareer('diverge-1', 'chicago', weeks, undefined, 'first');
    const b = playCareer('diverge-1', 'chicago', weeks, undefined, 'last');
    const same = playCareer('diverge-1', 'chicago', weeks, undefined, 'first');
    // Determinism first: the same man twice is the same man.
    expect(JSON.stringify(same.character)).toBe(JSON.stringify(a.character));
    // Then the divergence: stats, pillars, reputation, the record, the people.
    const ca = a.character!;
    const cb = b.character!;
    const statGap = (['piety', 'theology', 'knowledge', 'charisma', 'administration'] as const).reduce((n, k) => n + Math.abs(ca.stats[k] - cb.stats[k]), 0);
    expect(statGap).toBeGreaterThan(8);
    const repGap = (['parishioners', 'chancery', 'brother_priests', 'public', 'rome'] as const).reduce((n, k) => n + Math.abs(ca.reputation[k] - cb.reputation[k]), 0);
    expect(repGap).toBeGreaterThan(5);
    expect(JSON.stringify(ca.positions)).not.toBe(JSON.stringify(cb.positions));
    const relGap = Object.keys(a.npcs).reduce((n, id) => n + Math.abs((a.npcs[id]?.relationship ?? 0) - (b.npcs[id]?.relationship ?? 0)), 0);
    expect(relGap).toBeGreaterThan(20);
    // The histories are not the same story.
    const ha = a.history.map((h) => `${h.eventId}:${h.choiceId}`);
    const hb = b.history.map((h) => `${h.eventId}:${h.choiceId}`);
    expect(ha.join()).not.toBe(hb.join());
    expect(ha.filter((x) => !hb.includes(x)).length).toBeGreaterThanOrEqual(2);
  });
});
