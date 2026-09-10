import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { emphasisPointsFor, FORMATION, validateEmphasis } from '@/systems/formation';
import { PILLARS, type Pillar } from '@/types';
import Panel from '../Panel';

const PILLAR_TEXT: Record<Pillar, { label: string; blurb: string }> = {
  human: { label: 'Human', blurb: 'Friendship, the table, the gym, being a man other men can stand.' },
  spiritual: { label: 'Spiritual', blurb: 'The hours, the chapel at six, direction, silence.' },
  intellectual: { label: 'Intellectual', blurb: 'The library, the languages, the argument you lose and then win.' },
  pastoral: { label: 'Pastoral', blurb: 'The parish on weekends, the hospital, the people who need something.' },
};

const YEAR_TEXT: Record<number, string> = {
  1: 'The propaedeutic year. No phone, no news, a long silence. The question is whether you can bear it.',
  2: 'Philosophy begins. Logic, metaphysics, the ancients. Some men find it a review; some find it a wall.',
  3: 'The second philosophy year. Positions form. The faculty are watching which professors you drift toward.',
  4: 'Theology begins, and with it the first hard gate: the rector will decide whether to admit you to candidacy.',
  5: 'Lector and acolyte. Real parish exposure. The faculty begin steering you toward a track.',
  6: 'The diaconate year. At its end, the promise of celibacy and obedience. There is no undoing it.',
  7: 'A deacon in a parish: preaching, baptizing, burying. Assignment preferences. Ordination.',
};

export default function EmphasisPanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseEmphasis);
  const leave = useGameStore((s) => s.leaveSeminary);
  const [alloc, setAlloc] = useState<Record<Pillar, number>>({ human: 3, spiritual: 3, intellectual: 2, pastoral: 2 });
  if (!game?.seminary || game.mode.kind !== 'year_start') return null;
  const points = emphasisPointsFor(game);
  const used = PILLARS.reduce((n, p) => n + alloc[p], 0);
  const error = validateEmphasis(alloc, points);
  const year = game.mode.year;

  const bump = (p: Pillar, d: number) => setAlloc((a) => ({ ...a, [p]: Math.min(FORMATION.emphasisMax, Math.max(0, a[p] + d)) }));

  return (
    <Panel title={`Year ${year} · the year's emphasis`} tilt="r">
      <p className="leading-relaxed">{YEAR_TEXT[year]}</p>
      <p className="ink-muted mt-2 text-sm">
        Where the year goes. You have {points} measures to give{points > FORMATION.emphasisPoints ? ', more than the boys, because you have studied before' : ''}. A pillar given nothing is noticed.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {PILLARS.map((p) => (
          <li key={p} className="flex items-center gap-4">
            <div className="w-28 font-medium">{PILLAR_TEXT[p].label}</div>
            <div className="flex items-center gap-1">
              <button className="pbtn px-2 py-0 text-sm" onClick={() => bump(p, -1)}>−</button>
              <div className="flex w-24 gap-0.5">
                {Array.from({ length: FORMATION.emphasisMax }, (_, i) => (
                  <span key={i} className="h-3 flex-1 rounded-sm" style={{ background: i < alloc[p] ? '#7a1f1f' : '#d8ccae' }} />
                ))}
              </div>
              <button className="pbtn px-2 py-0 text-sm" onClick={() => bump(p, 1)}>+</button>
            </div>
            <div className="ink-muted text-sm">{PILLAR_TEXT[p].blurb}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button className="pbtn pbtn-primary" disabled={!!error} onClick={() => choose(alloc)}>Begin the year</button>
        <span className="ink-muted text-sm">{error ?? `${used} of ${points} given`}</span>
        <button className="pbtn-link ml-auto" onClick={() => confirm('Leave the seminary? This ends the run.') && leave()}>Leave the seminary</button>
      </div>
    </Panel>
  );
}
