import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { directedTransfer } from '@/engine/career';
import { parishWeekHook } from '@/engine/weekHook';
import { eventById, eventsForPhase } from '@/content';
import { offerById, offersForPhase } from '@/content/offers';
import { resolveWeek, weekBudget, WEEK } from '@/systems/week';
import { startWork, workAvailability, workWeek } from '@/systems/problems';
import { sinceArrival, takeSnapshot } from '@/systems/trajectory';
import { mayReplaceLeader, parishGroups, replaceLeader } from '@/systems/groups';
import { problemFixes } from '@/content/parish';
import { evaluateCondition } from '@/engine/conditions';
import type { GameState } from '@/types';

function weeks(s: GameState, n: number, seed: string): GameState {
  let next = s;
  for (let i = 0; i < n; i++) next = resolveWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`${seed}:${i}`)).state;
  return next;
}

describe('levers on a parish', () => {
  it('saying yes to the parish nobody wants moves you there the next week', () => {
    const s = parishState('move');
    const here = s.parish!.parishId;
    const flagged = applyEffects(s, [{ target: 'transfer', key: 'difficult' }]);
    expect(flagged.flags.transfer_pending).toBe('difficult:parochial_vicar');
    const hook = parishWeekHook({ pool: eventsForPhase('parochial_vicar'), lookup: eventById, offers: offersForPhase('parochial_vicar'), offerLookup: offerById });
    const next = hook({ ...flagged, clock: { ...flagged.clock, week: flagged.clock.week + 1 } }, createRng('move:hook'), []);
    expect(next.mode.kind).toBe('assignment');
    expect(next.assignment!.parishId).not.toBe(here);
    expect(next.world!.parishes.find((p) => p.id === next.assignment!.parishId)!.kind).toBe('difficult');
    expect(next.flags.transfer_pending).toBeUndefined();
    expect(next.career[next.career.length - 1]!.text).toMatch(/at the bishop's asking/);
    // The offer itself carries the effect, and a pastor keeps his rank.
    expect(offerById('pv_hard_parish')!.accept.effects.some((e) => e.target === 'transfer')).toBe(true);
    const pastor: GameState = { ...s, assignment: { ...s.assignment!, role: 'pastor' } };
    expect(applyEffects(pastor, [{ target: 'transfer', key: 'difficult' }]).flags.transfer_pending).toBe('difficult:pastor');
    const moved = directedTransfer(s, createRng('dt'), 'difficult', 'parochial_vicar');
    expect(moved.moved).toBe(true);
    expect(moved.state.assignment!.reasons.join(' ')).toMatch(/said yes/);
  });

  it('every parish problem has work that fixes it, and the fix lands when the weeks are up', () => {
    const s = parishState('work');
    const rec = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(problemFixes.map((f) => f.problem)).toContain(rec.problem);
    // A vicar needs the pastor's leave.
    const cold: GameState = { ...s, npcs: { ...s.npcs, [rec.pastorId]: { ...s.npcs[rec.pastorId]!, relationship: -10 } } };
    expect(workAvailability(cold).available).toBe(false);
    expect(workAvailability(cold).why).toMatch(/would not hear/);
    const warm: GameState = { ...s, npcs: { ...s.npcs, [rec.pastorId]: { ...s.npcs[rec.pastorId]!, relationship: 40 } } };
    expect(workAvailability(warm).available).toBe(true);
    let w = startWork(warm);
    const fix = workAvailability(warm).fix!;
    expect(w.parish!.work!.endWeek - w.clock.week).toBe(fix.weeks);
    const cashBefore = w.parish!.finance.cash;
    w = { ...w, clock: { ...w.clock, week: w.parish!.work!.endWeek } };
    const done = workWeek(w);
    expect(done.line).toBe(fix.outcome);
    expect(done.state.world!.parishes.find((p) => p.id === rec.id)!.problem).toBe('none');
    expect(done.state.flags[`fixed:${rec.problem}`]).toBe(true);
    expect(done.state.parish!.work).toBeNull();
    if (fix.cost > 0) expect(done.state.parish!.finance.cash).toBeLessThan(cashBefore);
    expect(workAvailability(done.state).why).toMatch(/Nothing is on fire/);
  });

  it('giving up sleep buys an hour and wears you down; rest brings you back', () => {
    const s = parishState('strain');
    const base = weekBudget(s);
    const cut: GameState = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, sacrifices: ['sleep', 'day_off'] } } };
    expect(weekBudget(cut)).toBe(base + 2);
    const worn = weeks(cut, 20, 'worn');
    expect(worn.parish!.strain!).toBeGreaterThanOrEqual(WEEK.strainWorn);
    expect(worn.character!.reputation.brother_priests).toBeLessThan(s.character!.reputation.brother_priests);
    expect(evaluateCondition({ type: 'strain', op: '>=', value: 50 }, worn)).toBe(true);
    const sick = weeks(worn, 14, 'sick');
    expect(sick.parish!.strain!).toBeGreaterThanOrEqual(WEEK.strainSick);
    expect(weekBudget(sick)).toBe(base + 1);
    const rested = weeks({ ...sick, parish: { ...sick.parish!, routine: { ...sick.parish!.routine, sacrifices: [] } } }, 30, 'rest');
    expect(rested.parish!.strain!).toBeLessThan(sick.parish!.strain! - 30);
    expect(weekBudget(rested)).toBe(base);
  });

  it('the parish is read on arrival and each quarter, and the verdict follows the rows', () => {
    const s = parishState('traj');
    expect(s.parish!.arrival).toBeDefined();
    expect(s.parish!.arrival!.week).toBe(s.clock.week);
    const later = weeks(s, 27, 'q');
    expect(later.parish!.snapshots!.length).toBe(2);
    const t = sinceArrival(later)!;
    expect(t.rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Attendance', 'Collections', 'Debt', 'The groups', 'The buildings']));
    expect(['Turning around', 'Coming along', 'Holding', 'Slipping', 'Going under']).toContain(t.verdict);
    expect(sinceArrival({ ...s, clock: { ...s.clock, week: s.clock.week + 2 } })!.verdict).toBe('Too soon to say');
    const snap = takeSnapshot(later)!;
    expect(snap.groups).toBeGreaterThanOrEqual(0);
  });

  it('a new leader can be put over a group, at a cost, and the group follows him', () => {
    const s = parishState('lead');
    const rec = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(mayReplaceLeader(s).ok).toBe(s.npcs[rec.pastorId]!.relationship >= 30);
    const pastor: GameState = { ...s, assignment: { ...s.assignment!, role: 'pastor' }, parish: { ...s.parish!, role: 'pastor' } };
    expect(mayReplaceLeader(pastor).ok).toBe(true);
    const g = parishGroups(pastor)[0]!;
    const oldLeader = pastor.npcs[g.leaderId]!;
    const r = replaceLeader(pastor, g.id, createRng('rl'), 2018);
    const after = r.state.groups[g.id]!;
    expect(after.leaderId).not.toBe(g.leaderId);
    expect(after.agenda).toBe('new');
    expect(after.vitality).toBe(Math.max(0, g.vitality - 10));
    expect(Math.abs(after.alignment - pastor.character!.alignment)).toBeLessThanOrEqual(Math.abs(g.alignment - pastor.character!.alignment));
    expect(r.state.npcs[oldLeader.id]!.relationship).toBe(Math.max(-100, oldLeader.relationship - 35));
    expect(r.state.npcs[after.leaderId]).toBeDefined();
    expect(r.line).toMatch(new RegExp(g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(r.state.career[r.state.career.length - 1]!.text).toMatch(/^Put /);
  });
});
