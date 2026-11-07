import { useGameStore } from '@/engine/store';
import { languageLabel } from '@/systems/schedule';
import Panel from '../Panel';

/**
 * The Secretariat's letter: three posts, each with what a man can know of it
 * before he goes, and the way home when there is one. E1 §11.10.
 */
export default function PostingChoicePanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.choosePosting);
  if (!game || game.mode.kind !== 'posting_choice') return null;
  const { options, why, first, canGoHome } = game.mode;
  return (
    <Panel title={first ? 'The Secretariat of State: your first country' : 'The Secretariat of State: the next country'} tilt="l">
      <p className="leading-relaxed">{why}</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {options.map((o) => (
          <li key={o.country} className="flex flex-col rounded border rule bg-white/30 px-3 py-2">
            <h3 className="title text-lg">{o.country.replace(/^./, (c) => c.toUpperCase())}</h3>
            <p className="ink-muted text-xs">{o.region} · {o.hardshipWord}{o.language ? ` · ${languageLabel(o.language)}${o.speaks ? ', which you have' : ', which you do not have yet'}` : ''}{o.preferred ? ' · what you asked for' : ''}</p>
            <p className="mt-1 text-sm leading-relaxed">The Church there is {o.church}.</p>
            <p className="ink-muted mt-1 flex-1 text-sm leading-relaxed">{o.line}</p>
            <button className="pbtn pbtn-primary mt-2 self-start" onClick={() => choose(o.country)}>{first ? `Go to ${o.country}` : `Take ${o.country}`}</button>
          </li>
        ))}
      </ul>
      {canGoHome && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded border rule bg-white/20 px-3 py-2">
          <span className="text-sm leading-relaxed">Or ask to be released to go home to your diocese. The Secretariat lets a priest go, with thanks; the board will have a parish for you.</span>
          <button className="pbtn shrink-0" onClick={() => choose('home')}>Ask to go home</button>
        </div>
      )}
      {!canGoHome && !first && <p className="ink-faint mt-2 text-xs">A nuncio does not go home to a parish; his service ends at seventy-five, or with a red hat.</p>}
    </Panel>
  );
}
