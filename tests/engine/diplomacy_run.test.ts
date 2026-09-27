import { describe, it, expect } from 'vitest';
import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { useGameStore } from '@/engine/store';
import { defaultAnswers } from '../helpers/career';
import { atAcademy } from '../helpers/diplomat';
import type { GameState } from '@/types';

/** A young priest sent to the Academy, played through the store: the week, the scenes, the letters, for years. */
function career(seed: string, weeks: number, home: boolean): GameState {
  const s = useGameStore;
  s.getState().newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  s.getState().chooseDiocese('chicago');
  s.getState().startGame(defaultAnswers);
  s.setState({ game: { ...atAcademy(seed), speed: 'PAUSED' } });
  const start = s.getState().game!.clock.week;
  for (let i = 0; i < 20000; i++) {
    const game = s.getState().game!;
    if (s.getState().error) throw new Error(`${s.getState().error} at week ${game.clock.week} mode ${game.mode.kind}`);
    if (game.mode.kind === 'ended' || game.clock.week - start >= weeks) return game;
    if (game.pending.length) {
      const p = game.pending[0]!;
      const views = visibleChoices(eventById(p.eventId)!, game, p.bindings).filter((v) => v.available);
      const pick = (home ? views.find((v) => v.choice.id === 'home') : undefined) ?? views.find((v) => v.choice.default) ?? views[0]!;
      s.getState().resolveEvent(pick.choice.id);
      continue;
    }
    if (game.mode.kind === 'letter') { s.getState().readLetter(); continue; }
    if (game.mode.kind === 'assignment') { s.getState().acceptAssignment(); continue; }
    if (game.mode.kind === 'assignment_choice') { s.getState().chooseAssignment(game.mode.options[0]!.id); continue; }
    if (game.mode.kind !== 'clock') throw new Error(`unexpected mode ${game.mode.kind}`);
    if (game.study && Object.keys(game.study.routine).length === 0) {
      const ids = game.study.city === 'academy' ? ['acad_history', 'acad_languages', 'acad_drafting', 'acad_chapel'] : ['nun_reports', 'nun_bishops', 'nun_government', 'nun_chapel'];
      for (const id of ids) s.getState().setStudyActivity(id, 2);
    }
    s.getState().setSpeed('SKIP');
    s.getState().runToStop();
  }
  throw new Error('did not finish');
}

describe('the diplomatic service through the store (E1 §11)', () => {
  it('runs from the Academy through the missionary year into nunciatures abroad, country after country', () => {
    const g = career('dip-run', 52 * 12, false);
    const d = g.rome!.diplomacy!;
    expect(g.study!.city).toBe('nunciature');
    expect(d.countries.length).toBeGreaterThanOrEqual(3);
    expect(['secretary1', 'counsellor', 'nuncio']).toContain(d.rank);
    expect(g.career.some((e) => e.text.includes('Entered the diplomatic service'))).toBe(true);
    // The missionary year's scene came, and the default was the villages.
    expect(g.flags['diplomat:mission_villages']).toBe(true);
  });

  it('comes home at the first rotation when he asks, to a parish of his diocese', () => {
    const g = career('dip-run-home', 52 * 8, true);
    expect(g.rome?.diplomacy).toBeUndefined();
    expect(g.flags.diplomat_served).toBe(true);
    expect(g.assignment).not.toBeNull();
  });
});
