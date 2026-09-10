import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/store';
import Panel from './Panel';

export const AUTOSAVE_KEY = 'vocation.autosave';

export default function SavePanel() {
  const game = useGameStore((s) => s.game);
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave whenever the week or settings change.
  useEffect(() => {
    if (!game) return;
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, exportSave());
    } catch {
      /* storage unavailable; export still works */
    }
  }, [game, exportSave]);

  if (!game) return null;

  const download = () => {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocation-${game.seed}-week${game.clock.week}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote('Save downloaded.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportSave());
      setNote('Save copied to clipboard.');
    } catch {
      setNote('Clipboard unavailable.');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    clearError();
    importSave(await file.text());
    setNote(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Panel title="Save">
      <div className="flex flex-wrap gap-2">
        <Button onClick={download}>Download</Button>
        <Button onClick={() => void copy()}>Copy JSON</Button>
        <Button onClick={() => fileRef.current?.click()}>Load file</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Autosaves to this browser after every week. Saves are plain JSON.
      </p>
      {note && <p className="mt-2 text-xs text-stone-400">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-400">Load failed: {error}</p>}
    </Panel>
  );
}

function Button({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="rounded border border-stone-700 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
