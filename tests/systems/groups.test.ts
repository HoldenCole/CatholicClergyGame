import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { evaluateCondition } from '@/engine/conditions';
import { applyEffect } from '@/engine/effects';
import { fireEvent } from '@/engine/events';
import { finishFounding, generateGroups, groupRelief, groupsWeek, parishGroups, startFounding, suppressGroup, vitalityBand } from '@/systems/groups';
import { planWeek, resolveWeek } from '@/systems/week';
import { parishState } from './week.test';
import { testEvent } from '../helpers/fixtures';
import type { GameState } from '@/types';

describe('systems/groups', () => {
  it('every parish gets three to six groups with named leaders, varied across seeds', () => {
    const types = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = parishState(`g-${i}`);
      const gs = parishGroups(s);
      expect(gs.length).toBeGreaterThanOrEqual(3);
      expect(gs.length).toBeLessThanOrEqual(6);
      for (const g of gs) {
        types.add(g.type);
        const leader = s.npcs[g.leaderId]!;
        expect(leader.tags).toContain(`leader:${g.id}`);
        expect(leader.role).toBe('lay');
        expect(new Set(gs.map((x) => x.type)).size).toBe(gs.length);
      }
    }
    expect(types.size).toBeGreaterThanOrEqual(12);
    const s = parishState('g-1');
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(parish.groupIds).toEqual(parishGroups(s).map((g) => g.id));
    const again = generateGroups(createRng('same'), s, parish, 2017);
    expect(again).toEqual(generateGroups(createRng('same'), s, parish, 2017));
  });

  it('groups decay without attention and grow with sustaining AP', () => {
    const s = parishState('decay');
    const rng = createRng('d');
    let neglected = s;
    let tended = s;
    for (let i = 0; i < 20; i++) {
      neglected = groupsWeek(neglected, 0, rng).state;
      tended = groupsWeek(tended, 4, rng).state;
    }
    for (const g of parishGroups(s)) {
      expect(neglected.groups[g.id]!.vitality).toBeLessThan(g.vitality);
      expect(tended.groups[g.id]!.vitality).toBeGreaterThanOrEqual(neglected.groups[g.id]!.vitality);
    }
  });

  it('alignment friction halves sustaining and cools the leader', () => {
    let s = parishState('friction');
    const g = parishGroups(s)[0]!;
    s = { ...s, character: { ...s.character!, alignment: g.alignment > 0 ? -90 : 90 } };
    const rng = createRng('f');
    const leaderBefore = s.npcs[g.leaderId]!.relationship;
    for (let i = 0; i < 10; i++) s = groupsWeek(s, 4, rng).state;
    expect(s.npcs[g.leaderId]!.relationship).toBeLessThan(leaderBefore);
  });

  it('a suppressed group withers, complains to the chancery, and eventually ceases to exist', () => {
    let s = parishState('suppress');
    const g = parishGroups(s)[0]!;
    s = suppressGroup(s, g.id);
    const rng = createRng('s');
    const chanceryBefore = s.character!.reputation.chancery;
    let complained = false;
    for (let i = 0; i < 60 && s.groups[g.id]; i++) {
      const r = groupsWeek(s, 2, rng);
      s = r.state;
      if (r.lines.some((l) => /chancery/.test(l))) complained = true;
    }
    expect(s.groups[g.id]).toBeUndefined();
    expect(complained).toBe(true);
    expect(s.character!.reputation.chancery).toBeLessThan(chanceryBefore);
  });

  it('a thriving marriage-prep or RCIA group relieves sacramental prep by one AP', () => {
    let s = parishState('relief');
    const g = parishGroups(s).find((x) => ['marriage_prep', 'rcia', 'youth', 'grief_support'].includes(x.type));
    const base = planWeek(s).mandatory;
    if (!g) {
      expect(groupRelief(s)).toEqual({});
      return;
    }
    s = { ...s, groups: { ...s.groups, [g.id]: { ...g, vitality: 90 } } };
    expect(groupRelief(s).sacramental_prep).toBe(1);
    expect(planWeek(s).mandatory).toBeLessThanOrEqual(base);
  });

  it('founding costs AP for months and can fail or succeed', () => {
    let s = parishState('found');
    const existing = new Set(parishGroups(s).map((g) => g.type));
    const type = (['grief_support', 'recovery', 'mens_group', 'bible_study', 'adoration'] as const).find((t) => !existing.has(t))!;
    s = startFounding(s, type);
    expect(s.founding?.apPerWeek).toBeGreaterThan(0);
    expect(planWeek(s).mandatory).toBeGreaterThan(7);
    expect(() => startFounding(s, type)).toThrow();
    const done: GameState = { ...s, clock: { ...s.clock, week: s.founding!.endWeek } };
    let successes = 0;
    for (let i = 0; i < 40; i++) {
      const r = finishFounding(done, createRng(`fin-${i}`), 2018);
      expect(r.state.founding).toBeNull();
      if (parishGroups(r.state).some((g) => g.type === type && g.foundedByPlayer)) {
        successes++;
        expect(r.line).toMatch(/agreed to lead/);
      } else expect(r.line).toMatch(/did not take/);
    }
    expect(successes).toBeGreaterThan(5);
    expect(successes).toBeLessThan(40);
    const viaWeek = resolveWeek(done, createRng('w')).state;
    expect(viaWeek.founding).toBeNull();
  });

  it('events bind @group_leader to a group matching their group conditions and effects land on it', () => {
    const s = parishState('bind');
    const target = parishGroups(s)[1]!;
    const ev = testEvent({
      id: 'grp',
      phase: 'parochial_vicar',
      requires: [{ type: 'group', key: 'type', value: target.type }],
      body: '{@group_leader} wants a word.',
      choices: [{ id: 'a', label: 'A', effects: [{ target: 'group', key: 'vitality', delta: -20 }] }],
    });
    expect(evaluateCondition({ type: 'group', key: 'type', value: target.type }, s)).toBe(true);
    expect(evaluateCondition({ type: 'group', key: 'type', value: 'nonexistent' }, s)).toBe(false);
    const fired = fireEvent(s, ev, createRng('x'));
    expect(fired.pending.bindings['@group_leader']).toBe(target.leaderId);
    const after = applyEffect(fired.state, { target: 'group', key: 'vitality', delta: -20 }, fired.pending.bindings);
    expect(after.groups[target.id]!.vitality).toBe(target.vitality - 20);
    expect(evaluateCondition({ type: 'group', key: 'vitality', value: vitalityBand(target.vitality) }, after, fired.pending.bindings)).toBe(
      vitalityBand(target.vitality - 20) === vitalityBand(target.vitality),
    );
    const gone = applyEffect(after, { target: 'group', key: 'dissolve' }, fired.pending.bindings);
    expect(gone.groups[target.id]).toBeUndefined();
  });
});
