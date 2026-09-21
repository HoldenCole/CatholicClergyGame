import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { DIRECTOR_KIND_WORD, troubleOf, TROUBLE_WORD } from '@/systems/direction';
import { DIRECTOR_KINDS, type DirectorKind } from '@/types';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

/**
 * Year one, and any later year a man goes looking: which kind of director,
 * and then which man. It is presented as an administrative matter and is
 * one of the most consequential choices in the game. DESIGN.md §6.6, §9.4.
 */
export default function DirectorPanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseDirector);
  const decline = useGameStore((s) => s.declineDirectors);
  const [kind, setKind] = useState<DirectorKind | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [confessorToo, setConfessorToo] = useState(true);
  if (!game || game.mode.kind !== 'director') return null;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const options = game.mode.options;
  const firstYear = game.phase === 'seminary' && (game.seminary?.year ?? 1) < 2 && !game.flags['direction:chosen'];
  const trouble = troubleOf(game);
  const kinds = DIRECTOR_KINDS.filter((k) => options.some((o) => o.kind === k));
  const men = kind ? options.filter((o) => o.kind === kind) : [];

  return (
    <Panel title="Spiritual direction" tilt="l">
      <p className="ink-muted text-sm leading-relaxed">
        {firstYear
          ? 'The formation office asks, on a form, which of the house\u2019s directors you will see this year. Nothing said in that room is written down, reaches the rector, or enters an evaluation: the director is the internal forum and may not be consulted by the men who assess you.'
          : 'You are looking for a director. The men who would see you are of four kinds, and the kind decides more than the man: what he is for, whether he can be moved, and whether he will still be there in twenty years.'}
        {' '}He can also be your confessor, or you can keep the two apart, which is allowed and which the house notices.
      </p>
      {!firstYear && <p className="ink-faint mt-1 text-xs">What you are carrying just now reads as {TROUBLE_WORD[trouble]}.</p>}
      <div className="mt-3">
        <div className="heading text-sm">First, the kind of man</div>
        <ul className="mt-1 flex flex-col gap-1.5">
          {kinds.map((k) => {
            const w = DIRECTOR_KIND_WORD[k];
            const on = kind === k;
            return (
              <li key={k}>
                <button className={'w-full rounded border rule px-3 py-1.5 text-left text-sm ' + (on ? 'bg-white/60' : 'bg-white/25 hover:bg-white/40')} onClick={() => { setKind(k); setPicked(null); }}>
                  <span className="font-semibold">{w.label}</span> <span className="ink-faint text-xs">· {options.filter((o) => o.kind === k).length} would see you</span>
                  <span className="ink-muted block text-xs">{w.line}</span>
                  <span className="ink-faint block text-xs">For {w.good}.</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {kind && (
        <div className="mt-3">
          <div className="heading text-sm">Then, the man</div>
          <ul className="mt-1 flex flex-col gap-2">
            {men.map((o) => {
              const npc = game.npcs[o.npcId];
              const on = picked === o.npcId;
              return (
                <li key={o.npcId}>
                  <button className={'w-full rounded border rule px-3 py-2 text-left text-sm ' + (on ? 'bg-white/60' : 'bg-white/25 hover:bg-white/40')} onClick={() => setPicked(o.npcId)}>
                    <span className="flex items-center gap-2">
                      {npc && <Portrait portrait={portraitForNpc(npc, year)} size={34} />}
                      <span className="min-w-0">
                        <span className="block font-semibold">{o.name}</span>
                        <span className="ink-muted block text-xs">{o.line}{npc?.tags.includes('from_the_abbey') ? ', of the abbey two hours away' : ''}</span>
                      </span>
                    </span>
                    <span className="ink-faint mt-1 block text-xs">{o.good}. He is {o.poor}.</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confessorToo} onChange={(e) => setConfessorToo(e.target.checked)} />
        <span className="ink-muted">He will hear my confession too.</span>
      </label>
      <p className="ink-faint mt-1 text-xs">Keeping the two apart is permitted and ordinary, and is read by the house as a decision about something.</p>
      <div className="mt-3 flex gap-2">
        <button className="pbtn pbtn-primary" disabled={!picked} onClick={() => picked && choose(picked, confessorToo)}>
          {firstYear ? 'Put his name on the form' : 'Ask him'}
        </button>
        {!firstYear && <button className="pbtn" onClick={decline}>Not now</button>}
      </div>
    </Panel>
  );
}
