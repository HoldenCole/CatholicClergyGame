import { offerById } from '@/content/offers';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { evaluateAll } from '@/engine/conditions';
import { whyOffered } from '@/systems/doors';
import { studyProgram } from '@/content/study';
import { pendingAppointment } from '@/engine/appointment';
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
  const asked = pendingAppointment(game);
  const askedDef = asked ? offerById(asked.offerId) : undefined;
  const here = game.world?.parishes.find((p) => p.id === game.assignment?.parishId);

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
                <button className="pbtn" onClick={() => decline(o.offerId)}>Decline</button>
              </div>
            </div>
          );
        })}
      </Sheet>
      {(commitments.length > 0 || pending.length > 0 || asked) && (
        <Sheet title="Standing">
          <ul className="ink-muted text-sm">
            {asked && askedDef && (
              <li>You said yes to {renderText(askedDef.title, game)}. The bishop's letter is expected {asked.week - game.clock.week <= 0 ? 'this week' : `in ${asked.week - game.clock.week} week${asked.week - game.clock.week === 1 ? '' : 's'}`}; nothing moves until it comes.</li>
            )}
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
