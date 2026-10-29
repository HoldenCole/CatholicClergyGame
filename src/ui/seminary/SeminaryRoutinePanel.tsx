import { useGameStore } from '@/engine/store';
import { seminaryActivities } from '@/content/seminary';
import { activityBuilds, routineHours, routineOf, seminaryBudget, seminaryActivityOffered } from '@/systems/seminaryWeek';
import Sheet from '../Sheet';
import MassSaidNote from '../MassSaidNote';
import { devotionDefs, horariumDay, recreationDefs, seminaryHorariumDefs } from '@/content/seminary';
import { RULE, horariumHourShift, horariumOf, observanceOf, observanceWord, recreationOffered, ruleOf } from '@/systems/seminaryRule';
import type { Quality } from '@/types';

/** The seminarian's week: the horarium is fixed; these are the hours that are his. */
export default function SeminaryRoutinePanel() {
  const game = useGameStore((s) => s.game);
  const setActivity = useGameStore((s) => s.setSeminaryActivity);
  const setLine = useGameStore((s) => s.setSeminaryHorarium);
  const toggleDevotion = useGameStore((s) => s.toggleDevotion);
  const setRecreation = useGameStore((s) => s.setRecreation);
  if (!game?.seminary) return null;
  const sem = game.seminary;
  const routine = routineOf(sem);
  const budget = seminaryBudget(game);
  const used = routineHours(sem);
  const left = budget - used;
  const last = game.digest[game.digest.length - 1];
  const horarium = horariumOf(sem);
  const shift = horariumHourShift(sem);
  const rule = ruleOf(sem);
  const observance = observanceOf(sem);
  const QUALITIES: Quality[] = ['min', 'standard', 'invested'];
  const QWORD: Record<Quality, string> = { min: 'Loosely', standard: 'Kept', invested: 'Fully' };

  return (
    <>
      <Sheet title="The week">
        <p className="ink-muted text-xs leading-relaxed">
          The horarium is the house's: Mass, the hours, classes, and meals. How you keep it is yours, and so are {budget} hours a week{shift !== 0 ? ` (${shift > 0 ? `${shift} of them taken from the rule` : `${-shift} fewer for keeping it fully`})` : ''}.
          {left > 0 ? ` ${left} still unspoken for; they go nowhere in particular.` : ' All of them are given.'}
          {' '}The house calls you {observanceWord(observance)}.{(sem.lates ?? 0) > 0 ? ` The vice-rector's notebook has you late to Lauds ${sem.lates === 1 ? 'once' : `${sem.lates} times`} this year.` : ''}
        </p>
        {last && <p className="mt-2 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed"><span className="ink-faint block text-xs">{last.lines[0]}</span>{last.lines.length > 1 ? last.lines.slice(1).join(' ') : 'Nothing to write down.'}</p>}
        <MassSaidNote />
      </Sheet>
      <Sheet title="The horarium" fold="closed" summary={seminaryHorariumDefs.map((d) => `${d.label.toLowerCase()}: ${QWORD[horarium[d.key]!].toLowerCase()}`).join(' · ')}>
        <ul className="ink-muted grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          {horariumDay.map((p) => <li key={p.time} className="flex gap-2"><span className="w-10 shrink-0 font-mono">{p.time}</span><span>{p.label}</span></li>)}
        </ul>
        <p className="ink-faint mt-2 text-xs">A house runs on its rule the way a parish runs on its schedule. Kept loosely, a line gives an hour back and costs you with the house and in the chapel; kept fully, it costs an hour and pays in both.</p>
        <ul className="mt-2 flex flex-col gap-2">
          {seminaryHorariumDefs.map((d) => (
            <li key={d.key} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate" title={d.time}>{d.label} <span className="ink-faint text-xs">· {d.time}</span></span>
                <div className="flex gap-1">
                  {QUALITIES.map((q) => (
                    <button key={q} onClick={() => setLine(d.key, q)} className={'pbtn whitespace-nowrap px-2 py-0.5 text-xs ' + (q === horarium[d.key] ? 'pbtn-active' : '')} title={d.blurb[q]}>
                      {QWORD[q]}{d.hours[q] !== 0 ? <span className="opacity-70"> {d.hours[q] > 0 ? `+${d.hours[q]}h` : `${d.hours[q]}h`}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ink-faint text-xs">{d.blurb[horarium[d.key]!]}</div>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet title="Your rule of prayer" fold="closed" summary={rule.length ? rule.map((id) => devotionDefs.find((d) => d.id === id)?.label.toLowerCase()).join(', ') : 'nothing of your own yet'}>
        <p className="ink-muted text-xs leading-relaxed">What you keep in your own time, before Lauds and after Compline, beside what the house keeps. Up to {RULE.maxDevotions}: a rule is a few things kept, not a list. The night ones cost the morning.</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {devotionDefs.map((d) => {
            const kept = rule.includes(d.id);
            const full = !kept && rule.length >= RULE.maxDevotions;
            return (
              <li key={d.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div>{d.label} <span className="ink-faint text-xs">· {d.when === 'morning' ? 'before Lauds' : d.when === 'night' ? 'after Compline' : 'in the day'}</span></div>
                  <div className="ink-muted text-xs">{d.blurb}</div>
                </div>
                <button className={'pbtn shrink-0 px-2 py-0 text-xs ' + (kept ? 'pbtn-active' : '')} disabled={full} title={full ? 'Let one go first' : ''} onClick={() => toggleDevotion(d.id)}>{kept ? 'kept' : 'take up'}</button>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <Sheet title="The evening" fold="closed" summary={sem.recreation ? recreationDefs.find((r) => r.id === sem.recreation)?.label.toLowerCase() ?? '' : 'no habit yet'}>
        <p className="ink-muted text-xs leading-relaxed">The hour after supper, as a habit. It is where the human formation happens that no class gives, where the class becomes friends, and where the night runs late or does not.</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {recreationDefs.map((r) => {
            const offered = recreationOffered(game, r);
            const chosen = sem.recreation === r.id;
            return (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <div className={'min-w-0 ' + (offered ? '' : 'ink-faint')}>
                  <div>{r.label}{r.late >= 0.08 ? <span className="ink-faint text-xs"> · runs late</span> : null}</div>
                  <div className="ink-muted text-xs">{r.blurb}</div>
                </div>
                <button className={'pbtn shrink-0 px-2 py-0 text-xs ' + (chosen ? 'pbtn-active' : '')} disabled={!offered} onClick={() => setRecreation(chosen ? null : r.id)}>{chosen ? 'your habit' : 'choose'}</button>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <Sheet title="Your hours">
        <ul className="flex flex-col gap-1.5">
          {seminaryActivities
            // An order's own formation (its rite) is not listed for a man outside it.
            .filter((a) => !(a.requires ?? []).some((c) => c.type === 'flag' && c.key.startsWith('order:') && c.value && !game.flags[c.key]))
            .filter((a) => a.location !== 'language' || (routine[a.id] ?? 0) > 0 || (sem.hoursLogged?.[a.id] ?? 0) > 0).map((a) => {
            const ap = routine[a.id] ?? 0;
            const offered = seminaryActivityOffered(game, a);
            const canAdd = offered && ap < a.maxAp && left > 0;
            if (!offered) {
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="ink-faint min-w-0" title={a.blurb}>{a.label} <span className="ml-2 text-xs">(completed)</span></span>
                </li>
              );
            }
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0" title={a.blurb}>
                  {a.label}
                  <span className="ink-faint ml-2 text-xs">{activityBuilds(a.id)}</span>
                  {sem.hoursLogged?.[a.id] && a.credentialAfter ? <span className="ink-faint ml-2 text-xs">{Math.min(sem.hoursLogged[a.id]!, a.credentialAfter.hours)} of {a.credentialAfter.hours} hours</span> : null}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button className="pbtn px-2 py-0 text-xs" disabled={ap === 0} onClick={() => setActivity(a.id, ap - 1)}>−</button>
                  <span className="w-5 text-center font-mono text-xs">{ap}</span>
                  <button className="pbtn px-2 py-0 text-xs" disabled={!canAdd} onClick={() => setActivity(a.id, ap + 1)}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
        {(() => {
          // The languages, folded: one row each once begun, and a list to begin another from, so nine tongues do not crowd the week.
          const folded = seminaryActivities.filter((a) => a.location === 'language' && !((routine[a.id] ?? 0) > 0 || (sem.hoursLogged?.[a.id] ?? 0) > 0) && seminaryActivityOffered(game, a));
          if (!folded.length) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="ink-muted">Begin a language:</span>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value="" disabled={left <= 0} onChange={(e) => { if (e.target.value) setActivity(e.target.value, 1); }}>
                <option value="">{left > 0 ? 'choose one' : 'no hours left'}</option>
                {folded.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <span className="ink-faint">An hour a week; the ones you have begun stay in the list above.</span>
            </div>
          );
        })()}
        <p className="ink-faint mt-3 text-xs">The year's emphasis still shapes the year. These hours are what you do with the rest of it, and the people you do it with; what they build, they build for good, and the evaluation will say so.</p>
      </Sheet>
    </>
  );
}
