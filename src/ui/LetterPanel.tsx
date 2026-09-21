import { useGameStore } from '@/engine/store';
import Panel from './Panel';

/** A letter the man must read before the clock moves: the year in review, or a new bishop's reading of his file. */
export default function LetterPanel() {
  const game = useGameStore((s) => s.game);
  const read = useGameStore((s) => s.readLetter);
  const seek = useGameStore((s) => s.seekDirector);
  if (!game || game.mode.kind !== 'letter') return null;
  const l = game.mode.letter;
  return (
    <Panel title={l.sort === 'review' ? 'The year in review' : l.sort === 'provincial' ? "The provincial's desk" : l.sort === 'confrere' ? 'A brother\'s letter' : "The bishop's desk"} tilt={l.sort === 'review' ? 'l' : 'r'}>
      <h2 className="title text-xl">{l.title}</h2>
      {l.body.map((p, i) => (
        <p key={i} className="mt-2 leading-relaxed">{p}</p>
      ))}
      {l.rows && l.rows.length > 0 && (
        <dl className="mt-3 flex flex-col gap-1 text-sm">
          {l.rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <dt className="ink-muted w-40 shrink-0">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 flex gap-2">
        <button className="pbtn pbtn-primary" onClick={read}>{l.sort === 'review' ? 'Another year' : 'Put it in the drawer'}</button>
        {l.action === 'seek_director' && <button className="pbtn" onClick={() => { read(); seek(); }}>Look for another</button>}
      </div>
    </Panel>
  );
}
