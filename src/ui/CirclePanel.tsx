import { useGameStore } from '@/engine/store';
import { CIRCLE_LABEL, CIRCLE_ORDER, circleOf, type CircleGroup } from '@/systems/circle';
import Sheet from './Sheet';
import Portrait from './portraits/Portrait';
import { portraitForNpc, yearOf } from './portraits/spec';
import TalkButton from './parish/TalkButton';
import { LastTalk } from './parish/TalkButton';
import { ENEMIES, mayMend } from '@/systems/enemies';

/** The circle: everyone who matters to the man, across the whole life, and how each of them holds him now. */
export default function CirclePanel() {
  const game = useGameStore((s) => s.game);
  const mend = useGameStore((s) => s.mendWith);
  if (!game?.character) return null;
  const rows = circleOf(game);
  const year = yearOf(game.clock.startDay, game.clock.week);
  const groups = CIRCLE_ORDER.map((g) => [g, rows.filter((r) => r.group === g)] as [CircleGroup, typeof rows]).filter(([, rs]) => rs.length > 0);
  const friends = rows.filter((r) => r.npc.status === 'active' && r.npc.relationship >= 40).length;
  const drifting = rows.filter((r) => r.npc.status === 'active' && / drifting$/.test(r.regard)).length;
  return (
    <Sheet title="The circle">
      <p className="ink-muted mb-2 text-xs">
        {rows.length === 0 ? 'Nobody yet. The people come with the years.' : `${rows.length} people who matter, ${friends} of them friends${drifting ? `, ${drifting} drifting for want of a word` : ''}. Regard settles toward what has passed between you; the top of it costs keeping.`}
      </p>
      {groups.map(([g, rs]) => (
        <div key={g} className="mb-3">
          <h4 className="heading mb-1 text-xs">{CIRCLE_LABEL[g]}</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {rs.map((r) => (
              <li key={r.npc.id} className={'flex items-start gap-2 ' + (r.status ? 'ink-faint' : '')}>
                <Portrait portrait={portraitForNpc(r.npc, year)} size={22} />
                <span className="min-w-0 flex-1">
                  <span>{r.npc.title ? `${r.npc.title} ` : ''}{r.npc.name.first} {r.npc.name.last}, {r.who}{r.status ? `, ${r.status}` : ''}</span>
                  <span className="ink-muted ml-2">{r.regard}{r.seen ? ` · ${r.seen}` : ''}</span>
                  {r.history && <span className="ink-faint block text-xs">{r.history}</span>}
                </span>
                {!r.status && (r.group === 'class' || r.group === 'brothers' || r.group === 'chancery' || r.group === 'parish') && <TalkButton npcId={r.npc.id} />}
                {!r.status && r.npc.relationship <= ENEMIES.mendAt && (() => { const may = mayMend(game, r.npc.id); return <button className="pbtn-link text-xs" disabled={!may.ok} title={may.ok ? 'Two hours of the coming week: go to him, and see what kind of man he is' : may.why ?? ''} onClick={() => mend(r.npc.id)}>make amends</button>; })()}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <LastTalk npcIds={rows.map((r) => r.npc.id)} />
    </Sheet>
  );
}
