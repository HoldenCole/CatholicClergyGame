import { useGameStore } from '@/engine/store';
import { currentHouse, playerIsPrior } from '@/systems/religious/house';
import { houseRules, mayGovern, officerRows, purseOffers, ruleOf } from '@/systems/religious/priorDesk';
import { buildDef, buildOffers, capacityOf, expectedHouseVocations, grantChance, houseMoney, mayAskGrant } from '@/systems/religious/growth';
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
  const startBuild = useGameStore((s) => s.startBuild);
  const askBuildGrant = useGameStore((s) => s.askBuildGrant);
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
  const builds = buildOffers(game);
  const grant = mayAskGrant(game);
  const money = houseMoney(game, house);
  const draw = expectedHouseVocations(game, house);
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
        <div className="heading text-sm">The house's year</div>
        <p className="ink-faint text-xs">
          Beds for {capacityOf(house)}. The works bring about ${money.income.toLocaleString()} a year and the men cost about ${money.cost.toLocaleString()}.
          {' '}The house draws {draw >= 1.5 ? 'men every year' : draw >= 0.8 ? 'a man most years' : draw >= 0.4 ? 'a man some years' : 'few men'}: its kind, its works, how it keeps the common life, what it has built, and the {title}'s own name.
          {house.grew ? ` Last year ${house.grew.entered ? `${house.grew.entered} entered` : 'nobody entered'}${house.grew.died ? `, ${house.grew.died} died` : ''}${house.grew.left ? `, ${house.grew.left} left` : ''}.` : ''}
        </p>
      </div>
      <div className="mt-4">
        <div className="heading text-sm">Building</div>
        <p className="ink-faint text-xs">
          {house.build ? `Under way: ${buildDef(house.build.id)?.label.toLowerCase() ?? house.build.id}, done in about ${Math.max(1, Math.round((house.build.endWeek - game.clock.week) / 4))} months.` : 'One thing at a time, from the purse; the province can be asked for half.'}
          {house.buildings?.length ? ` Built: ${house.buildings.map((id) => buildDef(id)?.label.toLowerCase() ?? id).join(', ')}.` : ''}
        </p>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {builds.filter((b) => b.why !== 'Built').map((b) => (
            <li key={b.def.id} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-3 py-1">
              <span className="min-w-0">
                <span className="font-medium">{b.def.label}</span> <span className="ink-faint text-xs">· ${b.def.cost.toLocaleString()} · {b.def.weeks < 52 ? `${b.def.weeks} weeks` : `${Math.round((b.def.weeks / 52) * 10) / 10} years`}</span>
                <span className="ink-faint block text-xs">{b.def.blurb}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button className="pbtn px-2 py-0 text-xs" disabled={!b.available} title={b.available ? 'Begin it' : b.why} onClick={() => startBuild(b.def.id)}>{b.available ? 'begin it' : b.why.length > 40 ? 'not yet' : b.why.toLowerCase()}</button>
                {mine && !b.available && b.def.cost > house.budget && !house.build && (
                  <button className="pbtn px-2 py-0 text-xs" disabled={!grant.ok} title={grant.ok ? `Ask the province for half. ${Math.round(grantChance(game, b.def) * 100)}% they say yes.` : grant.why} onClick={() => askBuildGrant(b.def.id)}>ask the province</button>
                )}
              </span>
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
