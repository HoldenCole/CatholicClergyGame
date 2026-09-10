import { describe, it, expect, beforeEach } from 'vitest';
import { eventById, allEvents } from '@/content';
import { visibleChoices } from '@/engine/events';
import { createRng } from '@/engine/rng';
import { setWeekDraw, setWeekHook, useGameStore } from '@/engine/store';
import { noDraw } from '@/engine/clock';
import { newGame } from '@/engine/game';
import { generateRun } from '@/generation';
import { emphasisPointsFor } from '@/systems/formation';
import type { CreationAnswers, GameState } from '@/types';

const answers: CreationAnswers = {
  firstName: 'Thomas',
  lastName: 'Reilly',
  portrait: 'p1',
  entryYear: 2010,
  origin: 'urban_ethnic',
  tie: 'son',
  path: 'college',
  field: 'philosophy',
  career: null,
  yearsWorked: 0,
  motive: 'priest',
  family: 'widowed_mother',
  past: 'relationship',
};

describe('generation/generateRun', () => {
  it('builds a complete seminary run from answers', () => {
    const { state, rng } = newGame({ seed: 'run', start: { year: 2010, month: 8, day: 20 } });
    const run = generateRun(state, answers, rng);
    expect(run.mode).toEqual({ kind: 'year_start', year: 1 });
    expect(run.character?.name.last).toBe('Reilly');
    const tags = new Set(Object.values(run.npcs).flatMap((n) => n.tags));
    for (const t of ['rector', 'spiritual_director', 'formation_advisor', 'vocation_director', 'professor_trad', 'professor_prog', 'bishop', 'mother', 'home_pastor']) {
      expect(tags.has(t), t).toBe(true);
    }
    expect(run.seminary!.classmateIds.length).toBeGreaterThanOrEqual(6);
    expect(run.character!.hooks.find((h) => h.id === 'home_pastor')?.npcId).toBeTruthy();
    expect(run.npcs.mother?.tags).toContain('dependent');
    // Generation is reproducible and independent across streams.
    const again = generateRun(newGame({ seed: 'run', start: { year: 2010, month: 8, day: 20 } }).state, answers, createRng('run'));
    expect(again.npcs).toEqual(run.npcs);
  });
});

/** Play the store forward, choosing the first available choice at every decision. */
function autoplay(maxSteps = 5000): GameState {
  const s = useGameStore;
  for (let i = 0; i < maxSteps; i++) {
    const game = s.getState().game!;
    if (game.mode.kind === 'ended' || game.mode.kind === 'ordination') return game;
    if (game.pending.length) {
      const pending = game.pending[0]!;
      const event = eventById(pending.eventId)!;
      const choice = visibleChoices(event, game, pending.bindings).find((v) => v.available && !v.choice.effects.some((e) => e.target === 'end'));
      s.getState().resolveEvent(choice ? choice.choice.id : visibleChoices(event, game, pending.bindings)[0]!.choice.id);
      continue;
    }
    switch (game.mode.kind) {
      case 'year_start': {
        const extra = emphasisPointsFor(game) - 10;
        s.getState().chooseEmphasis({ human: 3, spiritual: 3, intellectual: 2 + extra, pastoral: 2 });
        break;
      }
      case 'summer':
        s.getState().chooseSummer('hard_parish');
        break;
      case 'evaluation':
        s.getState().acknowledgeEvaluation();
        break;
      case 'clock':
        s.getState().setSpeed('SKIP');
        s.getState().runToStop();
        break;
      default:
        throw new Error(`unexpected mode ${game.mode.kind}`);
    }
    if (s.getState().error) throw new Error(s.getState().error!);
  }
  throw new Error('autoplay did not finish');
}

