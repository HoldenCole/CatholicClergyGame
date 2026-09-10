import { availableSummers } from '@/engine/seminary';
import { useGameStore } from '@/engine/store';
import Panel from '../Panel';

export default function SummerPanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseSummer);
  if (!game || game.mode.kind !== 'summer') return null;
  const options = availableSummers(game);
  return (
    <Panel title={`Summer, year ${game.mode.year}`}>
      <p className="text-stone-300">The academic year ends. Where do you spend the summer?</p>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {options.map(({ option, available }) => (
          <li key={option.id}>
            <button
              disabled={!available}
              onClick={() => choose(option.id)}
              className={
                'w-full h-full text-left rounded border p-3 ' +
                (available ? 'border-stone-800 bg-stone-900/50 hover:border-amber-600' : 'border-stone-900 text-stone-600 cursor-not-allowed')
              }
            >
              <div className="font-medium">{option.label}</div>
              <div className="mt-1 text-sm text-stone-400 leading-snug">{option.blurb}</div>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
