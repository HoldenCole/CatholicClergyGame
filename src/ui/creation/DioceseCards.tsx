import { useState } from 'react';
import type { DioceseVisible } from '@/types';
import { parishKindWord, type Placement } from '@/systems/placement';
import { NEED_LABEL, TENSION_LABEL, prioritiesLine } from '@/generation/diocese';
import Portrait from '../portraits/Portrait';
import { portraitFromParts } from '../portraits/spec';

/**
 * The preview. CLAUDE.md rule 6: this component receives only the visible
 * half of each diocese and cannot reach the hidden one.
 */
export default function DioceseCards({
  dioceses,
  placements = {},
  selected,
  onSelect,
  onSurprise,
}: {
  dioceses: DioceseVisible[];
  /** Where a man like this would probably be sent, by diocese id; computed from visible facts only. */
  placements?: Record<string, Placement | null>;
  selected: string | null;
  onSelect: (id: string) => void;
  onSurprise: () => void;
}) {
  const [open, setOpen] = useState<string | null>(selected);
  const shown = dioceses.find((d) => d.id === open) ?? null;

  return (
    <div className="grid grid-cols-12 gap-4">
      <ul className="col-span-4 flex flex-col gap-1.5">
        {regionsOf(dioceses).map(({ region, list }) => (
          <li key={region}>
            <div className="ink-faint mt-1 text-[10px] uppercase tracking-wide">{region}</div>
            <ul className="flex flex-col gap-1">
              {list.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => {
                      setOpen(d.id);
                      onSelect(d.id);
                    }}
                    className={'choice border rule py-1 ' + (d.id === selected ? 'choice-chosen' : '')}
                  >
                    <span className="font-medium">{d.see}</span>
                    <span className="ink-faint ml-2 text-xs">{NEED_LABEL[d.clergyNeed]} · {TENSION_LABEL[d.tension]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li>
          <button onClick={onSurprise} className="choice border border-dashed rule text-sm ink-muted">
            Surprise me
            <div className="ink-faint text-xs">No preview. A small starting bonus.</div>
          </button>
        </li>
      </ul>
      <div className="col-span-8 min-h-[420px] rounded border rule bg-white/25 p-4">
        {shown ? <Card d={shown} placement={placements[shown.id] ?? null} /> : <p className="ink-faint">Choose a diocese to read about it.</p>}
      </div>
    </div>
  );
}

/** The list by region, in the order the regions first appear, so ten sees fit a screen. */
function regionsOf(dioceses: DioceseVisible[]): { region: string; list: DioceseVisible[] }[] {
  const out: { region: string; list: DioceseVisible[] }[] = [];
  for (const d of dioceses) {
    const r = out.find((x) => x.region === d.region);
    if (r) r.list.push(d);
    else out.push({ region: d.region, list: [d] });
  }
  return out;
}

function Card({ d, placement }: { d: DioceseVisible; placement: Placement | null }) {
  const pct = Math.round(((d.disposition + 100) / 200) * 100);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className="title text-xl">{d.name}</h3>
        <div className="ink-muted">{d.region} · {d.size}</div>
      </div>
      <div>
        <div className="heading flex justify-between">
          <span>Traditional</span>
          <span>{TENSION_LABEL[d.tension]}</span>
          <span>Progressive</span>
        </div>
        <div className="relative mt-1 h-2 rounded" style={{ background: '#d8ccae' }}>
          <div className="absolute top-0 h-2 w-1 rounded" style={{ left: `calc(${pct}% - 2px)`, background: '#7a1f1f' }} />
        </div>
      </div>
      <Row label="Clergy need">{NEED_LABEL[d.clergyNeed]}</Row>
      <Row label="The bishop">
        <BishopFace d={d} />
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
      {d.houses?.length > 0 && (
        <Row label="Religious houses">
          <ul className="list-disc pl-4">
            {d.houses.map((h) => (
              <li key={h.id}>{h.line}</li>
            ))}
          </ul>
        </Row>
      )}
      <Row label="Complication">{d.complication}</Row>
      {placement && (
        <Row label="Where you would likely land">
          <p>
            {placement.parish.name}, {placement.parish.place}: {parishKindWord(placement.parish)}
            {placement.parish.needsSpanish ? ', where Spanish is needed' : ''}. {placement.reasons.length ? placement.reasons.join('; ') + '.' : 'Nothing about you points anywhere in particular yet; the seminary years will.'}
          </p>
          <p className="ink-faint mt-1 text-xs">
            The parishes: {placement.ranked.map((r) => `${r.parish.name} (${parishKindWord(r.parish).replace('the ', '').replace('a ', '')})`).join(', ')}. A guess from what you have said so far; the record you make in seminary and the diocese's need decide.
          </p>
        </Row>
      )}
    </div>
  );
}

function BishopFace({ d }: { d: DioceseVisible }) {
  const parts = d.bishop.name.split(' ');
  const first = parts[1] ?? parts[0] ?? '';
  const last = parts.slice(2).join(' ') || (parts[1] ?? '');
  return (
    <span className="float-left mr-3 mb-1">
      <Portrait portrait={portraitFromParts(d.bishop.npcId, first, last, d.bishop.age, 'bishop')} size={56} title={d.bishop.name} />
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="heading">{label}</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
