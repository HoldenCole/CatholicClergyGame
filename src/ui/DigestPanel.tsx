import { useGameStore } from '@/engine/store';
import { useState } from 'react';
import { publicRecord } from '@/systems/record';
import { arcHistory, arcLines } from '@/systems/arcs';
import { LANE_LABEL, readDigest, type Lane } from '@/systems/digest';
import { whatIsGoingOn } from '@/systems/digest';
import type { DigestWeek } from '@/types';
import Sheet from './Sheet';
import { useUiStore } from './uiStore';

const SHOWN = 26;
const LANES: Lane[] = ['decided', 'money', 'parish', 'people', 'diocese', 'you', 'around'];
const FILTERS: { key: Lane | 'all'; label: string }[] = [{ key: 'all', label: 'Everything' }, { key: 'decided', label: 'Decided' }, { key: 'money', label: 'Money' }, { key: 'parish', label: 'Parish' }, { key: 'people', label: 'People' }, { key: 'diocese', label: 'Diocese' }, { key: 'you', label: 'You' }];

function arrow(sign: -1 | 0 | 1): string {
  return sign > 0 ? '\u2191' : sign < 0 ? '\u2193' : '\u2192';
}

/** The weeks, read: a month at a glance, then each week in lanes with the money and the pews against the week before. */
function WeeksSheet({ digest, going }: { digest: DigestWeek[]; going: string[] }) {
  // The filter is kept across the desk's tabs, so a man reading the money does not start over each time he looks away.
  const filter = useUiStore((s) => s.digestLane);
  const setFilter = useUiStore((s) => s.setDigestLane);
  const [flavor, setFlavor] = useState(false);
  const [more, setMore] = useState(0);
  const weeks = readDigest(digest, SHOWN + more);
  const shown = weeks.filter((w) => filter === 'all' ? true : (w.lanes[filter]?.length ?? 0) > 0);
  return (
    <Sheet title="The weeks">
      {going.length > 0 && (
        <div className="mb-3 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">
          <span className="ink-faint mr-2 text-[11px] uppercase tracking-[0.18em]">This quarter</span>
          {going.join(' ')}
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
        {FILTERS.map((f) => (
          <button key={f.key} className={'tab ' + (filter === f.key ? 'tab-active' : '')} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
        <label className="ink-faint ml-auto flex items-center gap-1"><input type="checkbox" checked={flavor} onChange={(e) => setFlavor(e.target.checked)} /> around the parish</label>
      </div>
      {shown.length === 0 ? (
        <p className="ink-faint text-sm">{weeks.length === 0 ? 'No weeks have passed yet.' : 'Nothing of that kind in these weeks.'}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {shown.map((w) => (
            <li key={w.week} className={'border-t rule pt-1.5 ' + (w.eventful ? '' : 'ink-muted')}>
              <div className="flex items-baseline gap-2">
                <span className="ink-faint w-8 shrink-0 text-right text-xs">{w.week}</span>
                <span className="flex-1 text-xs">{w.head}</span>
                {w.numbers.collections !== null && (
                  <span className="ink-faint shrink-0 font-mono text-xs" title={`against the usual $${(w.numbers.usual ?? 0).toLocaleString()}`}>
                    ${w.numbers.collections.toLocaleString()} {arrow(w.moneySign)} · {w.numbers.attendance}% {arrow(w.pewsSign)}
                  </span>
                )}
              </div>
              {LANES.filter((lane) => (filter === 'all' || lane === filter) && (lane !== 'around' || flavor) && lane !== 'money').map((lane) => {
                const lines = w.lanes[lane];
                if (!lines?.length) return null;
                return (
                  <div key={lane} className="ml-10 flex gap-2">
                    <span className={'w-16 shrink-0 text-[11px] uppercase tracking-[0.12em] ' + (lane === 'decided' ? 'ink-wine' : 'ink-faint')}>{LANE_LABEL[lane]}</span>
                    <span className={'min-w-0 flex-1 leading-5 ' + (lane === 'around' ? 'ink-faint' : '')}>{lines.join(' ')}</span>
                  </div>
                );
              })}
              {filter === 'all' && !Object.entries(w.lanes).some(([lane, lines]) => lane !== 'money' && (lane !== 'around' || flavor) && lines.length > 0) && (
                <div className="ml-10 ink-faint text-xs">Nothing to write down.</div>
              )}
              {filter === 'money' && w.lanes.money && w.lanes.money.length > 1 && (
                <div className="ml-10 flex gap-2"><span className="ink-faint w-16 shrink-0 text-[11px] uppercase tracking-[0.12em]">{LANE_LABEL.money}</span><span className="min-w-0 flex-1 leading-5">{w.lanes.money.filter((l) => !/^Collections \$/.test(l)).join(' ')}</span></div>
              )}
              {filter === 'all' && w.lanes.money && w.lanes.money.some((l) => !/^Collections \$/.test(l)) && (
                <div className="ml-10 flex gap-2"><span className="ink-faint w-16 shrink-0 text-[11px] uppercase tracking-[0.12em]">{LANE_LABEL.money}</span><span className="min-w-0 flex-1 leading-5">{w.lanes.money.filter((l) => !/^Collections \$/.test(l)).join(' ')}</span></div>
              )}
            </li>
          ))}
        </ol>
      )}
      {digest.length > SHOWN + more && (
        <button className="pbtn-link mt-2 text-xs" onClick={() => setMore(more + 52)}>Another year of weeks</button>
      )}
    </Sheet>
  );
}

/** The record: what each week came to, most recent first; the file; and the public record of stands taken. */
export default function DigestPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const notes = game.career.slice(-8).reverse();
  const record = publicRecord(game);
  const letters = (game.letters ?? []).slice(-6).reverse();

  return (
    <>
      <WeeksSheet digest={game.digest} going={game.parish ? whatIsGoingOn(game) : []} />
      {game.character && (
        <>
        <Sheet title="What is running">
          {(() => {
            const open = arcLines(game);
            const done = arcHistory(game);
            if (!open.length && !done.length) return <p className="ink-faint text-sm">Nothing long is running. Things that take years open on their own, in a parish a man has been in a while.</p>;
            return (
              <>
                <ul className="flex flex-col gap-2 text-sm">
                  {open.map((a) => (
                    <li key={a.title}>
                      <div className="font-semibold">{a.title}<span className="ink-faint ml-2 text-xs">{a.years >= 1 ? `${a.years} year${a.years === 1 ? '' : 's'} in` : 'just begun'}</span></div>
                      <div className="ink-muted text-xs">{a.line}</div>
                    </li>
                  ))}
                </ul>
                {done.length > 0 && (
                  <p className="ink-faint mt-2 text-xs">Finished: {done.map((d) => `${d.title} (${d.outcome.replace(/_/g, ' ')}, ${d.years} year${d.years === 1 ? '' : 's'})`).join('; ')}.</p>
                )}
              </>
            );
          })()}
        </Sheet>

        <Sheet title="The public record">
          <p className="text-sm">You are {record.standing}. {record.bishopLine}</p>
          {record.rows.length === 0 ? (
            <p className="ink-faint mt-2 text-xs">You have taken no stand anyone could quote.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {record.rows.slice(0, 14).map((r, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="ink-faint w-8 shrink-0 text-right text-xs">{r.week}</span>
                  <span className="flex-1">On {r.topic}, {r.side}, {r.volume}.</span>
                  <span className={'text-xs ' + (r.reading === 'against' ? 'ink-wine' : 'ink-faint')}>
                    {r.reading === 'with' ? 'the bishop agrees' : r.reading === 'against' ? 'the bishop does not' : 'unread'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
        </>
      )}
      {notes.length > 0 && (
        <Sheet title="The file">
          <ol className="flex flex-col gap-1 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="ink-muted">{n.text}</li>
            ))}
          </ol>
        </Sheet>
      )}
      {letters.length > 0 && (
        <Sheet title="The drawer">
          <ol className="flex flex-col gap-1 text-sm">
            {letters.map((l, i) => (
              <li key={i} className="ink-muted">
                <span className="ink-faint mr-2 text-xs">{l.week}</span>{l.title}. {l.body[0]}
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </>
  );
}
