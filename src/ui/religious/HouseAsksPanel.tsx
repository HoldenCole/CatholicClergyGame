import { useGameStore } from '@/engine/store';
import { permissionOffers } from '@/systems/religious/poverty';
import { mayAskDispensation, preachingOf } from '@/systems/religious/study';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { friendSlots, friendsOf, mayBefriend } from '@/systems/religious/friendship';
import { officeOffers } from '@/systems/religious/offices';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';

/** What a friar asks for: permissions, a dispensation, a friendship named, an office accepted. E3 §3.4, §6.2, §7.2, §6.3. */
export default function HouseAsksPanel() {
  const game = useGameStore((s) => s.game);
  const askPermission = useGameStore((s) => s.askPermission);
  const askDispensation = useGameStore((s) => s.askDispensation);
  const befriend = useGameStore((s) => s.befriend);
  const acceptOffice = useGameStore((s) => s.acceptOffice);
  const line = useGameStore((s) => s.lastPriorLine);
  if (!game?.religious) return null;
  const house = currentHouse(game);
  if (!house) return null;
  const order = religiousOrder(game.religious.order);
  const offers = permissionOffers(game);
  const disp = mayAskDispensation(game);
  const dispensed = game.religious.dispensed && game.religious.dispensed.untilWeek > game.clock.week;
  const slots = friendSlots(game);
  const friends = friendsOf(game);
  const candidates = slots ? membersOf(game, house).filter((m) => mayBefriend(game, m.id).ok) : [];
  const offices = game.flags.ordained ? officeOffers(game) : [];
  const preaching = preachingOf(game);
  const held = game.religious.appointment ? order.offices.find((o) => o.id === game.religious!.appointment!.id) : undefined;
  return (
    <Panel title="Asking the prior">
      {line && <p className="mb-3 rounded border rule bg-white/30 p-3 text-sm italic">{line}</p>}
      <p className="ink-faint text-xs">You have no money. Every expense is a permission, and he remembers what he has said before.</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {offers.map((o) => (
          <li key={o.def.id} className="flex flex-col gap-1 rounded border rule bg-white/30 px-3 py-2">
            <span className="font-medium">{o.def.label} <span className="ink-faint text-xs">· ${o.def.cost.toLocaleString()}</span></span>
            <span className="ink-muted text-xs">{o.def.blurb} {o.available ? o.odds : ''}</span>
            {o.available ? (
              <button className="pbtn self-start px-2 py-0.5 text-xs" onClick={() => askPermission(o.def.id)}>Ask</button>
            ) : (
              <span className="ink-faint text-xs">{o.why}</span>
            )}
          </li>
        ))}
      </ul>
      {order.mechanics.studyDispensation && (
        <div className="mt-4 text-sm">
          <div className="heading text-sm">A dispensation for study</div>
          <p className="ink-muted text-xs">Lifted from the Hours and the table for a year, for the work; the brothers cover, and they remember it.</p>
          {dispensed ? (
            <p className="mt-1 text-xs">Dispensed until week {game.religious.dispensed!.untilWeek - game.clock.week} from now.</p>
          ) : disp.ok ? (
            <button className="pbtn mt-1 px-2 py-0.5 text-xs" onClick={() => askDispensation()}>Petition the prior</button>
          ) : (
            <p className="ink-faint mt-1 text-xs">{disp.why}</p>
          )}
        </div>
      )}
      {preaching !== undefined && (
        <p className="mt-3 text-sm"><span className="heading">Preaching.</span> {preaching < 15 ? 'Nobody outside the house has heard you yet.' : preaching < 40 ? 'The parishes nearby know your name.' : preaching < 60 ? 'Pastors two dioceses over write to the prior for you.' : 'Invitations come from outside the province. It travels with you.'}</p>
      )}
      {slots > 0 && (
        <div className="mt-4 text-sm">
          <div className="heading text-sm">Close friends ({friends.length} of {slots})</div>
          <p className="ink-muted text-xs">A friend is almost a second director. One in another house costs hours to keep; a transfer that splits you hurts more than anything.</p>
          {friends.length > 0 && <p className="mt-1 text-xs">{friends.map((f) => `${f.title} ${f.name.first} ${f.name.last}`).join(', ')}.</p>}
          {friends.length < slots && candidates.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {candidates.slice(0, 6).map((m) => (
                <button key={m.id} className="pbtn px-2 py-0.5 text-xs" onClick={() => befriend(m.id)}>Name {m.title} {m.name.last}</button>
              ))}
            </div>
          )}
          {friends.length < slots && candidates.length === 0 && <p className="ink-faint mt-1 text-xs">No one here knows you well enough yet.</p>}
        </div>
      )}
      {game.flags.ordained && (
        <div className="mt-4 text-sm">
          <div className="heading text-sm">Offices</div>
          {held ? (
            <p className="text-xs">{held.label}, until the term runs. {held.line}</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs">
              {offices.map((o) => (
                <li key={o.def.id} className="flex items-center justify-between gap-2">
                  <span><span className="font-medium">{o.def.label}</span> · {o.def.line}</span>
                  {o.available ? <button className="pbtn px-2 py-0.5 text-xs" onClick={() => acceptOffice(o.def.id)}>Accept</button> : <span className="ink-faint">{o.why}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
