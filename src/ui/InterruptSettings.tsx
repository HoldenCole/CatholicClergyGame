import { useGameStore } from '@/engine/store';
import { CATEGORY_LABELS } from '@/engine/interrupts';
import { EVENT_CATEGORIES, INTERRUPT_LEVELS, type InterruptLevel } from '@/types';
import Sheet from './Sheet';

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
    <Sheet title="Stop the clock for">
      <ul className="flex flex-col gap-1.5">
        {EVENT_CATEGORIES.map((category) => (
          <li key={category} className="flex items-center justify-between gap-3 text-sm">
            <span>{CATEGORY_LABELS[category]}</span>
            <select className="pinput text-xs" value={interrupts[category]} onChange={(e) => setInterrupt(category, e.target.value as InterruptLevel)}>
              {INTERRUPT_LEVELS.map((level) => (
                <option key={level} value={level}>{LEVEL_LABELS[level]}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <p className="ink-faint mt-3 text-xs">What cannot wait always stops the clock.</p>
    </Sheet>
  );
}
