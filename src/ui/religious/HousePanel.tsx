import { useGameStore } from '@/engine/store';
import { currentHouse, houseLine, membersOf, priorOf } from '@/systems/religious/house';
import { horariumRows } from '@/systems/religious/horarium';
import { formationStage } from '@/systems/religious/formation';
import { pietyLabelsOf } from '@/systems/religious/feel';
import { friendsOf } from '@/systems/religious/friendship';
import { religiousOrder } from '@/content/religious';
import { standing } from '@/systems/reputation';
import type { Quality } from '@/types';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

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
  const load = rows.reduce((n, r) => n + r.ap, 0);
  return (
    <Panel title={house.name}>
      <p className="leading-relaxed">{houseLine(game, house)}</p>
      <p className="ink-muted mt-1 text-sm">
        {order.short}, {game.province?.name ?? 'the province'}. {game.religious.religiousName ? `In the house you are ${game.religious.religiousName}. ` : ''}
        {stage ? `${stage.label}, under the ${stage.guide}. ` : ''}
        {rep ? `The house: ${word(standing(rep, 'community'))}. The province: ${word(standing(rep, 'province'))}. The provincial's council: ${word(standing(rep, 'superiors'))}.` : ''}
      </p>
      {prior && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Portrait portrait={portraitForNpc(prior, year)} size={30} />
          <span>The prior, {prior.title} {prior.name.first} {prior.name.last}, {year - prior.birthYear}: {word(prior.relationship)} to you.</span>
        </p>
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
      <div className="mt-4">
        <div className="heading text-sm">The men ({members.length})</div>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(m, year)} size={22} />
              <span>
                {m.title} {m.name.first} {m.name.last}, {year - m.birthYear}
                {m.tags.includes('prior') ? ' · prior' : m.tags.includes('novice_master') ? ' · novice master' : m.tags.includes('master_of_students') ? ' · master of students' : m.tags.includes('vows:novice') ? ' · novice' : m.tags.includes('vows:simple') ? ' · student' : ''}
                {friends.has(m.id) ? ' · a close friend' : ''}
                <span className="ink-faint"> · {word(m.relationship)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <div className="heading text-sm">What this order is like</div>
        <ul className="ink-muted mt-1 flex flex-col gap-0.5 text-xs">
          {pietyLabelsOf(game).map((l) => <li key={l}>· {l}</li>)}
        </ul>
      </div>
    </Panel>
  );
}
