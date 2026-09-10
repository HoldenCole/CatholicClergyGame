import { describe, it, expect } from 'vitest';
import { runClock } from '@/engine/clock';
import { createRng } from '@/engine/rng';
import {
  acknowledgeEvaluation,
  chooseEmphasis,
  chooseSummer,
  leaveSeminary,
  ordain,
  playedWeekBeat,
  startSeminary,
  YEAR_SHAPE,
  availableSummers,
} from '@/engine/seminary';
import { resolvePending, seminaryWeekHook, type EventDeps } from '@/engine/weekHook';
import { seminaryState, testEvent, testNpc } from '../helpers/fixtures';
import { emphasisPointsFor } from '@/systems/formation';
import type { GameEvent, GameState, Pillar } from '@/types';
import { buildSave, deserialize, rngFromSave, serialize } from '@/engine/save';

const E = (h: number, s: number, i: number, p: number): Record<Pillar, number> => ({ human: h, spiritual: s, intellectual: i, pastoral: p });

function pool(): GameEvent[] {
  const out: GameEvent[] = [];
  for (let y = 1; y <= 7; y++) {
    for (let n = 0; n < 6; n++) {
      out.push(
        testEvent({
          id: `y${y}_ev${n}`,
          yearGate: [y],
          severity: n === 0 ? 'ROUTINE' : 'NOTABLE',
          suppressYears: 1,
          choices: [
            { id: 'a', label: 'A', default: true, effects: [{ target: 'pillar', key: 'human', delta: 1 }] },
            { id: 'b', label: 'B', effects: [{ target: 'pillar', key: 'spiritual', delta: 1 }] },
          ],
        }),
      );
    }
  }
  for (const [y, beat] of [[4, 'candidacy'], [5, 'lector_acolyte'], [6, 'diaconate'], [7, 'ordination_eve']] as const) {
    out.push(
      testEvent({
        id: `beat_${beat}`,
        yearGate: [y],
        beat,
        severity: 'CRITICAL',
        once: true,
        choices: [{ id: 'yes', label: 'Yes', effects: [{ target: 'flag', key: `${beat}_done`, value: true }] }],
      }),
    );
  }
  return out;
}

function deps(): EventDeps {
  const p = pool();
  return { pool: p, lookup: (id) => p.find((e) => e.id === id) };
}

function withFormators(state: GameState): GameState {
  return {
    ...state,
    npcs: {
      ...state.npcs,
      advisor: testNpc('advisor', { role: 'formator', title: 'Fr.', tags: ['formation_advisor'] }),
      vd: testNpc('vd', { role: 'formator', title: 'Fr.', tags: ['vocation_director'] }),
    },
  };
}

/** Drive one formation year to its evaluation, taking the first choice everywhere. */
function playYear(state: GameState, rng: ReturnType<typeof createRng>, d: EventDeps, speed: GameState['speed'] = 'AUTO'): GameState {
  const extra = emphasisPointsFor(state) - 10;
  let s = chooseEmphasis({ ...state, speed }, E(3, 3, 2 + extra, 2), rng);
  for (let guard = 0; guard < 200; guard++) {
    const r = runClock(s, rng, { maxWeeks: 60, hook: seminaryWeekHook(d) });
    s = r.state;
    if (s.pending.length) {
      s = resolvePending(s, s.pending[0]!, s.pending[0]!.eventId.startsWith('beat') ? 'yes' : 'a', rng, d);
      continue;
    }
    if (s.mode.kind === 'summer') {
      s = chooseSummer(s, 'hard_parish');
      continue;
    }
    if (s.mode.kind === 'evaluation') return s;
    if (r.stop.kind === 'cap') continue;
    if (r.stop.kind === 'paused') break;
  }
  throw new Error(`year did not reach evaluation (mode ${s.mode.kind}, week ${s.clock.week})`);
}

