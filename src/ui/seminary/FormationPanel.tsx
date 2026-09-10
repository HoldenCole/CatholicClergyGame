import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { FORMATION } from '@/systems/formation';
import { PILLARS, STAT_KEYS, CONSTITUENCY_KEYS, type Pillar } from '@/types';
import Sheet from '../Sheet';
import { pillarWord } from './EvaluationPanel';

const PILLAR_LABEL: Record<Pillar, string> = { human: 'Human', spiritual: 'Spiritual', intellectual: 'Intellectual', pastoral: 'Pastoral' };

export default function FormationPanel() {
  const game = useGameStore((s) => s.game);
  const leave = useGameStore((s) => s.leaveSeminary);
  const [inspect, setInspect] = useState(false);
  if (!game?.character || !game.seminary) return null;
  const c = game.character;
  const sem = game.seminary;
  const classmates = sem.classmateIds.map((id) => game.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  // Mid-year, show where the pillar is heading at the current pace rather than the raw total so far.
  const elapsed = Math.max(1, Math.min(FORMATION.academicWeeks, game.clock.week - sem.yearStartWeek));
  const pace = (p: Pillar) => (sem.pillarScores[p] * FORMATION.academicWeeks) / elapsed;

  return (
    <>
      <Sheet title={`${c.name.first} ${c.name.last} · year ${sem.year} · ${sem.name}`}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {PILLARS.map((p) => (
            <div key={p} className="flex justify-between">
              <dt className="ink-muted">{PILLAR_LABEL[p]}</dt>
              <dd>{sem.emphasis ? pillarWord(elapsed < 4 ? (sem.emphasis[p] ?? 0) * FORMATION.pillarPerPoint : pace(p)) : '—'}</dd>
            </div>
          ))}
        </dl>
        {sem.concerns.length > 0 && <p className="ink-wine mt-3 text-xs">In the file: {sem.concerns.join(' ')}</p>}
      </Sheet>
      <Sheet title="Classmates">
        <ul className="scroll-paper flex max-h-48 flex-col gap-0.5 overflow-y-auto text-sm">
          {classmates.map((n) => (
            <li key={n.id} className={'flex justify-between ' + (n.status !== 'active' ? 'ink-faint line-through' : '')}>
              <span>{n.name.first} {n.name.last}</span>
              <span className="ink-muted">{relationshipWord(n.relationship)}</span>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet title="">
        <div className="flex items-center justify-between">
          <button className="pbtn-link" onClick={() => setInspect((v) => !v)}>{inspect ? 'Hide the numbers' : 'Inspect the numbers'}</button>
          {game.mode.kind === 'clock' && (
            <button className="pbtn-link" onClick={() => confirm('Leave the seminary? This ends the run.') && leave()}>Leave the seminary</button>
          )}
        </div>
        {inspect && (
          <div className="ink-muted mt-2 grid grid-cols-2 gap-x-6 font-mono text-xs">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.stats[k].toFixed(1)}</span></div>
            ))}
            <div className="flex justify-between"><span>alignment</span><span>{c.alignment.toFixed(0)}</span></div>
            <div className="flex justify-between"><span>outspokenness</span><span>{c.outspokenness.toFixed(0)}</span></div>
            {CONSTITUENCY_KEYS.map((k) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.reputation[k]}</span></div>
            ))}
            {PILLARS.map((p) => (
              <div key={p} className="flex justify-between"><span>{p}</span><span>{sem.pillarScores[p].toFixed(1)}</span></div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

function relationshipWord(r: number): string {
  if (r >= 40) return 'a friend';
  if (r >= 15) return 'warm';
  if (r > -15) return 'civil';
  if (r > -40) return 'cool';
  return 'hostile';
}
