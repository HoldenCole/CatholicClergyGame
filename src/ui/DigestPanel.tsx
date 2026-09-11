import { useGameStore } from '@/engine/store';
import { publicRecord } from '@/systems/record';
import Sheet from './Sheet';

const SHOWN = 30;

/** The record: what each week came to, most recent first; the file; and the public record of stands taken. */
export default function DigestPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const recent = game.digest.slice(-SHOWN).reverse();
  const notes = game.career.slice(-8).reverse();
  const record = publicRecord(game);
  const letters = (game.letters ?? []).slice(-6).reverse();

  return (
    <>
      <Sheet title="The weeks">
        {recent.length === 0 ? (
          <p className="ink-faint text-sm">No weeks have passed yet.</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {recent.map((w) => (
              <li key={w.week} className="flex gap-3">
                <span className="ink-faint w-8 shrink-0 text-right text-xs leading-5">{w.week}</span>
                <span className="leading-5">{w.lines.join(' ')}</span>
              </li>
            ))}
          </ol>
        )}
      </Sheet>
      {game.character && (
        <Sheet title="The public record">
          <p className="text-sm">You are {record.standing}. {record.bishopLine}</p>
          {record.rows.length === 0 ? (
            <p className="ink-faint mt-2 text-xs">You have taken no stand anyone could quote.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {record.rows.slice(0, 14).map((r, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="ink-faint w-8 shrink-0 text-right text-xs">{r.week}</span>
                  <span className="flex-1">On {r.topic}, {r.side}, {r.volume}.</span>
                  <span className={'text-xs ' + (r.reading === 'against' ? 'ink-wine' : 'ink-faint')}>
                    {r.reading === 'with' ? 'the bishop agrees' : r.reading === 'against' ? 'the bishop does not' : 'unread'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
      {notes.length > 0 && (
        <Sheet title="The file">
          <ol className="flex flex-col gap-1 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="ink-muted">{n.text}</li>
            ))}
          </ol>
        </Sheet>
      )}
      {letters.length > 0 && (
        <Sheet title="The drawer">
          <ol className="flex flex-col gap-1 text-sm">
            {letters.map((l, i) => (
              <li key={i} className="ink-muted">
                <span className="ink-faint mr-2 text-xs">{l.week}</span>{l.title}. {l.body[0]}
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </>
  );
}
