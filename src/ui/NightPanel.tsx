import { useGameStore } from '@/engine/store';
import { eveningBlurb, eveningLabel, nightOf, nightWords } from '@/systems/night';
import { EVENING_KINDS } from '@/types';
import { dateOf } from '@/engine/time';
import { formatDate } from '@/engine/calendar';
import Sheet from './Sheet';

/** The house at night: what he does with an evening, and what the nights are. Words, never numbers. DESIGN §8.13. */
export default function NightPanel() {
  const game = useGameStore((s) => s.game);
  const setEvenings = useGameStore((s) => s.setEvenings);
  if (!game?.character || (!game.parish && !(game.religious && game.flags.ordained))) return null;
  const n = nightOf(game);
  const w = nightWords(game);
  const friar = !!game.religious && !game.parish;
  const bottle = !!game.flags['night:bottle'];
  const sober = game.flags['night:sober'];
  return (
    <Sheet title={friar ? 'The house at night' : 'The rectory at night'}>
      <p className="text-sm leading-relaxed">
        {w.company.charAt(0).toUpperCase() + w.company.slice(1)}; {w.rest}; {w.prayer}.
        {n.aloneWeeks >= 8 && <span className="ink-wine"> The nights have been alone and the days too much, for {n.aloneWeeks} weeks.</span>}
        {bottle && <span className="ink-wine"> There is a bottle in the evenings now.</span>}
        {typeof sober === 'number' && <span className="ink-muted"> Sober since {formatDate(dateOf(game.clock, sober))}.</span>}
      </p>
      <h4 className="ink-faint mt-3 text-[11px] uppercase tracking-[0.18em]">The evenings</h4>
      <div className="mt-1 flex flex-wrap gap-1">
        {EVENING_KINDS.map((k) => (
          <button key={k} className={'tab ' + (n.evenings === k ? 'tab-active' : '')} title={eveningBlurb(k)} onClick={() => setEvenings(k)}>{eveningLabel(k)}</button>
        ))}
      </div>
      <p className="ink-muted mt-1 text-xs leading-relaxed">{eveningBlurb(n.evenings)}</p>
      <p className="ink-faint mt-1 text-xs">The evenings are outside the week's hours. They decide how the nights rest you, whether the breviary is kept, and who is in the house.</p>
    </Sheet>
  );
}
