import { useState } from 'react';
import type { DioceseVisible } from '@/types';
import { NEED_LABEL, TENSION_LABEL, prioritiesLine } from '@/generation/diocese';

/**
 * The preview. CLAUDE.md rule 6: this component receives only the visible
 * half of each diocese and cannot reach the hidden one.
 */
export default function DioceseCards({
  dioceses,
  selected,
  onSelect,
  onSurprise,
}: {
  dioceses: DioceseVisible[];
  selected: string | null;
  onSelect: (id: string) => void;
  onSurprise: () => void;
}) {
  const [open, setOpen] = useState<string | null>(selected);
  const shown = dioceses.find((d) => d.id === open) ?? null;

  return (
    <div className="grid grid-cols-12 gap-4">
      <ul className="col-span-4 flex flex-col gap-2">
        {dioceses.map((d) => (
          <li key={d.id}>
            <button
              onClick={() => {
                setOpen(d.id);
                onSelect(d.id);
              }}
              className={
                'w-full text-left rounded border px-3 py-2 ' +
                (d.id === selected ? 'border-amber-600 bg-amber-950/30' : 'border-stone-800 bg-stone-900/50 hover:border-stone-600')
              }
            >
              <div className="font-medium">{d.see}</div>
              <div className="text-xs text-stone-500">
                {NEED_LABEL[d.clergyNeed]} · {TENSION_LABEL[d.tension]}
              </div>
            </button>
          </li>
        ))}
        <li>
          <button onClick={onSurprise} className="w-full text-left rounded border border-dashed border-stone-700 px-3 py-2 text-sm text-stone-400 hover:border-stone-500">
            Surprise me
            <div className="text-xs text-stone-600">No preview. A small starting bonus.</div>
          </button>
        </li>
      </ul>
      <div className="col-span-8 rounded border border-stone-800 bg-stone-900/50 p-4 min-h-[420px]">
        {shown ? <Card d={shown} /> : <p className="text-stone-500">Choose a diocese to read about it.</p>}
      </div>
    </div>
  );
}

function Card({ d }: { d: DioceseVisible }) {
  const pct = Math.round(((d.disposition + 100) / 200) * 100);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className="text-xl">{d.name}</h3>
        <div className="text-stone-500">{d.region} · {d.size}</div>
      </div>
      <div>
        <div className="flex justify-between text-xs uppercase tracking-wider text-stone-500">
          <span>Traditional</span>
          <span>{TENSION_LABEL[d.tension]}</span>
          <span>Progressive</span>
        </div>
        <div className="relative mt-1 h-2 rounded bg-stone-800">
          <div className="absolute top-0 h-2 w-1 rounded bg-amber-500" style={{ left: `calc(${pct}% - 2px)` }} />
        </div>
      </div>
      <Row label="Clergy need">{NEED_LABEL[d.clergyNeed]}</Row>
      <Row label="The bishop">
        {d.bishop.name}, {d.bishop.age}, {d.bishop.yearsInOffice === 0 ? 'newly installed' : `${d.bishop.yearsInOffice} years in office`}. {d.bishop.temperamentLine} Says his priorities are {prioritiesLine(d.bishop.priorities)}.
      </Row>
      <Row label="Character">
        {d.character.map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
        ))}
      </Row>
      <Row label="Opportunities">
        <ul className="list-disc pl-4">
          {d.opportunities.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </Row>
      <Row label="Complication">{d.complication}</Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-stone-200 leading-relaxed">{children}</div>
    </div>
  );
}
