import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { evaluateCondition } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { createRng } from '@/engine/rng';
import { COLLAPSE, nextAssignment } from '@/engine/career';
import { handoffProject, startProject } from '@/systems/projects';
import { currentPreference, setPreference, terrainOf } from '@/systems/assignment';
import { parishWeek, startAssignment } from '@/engine/parish';
import { allOffers } from '@/content/offers';
import type { GameState } from '@/types';

describe('design gaps closed', () => {
  it('a position on the record, the routine, and being a figure can gate content', () => {
    const s = parishState('gaps');
    const c = s.character!;
    const loud: GameState = { ...s, character: { ...c, outspokenness: 70, reputation: { ...c.reputation, traditional_bloc: 60, progressive_bloc: 60 }, positions: [{ topic: 'liturgy', value: -50, volume: 'public', week: 3 }, { topic: 'money', value: 20, volume: 'private', week: 4 }] } };
    expect(evaluateCondition({ type: 'position', topic: 'liturgy', op: '<=', value: -30 }, loud)).toBe(true);
    expect(evaluateCondition({ type: 'position', topic: 'money', op: '>=', value: 10 }, loud)).toBe(false);
    expect(evaluateCondition({ type: 'position', topic: 'any', op: '<=', value: -30 }, loud)).toBe(true);
    expect(evaluateCondition({ type: 'figure' }, loud)).toBe(true);
    expect(evaluateCondition({ type: 'figure' }, s)).toBe(false);
    const studious: GameState = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, discretionary: { study: 3 }, obligations: { ...s.parish!.routine.obligations, sunday_masses: 'min' } } } };
    expect(evaluateCondition({ type: 'routine', key: 'study', op: '>=', value: 3 }, studious)).toBe(true);
    expect(evaluateCondition({ type: 'routine', key: 'sunday_masses', op: '<=', value: 1 }, studious)).toBe(true);
    expect(evaluateCondition({ type: 'routine', key: 'sunday_masses', op: '<=', value: 1 }, s)).toBe(false);
    expect(allOffers.filter((o) => o.requires?.some((r) => r.type === 'figure')).length).toBeGreaterThanOrEqual(3);
    const settled: GameState = { ...s, parish: { ...s.parish!, weeksServed: 30, arcEndWeek: s.clock.week + 8 } };
    expect(evaluateCondition({ type: 'weeks_served', op: '<=', value: 6 }, settled)).toBe(false);
    expect(evaluateCondition({ type: 'weeks_served', op: '>=', value: 20 }, settled)).toBe(true);
    expect(evaluateCondition({ type: 'arc_weeks_left', op: '<=', value: 10 }, settled)).toBe(true);
    expect(evaluateCondition({ type: 'arc_weeks_left', op: '<=', value: 10 }, { ...s, parish: null })).toBe(false);
  });

  it('taking a pastorate moves the phase so the pastor pool is drawn', () => {
    const base = parishState('phase');
    expect(base.phase).toBe('parochial_vicar');
    const parish = base.world!.parishes.find((p) => p.id === base.parish!.parishId)!;
    const asPastor: GameState = { ...base, assignment: { parishId: parish.id, role: 'pastor', startWeek: base.clock.week, letter: '', reasons: [] } };
    const started = startAssignment(asPastor, createRng('phase:start'));
    expect(started.phase).toBe('pastor');
    expect(started.flags['role:pastor']).toBe(true);
    const asAdmin: GameState = { ...base, assignment: { parishId: parish.id, role: 'administrator', startWeek: base.clock.week, letter: '', reasons: [] } };
    expect(startAssignment(asAdmin, createRng('phase:admin')).phase).toBe('administrator');
  });

  it('a hidden trait becomes known only through an effect', () => {
    const s = parishState('trait');
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(s.npcs[parish.pastorId]!.traitKnown).toBe(false);
    const after = applyEffects(s, [{ target: 'trait_known', key: '@pastor' }]);
    expect(after.npcs[parish.pastorId]!.traitKnown).toBe(true);
  });

  it('a preference is one flag at a time and the terrain pulls lay support every week', () => {
    let s = setPreference(parishState('pref'), 'rural');
    expect(currentPreference(s)).toBe('rural');
    s = setPreference(s, 'wherever');
    expect(currentPreference(s)).toBe('wherever');
    expect(s.flags.pref_rural).toBeUndefined();
    const here = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const home: GameState = { ...s, flags: { ...s.flags, [`home_terrain:${here.terrain}`]: true } };
    const away: GameState = { ...s, flags: { ...s.flags, [`home_terrain:${here.terrain === 'rural' ? 'urban' : 'rural'}`]: true } };
    expect(terrainOf(home)).toBe(here.terrain);
    const a = parishWeek(home, createRng('t')).character!.reputation.parishioners;
    const b = parishWeek(away, createRng('t')).character!.reputation.parishioners;
    expect(a).toBeGreaterThan(b);
  });

  it('a charismatic man leaves a collapse behind, and a successor may keep his project', () => {
    const base = parishState('leave');
    const pastor: GameState = { ...base, phase: 'pastor', assignment: { ...base.assignment!, role: 'pastor' }, parish: { ...base.parish!, role: 'pastor', finance: { ...base.parish!.finance, cash: 900000 } }, flags: { ...base.flags, ordination_week: -1040 } };
    const c = pastor.character!;
    const beloved: GameState = { ...pastor, character: { ...c, stats: { ...c.stats, charisma: COLLAPSE.charisma + 5 }, reputation: { ...c.reputation, parishioners: COLLAPSE.support + 10 } } };
    const withProject = startProject(beloved, 'renovation');
    const before = withProject.world!.parishes.find((p) => p.id === withProject.parish!.parishId)!;
    const moved = nextAssignment(withProject, createRng('board')).state;
    const after = moved.world!.parishes.find((p) => p.id === before.id)!;
    expect(moved.flags.left_a_collapse).toBe(true);
    expect(after.households).toBeLessThan(before.households);
    expect(moved.project).toBeNull();
    expect(moved.career.some((e) => /successor kept|Abandoned by your successor/.test(e.text))).toBe(true);
    // The handoff itself is a roll: over many seeds both outcomes happen, and a kept renovation fixes the church.
    let kept = 0;
    for (let i = 0; i < 40; i++) {
      const r = handoffProject(withProject, createRng(`h${i}`));
      if (r.kept) {
        kept++;
        expect(r.state.world!.parishes.find((p) => p.id === before.id)!.buildings.church).toBe(95);
      }
    }
    expect(kept).toBeGreaterThan(3);
    expect(kept).toBeLessThan(37);
    const quiet: GameState = { ...pastor, character: { ...c, stats: { ...c.stats, charisma: 40 } } };
    expect(nextAssignment(quiet, createRng('board')).state.flags.left_a_collapse).toBeUndefined();
  });
});
