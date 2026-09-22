import { useGameStore } from '@/engine/store';
import { currentHouse, houseLine } from '@/systems/religious/house';
import { horariumLoad } from '@/systems/religious/horarium';
import { currentPosting } from '@/systems/religious/transfer';
import { friendshipLoad } from '@/systems/religious/friendship';
import { apostolateDef, houseOfficeDef, requestsLoad } from '@/systems/religious/requests';
import { BISHOP_ASKS } from '@/systems/religious/bishopAsks';
import { chanceryAskDef } from '@/systems/religious/bishopAsks';
import { spendBudget, spendBuilds, spendCost, spendOffered, spendsOf, spendsUsed } from '@/systems/religious/spends';
import { spendDefs } from '@/content/religious';
import Sheet from '../Sheet';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';
import DigestPanel from '../DigestPanel';

const WORK: Record<string, string> = {
  parish: 'the parish the house serves',
  school: 'the school',
  teaching: 'the house of studies, teaching',
  formation: 'the formation house',
  priory_church: 'the priory church and the pulpit',
  preaching: 'the pulpit',
  mission: 'the mission',
  curia: "the provincial's house",
};

/** An ordained friar's week without a parish loop of his own: the house's, and the posting's. E3 §3.3. */
export default function FriarWeekPanel() {
  const game = useGameStore((s) => s.game);
  const setSpend = useGameStore((s) => s.setSpend);
  if (!game?.religious) return null;
  const house = currentHouse(game);
  const posting = currentPosting(game);
  const order = religiousOrder(game.religious.order);
  const load = horariumLoad(game) + friendshipLoad(game);
  const office = houseOfficeDef(game);
  const work = apostolateDef(game) ?? chanceryAskDef(game);
  const extra = requestsLoad(game);
  return (
    <>
      <Panel title="The week">
        <p className="leading-relaxed">{house ? houseLine(game, house) : ''}</p>
        <p className="ink-muted mt-2 text-sm">
          The common life takes {load} blocks before anything else; the House sheet sets how you keep it. Your work is {WORK[posting?.work ?? ''] ?? 'the house\'s'}{game.religious.office ? `, and you are ${game.religious.office.office === 'prior' ? order.governance.priorTitle : order.governance.provincialTitle}` : game.religious.appointment ? `, and you hold the office of ${order.offices.find((o) => o.id === game.religious!.appointment!.id)?.label.toLowerCase() ?? 'an appointment'}` : ''}.
          {office ? ` In the house you are ${office.label.toLowerCase()}, ${office.ap} blocks a week.` : ''}
          {work ? ` Beyond the house: ${work.label.toLowerCase()}, ${work.ap} blocks a week.` : ''}
          {game.religious.pastorTask ? ` For ${game.npcs[game.religious.pastorTask.pastorId] ? `${game.npcs[game.religious.pastorTask.pastorId]!.title} ${game.npcs[game.religious.pastorTask.pastorId]!.name.last}` : 'a pastor'}: ${game.religious.pastorTask.label.toLowerCase()}, ${game.religious.pastorTask.ap} blocks a week.` : ''}
          {extra ? ` The office, the work, and the asks take ${extra} blocks more.` : ''}
          {game.religious.deanery ? ' The parish sits in a deanery of the diocese: its sheet is beside the house\'s.' : ''}
        </p>
        <p className="ink-faint mt-2 text-xs">The provincial assigns you for a term of three to six years and consults you before each letter. A parish entrusted to the order is held by two keys. Chapters elect the prior and the provincial, and you watch the ballots.</p>
      </Panel>
      {game.flags.ordained && (() => {
        const budget = spendBudget(game);
        const used = spendsUsed(game);
        const left = Math.round((budget - used) * 4) / 4;
        const spends = spendsOf(game);
        return (
          <Sheet title="Your hours">
            <p className="ink-muted text-xs leading-relaxed">
              The week is {BISHOP_ASKS.weekBlocks} blocks with the common life counted in; after it, the office, the work, and the asks, {budget} block{budget === 1 ? '' : 's'} are yours. Keeping the common life at its least buys blocks back, and the whole house sees who is not in choir.
              {left > 0 ? ` ${left} still unspoken for; they go nowhere in particular.` : ' All of them are given.'} What they build, they build slowly, and the province comes to know you by it.
              {used > 0 && <button className="pbtn-link ml-2" onClick={() => { for (const d of spendDefs) if ((spends[d.id] ?? 0) > 0) setSpend(d.id, 0); }}>clear them</button>}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {spendDefs.map((d) => {
                const ap = spends[d.id] ?? 0;
                const offered = spendOffered(game, d);
                const cost = spendCost(game, d.id, 1);
                const canAdd = offered.ok && ap < d.maxAp && left >= cost - 1e-6;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={'min-w-0 ' + (offered.ok ? '' : 'ink-faint')} title={d.blurb}>
                      {d.label}
                      <span className="ink-faint ml-2 text-xs">{offered.ok ? spendBuilds(d) : offered.why}{cost !== 1 && offered.ok ? ` · ${cost} a block` : ''}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button className="pbtn px-2 py-0 text-xs" disabled={ap === 0} onClick={() => setSpend(d.id, ap - 1)}>−</button>
                      <span className="w-5 text-center font-mono text-xs">{ap}</span>
                      <button className="pbtn px-2 py-0 text-xs" disabled={!canAdd} onClick={() => setSpend(d.id, ap + 1)}>+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Sheet>
        );
      })()}
      <DigestPanel />
    </>
  );
}
