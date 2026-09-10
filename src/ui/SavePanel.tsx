import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/store';
import Sheet from './Sheet';

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

  const download = async () => {
    const json = exportSave();
    const filename = `vocation-${game.seed}-week${game.clock.week}.json`;
    // Inside the claude.ai viewer the page may not download on its own; the host offers the file instead.
    const host = window.claude ? await window.claude.use('downloads').catch(() => null) : null;
    if (host) {
      try {
        await host.save({ filename, data: json });
        setNote('Save downloaded.');
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        setNote(code === 'declined' ? 'Not saved.' : 'The host could not save the file. Copy JSON works instead.');
      }
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
    <Sheet title="The save">
      <div className="flex flex-wrap gap-2">
        <button className="pbtn" onClick={() => void download()}>Download</button>
        <button className="pbtn" onClick={() => void copy()}>Copy JSON</button>
        <button className="pbtn" onClick={() => fileRef.current?.click()}>Load a file</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <p className="ink-faint mt-3 text-xs">
        Autosaves to this browser after every week. Seed <span className="font-mono">{game.seed}</span>. Saves are plain JSON.
      </p>
      {note && <p className="ink-muted mt-2 text-xs">{note}</p>}
      {error && <p className="ink-wine mt-2 text-xs">Load failed: {error}</p>}
    </Sheet>
  );
}