describe('engine/seminary', () => {
  it('starts in year one waiting for an emphasis, then schedules the year', () => {
    const s0 = startSeminary(seminaryState(), ['c1', 'c2', 'c3']);
    expect(s0.mode).toEqual({ kind: 'year_start', year: 1 });
    const s1 = chooseEmphasis(s0, E(3, 3, 2, 2), createRng('sched'));
    expect(s1.mode.kind).toBe('clock');
    const sem = s1.seminary!;
    expect(sem.playedWeeks.length).toBeGreaterThanOrEqual(2);
    expect(sem.playedWeeks.length).toBeLessThanOrEqual(3);
    for (const w of sem.playedWeeks) {
      expect(w).toBeGreaterThanOrEqual(YEAR_SHAPE.firstPlayedWeek);
      expect(w).toBeLessThanOrEqual(YEAR_SHAPE.lastPlayedWeek);
    }
    expect(s1.beats.map((b) => b.kind)).toEqual(['assignment', 'evaluation']);
    expect(() => chooseEmphasis(s0, E(9, 1, 0, 0), createRng('x'))).toThrow();
  });

  it('MANUAL: events queue at played weeks and the clock waits for a choice', () => {
    const d = deps();
    const rng = createRng('manual');
    let s = chooseEmphasis({ ...withFormators(startSeminary(seminaryState(), ['c1'])), speed: 'MANUAL' }, E(3, 3, 2, 2), rng);
    const firstPlayed = s.seminary!.playedWeeks[0]!;
    while (s.clock.week < firstPlayed) s = runClock(s, rng, { hook: seminaryWeekHook(d) }).state;
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0]!.eventId).toMatch(/^y1_/);
    const blocked = runClock(s, rng, { hook: seminaryWeekHook(d) });
    expect(blocked.weeksAdvanced).toBe(0);
    s = resolvePending(s, s.pending[0]!, 'b', rng, d);
    expect(s.pending).toHaveLength(0);
    expect(s.seminary!.pillarScores.spiritual).toBeGreaterThan(0);
    expect(s.history[0]!.auto).toBeUndefined();
  });

  it('AUTO: routine events auto-resolve with the default and notable ones stop the clock', () => {
    const d = deps();
    const rng = createRng('auto');
    let s = chooseEmphasis({ ...withFormators(startSeminary(seminaryState(), ['c1'])), speed: 'AUTO' }, E(3, 3, 2, 2), rng);
    const r = runClock(s, rng, { maxWeeks: 60, hook: seminaryWeekHook(d) });
    s = r.state;
    // Either it stopped on a notable event or reached the summer with routine ones resolved.
    if (r.stop.kind === 'event') {
      expect(s.pending[0]!.severity).toBe('NOTABLE');
    } else {
      expect(r.stop.kind).toBe('mode');
      expect(s.mode.kind).toBe('summer');
    }
    expect(s.history.filter((h) => h.auto).every((h) => h.eventId.endsWith('ev0'))).toBe(true);
  });

  it('SKIP runs through notable events to the summer beat', () => {
    const d = deps();
    const rng = createRng('skip');
    const s = chooseEmphasis({ ...withFormators(startSeminary(seminaryState(), ['c1'])), speed: 'SKIP' }, E(3, 3, 2, 2), rng);
    const r = runClock(s, rng, { maxWeeks: 60, hook: seminaryWeekHook(d) });
    expect(r.state.mode.kind).toBe('summer');
    expect(r.state.pending).toHaveLength(0);
    expect(r.state.history.length).toBe(r.state.seminary!.playedWeeks.filter((w) => w <= r.state.clock.week).length);
  });

  it('runs a year: summer choice, evaluation, and advancement', () => {
    const d = deps();
    const rng = createRng('year');
    const s0 = withFormators(startSeminary(seminaryState(), ['c1', 'c2', 'c3']));
    expect(availableSummers(s0).find((o) => o.option.id === 'home_parish')?.available).toBe(true);
    const s = playYear(s0, rng, d);
    expect(s.mode.kind).toBe('evaluation');
    expect(s.seminary!.summers[1]).toBe('hard_parish');
    expect(s.flags['summer:hard_parish']).toBe(true);
    if (s.mode.kind !== 'evaluation') throw new Error('unreachable');
    expect(['ADVANCED', 'ADVANCED_WITH_CONCERNS']).toContain(s.mode.record.result);
    const s2 = acknowledgeEvaluation(s);
    expect(s2.mode).toEqual({ kind: 'year_start', year: 2 });
    expect(s2.seminary!.year).toBe(2);
    expect(s2.seminary!.evaluations).toHaveLength(1);
  });

  it('guarantees the year’s beat on the last played week and records it', () => {
    const d = deps();
    const rng = createRng('beat');
    let s = withFormators(startSeminary(seminaryState(), ['c1']));
    s = { ...s, seminary: { ...s.seminary!, year: 4 }, mode: { kind: 'year_start', year: 4 } };
    s = chooseEmphasis({ ...s, speed: 'MANUAL' }, E(3, 3, 2, 2), rng);
    const last = s.seminary!.playedWeeks[s.seminary!.playedWeeks.length - 1]!;
    let sawBeat = false;
    while (s.clock.week < last) {
      s = runClock(s, rng, { hook: seminaryWeekHook(d) }).state;
      if (s.pending.length) {
        if (s.clock.week === last) {
          expect(playedWeekBeat({ ...s, clock: { ...s.clock } }).played).toBe(true);
          expect(s.pending[0]!.eventId).toBe('beat_candidacy');
          sawBeat = true;
          s = resolvePending(s, s.pending[0]!, 'yes', rng, d);
        } else {
          s = resolvePending(s, s.pending[0]!, 'a', rng, d);
        }
      }
    }
    expect(sawBeat).toBe(true);
    expect(s.flags['beat_fired:candidacy:4']).toBe(true);
    expect(s.flags.candidacy_done).toBe(true);
  });

  it('plays seven years to ordination and names an archetype', () => {
    const d = deps();
    const rng = createRng('career');
    let s = withFormators(startSeminary(seminaryState('career'), ['c1', 'c2', 'c3']));
    for (let year = 1; year <= 7; year++) {
      expect(s.mode).toEqual({ kind: 'year_start', year });
      s = acknowledgeEvaluation(playYear(s, rng, d, 'SKIP'));
    }
    expect(s.mode.kind).toBe('ordination');
    expect(s.seminary!.candidacy).toBe(true);
    expect(s.seminary!.lectorAcolyte).toBe(true);
    expect(s.seminary!.diaconate).toBe(true);
    expect(s.flags.diaconate_done).toBe(true);
    expect(s.seminary!.evaluations).toHaveLength(7);
    const o = ordain(s, rng);
    expect(o.phase).toBe('parochial_vicar');
    expect(o.character!.archetype).toBeTruthy();
    expect(o.flags.ordained).toBe(true);
    // Seven years of clock: roughly 364 weeks.
    expect(s.clock.week).toBeGreaterThan(330);
    expect(s.clock.week).toBeLessThan(380);
  });

  it('a save taken mid-year continues identically to the unsaved run', () => {
    const d = deps();
    const rngA = createRng('save');
    const rngB = createRng('save');
    const start = withFormators(startSeminary(seminaryState('save'), ['c1', 'c2']));
    let a = chooseEmphasis({ ...start, speed: 'SKIP' }, E(2, 3, 3, 2), rngA);
    let b = chooseEmphasis({ ...start, speed: 'SKIP' }, E(2, 3, 3, 2), rngB);
    a = runClock(a, rngA, { maxWeeks: 20, hook: seminaryWeekHook(d) }).state;
    b = runClock(b, rngB, { maxWeeks: 20, hook: seminaryWeekHook(d) }).state;
    const save = deserialize(serialize(buildSave(b, rngB, null)));
    const rngB2 = rngFromSave(save);
    const a2 = runClock(a, rngA, { maxWeeks: 30, hook: seminaryWeekHook(d) }).state;
    const b2 = runClock(save.state, rngB2, { maxWeeks: 30, hook: seminaryWeekHook(d) }).state;
    expect(serialize(buildSave(b2, rngB2, null))).toBe(serialize(buildSave(a2, rngA, null)));
  });

  it('voluntary departure ends the run with respect', () => {
    const s = leaveSeminary(startSeminary(seminaryState(), []));
    expect(s.mode.kind).toBe('ended');
    if (s.mode.kind === 'ended') {
      expect(s.mode.ending).toBe('left_seminary');
      expect(s.mode.summary).toMatch(/carried your boxes/);
    }
    expect(s.speed).toBe('PAUSED');
  });
});
