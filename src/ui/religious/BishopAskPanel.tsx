import { useGameStore } from '@/engine/store';
import { bishopAskLetter } from '@/systems/religious/bishopAsks';
import Panel from '../Panel';

/**
 * The bishop's office asked the provincial for the friar. The provincial
 * has answered for the province; when he left it to the man, the man
 * answers here. The bishop is never the one being answered. E3 §3.11.
 */
export default function BishopAskPanel() {
  const game = useGameStore((s) => s.game);
  const answer = useGameStore((s) => s.answerBishopAsk);
  if (!game?.religious?.bishopAsk || game.mode.kind !== 'bishop_ask') return null;
  const ask = game.religious.bishopAsk;
  const letter = bishopAskLetter(game);
  if (!letter) return null;
  return (
    <Panel title="The provincial's desk" tilt="r">
      <h2 className="title text-xl">{letter.title}</h2>
      {letter.body.map((p, i) => (
        <p key={i} className="mt-2 leading-relaxed">{p}</p>
      ))}
      <p className="ink-faint mt-3 text-xs">The order is in charge of you. The bishop asked the order; the order answered; what is left is yours.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ask.answer === 'refused' ? (
          <button className="pbtn pbtn-primary" onClick={() => answer(false)}>Put it in the drawer</button>
        ) : (
          <>
            <button className="pbtn pbtn-primary" onClick={() => answer(true)}>{ask.answer === 'both' ? 'Take it, beside what you do' : 'Take it, and lay down the work you have'}</button>
            <button className="pbtn" onClick={() => answer(false)}>Ask the provincial to decline</button>
          </>
        )}
      </div>
    </Panel>
  );
}
