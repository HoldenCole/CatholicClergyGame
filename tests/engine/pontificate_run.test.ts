import { describe, it, expect } from 'vitest';
import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { useGameStore } from '@/engine/store';
import { draftSubjects } from '@/systems/rome/papalDesk';
import { consistoryOpen, journeyOpen } from '@/systems/rome/papalActs';
import { defaultAnswers } from '../helpers/career';
import { elected } from '../helpers/pope';
import type { GameState } from '@/types';

/** Play a pontificate through the store: a week, a desk, consistories, journeys, scenes and letters, until it ends. */
function reign(seed: string, maxWeeks: number, save?: (game: GameState) => void): GameState {
  const s = useGameStore;
  s.getState().newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  s.getState().chooseDiocese('chicago');
  s.getState().startGame(defaultAnswers);
  s.setState({ game: { ...elected(seed), speed: 'PAUSED' } });
  const start = s.getState().game!.clock.week;
  for (const [id, n] of [['pope_writing', 4], ['pope_audience', 2], ['pope_chapel', 2], ['pope_rest', 2], ['pope_bishops', 2], ['pope_rome', 1]] as const) s.getState().setStudyActivity(id, n);
  let saved = false;
  for (let i = 0; i < 20000; i++) {
    const game = s.getState().game!;
    if (s.getState().error) throw new Error(`${s.getState().error} at week ${game.clock.week} mode ${game.mode.kind}`);
    if (game.mode.kind === 'ended') return game;
    if (game.clock.week - start >= maxWeeks) return game;
    if (!saved && save && game.clock.week - start > 20 && game.rome?.pontificate?.draft) {
      save(game);
      saved = true;
    }
    if (game.pending.length) {
      const p = game.pending[0]!;
      const ev = eventById(p.eventId)!;
      const views = visibleChoices(ev, game, p.bindings).filter((v) => v.available);
      // Stay, rather than lay it down, so the run reaches the end the year brings.
      const pick = views.find((v) => v.choice.default) ?? views[0]!;
      s.getState().resolveEvent(pick.choice.id);
      continue;
    }
    if (game.mode.kind === 'letter') {
      s.getState().readLetter();
      continue;
    }
    if (game.mode.kind !== 'clock') throw new Error(`unexpected mode ${game.mode.kind}`);
    const p = game.rome!.pontificate!;
    if (!p.draft) s.getState().beginPapalDraft(p.written.length % 2 ? 'motu_proprio' : 'apostolic_letter', draftSubjects(game)[p.written.length % 3]!.id);
    if (p.candidates) s.getState().createCardinals(p.candidates.filter((c) => c.temperament > -20).map((c) => c.id));
    else if (consistoryOpen(game).open) s.getState().callConsistory();
    if (journeyOpen(game).open && game.clock.week % 3 === 0) s.getState().planJourney(['Kenya', 'Brazil', 'the Philippines', 'Poland'][p.journeys.length % 4]!);
    if (s.getState().game!.mode.kind !== 'clock') continue;
    s.getState().setSpeed('SKIP');
    s.getState().runToStop();
  }
  throw new Error('did not finish');
}

describe('a pontificate played through the store (E1 R1.6)', () => {
  it('runs from the loggia to its end, writing, creating, travelling, and leaves the College to elect', () => {
    const end = reign('pope-run', 52 * 40);
    expect(end.mode.kind).toBe('ended');
    if (end.mode.kind !== 'ended') return;
    expect(['pope_died', 'pope_renounced']).toContain(end.mode.ending);
    expect(end.mode.summary).toMatch(/cardinal electors/);
    const p = end.rome!.pontificate!;
    expect(p.written.length).toBeGreaterThan(0);
    expect(p.consistories.length).toBeGreaterThan(0);
    expect(p.journeys.length).toBeGreaterThan(0);
    expect(end.study!.record!.bishops).toBeGreaterThan(0);
    expect(end.career.some((e) => e.text.includes('Elected Bishop of Rome'))).toBe(true);
  });

  it('survives a save and load mid-pontificate, with a document on the desk', () => {
    let snapshot: string | null = null;
    let before: GameState | null = null;
    reign('pope-save', 400, (game) => {
      before = game;
      snapshot = useGameStore.getState().exportSave();
    });
    expect(snapshot).not.toBeNull();
    useGameStore.getState().importSave(snapshot!);
    const after = useGameStore.getState().game!;
    // A save is JSON: compare against the state as JSON keeps it (a negative zero in the world is written as zero).
    expect({ ...after, speed: 'PAUSED' }).toEqual(JSON.parse(JSON.stringify({ ...before!, speed: 'PAUSED' })));
    expect(after.rome!.pontificate!.draft).toBeDefined();
  });
});
