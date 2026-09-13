import { useGameStore } from '@/engine/store';
import { controlsMoney, debtPayable } from '@/systems/finance';
import { driversOf, HARD_KINDS, sinceArrival, wasDying } from '@/systems/trajectory';
import { hoursOf } from '@/systems/week';
import { NEED_LABEL } from '@/generation/diocese';
import { diocesePresets } from '@/content/dioceses';
import { workAvailability } from '@/systems/problems';
import { fundableGroups, mayInvest, spendAvailability, spendable, spendWords, SPENDING } from '@/systems/spending';
import { explainAlignment, explainAttendance, explainCollections, explainReputation, explainStat, reasonsLine } from '@/systems/movers';
import type { ConstituencyKey } from '@/types';
import { useUiStore } from '../uiStore';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { STAT_KEYS, CONSTITUENCY_KEYS } from '@/types';
import { useState } from 'react';
import { arcKey } from '@/llm/skin';
import Sheet from '../Sheet';
import TalkButton, { LastTalk } from './TalkButton';
import MassPanel from './MassPanel';
import { currentPreference, PREFERENCES, PREFERENCE_LABEL } from '@/systems/assignment';
import { TRAIT_LABEL } from '../portraits/traits';
import Portrait from '../portraits/Portrait';
import { portraitForCharacter, portraitForNpc, yearOf } from '../portraits/spec';

function word(v: number): string {
  if (v >= 50) return 'devoted';
  if (v >= 20) return 'warm';
  if (v > -10) return 'civil';
  if (v > -40) return 'cool';
  return 'hostile';
}

