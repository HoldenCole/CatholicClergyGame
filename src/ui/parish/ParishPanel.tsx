import { useGameStore } from '@/engine/store';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { STAT_KEYS, CONSTITUENCY_KEYS } from '@/types';
import { useState } from 'react';
import { arcKey } from '@/llm/skin';
import Sheet from '../Sheet';

function word(v: number): string {
  if (v >= 50) return 'devoted';
  if (v >= 20) return 'warm';
  if (v > -10) return 'civil';
  if (v > -40) return 'cool';
  return 'hostile';
}

export default function ParishPanel() {
  const game = useGameStore((s) => s.game);
  const prose = useGameStore((s) => s.prose);
  const [inspect, setInspect] = useState(false);
  if (!game?.parish || !game.world || !game.character) return null;
  const portraitKey = arcKey(game);
  const portrait = portraitKey ? prose[portraitKey] : undefined;
  const c = game.character;
  const p = game.parish;
  const parish = game.world.parishes.find((x) => x.id === p.parishId)!;
  const pastor = game.npcs[parish.pastorId];
  const staff = p.staffIds.map((id) => game.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  const yearsIn = Math.floor(p.weeksServed / 52);
  const bishop = game.npcs[game.world.diocese.hidden.bishop.npcId];
  const fin = p.finance;

  return (
    <>
      <Sheet title={`${parish.name}, ${parish.place}`}>
        <p className="text-sm leading-relaxed">
          {c.name.first} {c.name.last}, {p.role.replace('_', ' ')}, {yearsIn === 0 ? 'first year' : `year ${yearsIn + 1}`}. {game.world.diocese.visible.name}
          {bishop ? `, under ${bishop.title} ${bishop.name.last}` : ''}.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between"><dt className="ink-muted">The people</dt><dd>{word(c.reputation.parishioners)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">The chancery</dt><dd>{word(c.reputation.chancery)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Brother priests</dt><dd>{word(c.reputation.brother_priests)}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Attendance</dt><dd>{Math.round(p.attendance * 100)}% of the rolls</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Cash</dt><dd>${fin.cash.toLocaleString()}</dd></div>
          <div className="flex justify-between"><dt className="ink-muted">Debt</dt><dd>${fin.debt.toLocaleString()}</dd></div>
        </dl>
        <p className="ink-muted mt-3 text-xs">{PROBLEM_LABEL[parish.problem] ?? parish.problem}</p>
        {portrait && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{portrait}</p>}
      </Sheet>
      <Sheet title="The rectory and the office">
        <ul className="text-sm">
          {pastor && (
            <li className="flex justify-between"><span>{pastor.title} {pastor.name.first} {pastor.name.last}, pastor</span><span className="ink-muted">{word(pastor.relationship)}</span></li>
          )}
          {staff.map((n) => (
            <li key={n.id} className="flex justify-between">
              <span>{n.name.first} {n.name.last}, {(n.tags[0] ?? '').replace('_', ' ')}</span>
              <span className="ink-muted">{word(n.relationship)}</span>
            </li>
          ))}
        </ul>
        {game.commitments.length > 0 && <p className="ink-muted mt-2 text-xs">Also on your plate: {game.commitments.map((x) => x.label).join(', ')}.</p>}
        <button className="pbtn-link mt-3" onClick={() => setInspect((v) => !v)}>
          {inspect ? 'Hide the numbers' : 'Inspect the numbers'}
        </button>
        {inspect && (
          <div className="ink-muted mt-2 grid grid-cols-2 gap-x-6 font-mono text-xs">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.stats[k].toFixed(1)}</span></div>
            ))}
            <div className="flex justify-between"><span>alignment</span><span>{c.alignment.toFixed(0)}</span></div>
            <div className="flex justify-between"><span>outspokenness</span><span>{c.outspokenness.toFixed(0)}</span></div>
            {CONSTITUENCY_KEYS.map((k) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span>{c.reputation[k].toFixed(0)}</span></div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
