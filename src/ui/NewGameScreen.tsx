import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/store';
import { DEFAULT_START_YEAR } from '@/engine/game';
import type { CampaignKind } from '@/types';
import { slotsAvailable, SLOTS } from '@/engine/slots';
import RepoSavePanel from './RepoSavePanel';

/** "3 days ago", for the shelf. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function NewGameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const importSave = useGameStore((s) => s.importSave);
  const slots = useGameStore((s) => s.slots);
  const refreshSlots = useGameStore((s) => s.refreshSlots);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const deleteSlot = useGameStore((s) => s.deleteSlot);
  const error = useGameStore((s) => s.error);
  const [seed, setSeed] = useState(() => `run-${Date.now().toString(36)}`);
  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);
  const [campaign, setCampaign] = useState<CampaignKind>('diocesan');
  const [starting, setStarting] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const auto = slots.find((s) => s.id === SLOTS.autoId);
  const kept = slots.filter((s) => s.id !== SLOTS.autoId);
  const repoSaves = useGameStore((s) => s.repoSaves);
  const showNew = starting || (slots.length === 0 && repoSaves.length === 0);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    importSave(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="felt flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="paper paper-tilt-l flex w-full max-w-xl flex-col gap-5 px-6 py-7 sm:px-8 sm:py-8">
        <div>
          <h1 className="title text-3xl" style={{ color: '#7a1f1f' }}>Vocation</h1>
          <p className="ink-muted mt-1 text-sm">A career and life simulation of a Catholic priest: diocesan, or a friar of an order.</p>
        </div>

        {slots.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="heading text-sm">Continue</h2>
            <ul className="flex flex-col gap-1.5">
              {[...(auto ? [auto] : []), ...kept].map((slot) => (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block">{slot.line}</span>
                    <span className="ink-faint block text-xs">
                      {slot.auto ? 'Autosave' : slot.name}
                      {' · '}{ago(slot.savedAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button className="pbtn pbtn-primary px-3" onClick={() => loadSlot(slot.id)}>Continue</button>
                    {confirm === slot.id ? (
                      <button className="pbtn px-2 text-xs" onClick={() => { deleteSlot(slot.id); setConfirm(null); }}>Sure?</button>
                    ) : (
                      <button className="pbtn px-2 text-xs" onClick={() => setConfirm(slot.id)}>Delete</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showNew ? (
          <div className="flex flex-col gap-4 border-t rule pt-4">
            {slots.length > 0 && <h2 className="heading text-sm">A new man</h2>}
            <label className="flex flex-col gap-1 text-sm">
              <span className="heading">Seed</span>
              <span className="flex items-center gap-2">
                <input className="pinput min-w-0 flex-1 font-mono" value={seed} onChange={(e) => setSeed(e.target.value)} />
                <button type="button" className="pbtn px-2 py-1 text-xs" title="A different seed rolls a different man, diocese, and life" onClick={() => setSeed(`run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`)}>Another</button>
              </span>
              <span className="ink-faint text-xs">The same seed and the same choices give the same life; change it for a different one.</span>
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="heading">Which life</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={'choice border rule p-3 text-left ' + (campaign === 'diocesan' ? 'choice-chosen' : '')} onClick={() => setCampaign('diocesan')}>
                  <span className="font-medium">A diocesan priest</span>
                  <span className="ink-faint block text-xs">One diocese, one bishop, a parish and a rectory. The base game.</span>
                </button>
                <button type="button" className={'choice border rule p-3 text-left ' + (campaign === 'religious' ? 'choice-chosen' : '')} onClick={() => setCampaign('religious')}>
                  <span className="font-medium">A friar</span>
                  <span className="ink-faint block text-xs">Dominican or Augustinian: a province, a house, vows, obedience, and chapters that elect. No money of your own.</span>
                </button>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="heading">{campaign === 'religious' ? 'Entry year' : 'Seminary entry year'}</span>
              <input type="number" className="pinput font-mono" value={startYear} min={1950} max={2040} onChange={(e) => setStartYear(Number(e.target.value))} />
              <span className="ink-faint text-xs">Ordination follows seven years later.</span>
            </label>
            <button className="pbtn pbtn-primary self-start px-5 py-2" disabled={seed.trim().length === 0} onClick={() => newGame({ seed: seed.trim(), startYear, campaign })}>
              Begin
            </button>
          </div>
        ) : (
          <button className="pbtn self-start px-4 py-1.5" onClick={() => setStarting(true)}>Begin a new man</button>
        )}

        <div className="border-t rule pt-3">
          <RepoSavePanel mode="title" />
        </div>

        <div className="border-t rule pt-3">
          <button className="pbtn text-xs" onClick={() => fileRef.current?.click()}>Load a save file</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <p className="ink-faint mt-2 text-xs">
            {slotsAvailable()
              ? 'The game saves itself to this browser as the weeks pass, and the Save sheet keeps a shelf of saves you name yourself. Clearing the browser’s data clears them, so download a file for anything you would hate to lose.'
              : 'This browser will not keep saves. Download the save file from the Save sheet and load it here.'}
          </p>
        </div>

        {error && <p className="ink-wine text-sm">{error}</p>}
      </div>
    </div>
  );
}
