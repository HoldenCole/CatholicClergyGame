import { useGameStore } from '@/engine/store';
import { controlsMoney, debtPayable } from '@/systems/finance';
import { sinceArrival } from '@/systems/trajectory';
import { workAvailability } from '@/systems/problems';
import { useUiStore } from '../uiStore';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { STAT_KEYS, CONSTITUENCY_KEYS } from '@/types';
import { useState } from 'react';
import { arcKey } from '@/llm/skin';
import Sheet from '../Sheet';
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

  return (
    <>
      <Sheet title={`${parish.name}, ${parish.place}`}>
        <div className="flex items-start gap-4">
          <Portrait portrait={portraitForCharacter(c, year, game.phase)} size={72} title={`${c.name.first} ${c.name.last}`} />
          <p className="text-sm leading-relaxed">
            {c.name.first} {c.name.last}, {p.role.replace('_', ' ')}, {yearsIn === 0 ? 'first year' : `year ${yearsIn + 1}`}. {game.world.diocese.visible.name}
            {bishop ? `, under ${bishop.title} ${bishop.name.last}` : ''}.
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between"><dt className="ink-muted">The people</dt><dd>{word(c.reputation.parishioners)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">The chancery</dt><dd>{word(c.reputation.chancery)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Brother priests</dt><dd>{word(c.reputation.brother_priests)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Attendance</dt><dd>{Math.round(p.attendance * 100)}% of the rolls</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Collections</dt><dd>${fin.averageCollection.toLocaleString()} a week</dd></div>
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
      <Sheet title={traj ? `Since you arrived: ${traj.verdict.toLowerCase()}` : 'Since you arrived'}>
        {traj ? (
          <table className="w-full text-sm">
            <tbody>
              {traj.rows.map((r) => (
                <tr key={r.label}>
                  <td className="ink-muted py-0.5 pr-2">{r.label}</td>
                  <td className="ink-faint py-0.5 pr-2 text-xs">{r.then}</td>
                  <td className="py-0.5 pr-2">{r.now}</td>
                  <td className={'py-0.5 text-xs ' + (r.sign > 0 ? 'text-emerald-800' : r.sign < 0 ? 'ink-wine' : 'ink-faint')}>{r.sign > 0 ? 'better' : r.sign < 0 ? 'worse' : 'the same'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ink-faint text-sm">No reading yet.</p>
        )}
        {traj && <p className="ink-faint mt-2 text-xs">{Math.floor(traj.weeks / 52) > 0 ? `${Math.floor(traj.weeks / 52)} years and ` : ''}{traj.weeks % 52} weeks in. A quarter at a time is how a parish turns.</p>}
      </Sheet>
      <Sheet title="The problem">
        <p className="text-sm">{parish.problem === 'none' ? 'Nothing is on fire. It will not last.' : (PROBLEM_LABEL[parish.problem] ?? parish.problem)}</p>
        {work && workAv.fix ? (
          <p className="ink-muted mt-2 text-xs">
            In hand: {workAv.fix.label.toLowerCase()}, {Math.max(0, work.endWeek - game.clock.week)} weeks to go at {work.apPerWeek} {work.apPerWeek === 1 ? 'hour' : 'hours'} a week.
            <button className="pbtn-link ml-2" onClick={stopWork}>let it drop</button>
          </p>
        ) : workAv.fix ? (
          <div className="mt-2 text-xs">
            <p className="ink-muted">{workAv.fix.label}: {workAv.fix.blurb} {workAv.fix.weeks} weeks at {workAv.fix.apPerWeek} {workAv.fix.apPerWeek === 1 ? 'hour' : 'hours'} a week{workAv.fix.cost > 0 ? `, about $${workAv.fix.cost.toLocaleString()} from the parish` : ''}.</p>
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
            </li>
          ))}
          {bishop && (
            <li className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(bishop, year)} size={26} />
              <span className="min-w-0 flex-1 truncate">{bishop.title} {bishop.name.first} {bishop.name.last}, the bishop</span>
              <span className="ink-muted">{word(bishop.relationship)}</span>
            </li>
          )}
        </ul>
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
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.stats[k].toFixed(1)}</span></div>
            ))}
            <div className="flex justify-between"><span>alignment</span><span>{c.alignment.toFixed(0)}</span></div>
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
