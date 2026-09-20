import { useGameStore } from '@/engine/store';
import Panel from './Panel';
import OfferCard from './seminary/OfferCard';

/** The first unread letter, laid over the scene: it holds the clock until it is answered or put on the desk. */
export function unreadOffers(offers: { read?: boolean }[]): number {
  return offers.filter((o) => !o.read).length;
}

/**
 * A letter that has just come lies on the table until the man has read it.
 * He may answer it here, or put it on the desk and answer it from the Letters
 * sheet before it lapses; either way the week does not move until he has.
 */
export default function OfferLetter() {
  const game = useGameStore((s) => s.game);
  const markRead = useGameStore((s) => s.markOfferRead);
  if (!game) return null;
  const letter = game.offers.find((o) => !o.read);
  if (!letter) return null;
  const more = unreadOffers(game.offers) - 1;
  return (
    <Panel title={`A letter has come${more > 0 ? ` · ${more} more waiting` : ''}`} tilt="r">
      <OfferCard o={letter} />
      <div className="mt-2 flex items-center justify-between">
        <span className="ink-faint text-xs">It waits on the Letters sheet until it lapses; the clock waits with it.</span>
        <button className="pbtn text-xs" onClick={() => markRead(letter.offerId)}>Put it on the desk</button>
      </div>
    </Panel>
  );
}
