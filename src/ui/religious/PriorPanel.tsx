import { useGameStore } from '@/engine/store';
import { currentHouse, playerIsPrior } from '@/systems/religious/house';
import { houseRules, mayGovern, officerRows, purseOffers, ruleOf } from '@/systems/religious/priorDesk';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';

/**
 * The prior's desk. E3 §3.2, §3.10: the rule of the house, the offices in
 * his gift, and the purse held in common. Shown to the prior; to anyone else
 * it shows what the house's prior has set, greyed.
 */
export default function PriorPanel() {
  const game = useGameStore((s) => s.game);
  const setHouseRule = useGameStore((s) => s.setHouseRule);
  const nameOfficer = useGameStore((s) => s.nameOfficer);
  const spendPurse = useGameStore((s) => s.spendPurse);
  const line = useGameStore((s) => s.lastPriorLine);
  if (!game?.religious || !game.flags.ordained) return null;
  const house = currentHouse(game);
  if (!house) return null;
  const mine = playerIsPrior(game, house);
  const may = mayGovern(game);
  const order = religiousOrder(game.religious.order);
  const rule = ruleOf(house);
  const rows = officerRows(game);
  const purse = purseOffers(game);
  const title = order.governance.priorTitle;
  return (
    <Panel title={mine ? `The ${title}'s desk` : `The ${title}'s desk, seen from the table`}>
      {mine && line && <p className="mb-3 rounded border rule bg-white/30 p-3 text-sm italic">{line}</p>}
      <p className="ink-faint text-xs">
        {mine
          ? `The house is yours to govern for the term: how strictly it keeps the common life, who holds its offices, and what its purse is spent on. Every one of these is felt at supper.`
          : `The ${title} sets how the house keeps the common life, gives its offices, and holds its purse. ${may.why}.`}
      </p>
      <div className="mt-3">
        <div className="heading text-sm">The rule of the house</div>
        <p className="ink-faint text-xs">Observance now: {Math.round(house.observance)}{rule ? `; set toward ${rule.observance}, ${rule.label.toLowerCase()}` : '; no rule set beyond the province\'s custom'}. A house moves a point or so a week, and a house being moved rubs.</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {houseRules().map((r) => (
            <button key={r.id} className={'pbtn px-2 py-0.5 text-xs ' + (house.rule === r.id ? 'pbtn-primary' : '')} disabled={!mine} title={r.line} onClick={() => setHouseRule(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        {rule && <p className="ink-muted mt-1 text-xs">{rule.line}</p>}
      </div>
      <div className="mt-4">
        <div className="heading text-sm">The offices of the house</div>
        <p className="ink-faint text-xs">In the {title}'s gift. A house whose offices are filled runs; the man named is grateful, and a better-fitted man passed over notices.</p>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <li key={row.def.id} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-3 py-1">
              <span>
                <span className="font-medium">{row.def.label}</span>
                <span className="ink-faint block text-xs">{row.def.line}</span>
              </span>
              {mine ? (
                <select className="rounded border rule bg-white/60 px-1 py-0.5 text-xs" value={row.holder?.id ?? ''} onChange={(e) => nameOfficer(row.def.id, e.target.value || null)}>
                  <option value="">Vacant</option>
                  {row.candidates.map((c) => (
                    <option key={c.npc.id} value={c.npc.id} disabled={!!c.short}>
                      {c.npc.title} {c.npc.name.first} {c.npc.name.last}{c.short ? ` (short of ${c.short})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="ink-muted text-xs">{row.holder ? `${row.holder.title} ${row.holder.name.last}` : 'vacant'}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <div className="heading text-sm">The purse</div>
        <p className="ink-faint text-xs">Held in common: ${house.budget.toLocaleString()}. {mine ? 'What it is spent on, the house sees.' : ''}</p>
        <ul className="mt-1 grid grid-cols-2 gap-2 text-sm">
          {purse.map((o) => (
            <li key={o.def.id} className="flex flex-col gap-1 rounded border rule bg-white/30 px-3 py-2">
              <span className="font-medium">{o.def.label} <span className="ink-faint text-xs">· ${o.def.cost.toLocaleString()}</span></span>
              <span className="ink-muted text-xs">{o.def.blurb}</span>
              <button className="pbtn self-start px-2 py-0 text-xs" disabled={!o.available} title={o.available ? 'Spend it' : o.why} onClick={() => spendPurse(o.def.id)}>
                {o.available ? 'spend it' : o.why.toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
