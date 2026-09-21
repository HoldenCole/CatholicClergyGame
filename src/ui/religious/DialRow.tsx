import { charterDials } from '@/content/religious';
import { dialLabel } from '@/systems/religious/charter';
import type { WorkNeed } from '@/systems/religious/founding';
import type { CharterDial, CharterWork } from '@/types';

/** One dial of a charter: its options as buttons, the chosen one's line under them, the need marks on the works. */
export default function DialRow({ dial, current, allowed, onPick, needs, most, compact }: { dial: CharterDial; current: string; allowed: (id: string) => { ok: boolean; why?: string }; onPick: (id: string) => void; needs?: Record<CharterWork, WorkNeed> | undefined; most?: CharterWork[] | undefined; compact?: boolean }) {
  const options = charterDials[dial];
  const chosen = options.find((o) => o.id === current);
  return (
    <div className={compact ? 'flex flex-wrap items-center gap-1' : ''}>
      <div className={compact ? 'ink-faint w-24 text-xs' : 'heading text-sm'}>{dialLabel(dial)}</div>
      <div className={'flex flex-wrap gap-1.5 ' + (compact ? '' : 'mt-1')}>
        {options.map((o) => {
          const ok = allowed(o.id);
          const on = current === o.id;
          const need = needs && o.id !== 'none' ? needs[o.id as CharterWork] : undefined;
          const wanted = !!need && !need.filled && (most ?? []).includes(o.id as CharterWork);
          return (
            <button key={o.id} className={'pbtn px-2 py-0.5 text-xs ' + (on ? 'pbtn-primary ' : '') + (wanted && !on ? 'ring-1 ring-[#7a1f1f]/60 ' : '')} disabled={!ok.ok} title={ok.why ?? (need ? `${'●'.repeat(need.need)}${'○'.repeat(3 - need.need)} needed here` : o.line)} onClick={() => onPick(o.id)}>
              {o.label}
              {need && !need.filled && need.need > 0 ? <span className="ink-faint ml-1">{'●'.repeat(need.need)}</span> : ''}
              {wanted ? <span className="ink-wine ml-1">· needed</span> : ''}
            </button>
          );
        })}
      </div>
      {!compact && <p className="ink-muted mt-1 text-xs leading-relaxed">{chosen?.line}</p>}
    </div>
  );
}
