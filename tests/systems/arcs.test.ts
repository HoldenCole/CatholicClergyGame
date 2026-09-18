import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { arcDefs, arcDef } from '@/content/arcs';
import { allEvents, eventById } from '@/content';
import {
  ARCS,
  advanceArc,
  arcEligible,
  arcHistory,
  arcLines,
  arcOf,
  arcsOnMove,
  dueArc,
  endArc,
  maybeOpenArc,
  moveArc,
  openArcs,
} from '@/systems/arcs';
import { applyChoice, fireEvent, repeatFactor, REPEATS } from '@/engine/events';
import { evaluateCondition } from '@/engine/conditions';
import { parishIssueDefs } from '@/content/parish';
import type { GameState } from '@/types';

/** A man two years into a parish, where arcs can open. */
function settled(seed = 'arcs'): GameState {
  const s = parishState(seed);
  return { ...s, clock: { ...s.clock, week: s.clock.week + 120 }, parish: { ...s.parish!, arcStartWeek: s.clock.week, weeksServed: 120 } };
}

describe('content/arcs', () => {
  it('every stage names a scene that exists and is the arc\'s alone', () => {
    expect(arcDefs.length).toBeGreaterThanOrEqual(4);
    for (const def of arcDefs) {
      expect(def.stages.length, def.id).toBeGreaterThanOrEqual(3);
      for (const stage of def.stages) {
        const ev = eventById(stage.event);
        expect(ev, `${def.id} › ${stage.id}`).toBeTruthy();
        // A stage scene is never in the general draw: only its arc brings it.
        expect(ev!.beat, ev!.id).toBe('arc');
        expect(ev!.once, ev!.id).toBe(true);
        expect(stage.after[1]).toBeGreaterThanOrEqual(stage.after[0]);
      }
    }
    // And no arc scene is orphaned.
    const staged = new Set(arcDefs.flatMap((d) => d.stages.map((s) => s.event)));
    for (const e of allEvents.filter((x) => x.beat === 'arc')) expect(staged.has(e.id), e.id).toBe(true);
  });
});

describe('systems/arcs', () => {
  it('one opens, runs a stage at a time, and never two of the same', () => {
    const s = settled();
    let opened = s;
    for (let i = 0; i < 60 && openArcs(opened).length === 0; i++) opened = maybeOpenArc(opened, createRng(`open:${i}`)).state;
    expect(openArcs(opened).length).toBe(1);
    const arc = openArcs(opened)[0]!;
    const def = arcDef(arc.id)!;
    expect(arcEligible(opened, def)).toBe(false); // a man does not bury the same family twice
    expect(arc.stage).toBe(0);
    expect(arc.dueWeek).toBeGreaterThan(opened.clock.week);
  });

  it('a stage is due only when its week comes, and brings its own scene', () => {
    const s = settled('due');
    let opened = s;
    for (let i = 0; i < 60 && openArcs(opened).length === 0; i++) opened = maybeOpenArc(opened, createRng(`o:${i}`)).state;
    const arc = openArcs(opened)[0]!;
    expect(dueArc(opened)).toBeNull();
    const later = { ...opened, clock: { ...opened.clock, week: arc.dueWeek } };
    const due = dueArc(later);
    expect(due?.arc.id).toBe(arc.id);
    expect(due?.eventId).toBe(arcDef(arc.id)!.stages[0]!.event);
  });

  it('playing the stage advances it, and the last stage ends the arc', () => {
    const s = settled('advance');
    const id = arcDefs[0]!.id;
    const def = arcDef(id)!;
    let next: GameState = { ...s, arcs: [{ id, stage: 0, dueWeek: s.clock.week, startedWeek: s.clock.week }] };
    for (let i = 0; i < def.stages.length; i++) {
      expect(arcOf(next, id)!.stage).toBe(i);
      next = advanceArc(next, id, createRng(`a:${i}`));
    }
    expect(arcOf(next, id)!.endedWeek).toBeDefined();
    expect(arcOf(next, id)!.outcome).toBe('done');
    expect(openArcs(next)).toHaveLength(0);
    expect(arcHistory(next)[0]!.title).toBe(def.title);
  });

  it('a choice can end it early, hold it, or jump it', () => {
    const s = settled('move');
    const id = arcDefs[0]!.id;
    const def = arcDef(id)!;
    const base: GameState = { ...s, arcs: [{ id, stage: 0, dueWeek: s.clock.week, startedWeek: s.clock.week }] };
    const held = moveArc(base, id, 'hold:52', createRng('h'));
    expect(arcOf(held, id)!.dueWeek).toBe(s.clock.week + 52);
    const jumped = moveArc(base, id, def.stages[2]!.id, createRng('j'));
    expect(arcOf(jumped, id)!.stage).toBe(2);
    const ended = moveArc(base, id, 'lost', createRng('e'));
    expect(arcOf(ended, id)!.outcome).toBe('lost');
    // And a condition can read all of that back.
    expect(evaluateCondition({ type: 'arc', key: id, value: 'running' }, held)).toBe(true);
    expect(evaluateCondition({ type: 'arc', key: id, value: 'ended' }, ended)).toBe(true);
    expect(evaluateCondition({ type: 'arc', key: id, value: 'lost' }, ended)).toBe(true);
  });

  it('resolving an arc scene moves the arc on by itself', () => {
    const s = settled('resolve');
    const id = 'arc_family';
    const def = arcDef(id)!;
    const event = eventById(def.stages[0]!.event)!;
    const base: GameState = { ...s, arcs: [{ id, stage: 0, dueWeek: s.clock.week, startedWeek: s.clock.week }] };
    const fired = fireEvent(base, event, createRng('f'));
    const after = applyChoice(fired.state, event, fired.pending, event.choices[0]!.id, eventById);
    expect(arcOf(after.state, id)!.stage).toBe(1);
    expect(arcOf(after.state, id)!.dueWeek).toBeGreaterThan(after.state.clock.week);
  });

  it('an arc that belongs to a parish is lost when the man is moved; one that travels is not', () => {
    const s = settled('move-out');
    const here = s.assignment!.parishId;
    const there = s.world!.parishes.find((p) => p.id !== here)!.id;
    const base: GameState = {
      ...s,
      arcs: [
        { id: 'arc_wing', stage: 1, dueWeek: s.clock.week + 40, startedWeek: 0, parishId: here },
        { id: 'arc_vocation', stage: 1, dueWeek: s.clock.week + 40, startedWeek: 0 },
      ],
    };
    const moved = arcsOnMove({ ...base, assignment: { ...s.assignment!, parishId: there } });
    expect(arcOf(moved.state, 'arc_wing')!.outcome).toBe('left');
    expect(arcOf(moved.state, 'arc_vocation')!.endedWeek).toBeUndefined();
    expect(moved.lines.length).toBe(1);
    expect(arcLines(moved.state).map((a) => a.title)).toEqual([arcDef('arc_vocation')!.title]);
  });

  it('a life does not run more than a couple of these at once', () => {
    const s = settled('cap');
    let next = s;
    for (let i = 0; i < 200; i++) next = maybeOpenArc(next, createRng(`c:${i}`)).state;
    expect(openArcs(next).length).toBeLessThanOrEqual(ARCS.maxOpen);
  });

  it('ending an arc twice does not rewrite how it ended', () => {
    const s = settled('twice');
    const id = arcDefs[0]!.id;
    const once = endArc({ ...s, arcs: [{ id, stage: 0, dueWeek: 0, startedWeek: 0 }] }, id, 'lost');
    const twice = endArc(once, id, 'done');
    expect(arcOf(twice, id)!.outcome).toBe('lost');
  });
});

