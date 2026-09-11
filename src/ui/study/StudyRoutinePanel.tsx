import { useGameStore } from '@/engine/store';
import { studyActivitiesFor, studyActivityBuilds, studyBudget, studyHours } from '@/systems/studyWeek';
import Sheet from '../Sheet';

/** The priest-student's week: lectures are fixed; these are the hours that are his, and the work on the side. */
export default function StudyRoutinePanel() {
  const game = useGameStore((s) => s.game);
  const setActivity = useGameStore((s) => s.setStudyActivity);
  if (!game?.study) return null;
  const study = game.study;
  const budget = studyBudget(game);
  const used = studyHours(study);
  const left = budget - used;
  const last = game.digest[game.digest.length - 1];
  const weeksLeft = Math.max(0, study.endWeek - game.clock.week);
  const all = studyActivitiesFor(game);
  const studies = all.filter((a) => a.def.kind === 'study');
  const work = all.filter((a) => a.def.kind === 'work');
  const post = !['rome', 'washington'].includes(study.city);
  const where = study.city === 'rome' ? 'Rome' : study.city === 'washington' ? 'Washington' : 'the diocese';
  const POST_DAY: Record<string, string> = { residence: "The bishop's day", campus: "The Center's week", hospital: "The hospital's week", seminary: "The seminary's week" };

  const row = ({ def, available, why }: (typeof all)[number]) => {
    const ap = study.routine[def.id] ?? 0;
    const canAdd = available && ap < def.maxAp && left > 0;
    return (
      <li key={def.id} className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0" title={def.blurb}>
          <span className={available ? '' : 'ink-faint'}>{def.label}</span>
          <span className="ink-faint ml-2 text-xs">{available ? studyActivityBuilds(def) : `needs ${why}`}</span>
          {study.hoursLogged[def.id] && def.credentialAfter ? <span className="ink-faint ml-2 text-xs">{Math.min(study.hoursLogged[def.id]!, def.credentialAfter.hours)} of {def.credentialAfter.hours} hours</span> : null}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button className="pbtn px-2 py-0 text-xs" disabled={ap === 0} onClick={() => setActivity(def.id, ap - 1)}>−</button>
          <span className="w-5 text-center font-mono text-xs">{ap}</span>
          <button className="pbtn px-2 py-0 text-xs" disabled={!canAdd} onClick={() => setActivity(def.id, ap + 1)}>+</button>
        </div>
      </li>
    );
  };

  return (
    <>
      <Sheet title={post ? study.label : `${study.label} in ${where}`}>
        <p className="ink-muted text-xs leading-relaxed">
          {post ? (study.city === 'residence' ? 'Living at the residence, in the room with the view of the parking lot.' : `Living at ${study.residence}.`) : `${study.school.charAt(0).toUpperCase() + study.school.slice(1)}, living at ${study.residence}.`} {Math.floor(weeksLeft / 52) > 0 ? `${Math.floor(weeksLeft / 52)} years and ` : ''}{weeksLeft % 52} weeks {post ? (study.city === 'residence' ? 'until he lets you go' : 'until the appointment ends') : `until the degree${study.failed ? ', if it comes' : ''}`}. {post ? `${POST_DAY[study.city] ?? 'The work'} takes the week; the shape of it is yours:` : 'Lectures, the chapel, and the house rule take the week;'} {budget} {post ? 'blocks of it' : 'hours are yours'}.
          {left > 0 ? ` ${left} still unspoken for; they go to the city.` : ' All of them are given.'}
        </p>
        {last && <p className="mt-2 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">{last.lines.join(' ')}</p>}
      </Sheet>
      <Sheet title={post ? (POST_DAY[study.city] ?? 'The work') : 'Your studies'}>
        <ul className="flex flex-col gap-1.5">{studies.map(row)}</ul>
        <p className="ink-faint mt-2 text-xs">{post ? (study.city === 'residence' ? 'Every priest of the diocese will remember how you did this.' : 'The diocese hears how the appointment goes; so does the board.') : 'The thesis is the degree. Everything else is what kind of priest comes home.'}</p>
      </Sheet>
      <Sheet title="Work on the side">
        <ul className="flex flex-col gap-1.5">{work.map(row)}</ul>
        <p className="ink-faint mt-2 text-xs">A priest is a priest in {where} too. The work pays in standing, not money, and the diocese hears about it.</p>
      </Sheet>
    </>
  );
}
