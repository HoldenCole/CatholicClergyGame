import { lifeLabel } from '@/systems/lives';
import { venueLabel, whatTheySay } from '@/systems/talk';
import { useGameStore } from '@/engine/store';
import { currentHouse, houseLine, membersOf, playerIsPrior, priorOf } from '@/systems/religious/house';
import { horariumRows } from '@/systems/religious/horarium';
import { formationStage } from '@/systems/religious/formation';
import { pietyLabelsOf } from '@/systems/religious/feel';
import { friendsOf } from '@/systems/religious/friendship';
import { religiousOrder } from '@/content/religious';
import { instituteDef } from '@/content/institutes';
import { standing } from '@/systems/reputation';
import type { Quality } from '@/types';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

const BUILT: Record<string, string> = { chapel_restoration: 'a restored chapel', library_wing: 'a library wing', guest_wing: 'a guest wing', church_expansion: 'an enlarged church', classrooms: 'classrooms', studium_wing: 'a new wing', novitiate_wing: 'an enlarged novitiate', school: 'a school of its own' };

const QUALITIES: Quality[] = ['min', 'standard', 'invested'];
const QUALITY_WORD: Record<Quality, string> = { min: 'Least', standard: 'As the house does', invested: 'Fully' };

function word(v: number): string {
  if (v >= 40) return 'warm';
  if (v >= 15) return 'well enough';
  if (v > -15) return 'no view yet';
  if (v > -40) return 'cool';
  return 'against you';
}

/** The house: the men, the prior, how it lives, and the common life as the man keeps it. E3 §3.2–3.3. */
export default function HousePanel() {
  const game = useGameStore((s) => s.game);
  const setHorarium = useGameStore((s) => s.setHorarium);
  const setCappa = useGameStore((s) => s.setCappa);
  if (!game?.religious) return null;
  const house = currentHouse(game);
  if (!house) return null;
  const order = religiousOrder(game.religious.order);
  const prior = priorOf(game, house);
  const members = membersOf(game, house);
  const year = yearOf(game.clock.startDay, game.clock.week);
  const stage = formationStage(game);
  const rep = game.character?.reputation;
  const friends = new Set(friendsOf(game).map((f) => f.id));
  const rows = horariumRows(game);
  const habit = instituteDef(order.instituteId)?.habit;
  const load = rows.reduce((n, r) => n + r.ap, 0);
  return (
    <Panel title={house.name}>
      <p className="leading-relaxed">{houseLine(game, house)}{house.buildings?.length ? ` It has ${house.buildings.map((id) => BUILT[id] ?? id).join(', ')}.` : ''}</p>
      <p className="ink-muted mt-1 text-sm">
        {order.short}, {game.province?.name ?? 'the province'}. {game.religious.religiousName ? `In the house you are ${game.religious.religiousName}. ` : ''}
        {stage ? `${stage.label}, under the ${stage.guide}. ` : ''}
        {rep ? `The house: ${word(standing(rep, 'community'))}. The province: ${word(standing(rep, 'province'))}. The provincial's council: ${word(standing(rep, 'superiors'))}.` : ''}
      </p>
      {playerIsPrior(game, house) ? (
        <p className="mt-2 text-sm">You are the {order.governance.priorTitle} of the house{game.religious.office ? `, in the ${Math.floor((game.clock.week - game.religious.office.startWeek) / 52) + 1}${['st', 'nd', 'rd'][Math.floor((game.clock.week - game.religious.office.startWeek) / 52)] ?? 'th'} year of a term of ${Math.round((game.religious.office.endWeek - game.religious.office.startWeek) / 52)}` : ''}. The desk is below.</p>
      ) : prior ? (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Portrait portrait={portraitForNpc(prior, year)} size={30} />
          <span>The {order.governance.priorTitle}, {prior.title} {prior.name.first} {prior.name.last}, {year - prior.birthYear}: {word(prior.relationship)} to you.</span>
        </p>
      ) : (
        <p className="ink-muted mt-2 text-sm">The house has no {order.governance.priorTitle} at the moment; the chapter will elect one.</p>
      )}
      <div className="mt-4">
        <div className="heading text-sm">The common life</div>
        <p className="ink-faint text-xs">Mandatory, before any work: {load} blocks a week. The minimum buys hours back and the whole house sees who is not in choir.</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-3 py-1.5">
              <span>
                <span className="font-medium">{r.label}</span>
                <span className="ink-faint block text-xs">{r.blurb}{r.dispensed ? ' Dispensed.' : ''} · {r.ap} blocks</span>
              </span>
              <span className="flex gap-1">
                {QUALITIES.filter((q) => q !== 'invested' || r.investable).map((q) => (
                  <button key={q} className={'pbtn px-2 py-0.5 text-xs ' + (r.quality === q ? 'pbtn-primary' : '')} onClick={() => setHorarium(r.key, q)} title={QUALITY_WORD[q]}>
                    {QUALITY_WORD[q]}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {habit && (
        <div className="mt-4 text-sm">
          <div className="heading text-sm">The habit</div>
          <p className="ink-faint text-xs">{habit.line}</p>
          {habit.cappa && (
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!game.religious.cappa} onChange={(e) => setCappa(e.target.checked)} />
              <span>Wear the {order.key === 'OP' ? 'black cappa and hood' : 'choir cloak'} over it</span>
            </label>
          )}
        </div>
      )}
      <div className="mt-4">
        <div className="heading text-sm">The men ({members.length})</div>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(m, year)} size={22} />
              <span>
                {m.title} {m.name.first} {m.name.last}, {year - m.birthYear}
                {lifeLabel(game, m) && <span className="ink-wine ml-2 text-xs">{lifeLabel(game, m)}</span>}
                {m.tags.includes('prior') ? ` · ${order.governance.priorTitle}` : Object.entries(house.officers ?? {}).find(([, id]) => id === m.id) ? ` · ${order.houseOffices.find((o) => o.id === Object.entries(house.officers ?? {}).find(([, id]) => id === m.id)![0])?.label.toLowerCase() ?? 'an office'}` : m.tags.includes('novice_master') ? ' · novice master' : m.tags.includes('master_of_students') ? ' · master of students' : m.tags.includes('vows:novice') ? ' · novice' : m.tags.includes('vows:simple') ? ' · student' : ''}
                {friends.has(m.id) ? ' · a close friend' : ''}
                <span className="ink-faint"> · {word(m.relationship)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {whatTheySay(game).length > 0 && (
        <div className="mt-4">
          <div className="heading text-sm">What the house is saying</div>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {whatTheySay(game).map((r) => (
              <li key={r.id} className={r.about === 'you' ? 'ink-wine' : ''}>
                <span className="ink-faint mr-1 text-xs">{venueLabel(r.venue)}:</span>{r.text}
                {r.answered === 'correct' && <span className="ink-faint ml-1 text-xs">(you set that straight)</span>}
                {r.answered === 'own' && <span className="ink-faint ml-1 text-xs">(you owned it)</span>}
                {r.reachedBishop && !r.answered && <span className="ink-faint ml-1 text-xs">(the bishop has heard)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4">
        <div className="heading text-sm">What this order is like</div>
        <ul className="ink-muted mt-1 flex flex-col gap-0.5 text-xs">
          {pietyLabelsOf(game).map((l) => <li key={l}>· {l}</li>)}
        </ul>
      </div>
    </Panel>
  );
}
