import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { WEEKDAYS, type Weekday } from '@/types';
import { DAY_LABEL, SCHEDULE, canOpenBox, canSay, canSayIn, communityLanguages, languageLabel, liturgyLoadBlocks, myConfessionMinutes, myMasses, quickChanges, scheduleOf, setsSchedule, sundayDemand, timeLabel } from '@/systems/schedule';
import { currentParish } from '@/systems/liturgy';
import { languageDefs, speaks } from '@/systems/languages';
import { hoursOf } from '@/systems/week';
import Sheet from '../Sheet';

const TIMES: number[] = [];
for (let t = SCHEDULE.times.from; t <= SCHEDULE.times.to; t += SCHEDULE.times.step) TIMES.push(t);
const WHO: Record<string, string> = { me: 'you', pastor: 'the pastor', vicar: 'the vicar', other: 'another priest' };

/**
 * The week as it is said: the Masses and the box as rows you can read, a button for each decision, and the
 * changes most worth making as buttons of their own (owner's feedback: the old sheet was crammed and all menus).
 * The liturgy is said in its own time; what the schedule changes is the pews, the people, and your wear.
 */
export default function SchedulePanel() {
  const game = useGameStore((s) => s.game);
  const change = useGameStore((s) => s.changeSchedule);
  const [custom, setCustom] = useState(false);
  const [day, setDay] = useState<Weekday>('sun');
  const [minute, setMinute] = useState(17 * 60);
  const [language, setLanguage] = useState('english');
  const [cDay, setCDay] = useState<Weekday>('sat');
  const [cMinute, setCMinute] = useState(15 * 60 + 30);
  const [cLength, setCLength] = useState(60);
  const [error, setError] = useState<string | null>(null);
  if (!game?.parish) return null;
  const s = scheduleOf(game);
  const parish = currentParish(game);
  if (!s || !parish) return null;
  const inCharge = setsSchedule(game);
  const verb = inCharge ? 'Add' : 'Ask for';
  const mine = myMasses(s);
  const sundays = mine.filter((m) => m.sunday).length;
  const weekdays = mine.filter((m) => !m.sunday).length;
  const minutes = myConfessionMinutes(s);
  const demand = sundayDemand(parish);
  const allSundays = s.masses.filter((m) => m.sunday).length;
  const languages = ['english', ...new Set([...communityLanguages(parish), ...languageDefs.filter((l) => speaks(game, l.id)).map((l) => l.id)])];
  const can = canSay(s, day, minute);
  const box = canOpenBox(s, cDay, cMinute, cLength);
  const load = liturgyLoadBlocks(s);
  const quick = quickChanges(game);
  const hasVicar = s.masses.some((x) => x.celebrant === 'vicar');
  const act = (c: Parameters<typeof change>[0]) => {
    setError(null);
    try { change(c); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const sundayRows = s.masses.filter((m) => m.sunday);
  const weekdayRows = s.masses.filter((m) => !m.sunday);
  const row = (m: (typeof s.masses)[number]) => (
    <li key={m.id} className={'flex items-center justify-between gap-2 rounded border rule px-2 py-1 ' + (m.celebrant === 'me' ? 'bg-white/60' : 'bg-white/20 ink-muted')}>
      <span className="min-w-0 truncate">
        <span className="font-medium">{DAY_LABEL[m.day]} {timeLabel(m.minute)}</span>
        {m.language !== 'english' && <span> · {languageLabel(m.language)}</span>}
        {m.sunday && m.day === 'sat' && <span className="ink-faint"> · the vigil</span>}
        <span className="ink-faint"> · {WHO[m.celebrant]}</span>
      </span>
      <span className="flex shrink-0 gap-1">
        {inCharge && m.celebrant !== 'me' && canSayIn(game, m.language) && <button className="pbtn px-2 py-0 text-xs" title="Say this Mass yourself" onClick={() => act({ kind: 'hand_mass', id: m.id, to: 'me' })}>Take it</button>}
        {inCharge && m.celebrant === 'me' && hasVicar && <button className="pbtn px-2 py-0 text-xs" title="Hand this Mass to the vicar" onClick={() => act({ kind: 'hand_mass', id: m.id, to: 'vicar' })}>Hand to the vicar</button>}
        <button className="pbtn px-2 py-0 text-xs" title={inCharge ? 'Cancel this Mass' : 'Ask the pastor to cancel this Mass'} onClick={() => act({ kind: 'remove_mass', id: m.id })}>{inCharge ? 'Cancel' : 'Ask to cancel'}</button>
      </span>
    </li>
  );

  return (
    <Sheet title="The schedule" summary={`${sundays} Sunday ${sundays === 1 ? 'Mass' : 'Masses'}, ${weekdays} weekday, ${minutes} minutes in the box`}>
      <p className="ink-muted text-xs leading-relaxed">
        The Masses and the box are said in their own time, like the Office; they take nothing from the hours that are yours. What the schedule changes is the pews, the people it reaches, and your wear.
        {' '}You say {sundays} of the parish's {allSundays} Sunday {allSundays === 1 ? 'Mass' : 'Masses'} and {weekdays} weekday {weekdays === 1 ? 'Mass' : 'Masses'}, and sit {minutes} minutes a week in the box.
        {' '}The parish's {parish.households} households want about {demand} Sunday Masses{allSundays < demand ? '; it has fewer, and the pews show it' : allSundays > demand ? '; it has more, and some are thin' : ''}. The canon allows a priest two Masses on a weekday and three on a Sunday, the vigil counted.
        {load > 0 ? ` This is a heavy week: ${hoursOf(load)} hours' worth of wear beyond an ordinary one.` : ''}
        {!inCharge && " The schedule is the pastor's: you ask, and he answers."}
      </p>
      {s.lastAsk && <p className={'mt-2 rounded border rule bg-white/30 px-3 py-2 text-xs leading-relaxed ' + (s.lastAsk.granted ? '' : 'ink-wine')}>{s.lastAsk.text}</p>}
      {error && <p className="ink-wine mt-2 text-xs">{error}</p>}

      {quick.length > 0 && (
        <div className="mt-3">
          <div className="heading text-sm">Changes worth making</div>
          <ul className="mt-1 flex flex-col gap-1">
            {quick.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0"><span>{q.label}</span><span className="ink-faint block text-xs">{q.why}.</span></span>
                <button className="pbtn pbtn-primary shrink-0 px-2 py-0.5 text-xs" onClick={() => act(q.change)}>{inCharge ? 'Do it' : 'Ask'}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="heading text-sm">Sunday, and the vigil</div>
        <ul className="mt-1 flex flex-col gap-1 text-sm">{sundayRows.map(row)}</ul>
      </div>
      <div className="mt-3">
        <div className="heading text-sm">The weekdays</div>
        {weekdayRows.length === 0 ? <p className="ink-faint text-xs">No weekday Mass.</p> : <ul className="mt-1 flex flex-col gap-1 text-sm">{weekdayRows.map(row)}</ul>}
      </div>
      <div className="mt-3">
        <div className="heading text-sm">The box: the posted hours</div>
        <p className="ink-faint text-xs">These are the hours on the church door. The hours you sit beyond them are on the Week sheet, under everything else.</p>
        {s.confessions.length === 0 ? <p className="ink-faint mt-1 text-xs">No posted hours. The light is off.</p> : (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {s.confessions.map((c) => (
              <li key={c.id} className={'flex items-center justify-between gap-2 rounded border border-dashed rule px-2 py-1 ' + (c.confessor === 'me' ? 'bg-white/50' : 'bg-white/20 ink-muted')}>
                <span className="min-w-0 truncate"><span className="font-medium">{DAY_LABEL[c.day]} {timeLabel(c.minute)}</span> · {c.minutes} minutes<span className="ink-faint"> · {WHO[c.confessor]}</span></span>
                <button className="pbtn shrink-0 px-2 py-0 text-xs" title={inCharge ? 'Take these hours off the door' : 'Ask the pastor to drop these hours'} onClick={() => act({ kind: 'remove_confessions', id: c.id })}>{inCharge ? 'Cancel' : 'Ask to cancel'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <button className="pbtn-link text-xs" onClick={() => setCustom((v) => !v)}>{custom ? 'Hide' : 'Something else: a Mass or hours at a time of your own'}</button>
        {custom && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="ink-muted">{verb} a Mass:</span>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={day} onChange={(e) => setDay(e.target.value as Weekday)}>{WEEKDAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((l) => <option key={l} value={l}>{languageLabel(l)}</option>)}</select>
              <button className="pbtn px-2 py-0 text-xs" disabled={!can.ok || !canSayIn(game, language)} title={!can.ok ? can.why ?? '' : !canSayIn(game, language) ? `You do not have the ${languageLabel(language)} for it` : ''} onClick={() => act({ kind: 'add_mass', day, minute, language })}>{verb.toLowerCase()}</button>
              {!can.ok && <span className="ink-faint">{can.why}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="ink-muted">{verb} posted hours in the box:</span>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cDay} onChange={(e) => setCDay(e.target.value as Weekday)}>{WEEKDAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cMinute} onChange={(e) => setCMinute(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
              <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cLength} onChange={(e) => setCLength(Number(e.target.value))}>{[30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select>
              <button className="pbtn px-2 py-0 text-xs" disabled={!box.ok} title={box.why ?? ''} onClick={() => act({ kind: 'add_confessions', day: cDay, minute: cMinute, minutes: cLength })}>{verb.toLowerCase()}</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
