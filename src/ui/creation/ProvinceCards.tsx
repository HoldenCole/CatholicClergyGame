import { useState } from 'react';
import type { ProvinceVisible } from '@/systems/religious/newGame';

const TRAJECTORY: Record<ProvinceVisible['trajectory'], string> = { growing: 'growing', stable: 'holding its own', shrinking: 'shrinking' };

/**
 * The province preview. CLAUDE.md rule 6: this component receives only the
 * visible half of each rolled province and cannot reach the rest. E3 §4.1.
 */
export default function ProvinceCards({ provinces, selected, onSelect }: { provinces: ProvinceVisible[]; selected: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(selected ?? provinces[0]?.id ?? null);
  const shown = provinces.find((p) => p.id === open) ?? null;
  return (
    <div className="grid grid-cols-12 gap-4">
      <ul className="col-span-4 flex flex-col gap-1.5">
        {provinces.map((p) => (
          <li key={p.id}>
            <button onClick={() => { setOpen(p.id); onSelect(p.id); }} className={'choice border rule py-1 ' + (p.id === selected ? 'choice-chosen' : '')}>
              <span className="font-medium">{p.name}</span>
              <span className="ink-faint block text-xs">{p.region} · {TRAJECTORY[p.trajectory]}</span>
            </button>
          </li>
        ))}
      </ul>
      {shown && (
        <div className="col-span-8 flex flex-col gap-3 rounded border rule bg-white/30 p-4 text-sm leading-relaxed">
          <div>
            <div className="title text-lg">{shown.name}</div>
            <p className="ink-muted">{shown.line}</p>
          </div>
          <p>{shown.size} The province is {TRAJECTORY[shown.trajectory]}, and its friars are {shown.tension}{shown.disposition <= -25 ? ', leaning to the old observance' : shown.disposition >= 25 ? ', leaning to this century' : ''}.</p>
          <p><span className="heading">The provincial.</span> {shown.provincial.name}, {shown.provincial.age}, {shown.provincial.yearsInOffice === 0 ? 'newly in office' : `${shown.provincial.yearsInOffice} year${shown.provincial.yearsInOffice === 1 ? '' : 's'} in office`}: {shown.provincial.line}</p>
          <p><span className="heading">Works.</span> {shown.works.join(', ')}.</p>
          <p><span className="heading">Territory.</span> {shown.territory.join('; ')}.</p>
          {shown.formation?.length > 0 && <p><span className="heading">Formation.</span> {shown.formation.join('; ')}.</p>}
          <p className="ink-wine">{shown.complication}</p>
          <p className="ink-faint text-xs">Nothing here is hidden from a man who asks; what the province keeps to itself, you will learn by living in it.</p>
        </div>
      )}
    </div>
  );
}
