import { useGameStore } from '@/engine/store';
import { CATEGORY_LABELS } from '@/engine/interrupts';
import { EVENT_CATEGORIES, INTERRUPT_LEVELS, type InterruptLevel } from '@/types';
import Panel from './Panel';

const LEVEL_LABELS: Record<InterruptLevel, string> = {
  ROUTINE: 'Everything',
  NOTABLE: 'Notable and up',
  MAJOR: 'Major and up',
  CRITICAL: 'Critical only',
  never: 'Never',
};

export default function InterruptSettings() {
  const interrupts = useGameStore((s) => s.game?.interrupts);
  const setInterrupt = useGameStore((s) => s.setInterrupt);
  if (!interrupts) return null;

  return (
    <Panel title="Stop the clock for">
      <ul className="flex flex-col gap-2">
        {EVENT_CATEGORIES.map((category) => (
          <li key={category} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-stone-300">{CATEGORY_LABELS[category]}</span>
            <select
              className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs text-stone-200"
              value={interrupts[category]}
              onChange={(e) => setInterrupt(category, e.target.value as InterruptLevel)}
            >
              {INTERRUPT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-stone-500">Critical events always stop the clock.</p>
    </Panel>
  );
}
