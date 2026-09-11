import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { useGameStore } from '@/engine/store';
import { emphasisPointsFor } from '@/systems/formation';
import type { CreationAnswers, GameState } from '@/types';

export const defaultAnswers: CreationAnswers = {
  firstName: 'Thomas', lastName: 'Reilly', portrait: 'p1', entryYear: 2010, origin: 'urban_ethnic', tie: 'son',
  path: 'college', field: 'philosophy', career: null, yearsWorked: 0, motive: 'priest', family: 'widowed_mother', past: null,
};

/** Play through everything with safe choices until the run ends or the week cap is reached. */
export function playCareer(seed: string, diocese: string, maxWeeks: number, a: CreationAnswers = defaultAnswers): GameState {
  const s = useGameStore;
  s.getState().newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  s.getState().chooseDiocese(diocese);
  s.getState().startGame(a);
  for (let i = 0; i < 20000; i++) {
    const game = s.getState().game!;
    if (s.getState().error) throw new Error(`${s.getState().error} at week ${game.clock.week} mode ${game.mode.kind}`);
    if (game.mode.kind === 'ended') return game;
    if (game.clock.week >= maxWeeks) return game;
    if (game.pending.length) {
      const p = game.pending[0]!;
      const ev = eventById(p.eventId)!;
      const views = visibleChoices(ev, game, p.bindings);
      const safe = views.find((v) => v.available && !v.choice.effects.some((e) => e.target === 'end')) ?? views.find((v) => v.available);
      if (!safe) throw new Error(`no available choice for ${ev.id}`);
      s.getState().resolveEvent(safe.choice.id);
      continue;
    }
    if (game.offers.length) {
      const o = game.offers[0]!;
      if (game.clock.week % 2 === 0) s.getState().acceptOffer(o.offerId);
      else s.getState().declineOffer(o.offerId);
      if (s.getState().game!.offers.length === game.offers.length) s.getState().declineOffer(o.offerId);
      continue;
    }
    switch (game.mode.kind) {
      case 'year_start': {
        const x = emphasisPointsFor(game) - 10;
        s.getState().chooseEmphasis({ human: 3, spiritual: 3, intellectual: 2 + x, pastoral: 2 });
        break;
      }
      case 'summer': s.getState().chooseSummer('hard_parish'); break;
      case 'evaluation': s.getState().acknowledgeEvaluation(); break;
      case 'ordination': s.getState().ordain(); break;
      case 'assignment': s.getState().acceptAssignment(); break;
      case 'letter': s.getState().readLetter(); break;
      case 'clock':
        if (game.parish && (game.parish.routine.discretionary.groups ?? 0) === 0) s.getState().setDiscretionary('groups', 1);
        s.getState().setSpeed('SKIP');
        s.getState().runToStop();
        break;
      default:
        throw new Error(`unexpected mode ${game.mode.kind}`);
    }
  }
  throw new Error('did not finish');
}

