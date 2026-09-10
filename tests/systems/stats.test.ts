import { describe, it, expect } from 'vitest';
import { applyStatDelta, decayWeek, emptyStats, gainFactor } from '@/systems/stats';
import { DECAY } from '@/systems/tuning';

describe('systems/stats', () => {
  it('gains apply in full below the knee and clamp to the range', () => {
    expect(applyStatDelta(40, 10)).toBeCloseTo(50, 5);
    expect(applyStatDelta(98, 10)).toBe(100);
    expect(applyStatDelta(3, -10)).toBe(0);
  });

  it('gains slow logarithmically above 70', () => {
    expect(gainFactor(70)).toBe(1);
    expect(gainFactor(80)).toBeCloseTo(0.5);
    expect(gainFactor(90)).toBeCloseTo(1 / 3);
    const from60 = applyStatDelta(60, 10) - 60;
    const from75 = applyStatDelta(75, 10) - 75;
    const from90 = applyStatDelta(90, 10) - 90;
    expect(from60).toBeCloseTo(10, 5);
    expect(from75).toBeLessThan(6);
    expect(from75).toBeGreaterThan(3);
    expect(from90).toBeLessThan(3.5);
  });

  it('a gain that crosses the knee is only slowed for the part above it', () => {
    const gained = applyStatDelta(65, 10) - 65;
    expect(gained).toBeLessThan(10);
    expect(gained).toBeGreaterThan(8.5);
  });

  it('losses apply in full above the knee', () => {
    expect(applyStatDelta(90, -10)).toBe(80);
  });

  it('decay is asymmetric: admin and charisma never decay', () => {
    const s = emptyStats(60);
    const out = decayWeek(s, { adminAp: 6, theologyUsed: false, knowledgeUsed: false });
    expect(out.administration).toBe(60);
    expect(out.charisma).toBe(60);
    expect(out.theology).toBeCloseTo(60 - DECAY.atrophyPerWeek);
    expect(out.knowledge).toBeCloseTo(60 - DECAY.atrophyPerWeek);
    expect(out.piety).toBeCloseTo(60 - DECAY.pietyBasePerWeek - 6 * DECAY.pietyPerAdminAp);
  });

  it('use halts atrophy, and piety drains more under heavier admin load', () => {
    const s = emptyStats(60);
    const used = decayWeek(s, { adminAp: 0, theologyUsed: true, knowledgeUsed: true });
    expect(used.theology).toBe(60);
    expect(used.knowledge).toBe(60);
    const light = decayWeek(s, { adminAp: 1, theologyUsed: true, knowledgeUsed: true });
    const heavy = decayWeek(s, { adminAp: 8, theologyUsed: true, knowledgeUsed: true });
    expect(heavy.piety).toBeLessThan(light.piety);
  });

  it('decay never pulls a stat below the floor', () => {
    const s = emptyStats(DECAY.floor + 0.01);
    const out = decayWeek(s, { adminAp: 10, theologyUsed: false, knowledgeUsed: false });
    expect(out.piety).toBe(DECAY.floor);
    const already = emptyStats(10);
    expect(decayWeek(already, { adminAp: 10, theologyUsed: false, knowledgeUsed: false }).piety).toBe(10);
  });

  it('a year of unused theology costs a few points, not a career', () => {
    let s = emptyStats(60);
    for (let i = 0; i < 52; i++) s = decayWeek(s, { adminAp: 0, theologyUsed: false, knowledgeUsed: true });
    expect(60 - s.theology).toBeGreaterThan(1);
    expect(60 - s.theology).toBeLessThan(4);
  });
});
