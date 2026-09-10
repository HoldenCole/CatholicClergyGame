import { useGameStore } from '@/engine/store';
import NewGameScreen from './NewGameScreen';
import ClockPanel from './ClockPanel';
import SpeedControls from './SpeedControls';
import InterruptSettings from './InterruptSettings';
import SavePanel from './SavePanel';
import SettingsPanel from './SettingsPanel';
import DigestPanel from './DigestPanel';
import { useClockRunner } from './useClockRunner';
import CreationScreen from './creation/CreationScreen';
import EndedScreen from './EndedScreen';
import EmphasisPanel from './seminary/EmphasisPanel';
import EventPanel from './seminary/EventPanel';
import SummerPanel from './seminary/SummerPanel';
import EvaluationPanel from './seminary/EvaluationPanel';
import OrdinationPanel from './seminary/OrdinationPanel';
import FormationPanel from './seminary/FormationPanel';
import OffersPanel from './seminary/OffersPanel';
import AssignmentPanel from './seminary/AssignmentPanel';
import RoutinePanel from './parish/RoutinePanel';
import ParishPanel from './parish/ParishPanel';
import GroupsPanel from './parish/GroupsPanel';
import ProjectsPanel from './parish/ProjectsPanel';

export default function App() {
  const game = useGameStore((s) => s.game);
  const error = useGameStore((s) => s.error);
  useClockRunner();

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
    null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-wide">Vocation</h1>
        <span className="text-xs text-stone-500 font-mono">seed {game.seed}</span>
      </header>
      <main className="mx-auto max-w-6xl grid grid-cols-12 gap-6 p-6">
        <section className="col-span-8 flex flex-col gap-6">
          {decision}
          <OffersPanel />
          <ClockPanel />
          {!decision && <SpeedControls />}
          {!decision && game.parish && <RoutinePanel />}
          <DigestPanel />
        </section>
        <aside className="col-span-4 flex flex-col gap-6">
          {error && <p className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
          {game.parish ? <ParishPanel /> : game.seminary && <FormationPanel />}
          {game.parish && <GroupsPanel />}
          {game.parish && <ProjectsPanel />}
          <InterruptSettings />
          <SavePanel />
          <SettingsPanel />
        </aside>
      </main>
    </div>
  );
}
