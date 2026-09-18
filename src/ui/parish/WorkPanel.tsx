import { useGameStore } from '@/engine/store';
import { workLine, workOf, workOffers, worksDone } from '@/systems/sidework';
import { hoursOf } from '@/systems/week';
import { brotherLines, favoursFrom } from '@/systems/brothers';
import Sheet from '../Sheet';

/**
 * Two sheets about the half of a life that is not the parish: the thing he is
 * making besides it (DESIGN §8.8), and the men he was ordained with, whom he
 * has either kept up with or not (§9.5).
 */
export default function WorkPanel() {
  const game = useGameStore((s) => s.game);
  const start = useGameStore((s) => s.startSideWork);
  const drop = useGameStore((s) => s.dropSideWork);
  const ask = useGameStore((s) => s.askBrother);
  const line = useGameStore((s) => s.lastHouseLine);
  if (!game?.character) return null;
  const work = workOf(game);
  const offers = workOffers(game);
  const done = worksDone(game);
  const men = brotherLines(game);

  return (
    <>
      <Sheet title="Besides the parish">
        {work ? (
          <>
            <p className="text-sm">{workLine(game)}</p>
            <p className="ink-muted mt-1 text-xs">{work.def.blurb}</p>
            <p className="ink-faint mt-1 text-xs">
              {hoursOf(work.def.apPerWeek)} hours of every week, taken off the top before anything else.
              <button className="pbtn-link ml-2" onClick={() => drop()}>put it down</button>
            </p>
          </>
        ) : (
          <>
            <p className="ink-muted text-xs leading-relaxed">
              A man can do one thing besides the parish. It takes an hour or two of every week for years, it reaches a point where it either lands or it does not, and it is the part of a priesthood that nobody assigns him.
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {offers.map((o) => (
                <li key={o.def.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div>{o.def.label} <span className="ink-faint text-xs">· {hoursOf(o.def.apPerWeek)} hours a week · about {Math.round(o.def.weeks / 52)} year{Math.round(o.def.weeks / 52) === 1 ? '' : 's'}</span></div>
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

      <Sheet title="The men you were ordained with">
        <p className="ink-muted text-xs leading-relaxed">
          A diocesan priest has no community and no rule. What he has is the men who were in the same building at twenty-four, and whichever of them he has bothered to keep up with. The hours in the routine go to whoever he has left longest.
        </p>
        {line && <p className="mt-2 text-sm">{line}</p>}
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {men.map(({ npc, regard, kept }) => {
            const favours = favoursFrom(game, npc);
            const open = favours.filter((f) => f.available);
            return (
              <li key={npc.id}>
                <div>
                  {npc.title || 'Fr.'} {npc.name.first} {npc.name.last}
                  <span className="ink-faint ml-2 text-xs">{regard} · last {kept}</span>
                </div>
                {open.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {open.map((f) => (
                      <button key={f.def.id} className="pbtn px-2 py-0.5 text-xs" title={f.def.blurb} onClick={() => ask(npc.id, f.def.id)}>
                        {f.def.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ink-faint text-xs">{favours[0]?.why ?? 'Nothing to ask of him just now.'}</div>
                )}
              </li>
            );
          })}
          {men.length === 0 && <li className="ink-faint">Nobody yet. The men you are ordained with arrive with ordination.</li>}
        </ul>
        <p className="ink-faint mt-2 text-xs">A favour costs something with the man who does it. That is what makes it a favour.</p>
      </Sheet>
    </>
  );
}
