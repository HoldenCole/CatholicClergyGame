import { describe, expect, it } from 'vitest';
import { useGameStore } from '@/engine/store';
import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { circleOf, ROME_TAGS } from '@/systems/circle';
import { homeView } from '@/systems/home';
import { awayFromHome, composeMail, mailDefs, repliesFor } from '@/systems/mail';
import { defaultAnswers } from '../helpers/career';
import { atAcademy } from '../helpers/diplomat';
import { testNpc } from '../helpers/fixtures';
import { parishState } from './week.test';
import type { GameState } from '@/types';

/** Years away through the store, as the diplomacy run plays them. */
function away(seed: string, weeks: number): GameState {
  const s = useGameStore;
  s.getState().newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  s.getState().chooseDiocese('chicago');
  s.getState().startGame(defaultAnswers);
  s.setState({ game: { ...atAcademy(seed), speed: 'PAUSED' } });
  const start = s.getState().game!.clock.week;
  for (let i = 0; i < 20000; i++) {
    const game = s.getState().game!;
    if (s.getState().error) throw new Error(s.getState().error!);
    if (game.mode.kind === 'ended' || game.clock.week - start >= weeks) return game;
    if (game.pending.length) {
      const p = game.pending[0]!;
      const views = visibleChoices(eventById(p.eventId)!, game, p.bindings).filter((v) => v.available);
      s.getState().resolveEvent((views.find((v) => v.choice.default) ?? views[0]!).choice.id);
      continue;
    }
    if (game.mode.kind === 'letter') { s.getState().readLetter(); continue; }
    if (game.mode.kind === 'assignment') { s.getState().acceptAssignment(); continue; }
    if (game.mode.kind === 'assignment_choice') { s.getState().chooseAssignment(game.mode.options[0]!.id); continue; }
    if (game.mode.kind === 'posting_choice') { s.getState().choosePosting(game.mode.options[0]!.country); continue; }
    if (game.mode.kind !== 'clock') throw new Error(`mode ${game.mode.kind}`);
    s.getState().setSpeed('SKIP');
    s.getState().runToStop();
  }
  throw new Error('did not finish');
}

describe('one world, round 1: home from away', () => {
  it('the mailbag reaches a man away: letters come to Rome', () => {
    const g = away('home-mail', 52 * 3);
    expect(g.study).toBeTruthy();
    expect((g.mail ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('a letter that needs the car is not answered from Rome: the drive is not offered, and a letter that is only a drive does not come', () => {
    const s = atAcademy('home-replies');
    expect(awayFromHome(s)).toBe(true);
    expect(awayFromHome(parishState('home-replies-parish'))).toBe(false);
    const funeral = mailDefs.find((d) => d.id === 'ml_former_parish_the_funeral')!;
    expect(repliesFor(parishState('home-replies-parish'), funeral).map((r) => r.id)).toContain('go');
    const away = repliesFor(s, funeral).map((r) => r.id);
    expect(away).not.toContain('go');
    expect(away).toContain('a_letter_read');
    const letter = composeMail(s, funeral, { sender: { name: 'Mrs. Turner', who: 'of St. Julie' }, bindings: {}, extra: { sender: 'Mrs. Turner', sender_first: 'Mary', who: 'of St. Julie', former_parish: 'St. Julie' } });
    expect(letter.replies!.map((r) => r.id)).not.toContain('go');
  });

  it('home is in view from away: the parish he left and who has it, the bishop, the chancery, the openings', () => {
    const s = atAcademy('home-view');
    const h = homeView(s)!;
    expect(h).toBeTruthy();
    expect(h.diocese).toBe(s.world!.diocese.visible.name);
    expect(h.bishop?.role).toBe('bishop');
    expect(h.formerParish).toBeTruthy();
    expect(s.world!.parishes.some((p) => p.id === h.formerParish!.parish.id)).toBe(true);
    expect(h.formerParish!.years).toBeGreaterThanOrEqual(1);
    expect(h.chancery.every((n) => n.role === 'official')).toBe(true);
    expect(h.chancery.some((n) => ROME_TAGS.some((t) => n.tags.includes(t)))).toBe(false);
    expect(Array.isArray(h.news)).toBe(true);
    // No world, no home.
    expect(homeView({ ...s, world: null })).toBeNull();
  });

  it('the Roman years keep their own place in the circle, apart from the chancery', () => {
    const base = parishState('home-circle');
    const s: GameState = { ...base, npcs: { ...base.npcs, chief: testNpc('chief', { role: 'official', title: 'Archbishop', tags: ['nuncio_chief'], relationship: 40 }), vg: testNpc('vg', { role: 'official', title: 'Msgr.', tags: ['vicar_general'], relationship: 40 }), nacman: testNpc('nacman', { role: 'classmate', tags: ['nac_classmate', 'nac'], relationship: 40 }) } };
    const rows = circleOf(s);
    expect(rows.find((r) => r.npc.id === 'chief')!.group).toBe('rome');
    expect(rows.find((r) => r.npc.id === 'vg')!.group).toBe('chancery');
    // A College classmate is of the class first: the class is where he knew him.
    expect(rows.find((r) => r.npc.id === 'nacman')!.group).toBe('class');
  });
});
