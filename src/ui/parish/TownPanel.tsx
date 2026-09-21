import { useGameStore } from '@/engine/store';
import { regardWord, stateWord, townOf, townRegard } from '@/systems/town';
import Sheet from '../Sheet';

/** The town: the places around the parish, how each is doing, what its people make of him, and what the town remembers. DESIGN §8.9. */
export default function TownPanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.parish) return null;
  const town = townOf(game);
  if (!town) return <Sheet title="The town"><p className="ink-faint text-sm">No town yet. It is rolled when the week turns.</p></Sheet>;
  const week = game.clock.week;
  const since = (w: number) => { const y = Math.floor((week - w) / 52); return y <= 0 ? 'this year' : y === 1 ? 'a year' : `${y} years`; };
  return (
    <Sheet title={`The town: ${town.name}`}>
      <p className="ink-muted mb-2 text-xs">The places the parish lives among. The town is {regardWord(townRegard(town))}.</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {town.places.map((p) => (
          <li key={p.id} className={'border-t rule pt-1.5 ' + (p.state === 'closed' ? 'ink-muted' : '')}>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{p.name}</span>
                {p.owner && !p.name.includes(p.owner) && <span className="ink-muted"> · the {p.owner} family's</span>}
                <span className={'ml-2 text-xs ' + (p.state === 'thriving' ? 'text-[#3f7a3f]' : p.state === 'failing' || p.state === 'closing' ? 'ink-wine' : 'ink-faint')}>{stateWord(p.state)}{p.state !== 'open' ? `, ${since(p.sinceWeek)}` : ''}</span>
              </span>
              <span className="ink-muted shrink-0 text-xs">{regardWord(p.regard)}</span>
            </div>
            <p className="ink-muted text-xs leading-relaxed">{p.blurb}</p>
          </li>
        ))}
      </ul>
      <h4 className="mt-3 text-[11px] uppercase tracking-[0.18em] ink-faint">What the town remembers</h4>
      {town.memory.length === 0 ? (
        <p className="ink-faint text-sm">Nothing yet. The town remembers what is done in it, not what is said in church.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {[...town.memory].reverse().slice(0, 8).map((m, i) => (
            <li key={i}><span className="ink-faint mr-2 text-xs">{since(m.week) === 'this year' ? 'this year' : `${since(m.week)} ago`}</span>{m.text}</li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
