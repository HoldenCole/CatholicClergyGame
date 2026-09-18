import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

/**
 * Year one: the formation office asks which of these men he will see. It is
 * presented as an administrative matter and is one of the most consequential
 * choices in the game. DESIGN.md §6.6, §9.4.
 */
export default function DirectorPanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseDirector);
  const [picked, setPicked] = useState<string | null>(null);
  const [confessorToo, setConfessorToo] = useState(true);
  if (!game || game.mode.kind !== 'director') return null;
  const year = yearOf(game.clock.startDay, game.clock.week);

  return (
    <Panel title="Spiritual direction" tilt="l">
      <p className="ink-muted text-sm leading-relaxed">
        The formation office asks, on a form, which of the house&rsquo;s directors you will see this year. Nothing said in that room is written down, reaches the rector, or enters an evaluation: the director is the internal
        forum and may not be consulted by the men who assess you. He can also be your confessor, or you can keep the two apart, which is allowed and which the house notices.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {game.mode.options.map((o) => {
          const npc = game.npcs[o.npcId];
          const on = picked === o.npcId;
          return (
            <li key={o.npcId}>
              <button
                className={'w-full rounded border rule px-3 py-2 text-left text-sm ' + (on ? 'bg-white/60' : 'bg-white/25 hover:bg-white/40')}
                onClick={() => setPicked(o.npcId)}
              >
                <span className="flex items-center gap-2">
                  {npc && <Portrait portrait={portraitForNpc(npc, year)} size={34} />}
                  <span className="min-w-0">
                    <span className="block font-semibold">{o.name}</span>
                    <span className="ink-muted block text-xs">{o.line}</span>
                  </span>
                </span>
                <span className="ink-faint mt-1 block text-xs">{o.good}. He is {o.poor}.</span>
              </button>
            </li>
          );
        })}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confessorToo} onChange={(e) => setConfessorToo(e.target.checked)} />
        <span className="ink-muted">He will hear my confession too.</span>
      </label>
      <p className="ink-faint mt-1 text-xs">Keeping the two apart is permitted and ordinary, and is read by the house as a decision about something.</p>
      <button className="pbtn pbtn-primary mt-3" disabled={!picked} onClick={() => picked && choose(picked, confessorToo)}>
        Put his name on the form
      </button>
    </Panel>
  );
}
