import type { CreationOption } from '@/types';

export default function OptionList<T extends CreationOption>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: string | null;
  onSelect: (option: T) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <li key={o.id}>
          <button
            onClick={() => onSelect(o)}
            className={
              'w-full h-full text-left rounded border p-3 transition-colors ' +
              (o.id === selected
                ? 'border-amber-600 bg-amber-950/30'
                : 'border-stone-800 bg-stone-900/50 hover:border-stone-600')
            }
          >
            <div className="font-medium">{o.label}</div>
            <div className="mt-1 text-sm text-stone-400 leading-snug">{o.blurb}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
