import type { CreationOption } from '@/types';

export default function OptionList<T extends CreationOption>({
  options,
  selected,
  onSelect,
  shut,
}: {
  options: T[];
  selected: string | null;
  onSelect: (option: T) => void;
  /** Why an option is not open to this man, when it is not; shown greyed with the reason. */
  shut?: (option: T) => string | null;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const why = shut?.(o) ?? null;
        return (
        <li key={o.id}>
          <button
            onClick={() => onSelect(o)}
            disabled={!!why}
            className={'choice h-full border rule ' + (o.id === selected ? 'choice-chosen' : '')}
          >
            <div className="font-medium">{o.label}</div>
            <div className="ink-muted mt-1 text-sm leading-snug">{o.blurb}</div>
            {why && <div className="ink-faint mt-1 text-xs">{why}</div>}
          </button>
        </li>
        );
      })}
    </ul>
  );
}
