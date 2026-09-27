import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { documentPools } from '@/content/rome';
import { DESK, DESK_KINDS, draftSubjects } from '@/systems/rome/papalDesk';
import { consistoryOpen, journeyOpen, journeyPlaces } from '@/systems/rome/papalActs';
import { electorsOn } from '@/systems/rome/conclave';
import { reading } from '@/systems/rome/pontificateText';
import Sheet from '../Sheet';

/** The pope's desk: the document he is writing, the consistory, the journeys, and the door that is always open. E1 §10. */
export default function PopePanel() {
  const game = useGameStore((s) => s.game);
  const beginDraft = useGameStore((s) => s.beginPapalDraft);
  const abandon = useGameStore((s) => s.abandonPapalDraft);
  const call = useGameStore((s) => s.callConsistory);
  const create = useGameStore((s) => s.createCardinals);
  const plan = useGameStore((s) => s.planJourney);
  const renounce = useGameStore((s) => s.renouncePapacy);
  const [kind, setKind] = useState(DESK_KINDS[0]!);
  const [subject, setSubject] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [where, setWhere] = useState('');
  const [sure, setSure] = useState(false);
  const p = game?.rome?.pontificate;
  if (!game || !p) return null;
  const day = sundayOf(game.clock);
  const year = fromDayNumber(day).year;
  const writing = game.study?.routine.pope_writing ?? 0;
  const college = game.rome!.college ?? [];
  const electors = electorsOn(college, day);
  const mine = electors.filter((c) => c.createdBy === 'player').length;
  const cons = consistoryOpen(game);
  const jour = journeyOpen(game);
  const subjects = draftSubjects(game);
  const kindLabel = (k: string) => documentPools.kinds[k as keyof typeof documentPools.kinds]?.label ?? k;

  return (
    <>
      <Sheet title="The desk">
        {p.draft ? (
          <div className="text-sm">
            <p className="leading-relaxed"><span className="italic">{p.draft.title}</span>, {kindLabel(p.draft.kind)}, {p.draft.gist}.</p>
            <p className="ink-muted mt-1 text-xs">{p.draft.done} of {p.draft.need} blocks written. {writing > 0 ? `${writing} a week at the desk: about ${Math.ceil((p.draft.need - p.draft.done) / writing)} weeks more.` : 'Give it blocks of Writing on the Week sheet, or it will never be finished.'}</p>
            <button className="pbtn mt-2 px-2 py-0.5 text-xs" onClick={() => abandon()}>Put it in a drawer, unwritten</button>
          </div>
        ) : (
          <div className="text-sm">
            <p className="ink-muted text-xs">Nothing is on the desk. A document moves the law of the Church, or teaches without moving it; either way the bishops read it and so does your old diocese.</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {DESK_KINDS.map((k) => (
                <button key={k} className={'pbtn px-2 py-0.5 text-xs ' + (kind === k ? 'pbtn-primary' : '')} onClick={() => setKind(k)}>{kindLabel(k)} <span className="ink-faint">({DESK.kinds[k]})</span></button>
              ))}
            </div>
            <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
              {subjects.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input type="radio" name="subject" checked={subject === s.id} onChange={() => setSubject(s.id)} />
                    <span>
                      {s.label}
                      <span className="ink-faint"> {s.lean === 0 ? '(teaching; moves no law)' : s.lean < 0 ? '(toward tradition)' : '(toward reform)'}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button className="pbtn pbtn-primary mt-2 px-2 py-0.5 text-xs" disabled={!subject} onClick={() => { if (subject) beginDraft(kind, subject); setSubject(null); }}>Begin writing</button>
          </div>
        )}
        {p.written.length > 0 && <p className="ink-faint mt-2 text-xs">Promulgated: {p.written.length} document{p.written.length === 1 ? '' : 's'}.</p>}
      </Sheet>

      <Sheet title="The College">
        <p className="ink-muted text-xs">{electors.length} cardinal electors, {mine} of them created by you. The next conclave is theirs.</p>
        {p.candidates ? (
          <div className="mt-2 text-sm">
            <p className="text-xs">The Secretariat has put these men before you. Choose up to {Math.min(cons.room, p.candidates.length)}.</p>
            <ul className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
              {p.candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" checked={chosen.includes(c.id)} disabled={!chosen.includes(c.id) && chosen.length >= cons.room} onChange={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />
                    <span>{c.name} of {c.from}, {year - c.born}<span className="ink-faint">: {reading(c.temperament)}{c.curial ? ', of the Curia' : ''}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <button className="pbtn pbtn-primary mt-2 px-2 py-0.5 text-xs" disabled={chosen.length === 0} onClick={() => { create(chosen); setChosen([]); }}>Create {chosen.length || ''} cardinal{chosen.length === 1 ? '' : 's'}</button>
          </div>
        ) : (
          <div className="mt-2">
            <button className="pbtn px-2 py-0.5 text-xs" disabled={!cons.open} onClick={() => call()}>Call a consistory</button>
            {!cons.open && cons.why && <span className="ink-faint ml-2 text-xs">{cons.why}</span>}
          </div>
        )}
      </Sheet>

      <Sheet title="Journeys">
        {p.journey ? (
          <p className="text-sm">The journey to {p.journey.where} is being prepared: {Math.max(0, p.journey.dueWeek - game.clock.week)} weeks.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="rounded border rule bg-white/40 px-1 py-0.5 text-xs" value={where} onChange={(e) => setWhere(e.target.value)}>
              <option value="">A country…</option>
              {journeyPlaces().map((x) => <option key={x.where} value={x.where}>{x.where} ({x.region})</option>)}
            </select>
            <button className="pbtn px-2 py-0.5 text-xs" disabled={!where || !jour.open} onClick={() => { plan(where); setWhere(''); }}>Plan the journey</button>
            {!jour.open && jour.why && <span className="ink-faint text-xs">{jour.why}</span>}
          </div>
        )}
        {p.journeys.length > 0 && <p className="ink-faint mt-2 text-xs">Made: {p.journeys.map((j) => j.where).join(', ')}.</p>}
        <p className="ink-faint mt-1 text-xs">A journey is heard by the world and seen by the Church, and it costs an old man his strength.</p>
      </Sheet>

      <Sheet title="Laying it down">
        <p className="ink-muted text-xs">A pope may renounce his office, freely and duly manifested (can. 332 §2). It is not undone.</p>
        {!sure ? (
          <button className="pbtn mt-2 px-2 py-0.5 text-xs" onClick={() => setSure(true)}>Write the declaratio</button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button className="pbtn pbtn-primary px-2 py-0.5 text-xs" onClick={() => renounce()}>Renounce the see of Peter</button>
            <button className="pbtn px-2 py-0.5 text-xs" onClick={() => setSure(false)}>Not now</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
