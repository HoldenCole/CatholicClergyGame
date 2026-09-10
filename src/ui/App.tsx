import { useGameStore } from '@/engine/store';
import NewGameScreen from './NewGameScreen';
import ClockPanel from './ClockPanel';
import SpeedControls from './SpeedControls';
import InterruptSettings from './InterruptSettings';
import SavePanel from './SavePanel';
import DigestPanel from './DigestPanel';
import { useClockRunner } from './useClockRunner';

export default function App() {
  const game = useGameStore((s) => s.game);
  useClockRunner();

  if (!game) return <NewGameScreen />;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-wide">Vocation</h1>
        <span className="text-xs text-stone-500 font-mono">seed {game.seed}</span>
      </header>
      <main className="mx-auto max-w-6xl grid grid-cols-12 gap-6 p-6">
        <section className="col-span-8 flex flex-col gap-6">
          <ClockPanel />
          <SpeedControls />
          <DigestPanel />
        </section>
        <aside className="col-span-4 flex flex-col gap-6">
          <InterruptSettings />
          <SavePanel />
        </aside>
      </main>
    </div>
  );
}
