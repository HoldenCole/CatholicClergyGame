import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { milesBetween, MILES_ACROSS } from '@/systems/map';
import type { Parish } from '@/types';
import Sheet from '../Sheet';

const KIND_COLOR: Record<string, string> = { flagship_suburban: '#c9a24a', struggling_urban: '#8a5a3a', immigrant_growing: '#5a7a3f', rural: '#6f7f5a', difficult: '#7a1f1f' };

/** The map of the diocese: the cathedral at the center, every parish placed, yours marked, the deanery ringed. */
export default function MapPanel() {
  const game = useGameStore((s) => s.game);
  const [hover, setHover] = useState<string | null>(null);
  if (!game?.world) return null;
  const world = game.world;
  const here = world.parishes.find((p) => p.id === game.assignment?.parishId);
  const deanery = new Set(game.parish?.deanery?.parishIds ?? []);
  const size = world.diocese.visible.size;
  const hovered = world.parishes.find((p) => p.id === hover) ?? null;
  const miles = (p: Parish) => (here ? milesBetween(here, p, size) : null);
  return (
    <Sheet title={`${world.diocese.visible.name}, ${MILES_ACROSS[size]} miles across`}>
      <div className="relative w-full overflow-hidden rounded border rule" style={{ background: '#efe6d2', aspectRatio: '1 / 1' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="50" cy="50" r="12" fill="none" stroke="#8a7a5a" strokeWidth="0.3" strokeDasharray="1 1" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#8a7a5a" strokeWidth="0.3" strokeDasharray="1 1" />
          {here && deanery.size > 0 && world.parishes.filter((p) => deanery.has(p.id)).map((p) => (
            <line key={p.id} x1={here.x ?? 50} y1={here.y ?? 50} x2={p.x ?? 50} y2={p.y ?? 50} stroke="#7a1f1f" strokeWidth="0.25" opacity="0.5" />
          ))}
          {world.parishes.map((p) => {
            const r = p.cathedral ? 2.4 : 0.9 + Math.min(2, p.households / 1200);
            const mine = p.id === here?.id;
            return (
              <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
                {deanery.has(p.id) && <circle cx={p.x ?? 50} cy={p.y ?? 50} r={r + 1.4} fill="none" stroke="#7a1f1f" strokeWidth="0.35" />}
                {p.cathedral ? (
                  <g>
                    <rect x={(p.x ?? 50) - 0.5} y={(p.y ?? 50) - 3} width="1" height="6" fill="#3a2a18" />
                    <rect x={(p.x ?? 50) - 2} y={(p.y ?? 50) - 1.6} width="4" height="1" fill="#3a2a18" />
                  </g>
                ) : (
                  <circle cx={p.x ?? 50} cy={p.y ?? 50} r={r} fill={mine ? '#7a1f1f' : KIND_COLOR[p.kind] ?? '#6b6660'} stroke={mine ? '#e6c25a' : '#3a2a18'} strokeWidth={mine ? 0.6 : 0.25} />
                )}
                <circle cx={p.x ?? 50} cy={p.y ?? 50} r={Math.max(3, r + 1.5)} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {hovered
          ? `${hovered.name}, ${hovered.place}${hovered.cathedral ? ', the cathedral' : ''}: ${hovered.households.toLocaleString()} households${hovered.id === here?.id ? '. Yours.' : miles(hovered) !== null ? `, ${miles(hovered)} miles from you${deanery.has(hovered.id) ? ', in your deanery' : ''}.` : '.'}`
          : here
            ? `${here.name} is the one in red; the ringed ones are your deanery; the cross is the cathedral. Hover a parish for its name and the miles.`
            : 'The cross is the cathedral. Hover a parish for its name.'}
      </p>
    </Sheet>
  );
}
