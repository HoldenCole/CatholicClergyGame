import { offerById } from '@/content/offers';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { pendingAppointment } from '@/engine/appointment';
import Sheet from '../Sheet';
import OfferCard from './OfferCard';
import { mailbag } from '@/systems/mail';
import { dateOf } from '@/engine/time';
import { formatDate } from '@/engine/calendar';

/** Letters: open offers with their windows, and the commitments already made. */
export default function OffersPanel() {
  const game = useGameStore((s) => s.game);
  const outcome = useGameStore((s) => s.lastOfferOutcome);
  if (!game) return null;
  const open = game.offers;
  const commitments = game.commitments;
  const pending = Object.values(game.permissions).filter((p) => p.status === 'pending');
  const asked = pendingAppointment(game);
  const askedDef = asked ? offerById(asked.offerId) : undefined;
  const bag = mailbag(game).slice(0, 12);

  return (
    <>
      <Sheet title="Letters">
        {outcome && <p className="mb-3 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">{outcome}</p>}
        {open.length === 0 && !outcome && <p className="ink-faint text-sm">Nothing in the mail today.</p>}
        {open.map((o) => <OfferCard key={o.offerId} o={o} />)}
      </Sheet>
      {bag.length > 0 && (
        <Sheet title="The mailbag">
          <p className="ink-muted mb-2 text-xs">Letters from people, and what became of them. The past writes now and then; it is answered or it is not.</p>
          <ul className="flex flex-col gap-1 text-sm">
            {bag.map((m) => (
              <li key={`${m.mailId}:${m.week}`} className="flex items-baseline gap-2">
                <span className="ink-faint w-28 shrink-0 text-xs">{formatDate(dateOf(game.clock, m.week))}</span>
                <span className="min-w-0 flex-1">{/^From /.test(m.title) ? `${m.title}, ${m.from.who}` : `${m.title}, from ${m.from.name}, ${m.from.who}`}</span>
                <span className={'shrink-0 text-xs ' + (m.replied ? 'ink-muted' : m.asked ? 'ink-wine' : 'ink-faint')}>{m.replied ? m.repliedLabel : m.week === game.clock.week && !m.replied ? 'on the desk' : m.asked ? 'asked, and left' : 'left in the drawer'}</span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
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
