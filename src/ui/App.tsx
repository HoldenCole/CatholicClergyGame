import { useEffect } from 'react';
import { useGameStore } from '@/engine/store';
import NewGameScreen from './NewGameScreen';
import { useClockRunner } from './useClockRunner';
import CreationScreen from './creation/CreationScreen';
import EndedScreen from './EndedScreen';
import EmphasisPanel from './seminary/EmphasisPanel';
import EventPanel from './seminary/EventPanel';
import SummerPanel from './seminary/SummerPanel';
import EvaluationPanel from './seminary/EvaluationPanel';
import OrdinationPanel from './seminary/OrdinationPanel';
import AssignmentPanel from './seminary/AssignmentPanel';
import AssignmentChoicePanel from './seminary/AssignmentChoicePanel';
import LetterPanel from './LetterPanel';
import SceneView from './scenes/SceneView';
import Desk from './Desk';
import Hud from './Hud';
import { useUiStore } from './uiStore';

export default function App() {
  const game = useGameStore((s) => s.game);
  const error = useGameStore((s) => s.error);
  const lastStop = useGameStore((s) => s.lastStop);
  const openSheet = useUiStore((s) => s.openSheet);
  useClockRunner();

  // A letter arriving opens the letters sheet; nothing else moves the desk on its own.
  useEffect(() => {
    if (lastStop?.kind === 'offer') openSheet('letters');
  }, [lastStop, openSheet]);

  if (!game) return <NewGameScreen />;
  if (game.mode.kind === 'creation') return <CreationScreen />;
  if (game.mode.kind === 'ended') return <EndedScreen />;

  const pending = game.pending.length > 0;
  const decision =
    pending ? <EventPanel /> :
    game.mode.kind === 'year_start' ? <EmphasisPanel /> :
    game.mode.kind === 'summer' ? <SummerPanel /> :
    game.mode.kind === 'evaluation' ? <EvaluationPanel /> :
    game.mode.kind === 'ordination' ? <OrdinationPanel /> :
    game.mode.kind === 'assignment' ? <AssignmentPanel /> :
    game.mode.kind === 'assignment_choice' ? <AssignmentChoicePanel /> :
    game.mode.kind === 'letter' ? <LetterPanel /> :
    null;

  return (
    <div className="felt min-h-screen text-stone-100">
      <Hud />
      <main className="layout mx-auto flex max-w-[1400px] gap-5 px-5 pb-6 pt-4">
        <section className="relative min-w-0 flex-[3]">
          <SceneView />
          {decision && (
            <div className="scrim absolute inset-0 z-20 flex items-start justify-center overflow-y-auto p-6">
              <div className="w-full max-w-2xl">{decision}</div>
            </div>
          )}
        </section>
        <aside className="w-[420px] shrink-0">
          {error && <p className="paper mb-3 px-4 py-3 text-sm ink-wine">{error}</p>}
          <Desk />
        </aside>
      </main>
    </div>
  );
}
