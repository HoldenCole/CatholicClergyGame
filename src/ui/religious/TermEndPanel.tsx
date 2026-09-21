import { useGameStore } from '@/engine/store';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';

/** The term is up: he returns to the ranks, and is assigned by his successor like anyone else. E3 §3.7. */
export default function TermEndPanel() {
  const game = useGameStore((s) => s.game);
  const endTerm = useGameStore((s) => s.endTerm);
  if (!game?.religious?.office || game.mode.kind !== 'term_end') return null;
  const o = game.religious.office;
  const order = religiousOrder(game.religious.order);
  const title = o.office === 'prior' ? order.governance.priorTitle : order.governance.provincialTitle;
  return (
    <Panel title="The term ends" tilt="r">
      <p className="leading-relaxed">Your term as {title} has run. The chapter has elected your successor, or will, and you return to ordinary life in the house: assigned like anyone else, at the table like anyone else, under a man who may have run against you. Returning well is a virtue the province remembers. Returning badly is a real and tempting failure.</p>
      <div className="mt-4 flex gap-2">
        <button className="pbtn pbtn-primary" onClick={() => endTerm('well')}>Hand it over, and go back to the table</button>
        <button className="pbtn" onClick={() => endTerm('badly')}>Hand it over, and keep governing from your stall</button>
      </div>
    </Panel>
  );
}
