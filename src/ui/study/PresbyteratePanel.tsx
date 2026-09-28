import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { councilOf, councilRegard, PRESBYTERATE } from '@/systems/bishop/presbyterate';
import { priestsOfSee, shortName } from '@/systems/bishop/directions';
import Sheet from '../Sheet';

/** The presbyterate as people: the council of priests, its regard, the wings, and the year's losses. E4 R1.5. */
export default function PresbyteratePanel() {
  const game = useGameStore((s) => s.game);
  const name = useGameStore((s) => s.nameToCouncil);
  const [who, setWho] = useState('');
  if (!game?.see?.council || !game.world) return null;
  const council = councilOf(game);
  const regard = councilRegard(game);
  const word = regard >= 30 ? 'with you' : regard >= PRESBYTERATE.cold ? 'watchful' : regard >= -40 ? 'against you' : 'in open opposition';
  const f = game.world.diocese.hidden.factions;
  const priests = priestsOfSee(game).filter((n) => !council.some((c) => c.id === n.id));
  const losses = [...(game.see.losses ?? [])].reverse().slice(0, 6);
  return (
    <Sheet title="The council of priests">
      <p className="ink-muted text-xs">The council is {word}. The presbyterate reads as {Math.round(f.traditional * 100)} of a hundred of the old school, {Math.round(f.progressive * 100)} of the new, the rest hard to place.</p>
      <ul className="mt-2 flex flex-col gap-0.5 text-xs">
        {council.map((n) => (
          <li key={n.id}>{shortName(n)}{game.see!.council!.namedIds.includes(n.id) ? <span className="ink-faint"> (named by you)</span> : <span className="ink-faint"> (elected)</span>} · {n.relationship >= 30 ? 'warm' : n.relationship <= -15 ? 'cool' : 'watchful'}</li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-1 text-xs">
        <select className="pinput text-xs" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Name a man to it…</option>{priests.map((n) => <option key={n.id} value={n.id}>{shortName(n)}</option>)}</select>
        <button className="pbtn px-2 py-0.5 text-xs" disabled={!who} onClick={() => { name(who); setWho(''); }}>Name</button>
      </div>
      {losses.length > 0 && (
        <ul className="ink-muted mt-2 flex flex-col gap-0.5 text-xs">
          {losses.map((l, i) => <li key={i}>{l.name} {l.why === 'died' ? 'died' : 'retired'}.</li>)}
        </ul>
      )}
    </Sheet>
  );
}
