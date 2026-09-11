import { useGameStore } from '@/engine/store';
import { seminaryActivities } from '@/content/seminary';
import { activityBuilds, routineHours, routineOf, seminaryBudget } from '@/systems/seminaryWeek';
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
          {seminaryActivities.map((a) => {
            const ap = routine[a.id] ?? 0;
            const canAdd = ap < a.maxAp && left > 0;
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
        <p className="ink-faint mt-3 text-xs">The year's emphasis still shapes the year. These hours are what you do with the rest of it, and the people you do it with; what they build, they build for good, and the evaluation will say so.</p>
      </Sheet>
    </>
  );
}
