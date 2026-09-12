import { useGameStore } from '@/engine/store';
import { currentHomily, homilyAvailability, weeksUntilChange } from '@/systems/homily';
import Sheet from '../Sheet';

/** What he preaches on this month: one course at a time, a month each. */
export default function HomilyPanel() {
  const game = useGameStore((s) => s.game);
  const setHomily = useGameStore((s) => s.setHomily);
  if (!game?.parish) return null;
  const current = currentHomily(game);
  const options = homilyAvailability(game);
  const wait = weeksUntilChange(game);
  return (
    <Sheet title="The homily this month">
      <p className="text-sm leading-relaxed">
        You are preaching on {current?.label.toLowerCase() ?? 'the readings'}.{' '}
        <span className="ink-muted">{current?.blurb}</span>
        {wait > 0 && <span className="ink-faint"> Another {wait} week{wait === 1 ? '' : 's'} before you change course.</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.def.id}
            className={'tab ' + (o.current ? 'tab-active' : '')}
            disabled={!o.available && !o.current}
            title={o.current ? 'What you are preaching now' : o.why ?? o.def.blurb}
            onClick={() => o.available && setHomily(o.def.id)}
          >
            {o.def.label}
          </button>
        ))}
      </div>
      <p className="ink-faint mt-2 text-xs">A homily is a course, not a remark: what you preach on for a month moves the people, the wings, the chancery, and the record, and the sheets say by how much.</p>
    </Sheet>
  );
}
