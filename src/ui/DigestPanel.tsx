import { useGameStore } from '@/engine/store';
import Sheet from './Sheet';

const SHOWN = 30;

/** The record: what each week came to, most recent first. */
export default function DigestPanel() {
  const digest = useGameStore((s) => s.game?.digest);
  const career = useGameStore((s) => s.game?.career);
  if (!digest) return null;
  const recent = digest.slice(-SHOWN).reverse();
  const notes = (career ?? []).slice(-8).reverse();

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
      {notes.length > 0 && (
        <Sheet title="The file">
          <ol className="flex flex-col gap-1 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="ink-muted">{n.text}</li>
            ))}
          </ol>
        </Sheet>
      )}
    </>
  );
}
