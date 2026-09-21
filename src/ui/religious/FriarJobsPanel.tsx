import { useGameStore } from '@/engine/store';
import { religiousOrder } from '@/content/religious';
import { apostolateDef, apostolateOffers, houseOfficeDef, houseOfficeOffers, requestChance, requestWord, REQUESTS } from '@/systems/religious/requests';
import { currentHouse, priorOf } from '@/systems/religious/house';
import Sheet from '../Sheet';

/**
 * The friar's jobs sheet: the offices of the house he can ask the prior
 * for, and the works beyond it he can write to the provincial for. The
 * prior answers at the table; the provincial in weeks. E3 §3.10.
 */
export default function FriarJobsPanel() {
  const game = useGameStore((s) => s.game);
  const askHouseOffice = useGameStore((s) => s.askHouseOffice);
  const resignHouseOffice = useGameStore((s) => s.resignHouseOffice);
  const file = useGameStore((s) => s.fileFriarRequest);
  const withdraw = useGameStore((s) => s.withdrawFriarRequest);
  const endApostolate = useGameStore((s) => s.endApostolate);
  const line = useGameStore((s) => s.lastPriorLine);
  if (!game?.religious || !game.character) return null;
  const r = game.religious;
  const order = religiousOrder(r.order);
  const house = currentHouse(game);
  const prior = house ? priorOf(game, house) : undefined;
  const held = houseOfficeDef(game);
  const work = apostolateDef(game);
  const offices = houseOfficeOffers(game);
  const offers = game.flags.ordained ? apostolateOffers(game) : [];
  const local = offers.filter((o) => o.def.kind === 'local');
  const moves = offers.filter((o) => o.def.kind === 'house');
  const req = r.request;
  const standing = req && !req.outcome;
  const weeks = req ? game.clock.week - req.week : 0;
  const title = order.governance.provincialTitle;
  const seeName = game.world?.diocese.visible.see ?? 'the see';

  return (
    <>
      <Sheet title="An office of the house">
        <p className="ink-muted text-xs leading-relaxed">
          In the {prior ? `${order.governance.priorTitle}'s` : "prior's"} gift, asked at the table and answered there. It takes blocks every week on top of the common life and pays a little back. One at a time; laid down before a year, the house remembers.
        </p>
        {line && <p className="mt-2 rounded border rule bg-white/30 p-3 text-sm italic">{line}</p>}
        {held ? (
          <div className="mt-2 text-sm">
            <p><span className="font-medium">{held.label}</span> · {held.ap} blocks a week. {held.line}</p>
            <button className="pbtn mt-1 px-2 py-0.5 text-xs" onClick={resignHouseOffice}>Lay it down</button>
          </div>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {offices.map((o) => (
              <li key={o.def.id} className="flex flex-col gap-1 rounded border rule bg-white/30 px-3 py-2">
                <span className="font-medium">{o.def.label} <span className="ink-faint text-xs">· {o.def.ap} blocks</span></span>
                <span className="ink-muted text-xs">{o.def.line}</span>
                {o.available ? (
                  <button className="pbtn self-start px-2 py-0.5 text-xs" onClick={() => askHouseOffice(o.def.id)}>Ask the prior</button>
                ) : (
                  <span className="ink-faint text-xs">{o.why}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      {game.flags.ordained && (
        <Sheet title={`A letter to the ${title}`}>
          <p className="ink-muted text-xs leading-relaxed">
            A work beyond the house's own, asked for by name. The {title} answers in {REQUESTS.waitWeeks[0]} to {REQUESTS.waitWeeks[1]} weeks against the province's need, your fit, and how often you have written. One letter stands at a time. A work in {seeName} is done from the house you live in; a house of the province is a move.
          </p>
          {req && (
            <div className="mt-2 rounded border rule bg-white/30 p-3 text-sm">
              {standing ? (
                <>
                  <p>Asked for <span className="font-medium">{req.label.toLowerCase()}</span>, {weeks === 0 ? 'this week' : `${weeks} week${weeks === 1 ? '' : 's'} ago`}. No answer yet.</p>
                  <button className="pbtn mt-1 px-2 py-0.5 text-xs" onClick={withdraw}>Withdraw the letter</button>
                </>
              ) : (
                <p className="ink-muted text-xs">The last letter, for {req.label.toLowerCase()}, was {req.outcome} {req.answeredWeek !== undefined ? `${game.clock.week - req.answeredWeek} weeks ago` : ''}.</p>
              )}
            </div>
          )}
          {work && (
            <div className="mt-2 text-sm">
              <p><span className="font-medium">{work.label}</span> · {work.ap} blocks a week, since {Math.floor((game.clock.week - r.apostolate!.startWeek) / 52)} year{Math.floor((game.clock.week - r.apostolate!.startWeek) / 52) === 1 ? '' : 's'}. {work.line}</p>
              <button className="pbtn mt-1 px-2 py-0.5 text-xs" onClick={endApostolate}>Give it up</button>
            </div>
          )}
          <div className="mt-3">
            <div className="heading text-sm">In this diocese, from the house</div>
            <ul className="mt-1 grid grid-cols-2 gap-2 text-sm">
              {local.map((o) => (
                <li key={o.def.id} className="flex flex-col gap-1 rounded border rule bg-white/30 px-3 py-2">
                  <span className="font-medium">{o.label} <span className="ink-faint text-xs">· {o.def.ap} blocks{o.def.bishop ? " · the bishop's appointment" : ''}</span></span>
                  <span className="ink-muted text-xs">{o.def.line}</span>
                  {o.available ? (
                    <span className="flex items-center gap-2">
                      <button className="pbtn px-2 py-0.5 text-xs" onClick={() => file(o.def.id)}>Write</button>
                      <span className="ink-faint text-xs">{requestWord(requestChance(game, o))}</span>
                    </span>
                  ) : (
                    <span className="ink-faint text-xs">{o.why}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <div className="heading text-sm">Houses of the province</div>
            {moves.length === 0 && <p className="ink-faint text-xs">No house of the kinds a man can ask for, beyond this one.</p>}
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {moves.map((o) => (
                <li key={`${o.def.id}:${o.houseId}`} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-3 py-1.5">
                  <span><span className="font-medium">{o.label}</span> <span className="ink-muted text-xs">· {o.def.line}</span></span>
                  {o.available ? (
                    <span className="flex items-center gap-2">
                      <span className="ink-faint text-xs">{requestWord(requestChance(game, o))}</span>
                      <button className="pbtn px-2 py-0.5 text-xs" onClick={() => file(o.def.id, o.houseId)}>Write</button>
                    </span>
                  ) : (
                    <span className="ink-faint text-xs">{o.why}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      )}
    </>
  );
}
