import { useGameStore } from '@/engine/store';
import Panel from './Panel';
import { choiceMeaning } from '@/systems/choiceMeaning';
import type { Choice } from '@/types';

/** A letter the man must read before the clock moves: the year in review, or a new bishop's reading of his file. */
export default function LetterPanel() {
  const game = useGameStore((s) => s.game);
  const read = useGameStore((s) => s.readLetter);
  const seek = useGameStore((s) => s.seekDirector);
  const answer = useGameStore((s) => s.answerMail);
  if (!game || game.mode.kind !== 'letter') return null;
  const l = game.mode.letter;
  return (
    <Panel title={l.sort === 'review' ? 'The year in review' : l.sort === 'provincial' ? "The provincial's desk" : l.sort === 'confrere' ? 'A brother\'s letter' : l.sort === 'mail' ? 'The mailbag' : "The bishop's desk"} tilt={l.sort === 'review' ? 'l' : 'r'}>
      <h2 className="title text-xl">{l.title}</h2>
      {l.from && <p className="ink-muted mt-1 text-sm">From {l.from.name}, {l.from.who}.</p>}
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
      {l.sort === 'mail' && l.replies && (
        <ol className="mt-4 flex flex-col gap-1.5">
          {l.replies.map((r, i) => {
            const meaning = choiceMeaning({ id: r.id, label: r.label, effects: r.effects } as Choice);
            return (
              <li key={r.id}>
                <button className="choice w-full text-left" onClick={() => answer(r.id)}>
                  <span className="ink-faint mr-2 text-xs">{i + 1}</span>{r.label}{r.hours ? <span className="ink-faint ml-2 text-xs">{r.hours} hour{r.hours === 1 ? '' : 's'}</span> : null}
                  {meaning && <div className="ink-muted mt-0.5 text-xs">{meaning}</div>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-4 flex gap-2">
        <button className="pbtn pbtn-primary" onClick={l.sort === 'mail' ? () => answer(null) : read}>{l.sort === 'review' ? 'Another year' : l.sort === 'mail' ? 'Leave it in the drawer' : 'Put it in the drawer'}</button>
        {l.action === 'seek_director' && <button className="pbtn" onClick={() => { read(); seek(); }}>Look for another</button>}
      </div>
    </Panel>
  );
}