export default function ParishPanel() {
  const game = useGameStore((s) => s.game);
  const prose = useGameStore((s) => s.prose);
  const setPreference = useGameStore((s) => s.setPreference);
  const payDebt = useGameStore((s) => s.payDebt);
  const startWork = useGameStore((s) => s.startWork);
  const spend = useGameStore((s) => s.spend);
  const closeFund = useGameStore((s) => s.closeFund);
  const fundGroup = useGameStore((s) => s.fundGroup);
  const invest = useGameStore((s) => s.invest);
  const withdraw = useGameStore((s) => s.withdraw);
  const stopWork = useGameStore((s) => s.stopWork);
  const furnish = useUiStore((s) => s.furnish);
  const [inspect, setInspect] = useState(false);
  if (!game?.parish || !game.world || !game.character) return null;
  const portraitKey = arcKey(game);
  const portrait = portraitKey ? prose[portraitKey] : undefined;
  const c = game.character;
  const p = game.parish;
  const parish = game.world.parishes.find((x) => x.id === p.parishId)!;
  const pastor = game.npcs[parish.pastorId];
  const staff = p.staffIds.map((id) => game.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  const yearsIn = Math.floor(p.weeksServed / 52);
  const bishop = game.npcs[game.world.diocese.hidden.bishop.npcId];
  const fin = p.finance;
  const payable = debtPayable(game);
  const traj = sinceArrival(game);
  const workAv = workAvailability(game);
  const work = p.work;
  const year = yearOf(game.clock.startDay, game.clock.week);

  const whyRep = (key: ConstituencyKey): string => {
    const reasons = explainReputation(game, key);
    return reasons.length ? `This quarter: ${reasons.map((r) => `${r.label} ${r.amount > 0 ? '+' : ''}${Math.round(r.amount)}`).join(', ')}.` : 'Nothing has moved it this quarter; opinions drift back toward rest.';
  };
  const pews = explainAttendance(game);
  const whyPews = `Heading to ${Math.round(pews.target * 100)}%: ${pews.reasons.map((r) => `${r.label} ${r.amount > 0 ? '+' : ''}${r.amount}`).join(', ')}. Hover shows points of attendance.`;
  const plate = explainCollections(game);
  const whyPlate = `The usual is $${plate.usual.toLocaleString()}, then ${plate.factors.map((f) => `×${f.amount} for ${f.label}`).join(', ')}. Out of it each week: ${plate.costs.map((k) => `${k.label} $${Math.abs(k.amount).toLocaleString()}`).join(', ')}.`;
  return (
    <>
      <Sheet title={`${parish.name}, ${parish.place}${parish.founded ? ` (${parish.founded})` : ''}`}>
        <div className="flex items-start gap-4">
          <Portrait portrait={portraitForCharacter(c, year, game.phase)} size={72} title={`${c.name.first} ${c.name.last}`} />
          <p className="text-sm leading-relaxed">
            {c.name.first} {c.name.last}, {p.role.replace('_', ' ')}, {yearsIn === 0 ? 'first year' : `year ${yearsIn + 1}`}. {game.world.diocese.visible.name}
            {bishop ? `, under ${bishop.title} ${bishop.name.last}` : ''}.
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Standing label="The people" value={word(c.reputation.parishioners)} why={whyRep('parishioners')} />
          <Standing label="The chancery" value={word(c.reputation.chancery)} why={whyRep('chancery')} />
          <Standing label="Brother priests" value={word(c.reputation.brother_priests)} why={whyRep('brother_priests')} />
          <Standing label="Attendance" value={`${Math.round(p.attendance * 100)}% of the rolls`} why={whyPews} />
          <Standing label="Collections" value={`$${fin.averageCollection.toLocaleString()} a week`} why={whyPlate} />
          <div className="flex justify-between"><dt className="ink-muted">Cash</dt><dd>${fin.cash.toLocaleString()}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Debt</dt><dd>${fin.debt.toLocaleString()}</dd></div>
        </dl>
        {fin.debt > 0 && (
          <div className="mt-2 text-xs">
            {controlsMoney(game) ? (
              payable > 0 ? (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="ink-muted">Pay it down, keeping two months in hand:</span>
                  {[10000, 50000].filter((n) => n < payable).map((n) => (
                    <button key={n} className="pbtn px-2 py-0 text-xs" onClick={() => payDebt(n)}>${(n / 1000).toFixed(0)}k</button>
                  ))}
                  <button className="pbtn px-2 py-0 text-xs" onClick={() => payDebt(payable)}>${payable.toLocaleString()}{payable >= fin.debt ? ', all of it' : ''}</button>
                </span>
              ) : (
                <span className="ink-faint">Nothing to spare against the debt this week; the bills come first.</span>
              )
            ) : (
              <span className="ink-faint">The debt is the pastor's to pay down, not yours.</span>
            )}
          </div>
        )}
        {portrait && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{portrait}</p>}
      </Sheet>
      <MassPanel />
      <Sheet title={game.world.diocese.visible.name}>
        {(() => {
          const v = game.world!.diocese.visible;
          const preset = diocesePresets.find((p) => p.id === game.world!.diocese.presetId);
          const voice = preset?.voice;
          const week = game.clock.week;
          return (
            <>
              <p className="ink-muted text-xs leading-relaxed">{v.region}. {NEED_LABEL[v.clergyNeed]}. {v.character[0]}</p>
              {voice && (
                <p className="ink-faint mt-1 text-xs leading-relaxed">
                  {voice.weather[Math.floor(((week % 52) / 52) * voice.weather.length) % voice.weather.length]} {voice.sunday[week % voice.sunday.length]} {voice.presbyterate[Math.floor(week / 52) % voice.presbyterate.length]}
                </p>
              )}
            </>
          );
        })()}
      </Sheet>
      <Sheet title={traj ? `Since you arrived: ${traj.verdict.toLowerCase()}` : 'Since you arrived'}>
        {traj ? (
          <table className="w-full text-sm">
            <tbody>
              {traj.rows.map((r) => (
                <tr key={r.label}>
                  <td className="ink-muted py-0.5 pr-2">{r.label}</td>
                  <td className="ink-faint py-0.5 pr-2 text-xs">{r.then}</td>
                  <td className="py-0.5 pr-2">{r.now}</td>
                  <td className={'py-0.5 text-xs ' + (r.sign > 0 ? 'ink-green' : r.sign < 0 ? 'ink-wine' : 'ink-faint')}>{r.sign > 0 ? '▲ better' : r.sign < 0 ? '▼ worse' : 'the same'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ink-faint text-sm">No reading yet.</p>
        )}
        {traj && (
          <div className="mt-2 border-t rule pt-2">
            <div className="ink-muted text-xs font-medium">What is driving it</div>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {driversOf(game).map((d) => (
                <li key={d.label}><span className="ink-muted">{d.label}:</span> {d.lines.join(' ')}</li>
              ))}
            </ul>
            {(HARD_KINDS.has(parish.kind) || wasDying(game)) && (
              <p className={'mt-1 text-xs ' + (game.flags[`turnaround:${parish.id}`] ? 'ink-green' : 'ink-faint')}>
                {game.flags[`turnaround:${parish.id}`] ? 'The parish has said it, the bishop has written, and the board will remember it.' : 'A parish that was dying when you came. Turn it around and hold it a year, and the parish, the bishop, and the board will say so.'}
              </p>
            )}
          </div>
        )}
        {traj && <p className="ink-faint mt-2 text-xs">{Math.floor(traj.weeks / 52) > 0 ? `${Math.floor(traj.weeks / 52)} years and ` : ''}{traj.weeks % 52} weeks in. A quarter at a time is how a parish turns.</p>}
      </Sheet>
      {controlsMoney(game) && fin.debt <= 0 && (() => {
        const canSpend = spendable(game);
        const spends = spendAvailability(game);
        const standing = spends.filter((x) => x.standing);
        const may = mayInvest(game);
        const groups = fundableGroups(game);
        return (
          <Sheet title="The money">
            <p className="ink-muted text-xs leading-relaxed">
              The debt is paid. ${canSpend.toLocaleString()} can be spent with two months of running costs kept back
              {fin.endowment ? `, and $${fin.endowment.toLocaleString()} is invested` : ''}. Money that sits does nothing for anyone.
            </p>
            {standing.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {standing.map(({ def }) => (
                  <li key={def.id} className="flex items-center justify-between gap-2">
                    <span>{spendWords(game, def).label} <span className="ink-faint text-xs">· standing, ${(def.upkeep ?? 0).toLocaleString()} a week</span></span>
                    <button className="pbtn-link" onClick={() => closeFund(def.id)}>wind it up</button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {spends.filter((x) => !x.standing).map(({ def, available, why }) => (
                <li key={def.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={available ? '' : 'ink-muted'}>{spendWords(game, def).label} <span className="ink-faint text-xs">· ${def.cost.toLocaleString()}{def.upkeep ? ` and $${def.upkeep.toLocaleString()} a week` : ''}</span></div>
                    <div className="ink-faint text-xs">{available ? spendWords(game, def).blurb : why}</div>
                  </div>
                  {available && <button className="pbtn shrink-0 px-2 py-0 text-xs" onClick={() => spend(def.id)}>do it</button>}
                </li>
              ))}
            </ul>
            {groups.length > 0 && canSpend >= SPENDING.groupPerPoint * 5 && (
              <div className="mt-3 text-xs">
                <span className="ink-muted">Put money behind a group ($2,000 buys five points of life):</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {groups.map((g) => (
                    <button key={g.id} className="pbtn px-2 py-0 text-xs" onClick={() => fundGroup(g.id, Math.min(canSpend, SPENDING.groupPerPoint * 10))}>{g.name}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 text-xs">
              {may.ok ? (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="ink-muted">Invest it{fin.endowment ? ` (invested: $${fin.endowment.toLocaleString()})` : ''}:</span>
                  {[25000, 100000].filter((n) => n <= canSpend).map((n) => (
                    <button key={n} className="pbtn px-2 py-0 text-xs" onClick={() => invest(n)}>${(n / 1000).toFixed(0)}k</button>
                  ))}
                  {canSpend > 0 && <button className="pbtn px-2 py-0 text-xs" onClick={() => invest(canSpend)}>all of it</button>}
                  {(fin.endowment ?? 0) > 0 && <button className="pbtn-link" onClick={() => withdraw(fin.endowment ?? 0)}>bring it back</button>}
                </span>
              ) : (
                <span className="ink-faint">Investing it: {may.why}.</span>
              )}
            </div>
          </Sheet>
        );
      })()}
      <Sheet title="The problem">
        <p className="text-sm">{parish.problem === 'none' ? 'Nothing is on fire. It will not last.' : (PROBLEM_LABEL[parish.problem] ?? parish.problem)}</p>
        {work && workAv.fix ? (
          <p className="ink-muted mt-2 text-xs">
            In hand: {workAv.fix.label.toLowerCase()}, {Math.max(0, work.endWeek - game.clock.week)} weeks to go at {hoursOf(work.apPerWeek)} hours a week.
            <button className="pbtn-link ml-2" onClick={stopWork}>let it drop</button>
          </p>
        ) : workAv.fix ? (
          <div className="mt-2 text-xs">
            <p className="ink-muted">{workAv.fix.label}: {workAv.fix.blurb} {workAv.fix.weeks} weeks at {hoursOf(workAv.fix.apPerWeek)} hours a week{workAv.fix.cost > 0 ? `, about $${workAv.fix.cost.toLocaleString()} from the parish` : ''}.</p>
            {workAv.available ? (
              <button className="pbtn mt-1" onClick={startWork}>Take it on</button>
            ) : (
              <p className="ink-faint mt-1">{workAv.why}</p>
            )}
          </div>
        ) : workAv.why ? (
          <p className="ink-faint mt-1 text-xs">{workAv.why}</p>
        ) : null}
        <p className="ink-muted mt-3 text-xs">
          What the parish sings, how the altar stands, where the choir is: <button className="pbtn-link" onClick={() => furnish('church')}>the church</button> is yours to change, within what the bishop allows.
        </p>
      </Sheet>
      <Sheet title="The rectory and the office">
        <ul className="flex flex-col gap-1.5 text-sm">
          {[...(pastor && pastor.id !== 'player' ? [pastor] : []), ...staff].map((n) => (
            <li key={n.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(n, year)} size={26} />
              <span className="min-w-0 flex-1 truncate">
                {n.title ? `${n.title} ` : ''}{n.name.first} {n.name.last}, {n.id === pastor?.id ? 'pastor' : (n.tags[0] ?? '').replace('_', ' ')}
                {n.traitKnown && <span className="ink-faint ml-2 text-xs">{TRAIT_LABEL[n.hiddenTrait]}</span>}
              </span>
              <span className="ink-muted">{word(n.relationship)}</span>
              <TalkButton npcId={n.id} />
            </li>
          ))}
          {bishop && (
            <li className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(bishop, year)} size={26} />
              <span className="min-w-0 flex-1 truncate">{bishop.title} {bishop.name.first} {bishop.name.last}, the bishop</span>
              <span className="ink-muted">{word(bishop.relationship)}</span>
              <TalkButton npcId={bishop.id} />
            </li>
          )}
        </ul>
        <LastTalk npcIds={[...staff.map((n) => n.id), ...(pastor ? [pastor.id] : []), ...(bishop ? [bishop.id] : [])]} />
        {game.commitments.length > 0 && <p className="ink-muted mt-2 text-xs">Also on your plate: {game.commitments.map((x) => x.label).join(', ')}.</p>}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="ink-muted">What you have asked the chancery for</span>
          <select className="pinput text-xs" value={currentPreference(game) ?? 'wherever'} onChange={(e) => setPreference(e.target.value as (typeof PREFERENCES)[number])}>
            {PREFERENCES.map((p) => (
              <option key={p} value={p}>{PREFERENCE_LABEL[p].label}</option>
            ))}
          </select>
        </div>
        <button className="pbtn-link mt-3" onClick={() => setInspect((v) => !v)}>
          {inspect ? 'Hide the numbers' : 'Inspect the numbers'}
        </button>
        {inspect && (
          <div className="ink-muted mt-2 grid grid-cols-2 gap-x-6 font-mono text-xs">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex justify-between" title={reasonsLine(explainStat(game, k), 1)}><span>{k}</span><span>{c.stats[k].toFixed(1)}</span></div>
            ))}
            <div className="flex justify-between" title={reasonsLine(explainAlignment(game))}><span>alignment</span><span>{c.alignment.toFixed(0)}</span></div>
            <div className="col-span-2 mt-1 font-sans text-[11px] leading-relaxed">
              {STAT_KEYS.map((k) => ({ k, r: explainStat(game, k) })).filter((x) => x.r.length).map((x) => <div key={x.k}>{x.k}: {x.r.map((r) => `${r.label} ${r.amount > 0 ? '+' : ''}${r.amount.toFixed(1)}`).join(', ')}.</div>)}
              {explainAlignment(game).length > 0 && <div>alignment: {explainAlignment(game).map((r) => `${r.label} ${r.amount > 0 ? '+' : ''}${r.amount.toFixed(0)}`).join(', ')}.</div>}
            </div>
            <div className="flex justify-between"><span>outspokenness</span><span>{c.outspokenness.toFixed(0)}</span></div>
            {CONSTITUENCY_KEYS.map((k) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.reputation[k].toFixed(0)}</span></div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

/** One line of the standing, with the reason behind it on hover and on a click. */
function Standing({ label, value, why }: { label: string; value: string; why: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button className="flex justify-between text-left" title={why} onClick={() => setOpen((o) => !o)}>
        <dt className="ink-muted">{label}</dt>
        <dd className="underline decoration-dotted underline-offset-2">{value}</dd>
      </button>
      {open && <p className="ink-faint mt-0.5 text-xs leading-snug">{why}</p>}
    </div>
  );
}
