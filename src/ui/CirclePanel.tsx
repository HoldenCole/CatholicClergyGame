import { useGameStore } from '@/engine/store';
import { circleLabel, circleOrder, circleOf, type CircleGroup } from '@/systems/circle';
import Sheet, { FoldHeading, useFold } from './Sheet';
import { useState } from 'react';
import Portrait from './portraits/Portrait';
import { portraitForNpc, yearOf } from './portraits/spec';
import TalkButton from './parish/TalkButton';
import { LastTalk } from './parish/TalkButton';
import { ENEMIES, mayMend } from '@/systems/enemies';

const SHOWN = 8;

/** A group of the circle: folded by its heading, the far groups closed to start, and eight rows before the rest are asked for. */
function CircleGroupRows({ group, label, count, summary, children }: { group: CircleGroup; label: string; count: number; summary: string; children: (shown: number) => React.ReactNode }) {
  const [open, toggle] = useFold(`circle:${group}`, group !== 'former' && group !== 'others');
  const [all, setAll] = useState(false);
  const shown = all ? count : SHOWN;
  return (
    <div className="mb-3">
      <FoldHeading open={open} onToggle={toggle} title={label} summary={summary} className="mb-1" />
      {open && children(shown)}
      {open && count > shown && <button className="pbtn-link mt-1 text-xs" onClick={() => setAll(true)}>and {count - shown} more</button>}
    </div>
  );
}

/** The circle: everyone who matters to the man, across the whole life, and how each of them holds him now. */
export default function CirclePanel() {
  const game = useGameStore((s) => s.game);
  const mend = useGameStore((s) => s.mendWith);
  if (!game?.character) return null;
  const rows = circleOf(game);
  const year = yearOf(game.clock.startDay, game.clock.week);
  const groups = circleOrder(game).map((g) => [g, rows.filter((r) => r.group === g)] as [CircleGroup, typeof rows]).filter(([, rs]) => rs.length > 0);
  const friends = rows.filter((r) => r.npc.status === 'active' && r.npc.relationship >= 40).length;
  const drifting = rows.filter((r) => r.npc.status === 'active' && / drifting$/.test(r.regard)).length;
  return (
    <Sheet title="The circle">
      <p className="ink-muted mb-2 text-xs">
        {rows.length === 0 ? 'Nobody yet. The people come with the years.' : `${rows.length} people who matter, ${friends} of them friends${drifting ? `, ${drifting} drifting for want of a word` : ''}. Regard settles toward what has passed between you; the top of it costs keeping.`}
      </p>
      {groups.map(([g, rs]) => (
        <CircleGroupRows key={g} group={g} label={circleLabel(game, g)} count={rs.length} summary={`${rs.length}; ${rs.filter((r) => r.npc.status === 'active' && r.npc.relationship >= 40).length} friends`}>
          {(shown) => (
          <ul className="flex flex-col gap-1 text-sm">
            {rs.slice(0, shown).map((r) => (
              <li key={r.npc.id} className={'flex items-start gap-2 ' + (r.status ? 'ink-faint' : '')}>
                <Portrait portrait={portraitForNpc(r.npc, year)} size={22} />
                <span className="min-w-0 flex-1">
                  <span>{r.npc.title ? `${r.npc.title} ` : ''}{r.npc.name.first} {r.npc.name.last}, {r.who}{r.status ? `, ${r.status}` : ''}</span>
                  <span className="ink-muted ml-2">{r.regard}{r.seen ? ` · ${r.seen}` : ''}</span>
                  {r.history && <span className="ink-faint block text-xs">{r.history}</span>}
                </span>
                {!r.status && (r.group === 'class' || r.group === 'brothers' || r.group === 'chancery' || r.group === 'parish' || r.group === 'house' || r.group === 'province' || r.group === 'directees') && <TalkButton npcId={r.npc.id} />}
                {!r.status && r.npc.relationship <= ENEMIES.mendAt && (() => { const may = mayMend(game, r.npc.id); return <button className="pbtn-link text-xs" disabled={!may.ok} title={may.ok ? 'Two hours of the coming week: go to him, and see what kind of man he is' : may.why ?? ''} onClick={() => mend(r.npc.id)}>make amends</button>; })()}
              </li>
            ))}
          </ul>
          )}
        </CircleGroupRows>
      ))}
      <LastTalk npcIds={rows.map((r) => r.npc.id)} />
    </Sheet>
  );
}
