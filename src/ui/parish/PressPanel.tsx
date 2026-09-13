import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { mayWriteColumn, topicsFor, weeksUntilColumn } from '@/systems/press';
import Sheet from '../Sheet';

/** The diocesan paper: a column a quarter, a topic and a stance, on the record. */
export default function PressPanel() {
  const game = useGameStore((s) => s.game);
  const write = useGameStore((s) => s.writeColumn);
  const [topic, setTopic] = useState<string | null>(null);
  if (!game?.parish) return null;
  const may = mayWriteColumn(game);
  const wait = weeksUntilColumn(game);
  const topics = topicsFor(game);
  const chosen = topics.find((t) => t.topic.id === topic);
  const last = typeof game.flags['column:topic'] === 'string' ? topics.find((t) => t.topic.id === game.flags['column:topic']) : undefined;
  return (
    <Sheet title="The diocesan paper">
      <p className="text-sm leading-relaxed">
        The editor takes a column from a priest of the diocese every quarter, on the record, under your name.{' '}
        {last ? <span className="ink-muted">Your last was on {last.topic.label.toLowerCase()}. </span> : null}
        {wait > 0 ? <span className="ink-faint">He has other priests for {wait} more week{wait === 1 ? '' : 's'}.</span> : may.ok ? <span className="ink-muted">He would take one now; it costs a block of next week and says what you think where everyone can read it.</span> : <span className="ink-faint">{may.why}</span>}
      </p>
      {may.ok && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {topics.map((t) => (
              <button key={t.topic.id} className={'tab ' + (t.topic.id === topic ? 'tab-active' : '')} disabled={!t.available} title={t.why ?? t.topic.blurb} onClick={() => setTopic(t.topic.id)}>
                {t.topic.label}
              </button>
            ))}
          </div>
          {chosen && (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {chosen.topic.stances.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 rounded border rule bg-white/30 px-3 py-2">
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="ink-muted block text-xs">{s.line}</span>
                  </span>
                  <button className="pbtn shrink-0" onClick={() => { write(chosen.topic.id, s.id); setTopic(null); }}>Write it</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="ink-faint mt-2 text-xs">A column is a public position: it moves the wings and the people, it can land on the far side of the bishop, and it draws letters, a phone call from the chancery, or an invitation to speak.</p>
    </Sheet>
  );
}
