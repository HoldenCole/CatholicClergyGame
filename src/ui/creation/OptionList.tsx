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
            className={'choice h-full border rule ' + (o.id === selected ? 'choice-chosen' : '')}
          >
            <div className="font-medium">{o.label}</div>
            <div className="ink-muted mt-1 text-sm leading-snug">{o.blurb}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
