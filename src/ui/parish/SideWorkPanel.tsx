import { useGameStore } from '@/engine/store';
import { workLine, workOf, workOffers, worksDone } from '@/systems/sidework';
import Sheet from '../Sheet';

/** The thing he is making besides the parish (DESIGN §8.8): a book, a translation, the radio hour. On the You sheet, because it is his and not the parish's. */
export default function SideWorkPanel() {
  const game = useGameStore((s) => s.game);
  const start = useGameStore((s) => s.startSideWork);
  const drop = useGameStore((s) => s.dropSideWork);
  if (!game?.character || (!game.parish && !(game.religious && game.flags.ordained))) return null;
  const desk = !game.parish && !!game.religious;
  const work = workOf(game);
  const offers = workOffers(game);
  const done = worksDone(game);

  return (
    <Sheet title={desk ? 'The desk' : 'Besides the parish'}>
      {work ? (
        <>
          <p className="text-sm">{workLine(game)}</p>
          <p className="ink-muted mt-1 text-xs">{work.def.blurb}</p>
          {(() => {
            const elapsed = game.clock.week - work.state.startWeek;
            const share = Math.min(1, elapsed / Math.max(1, work.def.weeks));
            const next = work.def.milestones.find((_m, i) => !work.state.passed.includes(i));
            return (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded bg-black/10"><div className="h-full bg-black/40" style={{ width: `${Math.round(share * 100)}%` }} /></div>
                <p className="ink-faint mt-1 text-xs">
                  Week {elapsed} of {work.def.weeks}.
                  {work.state.passed.length > 0 && ` ${work.state.passed.length === 1 ? 'One milestone' : `${work.state.passed.length} milestones`} passed: ${work.state.passed.map((i) => work.def.milestones[i]?.line ?? '').filter(Boolean).join(' ')}`}
                  {next ? ` Next, at ${Math.round(next.at * 100)}%.` : ' Then it lands, or it does not.'}
                  {work.def.risk ? ` It can come to nothing at the end${work.def.risk.unless ? ', unless what it needs is there by then' : ''}.` : ''}
                </p>
              </div>
            );
          })()}
          <p className="ink-faint mt-1 text-xs">
            In its own time, beside the week: it takes nothing from your hours.
            <button className="pbtn-link ml-2" onClick={() => drop()}>put it down</button>
          </p>
        </>
      ) : (
        <>
          <p className="ink-muted text-xs leading-relaxed">
            {desk
              ? 'A friar can have one thing on the desk beside the house\'s work: a paper, a translation, a course, a degree, the novices\' catechesis. It is done in its own time, beside the week, it lands or it does not, and the province comes to know a man by what he finished.'
              : 'A man can do one thing besides the parish. It is done in its own time, for years, beside the week; it reaches a point where it either lands or it does not, and it is the part of a priesthood that nobody assigns him.'}
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {offers.map((o) => (
              <li key={o.def.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div>{o.def.label} <span className="ink-faint text-xs">· {o.def.weeks < 40 ? `${o.def.weeks} weeks` : (() => { const y = Math.max(1, Math.round(o.def.weeks / 52)); return `about ${y} year${y === 1 ? '' : 's'}`; })()}</span></div>
                  <div className="ink-muted text-xs">{o.def.blurb}</div>
                </div>
                <button className="pbtn shrink-0 px-2 py-0 text-xs" disabled={!o.available} title={o.available ? 'Take it on' : o.why} onClick={() => start(o.def.id)}>
                  {o.available ? 'take it on' : o.why.toLowerCase()}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {done.length > 0 && <p className="ink-faint mt-3 text-xs">You have {done.join('; ')}.</p>}
    </Sheet>
  );
}
