import { useGameStore } from '@/engine/store';
import { askDef, castOf, connectedTo, favourOffers, houseKindLine, houseLine, housesOf, houseWorkOffers, regardWord, standingOf } from '@/systems/houses';
import Sheet from '../Sheet';

/**
 * The houses of the diocese: what each one is, what it thinks of you, what it
 * will do for the parish, and what it has asked of you. DESIGN §9.4a — the
 * favours are the order's to give, and the provincial can end any of them.
 */
export default function HousesPanel() {
  const game = useGameStore((s) => s.game);
  const ask = useGameStore((s) => s.askHouseFavour);
  const answer = useGameStore((s) => s.answerHouseAsk);
  const work = useGameStore((s) => s.doHouseWork);
  const line = useGameStore((s) => s.lastHouseLine);
  if (!game) return null;
  const houses = housesOf(game);
  if (houses.length === 0) return null;
  const offers = favourOffers(game);
  const works = houseWorkOffers(game);

  return (
    <Sheet title="The houses of the diocese">
      <p className="ink-muted text-xs leading-relaxed">
        They were here before you and they answer to a provincial in another state. Nothing they do for the parish is owed, an hour a week in the routine is the only thing that builds it, and what they give the provincial can end without notice.
      </p>
      {line && <p className="mt-2 text-sm">{line}</p>}
      <ul className="mt-3 flex flex-col gap-4">
        {houses.map((h) => {
          const s = standingOf(game, h.id);
          const asked = s.ask ? askDef(s.ask.id) : undefined;
          const mine = offers.filter((o) => o.house.id === h.id && (!o.def.order || o.def.order === h.order));
          return (
            <li key={h.id}>
              <div className="font-semibold">{h.name}</div>
              <div className="ink-muted text-xs leading-relaxed">{h.line}</div>
              {houseKindLine(h) && <div className="ink-faint mt-1 text-xs leading-relaxed">{houseKindLine(h)}</div>}
              {castOf(game, h).length > 0 && (
                <ul className="mt-1 text-xs">
                  {castOf(game, h).map(({ npc, line }) => (
                    <li key={npc.id}><span className="font-semibold">{npc.title} {npc.name.first} {npc.name.last}</span><span className="ink-muted">, {line}</span></li>
                  ))}
                </ul>
              )}
              <div className="ink text-xs mt-1">{houseLine(game, h)}</div>
              {asked && s.ask && (
                <div className="mt-2 rounded border rule bg-white/40 px-2 py-1.5">
                  <div className="text-sm">{asked.label}: <span className="ink-muted">{asked.blurb}</span></div>
                  <div className="ink-faint text-xs">It would cost you {asked.costs}. They will take silence for an answer in {Math.max(1, s.ask.dueWeek - game.clock.week)} week{s.ask.dueWeek - game.clock.week === 1 ? '' : 's'}.</div>
                  <div className="mt-1 flex gap-1">
                    <button className="pbtn px-2 py-0.5 text-xs" onClick={() => answer(h.id, true)}>Say yes</button>
                    <button className="pbtn px-2 py-0.5 text-xs" onClick={() => answer(h.id, false)}>Say no</button>
                  </div>
                </div>
              )}
              <ul className="mt-2 flex flex-col gap-1">
                {mine.map((o) => (
                  <li key={o.def.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div>{o.def.label}{o.standing && <span className="ink-faint text-xs"> · standing</span>}</div>
                      <div className="ink-faint text-xs">{o.def.gives}{o.def.money ? ` · $${o.def.money.toLocaleString()} to them` : ''}</div>
                    </div>
                    <button
                      className="pbtn shrink-0 px-2 py-0 text-xs"
                      disabled={!o.available}
                      title={o.available ? o.def.blurb : o.why}
                      onClick={() => ask(h.id, o.def.id)}
                    >
                      {o.available ? 'ask' : o.why.toLowerCase()}
                    </button>
                  </li>
                ))}
              </ul>
              {connectedTo(game, h, 45) && (
                <div className="mt-2 rounded border rule bg-white/30 px-2 py-1.5">
                  <div className="ink-faint text-[11px] uppercase tracking-[0.18em]">Their future here</div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {works.filter((w) => w.house.id === h.id).map((w) => (
                      <li key={w.def.id} className="flex items-start justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div>{w.def.label}{w.standing && <span className="ink-faint text-xs"> · standing</span>}</div>
                          <div className="ink-faint text-xs">{w.def.gives} · ${w.def.money.toLocaleString()}{w.def.standing ? ' a year' : ''}</div>
                        </div>
                        <button className="pbtn shrink-0 px-2 py-0 text-xs" disabled={!w.available} title={w.available ? w.def.blurb : w.why} onClick={() => work(h.id, w.def.id)}>
                          {w.available ? 'do it' : w.why.toLowerCase()}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="ink-faint mt-3 text-xs">Standing, in their words: {regardWord(Math.max(...houses.map((h) => standingOf(game, h.id).regard)))}.</p>
    </Sheet>
  );
}
