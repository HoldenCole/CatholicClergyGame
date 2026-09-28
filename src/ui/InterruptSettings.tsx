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
  const stopForPeople = useGameStore((s) => s.game?.settings?.stopForPeople ?? true);
  const setSettings = useGameStore((s) => s.setSettings);
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
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={stopForPeople} onChange={(e) => setSettings({ stopForPeople: e.target.checked })} />
        <span>People: stop when someone who matters to you dies, leaves, is moved, or is named to something.</span>
      </label>
      <p className="ink-faint mt-3 text-xs">What cannot wait always stops the clock.</p>
    </Sheet>
  );
}
