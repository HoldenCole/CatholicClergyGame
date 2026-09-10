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
    <div className="felt flex min-h-screen items-center justify-center p-6">
      <div className="paper paper-tilt-l flex w-full max-w-md flex-col gap-5 px-8 py-8">
        <div>
          <h1 className="title text-3xl" style={{ color: '#7a1f1f' }}>Vocation</h1>
          <p className="ink-muted mt-1 text-sm">A career and life simulation of a Catholic diocesan priest.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="heading">Seed</span>
          <input className="pinput font-mono" value={seed} onChange={(e) => setSeed(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="heading">Seminary entry year</span>
          <input type="number" className="pinput font-mono" value={startYear} min={1950} max={2040} onChange={(e) => setStartYear(Number(e.target.value))} />
          <span className="ink-faint text-xs">Ordination follows seven years later.</span>
        </label>
        <button className="pbtn pbtn-primary self-start px-5 py-2" disabled={seed.trim().length === 0} onClick={() => newGame({ seed: seed.trim(), startYear })}>
          Begin
        </button>
        {autosave && (
          <button className="pbtn self-start" onClick={() => importSave(autosave)}>Continue from autosave</button>
        )}
        {error && <p className="ink-wine text-sm">{error}</p>}
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
