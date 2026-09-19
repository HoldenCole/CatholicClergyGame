import { useGameStore } from '@/engine/store';
import { seminaryActivities } from '@/content/seminary';
import { activityBuilds, routineHours, routineOf, seminaryBudget, seminaryActivityOffered } from '@/systems/seminaryWeek';
import Sheet from '../Sheet';

/** The seminarian's week: the horarium is fixed; these are the hours that are his. */
export default function SeminaryRoutinePanel() {
  const game = useGameStore((s) => s.game);
  const setActivity = useGameStore((s) => s.setSeminaryActivity);
  if (!game?.seminary) return null;
  const sem = game.seminary;
  const routine = routineOf(sem);
  const budget = seminaryBudget(game);
  const used = routineHours(sem);
  const left = budget - used;
  const last = game.digest[game.digest.length - 1];

  return (
    <>
      <Sheet title="The week">
        <p className="ink-muted text-xs leading-relaxed">
          Mass, the hours, classes, and meals are the horarium and are not yours to move. {budget} hours a week are.
          {left > 0 ? ` ${left} still unspoken for; they go nowhere in particular.` : ' All of them are given.'}
        </p>
        {last && <p className="mt-2 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">{last.lines.join(' ')}</p>}
      </Sheet>
      <Sheet title="Your hours">
        <ul className="flex flex-col gap-1.5">
          {seminaryActivities.filter((a) => a.location !== 'language' || (routine[a.id] ?? 0) > 0 || (sem.hoursLogged?.[a.id] ?? 0) > 0).map((a) => {
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
