import { religiousOrders } from '@/content/religious';
import { pietyLabelsOf } from '@/systems/religious/feel';
import type { OrderKey } from '@/types';

/** The two orders of round one, each with what its life is like, from its data. E3 §4.1, §10. */
export default function OrderCards({ selected, onSelect }: { selected: OrderKey | null; onSelect: (key: OrderKey) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-4">
      {religiousOrders.map((o) => (
        <li key={o.key}>
          <button className={'choice flex h-full flex-col items-start gap-2 border rule p-4 text-left ' + (o.key === selected ? 'choice-chosen' : '')} onClick={() => onSelect(o.key)}>
            <span className="title text-lg">{o.name}</span>
            <span className="ink-muted text-sm">{o.short} · <em>{o.motto}</em></span>
            <ul className="ink-muted mt-1 flex flex-col gap-1 text-sm">
              {pietyLabelsOf({ religious: { order: o.key, provinceId: '', houseId: '', horarium: { hours: 'standard', conventual_mass: 'standard', common_table: 'standard', house_chapter: 'standard' }, permissions: [], assignments: [], obedience: { accepted: 0, reluctant: 0, refused: 0 }, vows: { renewals: [] }, perceivedAmbition: 0, termsServed: [] } }).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <span className="ink-faint mt-1 text-xs">Formation: {o.formation.map((f) => f.label).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}.</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
