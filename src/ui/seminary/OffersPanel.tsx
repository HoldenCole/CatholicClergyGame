import { offerById } from '@/content/offers';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { evaluateAll } from '@/engine/conditions';
import Panel from '../Panel';

export default function OffersPanel() {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptOffer);
  const decline = useGameStore((s) => s.declineOffer);
  const outcome = useGameStore((s) => s.lastOfferOutcome);
  if (!game) return null;
  const open = game.offers;
  const commitments = game.commitments;
  if (open.length === 0 && commitments.length === 0 && !outcome) return null;

  return (
    <Panel title="Offers">
      {outcome && <p className="mb-3 rounded border border-stone-800 bg-stone-900 p-3 text-sm text-stone-300 leading-relaxed">{outcome}</p>}
      {open.map((o) => {
        const def = offerById(o.offerId);
        if (!def) return null;
        const weeksLeft = o.expiresWeek - game.clock.week;
        const stillQualified = evaluateAll(def.requires, game, o.bindings);
        const r = (t: string) => renderText(t, game, o.bindings);
        return (
          <div key={o.offerId} className="mb-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg">{r(def.title)}</h3>
              <span className="text-xs text-stone-500">
                {def.windowWeeks === 0 ? 'decide now' : weeksLeft <= 0 ? 'last week' : `${weeksLeft} week${weeksLeft === 1 ? '' : 's'} to decide`}
              </span>
            </div>
            <p className="mt-2 text-stone-200 leading-relaxed">{r(def.body)}</p>
            {def.accept.commitment && (
              <p className="mt-1 text-xs text-stone-500">
                A commitment of {Math.round(def.accept.commitment.weeks / 4)} months{def.accept.commitment.apPerWeek > 0 ? ', on top of everything else' : ''}.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className="rounded bg-amber-700 px-3 py-1.5 text-sm font-medium hover:bg-amber-600 disabled:opacity-40"
                disabled={!stillQualified}
                onClick={() => accept(o.offerId)}
              >
                Accept
              </button>
              <button className="rounded border border-stone-700 px-3 py-1.5 text-sm hover:bg-stone-800" onClick={() => decline(o.offerId)}>
                Decline
              </button>
            </div>
          </div>
        );
      })}
      {commitments.length > 0 && (
        <ul className="text-sm text-stone-400">
          {commitments.map((c) => (
            <li key={c.offerId}>
              {c.label}: {Math.max(0, c.endWeek - game.clock.week)} weeks remaining
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
