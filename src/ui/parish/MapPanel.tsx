import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { milesAcross, milesBetween } from '@/systems/map';
import { presetById } from '@/content/dioceses';
import { project } from '@/generation/geo';
import type { Parish, World } from '@/types';
import Sheet from '../Sheet';

const KIND_COLOR: Record<string, string> = { flagship_suburban: '#c9a24a', struggling_urban: '#8a5a3a', immigrant_growing: '#5a7a3f', rural: '#6f7f5a', difficult: '#7a1f1f' };

/** The map itself, pure: the real churches where they stand, the cities and neighborhoods named, one parish marked, a deanery ringed. */
export function DioceseMap({ world, hereId, deaneryIds = [], onHover }: { world: World; hereId?: string | undefined; deaneryIds?: string[]; onHover?: (id: string | null) => void }) {
  const preset = presetById(world.diocese.presetId);
  const here = world.parishes.find((p) => p.id === hereId);
  const deanery = new Set(deaneryIds);
  // Labels: the places the preset knows, thinned so they do not pile up.
  const labels: { name: string; x: number; y: number }[] = [];
  for (const pl of preset?.places ?? []) {
    if (!preset?.map) break;
    const at = project(preset, pl.lat, pl.lon);
    if (labels.some((l) => Math.abs(l.x - at.x) < 10 && Math.abs(l.y - at.y) < 3.4)) continue;
    labels.push({ name: pl.name.replace(/^the /, ''), x: Math.max(12, Math.min(88, at.x)), y: at.y });
  }
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      {[10, 20, 30, 40].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#8a7a5a" strokeWidth="0.2" strokeDasharray="1 1.5" opacity="0.6" />
      ))}
      {labels.map((l) => (
        <text key={l.name} x={l.x} y={l.y - 1.6} fontSize="2" textAnchor="middle" fill="#6b5a3a" fontFamily="serif" fontStyle="italic" opacity="0.8">{l.name}</text>
      ))}
      {here && deanery.size > 0 && world.parishes.filter((p) => deanery.has(p.id)).map((p) => (
        <line key={p.id} x1={here.x ?? 50} y1={here.y ?? 50} x2={p.x ?? 50} y2={p.y ?? 50} stroke="#7a1f1f" strokeWidth="0.25" opacity="0.5" />
      ))}
      {world.parishes.map((p) => {
        const r = p.cathedral ? 1.8 : 0.6 + Math.min(1.0, p.households / 2000);
        const mine = p.id === here?.id;
        return (
          <g key={p.id} onMouseEnter={() => onHover?.(p.id)} onMouseLeave={() => onHover?.(null)} style={{ cursor: 'default' }}>
            {deanery.has(p.id) && <circle cx={p.x ?? 50} cy={p.y ?? 50} r={r + 1.3} fill="none" stroke="#7a1f1f" strokeWidth="0.35" />}
            {p.cathedral ? (
              <g>
                <rect x={(p.x ?? 50) - 0.45} y={(p.y ?? 50) - 2.8} width="0.9" height="5.6" fill="#3a2a18" />
                <rect x={(p.x ?? 50) - 1.8} y={(p.y ?? 50) - 1.5} width="3.6" height="0.9" fill="#3a2a18" />
              </g>
            ) : (
              <circle cx={p.x ?? 50} cy={p.y ?? 50} r={r} fill={mine ? '#7a1f1f' : KIND_COLOR[p.kind] ?? '#6b6660'} stroke={mine ? '#e6c25a' : p.founded ? '#3a2a18' : '#8a7a5a'} strokeWidth={mine ? 0.6 : p.founded ? 0.4 : 0.2} />
            )}
            <circle cx={p.x ?? 50} cy={p.y ?? 50} r={Math.max(3, r + 1.5)} fill="transparent" />
          </g>
        );
      })}
      <text x="50" y="97" fontSize="2.2" textAnchor="middle" fill="#3a2a18" fontFamily="serif">{world.diocese.visible.see}</text>
    </svg>
  );
}

/** The Map sheet: the diocese, yours marked, the deanery ringed, the miles on hover. */
export default function MapPanel() {
  const game = useGameStore((s) => s.game);
  const [hover, setHover] = useState<string | null>(null);
  if (!game?.world) return null;
  const world = game.world;
  const here = world.parishes.find((p) => p.id === game.assignment?.parishId);
  const deanery = new Set(game.parish?.deanery?.parishIds ?? []);
  const across = milesAcross(world);
  const hovered = world.parishes.find((p) => p.id === hover) ?? null;
  const miles = (p: Parish) => (here ? milesBetween(here, p, across) : null);
  return (
    <Sheet title={`${world.diocese.visible.name}, ${across} miles across`}>
      <div className="relative w-full overflow-hidden rounded border rule" style={{ background: '#efe6d2', aspectRatio: '1 / 1' }}>
        <DioceseMap world={world} hereId={here?.id} deaneryIds={[...deanery]} onHover={setHover} />
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {hovered
          ? `${hovered.name}, ${hovered.place}${hovered.cathedral ? ', the cathedral' : hovered.founded ? ` (${hovered.founded})` : ''}: ${hovered.households.toLocaleString()} households${hovered.id === here?.id ? '. Yours.' : miles(hovered) !== null ? `, ${miles(hovered)} miles from you${deanery.has(hovered.id) ? ', in your deanery' : ''}.` : '.'}`
          : here
            ? `${here.name} is the one in red; the ringed ones are your deanery; the cross is the cathedral. The real churches of the diocese stand where they stand, with a dark edge; the rest are placed near their towns. Hover a parish for its name and the miles.`
            : 'The cross is the cathedral. Hover a parish for its name.'}
      </p>
    </Sheet>
  );
}
