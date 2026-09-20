import { offerById } from '@/content/offers';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { evaluateAll } from '@/engine/conditions';
import { whyOffered } from '@/systems/doors';
import { studyProgram } from '@/content/study';
import { pendingAppointment } from '@/engine/appointment';
import { canDefer } from '@/engine/offers';
import type { ActiveOffer } from '@/types';

/** One letter: what it offers, why it came, what saying yes would mean, and the answers. Used on the Letters sheet and laid over the scene when it arrives. */
export default function OfferCard({ o }: { o: ActiveOffer }) {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptOffer);
  const decline = useGameStore((s) => s.declineOffer);
  const defer = useGameStore((s) => s.deferOffer);
  if (!game) return null;
  const asked = pendingAppointment(game);
  const here = game.world?.parishes.find((p) => p.id === game.assignment?.parishId);
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
      {def.accept.commitment?.away ? (() => {
        const program = studyProgram(def.accept.commitment!.away!);
        const years = Math.round(def.accept.commitment!.weeks / 52) || 1;
        return (
          <div className="mt-2 rounded border rule bg-white/40 px-3 py-2 text-xs leading-relaxed">
            <div className="font-medium">A new assignment, not an addition: {program?.label.toLowerCase() ?? 'a post'}, {years} {years === 1 ? 'year' : 'years'}.</div>
            <div className="ink-muted mt-1">
              {here ? `You would leave ${here.name} and live at ${program?.residence ?? 'the post'}; the parish becomes someone else's. ` : `You would live at ${program?.residence ?? 'the post'}. `}
              {def.from === '@bishop' || program?.release?.always
                ? 'Saying yes is an answer, not a move: the letter of appointment follows within the month, and it is the letter that moves you.'
                : 'Saying yes tells them you would go. The move is the bishop\'s to make: his letter of appointment follows within the month, or he keeps you where you are.'}
            </div>
          </div>
        );
      })() : def.accept.commitment && (
        <p className="ink-muted mt-1 text-xs">
          A commitment of {Math.round(def.accept.commitment.weeks / 4)} months{def.accept.commitment.apPerWeek > 0 ? ', on top of everything else' : ''}, alongside the parish.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button className="pbtn pbtn-primary" disabled={!stillQualified || (!!asked && !!def.accept.commitment?.away)} title={asked && def.accept.commitment?.away ? "The bishop's answer to your last yes has not come" : undefined} onClick={() => accept(o.offerId)}>{def.accept.commitment?.away ? 'Say yes' : 'Accept'}</button>
        {canDefer(def) && <button className="pbtn" title="A smaller cost than a no: they keep your name, and the letter comes again in a year or two, likelier for the asking" onClick={() => defer(o.offerId)}>Not now, keep my name</button>}
        <button className="pbtn" onClick={() => decline(o.offerId)}>Decline</button>
      </div>
    </div>
  );
}
