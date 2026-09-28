import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { ageOf, awayOf, destinationsFor, directionsFor, officeOf, parishOf, priestsOfSee, shortName } from '@/systems/bishop/directions';
import { OFFICE_LABEL } from '@/generation/chancery';
import { directionDef } from '@/content/see';
import type { ChanceryOffice } from '@/types';
import Sheet from '../Sheet';

const OFFICES: ChanceryOffice[] = ['vicar_general', 'chancellor', 'vicar_for_clergy'];

/** The priests of the see, and what the bishop may direct each to. E4 R1.2. */
export default function DirectionsPanel() {
  const game = useGameStore((s) => s.game);
  const give = useGameStore((s) => s.giveDirection);
  const [who, setWho] = useState<string | null>(null);
  const [which, setWhich] = useState<string | null>(null);
  const [parishId, setParishId] = useState('');
  const [office, setOffice] = useState<ChanceryOffice>('vicar_general');
  if (!game?.see) return null;
  const priests = priestsOfSee(game);
  const npc = who ? game.npcs[who] : undefined;
  const options = npc ? directionsFor(game, npc) : [];
  const chosen = which ? directionDef(which) : undefined;
  const dests = npc ? destinationsFor(game, npc) : [];
  const ready = !!chosen && (chosen.target === 'parish' ? !!parishId : true);
  const lastFor = (id: string) => (game.see!.directions ?? []).filter((d) => d.npcId === id).at(-1);
  return (
    <Sheet title="The priests">
      {priests.length === 0 ? (
        <p className="ink-faint text-sm">The see has no priests of its own yet.</p>
      ) : (
        <>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto text-xs">
            {priests.map((n) => {
              const parish = parishOf(game, n);
              const off = officeOf(n);
              const away = awayOf(n);
              const last = lastFor(n.id);
              return (
                <li key={n.id}>
                  <label className={'flex cursor-pointer items-start gap-2 ' + (who === n.id ? 'ink-wine' : '')}>
                    <input type="radio" name="priest" checked={who === n.id} onChange={() => { setWho(n.id); setWhich(null); setParishId(''); }} />
                    <span>
                      {shortName(n)}, {ageOf(game, n)}{off ? `, ${OFFICE_LABEL[off]}` : ''}{parish ? `, ${parish.name}` : ''}{n.tags.includes('dean') ? ', dean' : ''}
                      {away && <span className="ink-faint"> (away: {away.what})</span>}
                      {last && <span className="ink-faint"> · {directionDef(last.id)?.label.toLowerCase()}, {last.answer}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {npc && (
            <div className="mt-2 text-xs">
              <p className="ink-muted">{shortName(npc)}: {npc.relationship >= 30 ? 'warm toward you' : npc.relationship <= -15 ? 'cool toward you' : 'watchful'}; {npc.alignment <= -25 ? 'of the old school' : npc.alignment >= 25 ? 'of the new' : 'hard to place'}{npc.traitKnown ? `; ${npc.hiddenTrait.replace(/_/g, ' ')}` : ''}.</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {options.map(({ def, ok, why }) => (
                  <li key={def.id}>
                    <label className={'flex items-start gap-2 ' + (ok ? 'cursor-pointer' : 'ink-faint')}>
                      <input type="radio" name="direction" disabled={!ok} checked={which === def.id} onChange={() => setWhich(def.id)} />
                      <span><span className={ok ? '' : 'line-through'}>{def.label}</span>{why ? <span className="ink-faint"> ({why.toLowerCase()})</span> : null}{which === def.id && <span className="ink-muted block">{def.blurb}</span>}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {chosen?.target === 'parish' && (
                <select className="pinput mt-1 text-xs" value={parishId} onChange={(e) => setParishId(e.target.value)}>
                  <option value="">Which parish</option>
                  {dests.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.place}{!game.npcs[p.pastorId] || game.npcs[p.pastorId]!.status !== 'active' ? ' (vacant)' : ''}</option>)}
                </select>
              )}
              {chosen?.target === 'office' && (
                <select className="pinput mt-1 text-xs" value={office} onChange={(e) => setOffice(e.target.value as ChanceryOffice)}>
                  {OFFICES.map((o) => <option key={o} value={o}>{OFFICE_LABEL[o]}</option>)}
                </select>
              )}
              <button className="pbtn pbtn-primary mt-2 px-2 py-0.5 text-xs" disabled={!ready} onClick={() => { if (chosen && npc) give(npc.id, chosen.id, chosen.target === 'parish' ? { parishId } : chosen.target === 'office' ? { office } : {}); setWhich(null); setParishId(''); }}>Call him in</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
