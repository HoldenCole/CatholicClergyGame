import { useGameStore } from '@/engine/store';
import { religiousOrder } from '@/content/religious';
import { CHARTER_DIALS, dialLabel, optionAllowed, optionIdOf } from '@/systems/religious/charter';
import { mostNeededWorks, workNeeds } from '@/systems/religious/founding';
import { worldOf } from '@/systems/religious/transfer';
import type { CharterDial, CharterWork } from '@/types';
import Panel from '../Panel';
import DialRow from './DialRow';

/**
 * The charter: what the house is to be. The charism is the order's; the
 * dials are the founder's, each with its prose consequence and no
 * numbers. A work another house already does here is greyed; the works
 * the diocese most needs are marked. Written once; revised only by a
 * prior. E3 §9.4.
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
  const needs = workNeeds(game, pet.dioceseId);
  const most = mostNeededWorks(game, pet.dioceseId);
  const problems = CHARTER_DIALS.filter((d) => !optionAllowed(game, d, optionIdOf(draft, d), pet.dioceseId, draft).ok);
  const setDial = (dial: CharterDial, id: string) => {
    if ((dial === 'secondaryWork' || dial === 'tertiaryWork') && id === 'none') setDraft({ [dial]: undefined } as never);
    else setDraft({ [dial]: id } as never);
  };
  return (
    <Panel title="The charter" tilt="l">
      <h2 className="title text-xl">A house in {name}</h2>
      <p className="mt-2 leading-relaxed">The province has voted it and the bishop has signed. What is left is the thing itself: under the charism of the {order.name}, which is fixed, everything below is yours. These interact, and the interactions are the house. Men who never met you will read this.</p>
      <p className="ink-faint mt-1 text-xs">Marks beside a work are the diocese&rsquo;s need for it; the works it needs most are named. A work greyed is one a house already does here. A second work counts at half, a third at a quarter.</p>
      <div className="mt-3 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        {CHARTER_DIALS.map((dial: CharterDial) => (
          <DialRow key={dial} dial={dial} current={optionIdOf(draft, dial)} allowed={(id) => optionAllowed(game, dial, id, pet.dioceseId, draft)} onPick={(id) => setDial(dial, id)} needs={dial === 'primaryWork' || dial === 'secondaryWork' || dial === 'tertiaryWork' ? needs : undefined} most={most} />
        ))}
        <div>
          <div className="heading text-sm">Alignment, within the charism</div>
          <input type="range" min={-80} max={80} step={10} value={draft.alignment} onChange={(e) => setDraft({ alignment: Number(e.target.value) })} className="mt-1 w-full" />
          <p className="ink-muted text-xs">{draft.alignment <= -40 ? 'Traditional: the house sits on the observant side of the province\'s fault line, and the men who want that will find it.' : draft.alignment >= 40 ? 'Progressive: the house sits on the other side of the line, and a strict observance beside it will read as a contradiction.' : 'Near the middle: the house takes no side the province can name, which the province finds restful or evasive.'}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="pbtn pbtn-primary" disabled={problems.length > 0} onClick={write}>Write it, and send for the men</button>
        {problems.length > 0 && <span className="ink-wine self-center text-xs">Not yet: {problems.map((d) => `${dialLabel(d).toLowerCase()} (${optionAllowed(game, d, optionIdOf(draft, d), pet.dioceseId, draft).why ?? 'not allowed'})`).join('; ')}.</span>}
      </div>
    </Panel>
  );
}

export type { CharterWork };
