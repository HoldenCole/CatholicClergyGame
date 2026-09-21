import type { WeatherKind } from '@/systems/weather';

/** Fixed scatter, so the same week draws the same snow. Positions are in the 100×60 box. */
const DOTS: [number, number, number][] = Array.from({ length: 70 }, (_, i) => {
  const x = ((i * 37) % 100) + ((i * 7) % 5) * 0.2;
  const y = ((i * 23) % 60) + ((i * 11) % 7) * 0.15;
  return [x, y, 0.25 + ((i * 13) % 4) * 0.12];
});

/**
 * The weather over the room: a wash on the light and something moving past
 * the windows. Drawn after the room and before the finish, kept faint so the
 * scene still reads. Fog and cold grey the light; heat warms it; rain streaks;
 * snow scatters; a storm darkens; wind and clear leave it alone.
 */
export function WeatherLayer({ kind }: { kind: WeatherKind }) {
  if (kind === 'clear' || kind === 'wind') return null;
  const wash =
    kind === 'fog' ? { fill: '#cfd3d6', opacity: 0.16 } :
    kind === 'cold' ? { fill: '#9fb4d0', opacity: 0.12 } :
    kind === 'heat' ? { fill: '#f0b860', opacity: 0.1 } :
    kind === 'storm' ? { fill: '#2a3140', opacity: 0.2 } :
    kind === 'rain' ? { fill: '#6d7a8a', opacity: 0.12 } :
    { fill: '#e8eef5', opacity: 0.1 };
  return (
    <g pointerEvents="none">
      <rect x="0" y="0" width="100" height="60" fill={wash.fill} opacity={wash.opacity} />
      {(kind === 'rain' || kind === 'storm') && (
        <g stroke="#dfe7f0" strokeWidth="0.18" opacity={kind === 'storm' ? 0.35 : 0.25} strokeLinecap="round">
          {DOTS.slice(0, 48).map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x - 0.6} y2={y + 2.2} />)}
        </g>
      )}
      {kind === 'snow' && (
        <g fill="#ffffff">
          {DOTS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r * 0.45} opacity={0.5 + (i % 3) * 0.15} />)}
        </g>
      )}
    </g>
  );
}
