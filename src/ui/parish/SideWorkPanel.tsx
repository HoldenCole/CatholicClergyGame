import { useGameStore } from '@/engine/store';
import { workLine, workOf, workOffers, worksDone } from '@/systems/sidework';
import { hoursOf } from '@/systems/week';
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
          <p className="ink-faint mt-1 text-xs">
            {desk ? `${work.def.apPerWeek} block${work.def.apPerWeek === 1 ? '' : 's'}` : `${hoursOf(work.def.apPerWeek)} hours`} of every week, taken off the top before anything else.
            <button className="pbtn-link ml-2" onClick={() => drop()}>put it down</button>
          </p>
        </>
      ) : (
        <>
          <p className="ink-muted text-xs leading-relaxed">
            {desk
              ? 'A friar can have one thing on the desk beside the house\'s work: a paper, a translation, a course, a degree, the novices\' catechesis. It takes blocks of every week until it is done, it lands or it does not, and the province comes to know a man by what he finished.'
              : 'A man can do one thing besides the parish. It takes an hour or two of every week for years, it reaches a point where it either lands or it does not, and it is the part of a priesthood that nobody assigns him.'}
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {offers.map((o) => (
              <li key={o.def.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div>{o.def.label} <span className="ink-faint text-xs">· {desk ? `${o.def.apPerWeek} block${o.def.apPerWeek === 1 ? '' : 's'}` : `${hoursOf(o.def.apPerWeek)} hours`} a week · {o.def.weeks < 40 ? `${o.def.weeks} weeks` : (() => { const y = Math.max(1, Math.round(o.def.weeks / 52)); return `about ${y} year${y === 1 ? '' : 's'}`; })()}</span></div>
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
