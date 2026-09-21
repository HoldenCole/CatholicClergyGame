import { describe, expect, it } from 'vitest';
import { allEvents } from '@/content';
import { SEALED_TARGETS } from '@/engine/internalForum';
import { evaluateCondition } from '@/engine/conditions';
import { parishState } from '../systems/week.test';
import { ministryWeek } from '@/systems/ministry';
import { applyEffects } from '@/engine/effects';
import type { GameState, Quality } from '@/types';

const STANDARD: Record<string, Quality> = { sunday_masses: 'standard', weekday_masses: 'standard', confessions: 'standard', meetings: 'standard', sacramental_prep: 'standard' };

describe('content pools', () => {
  it('the religious and internal-forum expansion is complete at 55 scenes', () => {
    // DESIGN §12.4: sd_ (direction, seminary and parish), rl_ and in_ (religious), sm_rl_ (the seminary's religious).
    const direction = allEvents.filter((e) => e.id.startsWith('sd_'));
    const religious = allEvents.filter((e) => e.id.startsWith('rl_') || e.id.startsWith('in_') || e.id.startsWith('sm_rl_'));
    expect(direction.length + religious.length).toBe(55);
    expect(direction.length).toBe(22);
    expect(religious.length).toBe(33);
  });

  it('every direction scene is sealed, and every sealed scene writes only what stays in the room', () => {
    const sealed = allEvents.filter((e) => e.internalForum);
    expect(sealed.length).toBe(31); // 22 direction scenes, the two direction hours of the seminary's director (sp_for_), and the seven hours a friar gives (dir_, E3 §3.13)
    for (const e of allEvents.filter((x) => x.id.startsWith('sd_') || x.id === 'sp_for_hour' || x.id === 'sp_for_knock' || (x.id.startsWith('dir_') && x.id !== 'dir_confessor_standing'))) expect(e.internalForum, e.id).toBe(true);
    for (const e of sealed) {
      for (const ch of e.choices) {
        for (const eff of ch.effects) expect(SEALED_TARGETS, `${e.id} › ${ch.id}`).toContain(eff.target);
      }
    }
  });

  it('the second half of a life has its own thirty-three scenes, all gated late', () => {
    const late = allEvents.filter((e) => e.id.startsWith('li_') || e.id.startsWith('lp_') || e.id.startsWith('ls_'));
    expect(late.length).toBe(33);
    for (const e of late) {
      expect(e.requires?.length, e.id).toBeGreaterThan(0);
      const gates = (e.requires ?? []).map((c) => c.type);
      expect(gates.some((t) => ['years_ordained', 'age', 'weeks_served', 'life', 'ministry', 'parish', 'ethnic', 'bond', 'flag', 'reputation'].includes(t)), e.id).toBe(true);
    }
    // None of them is sealed: the seal belongs to direction alone.
    expect(late.every((e) => !e.internalForum)).toBe(true);
  });

  it('the milestones of the book are gated on the book, not on luck', () => {
    const milestones = allEvents.filter((e) => e.id.startsWith('mi_'));
    expect(milestones.length).toBe(14);
    for (const e of milestones) {
      expect(e.requires?.length, e.id).toBeGreaterThan(0);
      const gates = (e.requires ?? []).map((c) => c.type);
      expect(gates.some((t) => t === 'ministry' || t === 'life' || t === 'years_ordained' || t === 'age'), e.id).toBe(true);
    }
  });
});

describe('engine/conditions: the book and the life', () => {
  const base = parishState('conds');

  it('a ministry condition reads the book', () => {
    let s: GameState = base;
    expect(evaluateCondition({ type: 'ministry', key: 'masses', op: '>=', value: 1 }, s)).toBe(false);
    for (let i = 0; i < 10; i++) s = ministryWeek(s, STANDARD);
    expect(evaluateCondition({ type: 'ministry', key: 'masses', op: '>=', value: 70 }, s)).toBe(true);
    expect(evaluateCondition({ type: 'ministry', key: 'ordinations', op: '>=', value: 1 }, s)).toBe(false);
  });

  it('a life condition counts posts, men formed, vocations and turnarounds', () => {
    const parish = base.world!.parishes.find((p) => p.id === base.parish!.parishId)!;
    const hard = { ...base, world: { ...base.world!, parishes: base.world!.parishes.map((p) => (p.id === parish.id ? { ...p, kind: 'difficult' as const } : p)) } };
    const s: GameState = {
      ...hard,
      formed: [{ npcId: 'x', name: 'A Man', year: 2019, verdict: 'strong' }],
      flags: { ...hard.flags, 'vocation:entered': 2 },
      tenures: [{ kind: 'parish', label: 'Pastor', place: 'St. Somewhere', parishId: parish.id, startWeek: 0, endWeek: 312, verdict: 'Turning around', left: 'moved' }],
    };
    expect(evaluateCondition({ type: 'life', key: 'formed', op: '>=', value: 1 }, s)).toBe(true);
    expect(evaluateCondition({ type: 'life', key: 'formed', op: '>=', value: 2 }, s)).toBe(false);
    expect(evaluateCondition({ type: 'life', key: 'vocations', op: '>=', value: 2 }, s)).toBe(true);
    expect(evaluateCondition({ type: 'life', key: 'turnarounds', op: '>=', value: 1 }, s)).toBe(true);
    // The open post counts with the closed ones.
    expect(evaluateCondition({ type: 'life', key: 'posts', op: '>=', value: 2 }, s)).toBe(true);
  });

  it('a scene can wear a man out, or give him a month back, within the same nought to a hundred', () => {
    const tired = applyEffects({ ...base, strain: 20 }, [{ target: 'strain', key: '', delta: 12 }], {}, 'a hard year');
    expect(tired.strain).toBe(32);
    const rested = applyEffects(tired, [{ target: 'strain', key: '', delta: -40 }], {}, 'the rota');
    expect(rested.strain).toBe(0);
    const maxed = applyEffects({ ...base, strain: 95 }, [{ target: 'strain', key: '', delta: 30 }], {}, 'everything at once');
    expect(maxed.strain).toBe(100);
  });

  it('a group condition can see that a sister runs it', () => {
    const group = Object.values(base.groups)[0];
    if (!group) return;
    const led = { ...base, groups: { ...base.groups, [group.id]: { ...group, religiousLed: true } } };
    expect(evaluateCondition({ type: 'group', key: 'religiousLed', value: true }, led)).toBe(true);
    const plain = { ...base, groups: { ...base.groups, [group.id]: { ...group, religiousLed: false } } };
    expect(evaluateCondition({ type: 'group', key: 'religiousLed', value: true }, plain)).toBe(false);
  });
});
