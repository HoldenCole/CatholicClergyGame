import { useGameStore } from '@/engine/store';
import { venueLabel, whatTheySay } from '@/systems/talk';
import Sheet from '../Sheet';

/** What the presbyterate is saying: the rumours he has heard, where, and what he did about them. DESIGN §8.12. */
export default function TalkPanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.character) return null;
  const said = whatTheySay(game);
  return (
    <Sheet title="What they are saying">
      {said.length === 0 ? (
        <p className="ink-faint text-sm">Nothing has reached you yet. The men talk; some of it finds its way to you at the meetings, the dinners, and on the phone.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {said.map((r) => (
            <li key={r.id} className={r.about === 'you' ? 'ink-wine' : ''}>
              <span className="ink-faint mr-1 text-xs">{venueLabel(r.venue)}:</span>{r.text}
              {r.answered === 'correct' && <span className="ink-faint ml-1 text-xs">(you set that straight)</span>}
              {r.answered === 'own' && <span className="ink-faint ml-1 text-xs">(you owned it)</span>}
              {r.answered === 'defend' && <span className="ink-faint ml-1 text-xs">(you spoke for him)</span>}
              {r.reachedBishop && !r.answered && <span className="ink-faint ml-1 text-xs">(the bishop has heard)</span>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
