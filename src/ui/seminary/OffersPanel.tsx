import { offerById } from '@/content/offers';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { evaluateAll } from '@/engine/conditions';
import { whyOffered } from '@/systems/doors';
import Sheet from '../Sheet';

/** Letters: open offers with their windows, and the commitments already made. */
export default function OffersPanel() {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptOffer);
  const decline = useGameStore((s) => s.declineOffer);
  const outcome = useGameStore((s) => s.lastOfferOutcome);
  if (!game) return null;
  const open = game.offers;
  const commitments = game.commitments;
  const pending = Object.values(game.permissions).filter((p) => p.status === 'pending');

  return (
    <>
      <Sheet title="Letters">
        {outcome && <p className="mb-3 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">{outcome}</p>}
        {open.length === 0 && !outcome && <p className="ink-faint text-sm">Nothing in the mail today.</p>}
        {open.map((o) => {
          const def = offerById(o.offerId);
          if (!def) return null;
          const weeksLeft = o.expiresWeek - game.clock.week;
          const stillQualified = evaluateAll(def.requires, game, o.bindings);
          const r = (t: string) => renderText(t, game, o.bindings);
          return (
            <div key={o.offerId} className="mb-4 border-b rule pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-baseline justify-between">
                <h3 className="title text-lg">{r(def.title)}</h3>
                <span className="ink-faint text-xs">
                  {def.windowWeeks === 0 ? 'decide now' : weeksLeft <= 0 ? 'last week' : `${weeksLeft} week${weeksLeft === 1 ? '' : 's'} to decide`}
                </span>
              </div>
              <p className="mt-2 leading-relaxed">{r(def.body)}</p>
              {(() => { const why = whyOffered(def, game); return why ? <p className="ink-faint mt-1 text-xs">{why}</p> : null; })()}
              {def.accept.commitment && (
                <p className="ink-muted mt-1 text-xs">
                  A commitment of {Math.round(def.accept.commitment.weeks / 4)} months{def.accept.commitment.apPerWeek > 0 ? ', on top of everything else' : ''}.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button className="pbtn pbtn-primary" disabled={!stillQualified} onClick={() => accept(o.offerId)}>Accept</button>
                <button className="pbtn" onClick={() => decline(o.offerId)}>Decline</button>
              </div>
            </div>
          );
        })}
      </Sheet>
      {(commitments.length > 0 || pending.length > 0) && (
        <Sheet title="Standing">
          <ul className="ink-muted text-sm">
            {commitments.map((c) => (
              <li key={c.offerId}>{c.label}: {Math.max(0, c.endWeek - game.clock.week)} weeks remaining</li>
            ))}
            {pending.map((p) => (
              <li key={p.topic}>A letter to the chancery about {p.topic.replace('_', ' ')}, sent {game.clock.week - p.askedWeek} week{game.clock.week - p.askedWeek === 1 ? '' : 's'} ago. No answer yet.</li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
