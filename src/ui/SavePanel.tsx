import { useRef, useState } from 'react';
import { useGameStore } from '@/engine/store';
import { describeSave, SLOTS, slotsAvailable } from '@/engine/slots';
import RepoSavePanel from './RepoSavePanel';
import Sheet from './Sheet';

function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function SavePanel() {
  const game = useGameStore((s) => s.game);
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);
  const slots = useGameStore((s) => s.slots);
  const slotId = useGameStore((s) => s.slotId);
  const saveToSlot = useGameStore((s) => s.saveToSlot);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const deleteSlot = useGameStore((s) => s.deleteSlot);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!game) return null;
  const auto = slots.find((s) => s.id === SLOTS.autoId);
  const kept = slots.filter((s) => s.id !== SLOTS.autoId);
  const full = kept.length >= SLOTS.max;

  const save = (id?: string) => {
    clearError();
    const label = name.trim();
    saveToSlot({ ...(id ? { id } : {}), ...(label ? { name: label } : {}) });
    setName('');
    setNote(useGameStore.getState().error ? null : id ? 'Saved over that one.' : 'Saved.');
  };

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
      {slotsAvailable() ? (
        <>
          <p className="ink-muted text-xs">This run: {describeSave(game)}.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input className="pinput min-w-0 flex-1 text-sm" placeholder="Name this save (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="pbtn" disabled={full} onClick={() => save()}>Save to a new slot</button>
          </div>
          {full && <p className="ink-faint mt-1 text-xs">The shelf holds {SLOTS.max}. Save over one below, or delete one.</p>}

          {(auto || kept.length > 0) && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {[...(auto ? [auto] : []), ...kept].map((slot) => (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-2 py-1.5 text-sm">
                  <span className="min-w-0">
                    <span className="block">{slot.auto ? 'Autosave' : slot.name}{slot.id === slotId ? ' · this run' : ''}</span>
                    <span className="ink-faint block text-xs">{slot.line} · {ago(slot.savedAt)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {!slot.auto && <button className="pbtn px-2 text-xs" onClick={() => save(slot.id)}>Save over</button>}
                    <button className="pbtn px-2 text-xs" onClick={() => loadSlot(slot.id)}>Load</button>
                    {confirm === slot.id ? (
                      <button className="pbtn px-2 text-xs" onClick={() => { deleteSlot(slot.id); setConfirm(null); }}>Sure?</button>
                    ) : (
                      <button className="pbtn px-2 text-xs" onClick={() => setConfirm(slot.id)}>Delete</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="ink-faint mt-2 text-xs">
            The game writes the autosave as the weeks pass, so closing the page loses nothing: the title screen offers it back, and beginning a new man sets this run aside rather than writing over it. Named saves are yours to keep. All of it lives in this browser, and clearing the browser&rsquo;s data clears it; download the file for anything you would hate to lose.
          </p>
        </>
      ) : (
        <p className="ink-muted text-xs">This browser will not keep saves. Download the file and load it again when you come back.</p>
      )}

      <RepoSavePanel mode="sheet" />

      <div className="mt-3 flex flex-wrap gap-2 border-t rule pt-3">
        <button className="pbtn" onClick={() => void download()}>Download</button>
        <button className="pbtn" onClick={() => void copy()}>Copy JSON</button>
        <button className="pbtn" onClick={() => fileRef.current?.click()}>Load a file</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <p className="ink-faint mt-2 text-xs">Seed <span className="font-mono">{game.seed}</span>. Saves are plain JSON.</p>
      {note && <p className="ink-muted mt-2 text-xs">{note}</p>}
      {error && <p className="ink-wine mt-2 text-xs">{error}</p>}
    </Sheet>
  );
}