describe('parish issues and repeats', () => {
  it('every parish carries two to four named issues, and they differ', () => {
    const s = parishState('issues');
    const sets = s.world!.parishes.map((p) => (p.issues ?? []).join(','));
    for (const p of s.world!.parishes) {
      expect(p.issues!.length).toBeGreaterThanOrEqual(2);
      expect(p.issues!.length).toBeLessThanOrEqual(4);
      for (const id of p.issues!) expect(parishIssueDefs.some((d) => d.id === id)).toBe(true);
      // A parish without a school is not given the school's troubles.
      if (p.school === 'none') expect(p.issues!.every((id) => !parishIssueDefs.find((d) => d.id === id)?.needsSchool)).toBe(true);
    }
    expect(new Set(sets).size).toBeGreaterThan(Math.min(3, sets.length - 1));
  });

  it('a scene can be gated on this parish\'s own trouble, by name or by what it touches', () => {
    const s = parishState('gate');
    const parish = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const mine = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, issues: ['boiler_from_the_war'] } : p)) } };
    expect(evaluateCondition({ type: 'parish_issue', key: 'boiler_from_the_war' }, mine)).toBe(true);
    expect(evaluateCondition({ type: 'parish_issue', key: 'buildings' }, mine)).toBe(true);
    expect(evaluateCondition({ type: 'parish_issue', key: 'school' }, mine)).toBe(false);
  });

  it('a scene already seen is drawn more rarely, and rarer again each time', () => {
    const s = parishState('repeats');
    const event = allEvents.find((e) => !e.beat && e.phase.includes('parochial_vicar'))!;
    expect(repeatFactor(event, s)).toBe(1);
    const once = { ...s, history: [{ eventId: event.id, choiceId: 'x', week: s.clock.week - 52 }] };
    expect(repeatFactor(event, once)).toBeCloseTo(REPEATS.seenAgain, 5);
    const thrice = { ...s, history: [1, 2, 3].map((n) => ({ eventId: event.id, choiceId: 'x', week: s.clock.week - n * 26 })) };
    expect(repeatFactor(event, thrice)).toBeLessThan(repeatFactor(event, once));
    // Long enough ago and it is forgotten.
    const ancient = { ...s, history: [{ eventId: event.id, choiceId: 'x', week: s.clock.week - REPEATS.window - 1 }] };
    expect(repeatFactor(event, ancient)).toBe(1);
  });
});
