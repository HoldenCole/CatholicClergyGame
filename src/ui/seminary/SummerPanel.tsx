import { availableSummers } from '@/engine/seminary';
import { useGameStore } from '@/engine/store';
import Panel from '../Panel';
import { renderText } from '@/engine/text';

export default function SummerPanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseSummer);
  if (!game || game.mode.kind !== 'summer') return null;
  const options = availableSummers(game);
  return (
    <Panel title={`Summer, year ${game.mode.year}`} tilt="l">
      <p>The academic year ends. Where do you spend the summer? The diocese has its own places, and a man who has been somewhere once is not sent there twice.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {options.map(({ option, available, taken }) => (
          <li key={option.id}>
            <button disabled={!available} onClick={() => choose(option.id)} className="choice h-full border rule">
              <div className="font-medium">{renderText(option.label, game)}{taken && <span className="ink-faint ml-2 text-xs">(a summer already spent)</span>}</div>
              <div className="ink-muted mt-1 text-sm leading-snug">{renderText(option.blurb, game)}</div>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
