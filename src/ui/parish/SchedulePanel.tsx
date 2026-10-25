import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { WEEKDAYS, type Weekday } from '@/types';
import { DAY_LABEL, DAY_SHORT, SCHEDULE, canOpenBox, canSay, canSayIn, communityLanguages, languageLabel, myConfessionMinutes, myMasses, scheduleOf, setsSchedule, sundayDemand, timeLabel } from '@/systems/schedule';
import { currentParish } from '@/systems/liturgy';
import { languageDefs, speaks } from '@/systems/languages';
import { hoursOf } from '@/systems/week';
import Sheet from '../Sheet';

const TIMES: number[] = [];
for (let t = SCHEDULE.times.from; t <= SCHEDULE.times.to; t += SCHEDULE.times.step) TIMES.push(t);
const WHO: Record<string, string> = { me: 'you', pastor: 'the pastor', vicar: 'the vicar', other: 'another priest' };

/** The week as it is said: every Mass and every hour in the box, by day, with who says it; and the means to change it. */
export default function SchedulePanel() {
  const game = useGameStore((s) => s.game);
  const change = useGameStore((s) => s.changeSchedule);
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
  const act = (c: Parameters<typeof change>[0]) => {
    setError(null);
    try { change(c); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Sheet title="The schedule" summary={`${sundays} Sunday ${sundays === 1 ? 'Mass' : 'Masses'}, ${weekdays} weekday, ${minutes} minutes in the box`}>
      <p className="ink-muted text-xs leading-relaxed">
        What the hours for the liturgy are actually doing. You say {sundays} of the parish's {allSundays} Sunday {allSundays === 1 ? 'Mass' : 'Masses'} and {weekdays} weekday {weekdays === 1 ? 'Mass' : 'Masses'}, and sit {minutes} minutes a week in the box: about {hoursOf(SCHEDULE.sundayMassAp * sundays + SCHEDULE.weekdayMassAp * weekdays + SCHEDULE.confessionOverheadAp + (SCHEDULE.confessionApPerHour * minutes) / 60)} hours before the homily.
        {' '}The parish's {parish.households} households want about {demand} Sunday Masses{allSundays < demand ? '; it has fewer, and the pews show it' : allSundays > demand ? '; it has more, and some are thin' : ''}. The canon allows a priest two Masses on a weekday and three on a Sunday, the vigil counted.
        {!inCharge && " The schedule is the pastor's: you ask, and he answers."}
      </p>
      {s.lastAsk && <p className={'mt-2 rounded border rule bg-white/30 px-3 py-2 text-xs leading-relaxed ' + (s.lastAsk.granted ? '' : 'ink-wine')}>{s.lastAsk.text}</p>}
      {error && <p className="ink-wine mt-2 text-xs">{error}</p>}
      <div className="mt-3 grid grid-cols-7 gap-1 text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="min-w-0 rounded border rule bg-white/20 p-1">
            <div className="ink-muted mb-1 text-center font-medium">{DAY_SHORT[d]}</div>
            {s.masses.filter((m) => m.day === d).map((m) => (
              <div key={m.id} className={'mb-1 rounded px-1 py-0.5 ' + (m.celebrant === 'me' ? 'bg-white/60' : 'bg-white/20 ink-muted')} title={`${languageLabel(m.language)} Mass, ${WHO[m.celebrant]}${m.sunday && d === 'sat' ? ', the vigil' : ''}`}>
                <div className="truncate">{timeLabel(m.minute)}{m.language !== 'english' ? ` · ${languageLabel(m.language)}` : ''}</div>
                <div className="ink-faint flex items-center justify-between gap-1">
                  <span className="truncate">{WHO[m.celebrant]}</span>
                  <span className="flex shrink-0 gap-1">
                    {inCharge && m.celebrant !== 'me' && canSayIn(game, m.language) && <button className="pbtn-link" title="Take this Mass yourself" onClick={() => act({ kind: 'hand_mass', id: m.id, to: 'me' })}>take</button>}
                    {inCharge && m.celebrant === 'me' && s.masses.some((x) => x.celebrant === 'vicar') && <button className="pbtn-link" title="Hand this Mass to the vicar" onClick={() => act({ kind: 'hand_mass', id: m.id, to: 'vicar' })}>hand</button>}
                    <button className="pbtn-link" title={inCharge ? 'Drop this Mass' : 'Ask the pastor to drop this Mass'} onClick={() => act({ kind: 'remove_mass', id: m.id })}>×</button>
                  </span>
                </div>
              </div>
            ))}
            {s.confessions.filter((c) => c.day === d).map((c) => (
              <div key={c.id} className={'mb-1 rounded border border-dashed rule px-1 py-0.5 ' + (c.confessor === 'me' ? '' : 'ink-muted')} title={`Confessions, ${WHO[c.confessor]}`}>
                <div className="truncate">{timeLabel(c.minute)} · box</div>
                <div className="ink-faint flex items-center justify-between gap-1">
                  <span>{c.minutes} min</span>
                  <button className="pbtn-link" title={inCharge ? 'Drop these confessions' : 'Ask the pastor to drop these confessions'} onClick={() => act({ kind: 'remove_confessions', id: c.id })}>×</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="ink-muted">{verb} a Mass:</span>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={day} onChange={(e) => setDay(e.target.value as Weekday)}>{WEEKDAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((l) => <option key={l} value={l}>{languageLabel(l)}</option>)}</select>
        <button className="pbtn px-2 py-0 text-xs" disabled={!can.ok || !canSayIn(game, language)} title={!can.ok ? can.why ?? '' : !canSayIn(game, language) ? `You do not have the ${languageLabel(language)} for it` : ''} onClick={() => act({ kind: 'add_mass', day, minute, language })}>{verb.toLowerCase()}</button>
        {!can.ok && <span className="ink-faint">{can.why}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="ink-muted">{verb} confessions:</span>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cDay} onChange={(e) => setCDay(e.target.value as Weekday)}>{WEEKDAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cMinute} onChange={(e) => setCMinute(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
        <select className="rounded border rule bg-white/40 px-1 py-0.5" value={cLength} onChange={(e) => setCLength(Number(e.target.value))}>{[30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select>
        <button className="pbtn px-2 py-0 text-xs" disabled={!box.ok} title={box.why ?? ''} onClick={() => act({ kind: 'add_confessions', day: cDay, minute: cMinute, minutes: cLength })}>{verb.toLowerCase()}</button>
      </div>
    </Sheet>
  );
}
