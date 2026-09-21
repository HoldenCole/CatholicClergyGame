import { useGameStore } from '@/engine/store';
import { charterDials, religiousOrder } from '@/content/religious';
import { CHARTER_DIALS, dialLabel, optionAllowed } from '@/systems/religious/charter';
import { worldOf } from '@/systems/religious/transfer';
import type { CharterDial } from '@/types';
import Panel from '../Panel';

/**
 * The charter: what the house is to be. The charism is the order's; the
 * dials are the founder's, each with its prose consequence and no
 * numbers. Written once; revised only by a prior. E3 §9.4.
 */
export default function CharterPanel() {
  const game = useGameStore((s) => s.game);
  const setDraft = useGameStore((s) => s.setCharterDraft);
  const write = useGameStore((s) => s.writeCharter);
  if (!game?.religious?.charterDraft || game.mode.kind !== 'charter' || !game.religious.petition) return null;
  const draft = game.religious.charterDraft;
  const pet = game.religious.petition;
  const order = religiousOrder(game.religious.order);
  const name = worldOf(game, pet.dioceseId)?.diocese.visible.name ?? 'the diocese';
  return (
    <Panel title="The charter" tilt="l">
      <h2 className="title text-xl">A house in {name}</h2>
      <p className="mt-2 leading-relaxed">The province has voted it and the bishop has signed. What is left is the thing itself: under the charism of the {order.name}, which is fixed, everything below is yours. These interact, and the interactions are the house. Men who never met you will read this.</p>
      <div className="mt-3 flex flex-col gap-3">
        {CHARTER_DIALS.map((dial: CharterDial) => (
          <div key={dial}>
            <div className="heading text-sm">{dialLabel(dial)}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {charterDials[dial].map((o) => {
                const allowed = optionAllowed(game, dial, o.id, pet.dioceseId);
                const on = String(draft[dial]) === o.id;
                return (
                  <button key={o.id} className={'pbtn px-2 py-0.5 text-xs ' + (on ? 'pbtn-primary' : '')} disabled={!allowed.ok} title={allowed.why ?? ''} onClick={() => setDraft({ [dial]: o.id } as never)}>{o.label}</button>
                );
              })}
            </div>
            <p className="ink-muted mt-1 text-xs leading-relaxed">{charterDials[dial].find((o) => o.id === String(draft[dial]))?.line}</p>
          </div>
        ))}
        <div>
          <div className="heading text-sm">Alignment, within the charism</div>
          <input type="range" min={-80} max={80} step={10} value={draft.alignment} onChange={(e) => setDraft({ alignment: Number(e.target.value) })} className="mt-1 w-full" />
          <p className="ink-muted text-xs">{draft.alignment <= -40 ? 'Traditional: the house sits on the observant side of the province\'s fault line, and the men who want that will find it.' : draft.alignment >= 40 ? 'Progressive: the house sits on the other side of the line, and a strict observance beside it will read as a contradiction.' : 'Near the middle: the house takes no side the province can name, which the province finds restful or evasive.'}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="pbtn pbtn-primary" onClick={write}>Write it, and send for the men</button>
      </div>
    </Panel>
  );
}
