import { useGameStore } from '@/engine/store';
import { massSaid } from '@/systems/massSaid';

/** Two lines on the week sheet: the Mass the man says, and where he stands with the older form under the law of the day. */
export default function MassSaidNote() {
  const game = useGameStore((s) => s.game);
  if (!game?.character) return null;
  const m = massSaid(game);
  return (
    <p className="ink-muted mt-2 text-xs leading-relaxed" title="The reformed Missal of 1970 is the Mass of the Roman Rite; the 1962 Missal is its older form, said under Rome's law and the bishop's leave">
      <span className="heading">{m.celebrant ? 'The Mass you say' : 'The Mass'}</span> · {m.line} <span className="ink-faint">{m.older}</span>
    </p>
  );
}
