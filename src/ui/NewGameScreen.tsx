import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { DEFAULT_START_YEAR } from '@/engine/game';
import { AUTOSAVE_KEY } from './SavePanel';

export default function NewGameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const importSave = useGameStore((s) => s.importSave);
  const error = useGameStore((s) => s.error);
  const [seed, setSeed] = useState(() => `run-${Date.now().toString(36)}`);
  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);

  const autosave = safeRead(AUTOSAVE_KEY);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
      <div className="w-full max-w-md rounded border border-stone-800 bg-stone-900/60 p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide">Vocation</h1>
          <p className="mt-1 text-sm text-stone-400">
            A career and life simulation of a Catholic diocesan priest.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-400">Seed</span>
          <input
            className="rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-100"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-400">Seminary entry year</span>
          <input
            type="number"
            className="rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-100"
            value={startYear}
            min={1950}
            max={2040}
            onChange={(e) => setStartYear(Number(e.target.value))}
          />
          <span className="text-xs text-stone-500">Ordination follows seven years later.</span>
        </label>

        <button
          className="rounded bg-amber-700 px-4 py-2 font-medium text-stone-50 hover:bg-amber-600 disabled:opacity-40"
          disabled={seed.trim().length === 0}
          onClick={() => newGame({ seed: seed.trim(), startYear })}
        >
          Begin
        </button>

        {autosave && (
          <button
            className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-300 hover:bg-stone-800"
            onClick={() => importSave(autosave)}
          >
            Continue from autosave
          </button>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