describe('engine/store with real content', () => {
  beforeEach(() => {
    setWeekDraw(noDraw);
    setWeekHook(null);
    useGameStore.getState().newGame({ seed: 'store-run', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.getState().chooseDiocese('chicago');
  });

  it('has authored seminary content', () => {
    expect(allEvents.filter((e) => e.phase === 'seminary').length).toBeGreaterThanOrEqual(90);
  });

  it('startGame enters seminary and the first year plays with real events', () => {
    const s = useGameStore.getState();
    s.startGame(answers);
    const started = useGameStore.getState().game!;
    expect(started.mode).toEqual({ kind: 'year_start', year: 1 });
    // The world's people survive character creation.
    expect(started.npcs[started.world!.diocese.hidden.bishop.npcId]).toBeTruthy();
    for (const p of started.world!.parishes) expect(started.npcs[p.pastorId]?.tags).toContain('pastor');
    expect(Object.values(started.npcs).filter((n) => n.role === 'official').length).toBeGreaterThanOrEqual(6);
    s.chooseEmphasis({ human: 3, spiritual: 3, intellectual: 2, pastoral: 2 });
    useGameStore.getState().setSpeed('MANUAL');
    let fired = 0;
    for (let guard = 0; guard < 60 && useGameStore.getState().game!.mode.kind === 'clock'; guard++) {
      useGameStore.getState().tick();
      const g = useGameStore.getState().game!;
      if (g.pending.length) {
        fired++;
        const p = g.pending[0]!;
        const ev = eventById(p.eventId)!;
        expect(ev.yearGate).toContain(1);
        const choice = visibleChoices(ev, g, p.bindings).find((v) => v.available && !v.choice.effects.some((e) => e.target === 'end'))!;
        useGameStore.getState().resolveEvent(choice.choice.id);
        expect(useGameStore.getState().error).toBeNull();
      }
    }
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(useGameStore.getState().game!.mode.kind).toBe('summer');
  });

  it('plays seven years of real content to ordination without errors', () => {
    useGameStore.getState().startGame(answers);
    const end = autoplay();
    expect(end.mode.kind).toBe('ordination');
    expect(end.seminary!.evaluations).toHaveLength(7);
    expect(end.history.length).toBeGreaterThanOrEqual(14);
    expect(end.flags['beat_fired:candidacy:4']).toBe(true);
    expect(end.flags['beat_fired:lector_acolyte:5']).toBe(true);
    expect(end.flags['beat_fired:diaconate:6']).toBe(true);
    expect(end.flags['beat_fired:ordination_eve:7']).toBe(true);
    expect(end.flags.diaconate_promised).toBe(true);
    // Every event that fired resolved every selector it used.
    for (const h of end.history) expect(eventById(h.eventId), h.eventId).toBeTruthy();
    useGameStore.getState().ordain();
    const after = useGameStore.getState().game!;
    expect(after.phase).toBe('parochial_vicar');
    expect(after.character!.archetype).toBeTruthy();
    expect(after.mode.kind).toBe('assignment');
    expect(after.assignment?.role).toBe('parochial_vicar');
    expect(after.assignment?.letter).toMatch(/Parochial Vicar of/);
    expect(after.world!.parishes.some((p) => p.id === after.assignment!.parishId)).toBe(true);
    useGameStore.getState().acceptAssignment();
    expect(useGameStore.getState().game!.mode.kind).toBe('clock');
  });

  it('two runs from the same seed and choices are identical; different seeds differ by year four', () => {
    useGameStore.getState().startGame(answers);
    const a = autoplay();
    useGameStore.getState().newGame({ seed: 'store-run', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.getState().chooseDiocese('chicago');
    useGameStore.getState().startGame(answers);
    const b = autoplay();
    expect(b).toEqual(a);
    useGameStore.getState().newGame({ seed: 'other-seed', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.getState().chooseDiocese('chicago');
    useGameStore.getState().startGame(answers);
    const c = autoplay();
    const firedA = a.history.filter((h) => h.week < 4 * 52).map((h) => h.eventId);
    const firedC = c.history.filter((h) => h.week < 4 * 52).map((h) => h.eventId);
    expect(firedA).not.toEqual(firedC);
  });
});
