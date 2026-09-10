import type { Parish, ParishKind, PlaceDecor } from '@/types';
import { decorOptions } from '@/systems/decor';
import { BACK, PALETTE } from './defs';
import { Candle, Crucifix, pts, wallPoint } from './primitives';
import { Layer } from './layer';

function art(decor: PlaceDecor, slot: keyof PlaceDecor, fallback: string): string {
  const id = decor[slot];
  return decorOptions.find((o) => o.id === id)?.art ?? fallback;
}

interface Shell {
  wall: string;
  wallPattern?: string;
  trim: string;
  floor: string;
  glass: 'lancet' | 'clerestory' | 'slab' | 'clear' | 'round';
  ceiling: 'vault' | 'beams' | 'flat' | 'aframe';
  warmth: number;
}

const SHELLS: Record<ParishKind, Shell> = {
  struggling_urban: { wall: '#9a8f7c', wallPattern: 'stone', trim: '#5a4a3a', floor: '#6e5a48', glass: 'lancet', ceiling: 'vault', warmth: 0.3 },
  flagship_suburban: { wall: '#e2d7bf', trim: '#b9a682', floor: '#8a3a30', glass: 'clerestory', ceiling: 'flat', warmth: 0.6 },
  immigrant_growing: { wall: '#d9a85a', trim: '#2d7f7a', floor: '#c9bda4', glass: 'round', ceiling: 'beams', warmth: 0.9 },
  rural: { wall: '#efe8d8', trim: '#8a6a44', floor: '#9a6a3a', glass: 'clear', ceiling: 'beams', warmth: 0.7 },
  difficult: { wall: '#c8b391', wallPattern: 'brick', trim: '#6f5a3f', floor: '#7a5a52', glass: 'slab', ceiling: 'aframe', warmth: 0.4 },
};

/**
 * The church, looking up the nave to the sanctuary. The shell (walls,
 * glass, ceiling) comes from the parish's kind; everything the pastor can
 * change is a layer on top.
 */
export function Church({ decor, parish }: { decor: PlaceDecor; parish: Parish | undefined }) {
  const shell = SHELLS[parish?.kind ?? 'rural'];
  const rich = (parish?.wealth ?? 3) >= 4;
  const tl = wallPoint('left', 0, 0);
  const bl = wallPoint('left', 0, 1);
  const tr = wallPoint('right', 100, 0);
  const br = wallPoint('right', 100, 1);
  const sanctuary = art(decor, 'sanctuary', 'plain');
  return (
    <g>
      {/* ceiling */}
      <polygon points={pts([tl, tr, [BACK.x1, BACK.y0], [BACK.x0, BACK.y0]])} fill={shell.ceiling === 'beams' ? '#4a2c17' : shell.ceiling === 'aframe' ? '#6b4a34' : '#d7cdb8'} />
      <polygon points={pts([tl, tr, [BACK.x1, BACK.y0], [BACK.x0, BACK.y0]])} fill="url(#ceilShade)" />
      {shell.ceiling === 'vault' && [10, 30, 50, 70, 90].map((x) => <path key={x} d={`M${x} ${x < 50 ? tl[1] + (x / 50) * 2 : tl[1] + ((100 - x) / 50) * 2} Q50 ${BACK.y0 - 4} ${100 - x} ${tl[1]}`} fill="none" stroke="#8a7f6c" strokeWidth="0.4" opacity="0.7" />)}
      {shell.ceiling === 'beams' && [6, 22, 38, 54, 70, 86].map((x) => <line key={x} x1={x} y1={-1 + Math.abs(50 - x) * 0.02} x2={BACK.x0 + ((BACK.x1 - BACK.x0) * x) / 100} y2={BACK.y0} stroke="#2a1408" strokeWidth="1.2" />)}
      {shell.ceiling === 'aframe' && <polygon points={pts([[50, -1], [BACK.x1 + 6, BACK.y0 - 2], [BACK.x0 - 6, BACK.y0 - 2]])} fill="#8a6a4a" opacity="0.5" />}
      {/* walls */}
      <rect x={BACK.x0} y={BACK.y0} width={BACK.x1 - BACK.x0} height={BACK.y1 - BACK.y0} fill={shell.wallPattern ? `url(#${shell.wallPattern})` : shell.wall} />
      <rect x={BACK.x0} y={BACK.y0} width={BACK.x1 - BACK.x0} height={BACK.y1 - BACK.y0} fill="url(#wallShade)" />
      <polygon points={pts([tl, [BACK.x0, BACK.y0], [BACK.x0, BACK.y1], bl])} fill={shell.wallPattern ? `url(#${shell.wallPattern})` : shell.wall} />
      <polygon points={pts([tl, [BACK.x0, BACK.y0], [BACK.x0, BACK.y1], bl])} fill="url(#sideLeft)" />
      <polygon points={pts([tr, [BACK.x1, BACK.y0], [BACK.x1, BACK.y1], br])} fill={shell.wallPattern ? `url(#${shell.wallPattern})` : shell.wall} />
      <polygon points={pts([tr, [BACK.x1, BACK.y0], [BACK.x1, BACK.y1], br])} fill="url(#sideRight)" />
      {parish?.kind === 'immigrant_growing' && (
        <g>
          <polygon points={pts([wallPoint('left', 0, 0.72), [BACK.x0, BACK.y0 + 23], [BACK.x0, BACK.y1], bl])} fill={shell.trim} opacity="0.85" />
          <polygon points={pts([wallPoint('right', 100, 0.72), [BACK.x1, BACK.y0 + 23], [BACK.x1, BACK.y1], br])} fill={shell.trim} opacity="0.85" />
        </g>
      )}
      <Glass kind={shell.glass} />
      {/* floor */}
      <polygon points={pts([[BACK.x0, BACK.y1], [BACK.x1, BACK.y1], br, [100, 60], [0, 60], bl])} fill={shell.floor} />
      <polygon points={pts([[BACK.x0, BACK.y1], [BACK.x1, BACK.y1], br, [100, 60], [0, 60], bl])} fill="url(#floorShade)" />
      {(parish?.kind === 'flagship_suburban' || parish?.kind === 'difficult') && <polygon points={pts([[44, BACK.y1], [56, BACK.y1], [66, 60], [34, 60]])} fill="#000" opacity="0.08" />}
      {parish?.kind !== 'flagship_suburban' && parish?.kind !== 'difficult' && [42, 45, 48.5, 52.5, 57].map((y, i) => <line key={y} x1={0 + i * 3} y1={y} x2={100 - i * 3} y2={y} stroke="#000" strokeWidth="0.15" opacity="0.25" />)}
      {/* sanctuary platform */}
      <polygon points={pts([[28, 34], [72, 34], [78, 40], [22, 40]])} fill={rich ? 'url(#marble)' : '#d9cdb5'} />
      <polygon points={pts([[22, 40], [78, 40], [79, 42], [21, 42]])} fill={rich ? '#bfb4a0' : '#a89a80'} />
      <polygon points={pts([[26, 42], [74, 42], [75, 44], [25, 44]])} fill={rich ? '#d3c9b6' : '#b9ab90'} />
      <Sanctuary variant={sanctuary} shell={shell} rich={rich} />
      <Crucifix x={50} y={sanctuary === 'modern' ? 9 : 10} s={sanctuary === 'modern' ? 0.9 : 1.15} corpus={sanctuary !== 'modern'} />
      <Tabernacle variant={art(decor, 'tabernacle', 'center')} sanctuary={sanctuary} />
      <Altar sanctuary={sanctuary} rich={rich} />
      <MassForm variant={art(decor, 'mass_form', 'vernacular')} />
      <Orientation variant={art(decor, 'orientation', 'populum')} />
      <Ambo />
      <Statues variant={art(decor, 'statues', 'many')} warmth={shell.warmth} />
      <Choir variant={art(decor, 'choir', 'loft')} />
      <Confessionals variant={art(decor, 'confessionals', 'booths')} />
      <AltarRail variant={art(decor, 'altar_rail', 'none')} />
      <Baptistery rich={rich} />
      <Pews color={parish?.kind === 'difficult' ? '#8a6a4a' : parish?.kind === 'flagship_suburban' ? '#a87a4a' : PALETTE.oak} />
      <Doors />
    </g>
  );
}

function Glass({ kind }: { kind: Shell['glass'] }) {
  const win = (side: 'left' | 'right', x: number, w: number, f0: number, f1: number, color: string, arch: boolean) => {
    const a = wallPoint(side, x, f0);
    const b = wallPoint(side, x + w, f0);
    const c = wallPoint(side, x + w, f1);
    const d = wallPoint(side, x, f1);
    const mid = wallPoint(side, x + w / 2, f0);
    return (
      <g key={`${side}${x}`}>
        <polygon points={pts([a, b, c, d])} fill={color} opacity="0.9" />
        {arch && <polygon points={pts([a, [mid[0], mid[1] - w * 0.7], b])} fill={color} opacity="0.9" />}
        <polygon points={pts([a, b, c, d])} fill="url(#lightShaft)" />
        <polygon points={pts([a, b, c, d])} fill="none" stroke="#3a2a1a" strokeWidth="0.3" />
      </g>
    );
  };
  const colors = ['#c0392b', '#2e5aac', '#c9a24a', '#2e8b57', '#7b3fa0'];
  if (kind === 'lancet')
    return (
      <g>
        {[3, 9.5].map((x, i) => win('left', x, 3, 0.12, 0.62, colors[i]!, true))}
        {[87.5, 94].map((x, i) => win('right', x, 3, 0.12, 0.62, colors[i + 2]!, true))}
        {[3, 9.5].map((x) => <polygon key={x} points={pts([wallPoint('left', x + 1, 0.62), wallPoint('left', x + 2, 0.62), [x + 24, 46], [x + 14, 46]])} fill="url(#lightShaft)" opacity="0.5" />)}
      </g>
    );
  if (kind === 'clerestory')
    return (
      <g>
        {[2, 7, 12].map((x) => win('left', x, 4, 0.05, 0.28, '#dfe9f0', false))}
        {[84, 89, 94].map((x) => win('right', x, 4, 0.05, 0.28, '#dfe9f0', false))}
      </g>
    );
  if (kind === 'slab')
    return (
      <g>
        {[2, 4.5, 7, 9.5, 12, 14.5].map((x, i) => win('left', x, 1.4, 0.1, 0.9, ['#e0b93a', '#c7742a', '#e0b93a', '#8a3a2a', '#e0b93a', '#c7742a'][i]!, false))}
        {[84, 86.5, 89, 91.5, 94, 96.5].map((x, i) => win('right', x, 1.4, 0.1, 0.9, ['#c7742a', '#e0b93a', '#8a3a2a', '#e0b93a', '#c7742a', '#e0b93a'][i]!, false))}
      </g>
    );
  if (kind === 'round')
    return (
      <g>
        {[4, 11].map((x, i) => win('left', x, 4, 0.15, 0.55, colors[(i + 1) % 5]!, true))}
        {[85, 92].map((x, i) => win('right', x, 4, 0.15, 0.55, colors[(i + 3) % 5]!, true))}
        {[[6, 14], [93, 14]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="1.6" fill="#c9a24a" opacity="0.8" />)}
      </g>
    );
  return (
    <g>
      {[4, 11].map((x) => win('left', x, 4, 0.18, 0.6, '#eaf0f3', false))}
      {[85, 92].map((x) => win('right', x, 4, 0.18, 0.6, '#eaf0f3', false))}
      <polygon points={pts([wallPoint('left', 6, 0.6), wallPoint('left', 8, 0.6), [30, 50], [18, 50]])} fill="url(#lightShaft)" opacity="0.6" />
    </g>
  );
}

function Sanctuary({ variant, shell, rich }: { variant: string; shell: Shell; rich: boolean }) {
  return (
    <Layer scene="church" layer="sanctuary" variant={variant}>
      {variant === 'high_altar' && (
        <g>
          <rect x="36" y="9" width="28" height="25" fill={rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.35" />
          <path d="M38 12 Q50 2 62 12 V14 Q50 5 38 14 Z" fill={PALETTE.gold} opacity="0.7" />
          {[39, 44.5, 55.5, 61].map((x) => (
            <g key={x}>
              <rect x={x - 0.7} y="14" width="1.4" height="14" fill={rich ? '#d9cbb0' : '#cdbf9e'} stroke="#8a7a5a" strokeWidth="0.15" />
              <rect x={x - 1.2} y="13" width="2.4" height="1" fill={PALETTE.gold} opacity="0.8" />
            </g>
          ))}
          <rect x="40" y="27" width="20" height="7" fill={rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.3" />
          {[42, 45, 48, 52, 55, 58].map((x) => (
            <Candle key={x} x={x} y={27} h={3.2} lit />
          ))}
          <rect x="41" y="29" width="18" height="0.4" fill={PALETTE.gold} opacity="0.7" />
        </g>
      )}
      {variant === 'plain' && (
        <g>
          <rect x="40" y="9" width="20" height="20" fill="url(#wood)" opacity="0.7" />
          <rect x="40" y="9" width="20" height="20" fill={shell.wall} opacity="0.25" />
          {[43, 47, 51, 55].map((x) => (
            <rect key={x} x={x} y="9" width="1.6" height="20" fill="#000" opacity="0.08" />
          ))}
          <rect x="30" y="10" width="40" height="24" fill="#8a3a30" opacity="0.12" />
          <rect x="24" y="12" width="6" height="9" fill="#2e6b4f" />
          <path d="M25 14 q2 -1.5 4 0 q-2 1.5 -4 0 Z" fill="#f3eee0" />
          <rect x="70" y="12" width="6" height="9" fill="#7a1f1f" />
          <path d="M71 15 l2 4 l2 -4 Z" fill="#f3eee0" opacity="0.85" />
          <ellipse cx="36" cy="33" rx="2.8" ry="3.2" fill="#2f5a2f" />
          <rect x="35" y="33" width="2" height="2.5" fill="#8a4a2a" />
          <ellipse cx="64" cy="33" rx="2.8" ry="3.2" fill="#2f5a2f" />
          <rect x="63" y="33" width="2" height="2.5" fill="#8a4a2a" />
        </g>
      )}
      {variant === 'modern' && (
        <g>
          <rect x="24" y="8" width="52" height="32" fill="#d9d3c5" />
          <rect x="24" y="8" width="52" height="32" fill="url(#wallShade)" />
          <rect x="48" y="8" width="4" height="26" fill="url(#sky)" />
          <rect x="47.5" y="8" width="0.4" height="26" fill="#000" opacity="0.2" />
          <polygon points="48,34 52,34 60,44 40,44" fill="url(#lightShaft)" />
          <rect x="30" y="30" width="40" height="0.5" fill="#000" opacity="0.15" />
        </g>
      )}
      {(variant === 'restored' || variant === 'gothic') && (
        <g>
          <rect x="34" y="8" width="32" height="26" fill={variant === 'gothic' ? '#1f3a6e' : rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.5" />
          {variant === 'gothic' && [38, 44, 50, 56, 62].map((x) => <circle key={x} cx={x} cy={12 + (x % 3)} r="0.5" fill={PALETTE.gold} opacity="0.8" />)}
          <path d="M38 18 Q50 4 62 18" fill="none" stroke={PALETTE.gold} strokeWidth="0.9" />
          {[39, 44.5, 50, 55.5, 61].map((x) => (
            <path key={x} d={`M${x - 2.2} 26 Q${x} 18 ${x + 2.2} 26 Z`} fill={variant === 'gothic' ? '#c9a24a' : '#d9cbb0'} stroke={PALETTE.gold} strokeWidth="0.4" opacity="0.9" />
          ))}
          <rect x="40" y="27" width="20" height="7" fill={rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.3" />
          {[42, 45, 48, 52, 55, 58].map((x) => (
            <Candle key={x} x={x} y={27} h={3.2} lit />
          ))}
        </g>
      )}
    </Layer>
  );
}

function Altar({ sanctuary, rich }: { sanctuary: string; rich: boolean }) {
  const top = sanctuary === 'modern' ? '#b5ada0' : rich ? 'url(#marble)' : '#e8dfcc';
  return (
    <g>
      <ellipse cx="50" cy="39.5" rx="9" ry="1.2" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      <polygon points="42,32 58,32 59.5,34 40.5,34" fill={top} />
      <rect x="41" y="34" width="18" height="5" fill={sanctuary === 'modern' ? '#a29a8c' : rich ? '#cfc4ae' : '#d9cdb5'} />
      <rect x="41" y="34" width="18" height="0.6" fill="#fff" opacity="0.35" />
      {sanctuary !== 'modern' && <rect x="41" y="32.4" width="18" height="1.2" fill="url(#cloth)" />}
      <Candle x={44} y={32.2} h={2.4} lit />
      <Candle x={56} y={32.2} h={2.4} lit />
    </g>
  );
}

function Ambo() {
  return (
    <g>
      <polygon points="30,30 35,30 35.6,32 29.4,32" fill="url(#woodTop)" />
      <rect x="29.6" y="32" width="5.8" height="6.5" fill="url(#wood)" />
      <rect x="30.8" y="29.2" width="3.4" height="1" fill="#7a1f1f" />
    </g>
  );
}

function Tabernacle({ variant, sanctuary }: { variant: string; sanctuary: string }) {
  return (
    <Layer scene="church" layer="tabernacle" variant={variant}>
      {variant === 'center' ? (
        <g>
          <rect x="47.4" y="22" width="5.2" height="5" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.3" />
          <rect x="49.7" y="22.6" width="0.6" height="3.8" fill="#5a3a12" opacity="0.7" />
          <circle cx="50" cy="20.6" r="0.9" fill="url(#brass)" />
          <circle cx="54.5" cy="24" r="0.6" fill="#e04a2a" />
          <circle cx="54.5" cy="24" r="1.8" fill="url(#glow)" opacity="0.5" />
          {sanctuary === 'plain' && <rect x="46.5" y="27" width="7" height="1.6" fill="#8a7a5a" />}
        </g>
      ) : (
        <g>
          <rect x="23" y="12" width="10" height="16" fill="#e6dcc4" stroke={PALETTE.gold} strokeWidth="0.3" />
          <path d="M23 12 Q28 7 33 12 Z" fill="#e6dcc4" stroke={PALETTE.gold} strokeWidth="0.3" />
          <rect x="26" y="18" width="4" height="3.8" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.25" />
          <circle cx="31.5" cy="16" r="0.5" fill="#e04a2a" />
          <circle cx="31.5" cy="16" r="1.4" fill="url(#glow)" opacity="0.5" />
        </g>
      )}
    </Layer>
  );
}

function Priest({ x, y, facing }: { x: number; y: number; facing: 'away' | 'toward' }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 8.5} rx="2.2" ry="0.6" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      <path d={`M${x - 2.2} ${y + 8.5} L${x - 1.6} ${y + 1.5} Q${x} ${y} ${x + 1.6} ${y + 1.5} L${x + 2.2} ${y + 8.5} Z`} fill="#3a8a4a" />
      <path d={`M${x - 0.7} ${y + 1.5} h1.4 v6.5 h-1.4 Z`} fill="#c9a24a" opacity="0.8" />
      <circle cx={x} cy={y} r="1.1" fill={facing === 'toward' ? '#e3c69c' : '#4a3020'} />
      {facing === 'toward' && <circle cx={x} cy={y - 0.9} r="0.9" fill="#4a3020" clipPath="inset(0 0 50% 0)" />}
    </g>
  );
}

function Orientation({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="orientation" variant={variant}>
      {variant === 'orientem' ? <Priest x={50} y={26} facing="away" /> : <Priest x={50} y={30.5} facing="toward" />}
    </Layer>
  );
}

function MassForm({ variant }: { variant: string }) {
  if (variant === 'vernacular') return null;
  return (
    <Layer scene="church" layer="mass_form" variant={variant}>
      {variant === 'tlm' && (
        <g>
          {[46, 50, 54].map((x) => (
            <rect key={x} x={x - 1.4} y="30.2" width="2.8" height="1.9" fill="#f6f1e4" stroke={PALETTE.gold} strokeWidth="0.15" />
          ))}
          <rect x="24" y="37.2" width="52" height="0.8" fill="#f6f1e4" opacity="0.9" />
        </g>
      )}
      {variant === 'latin_novus' && (
        <g>
          <rect x="30.8" y="28.4" width="3.4" height="1.2" fill="#7a1f1f" />
          <rect x="31.2" y="28.6" width="2.6" height="0.3" fill={PALETTE.gold} />
          <rect x="63" y="20" width="4" height="6" fill="#2a1408" />
          {[21.2, 22.6, 24].map((y) => <rect key={y} x="63.6" y={y} width="2.8" height="0.5" fill="#f3eee0" />)}
        </g>
      )}
    </Layer>
  );
}

function Statues({ variant, warmth }: { variant: string; warmth: number }) {
  if (variant === 'none') return null;
  const spots: [number, 'left' | 'right'][] = variant === 'many' ? [[4, 'left'], [13, 'left'], [87, 'right'], [96, 'right']] : [[13, 'left'], [87, 'right']];
  return (
    <Layer scene="church" layer="statues" variant={variant}>
      {spots.map(([x, side]) => {
        const [, top] = wallPoint(side, x, 0.42);
        const [, base] = wallPoint(side, x, 0.7);
        const h = base - top;
        return (
          <g key={x}>
            <rect x={x - 1.8} y={base} width="3.6" height="1.2" fill="#8a7a5a" />
            <path d={`M${x - 1.4} ${base} L${x - 1} ${top + 2} Q${x} ${top + 0.6} ${x + 1} ${top + 2} L${x + 1.4} ${base} Z`} fill={variant === 'many' && x % 2 ? '#dfe4ea' : '#3d5a9a'} />
            <circle cx={x} cy={top + 1.2} r="0.95" fill="#e3c69c" />
            <path d={`M${x - 1.1} ${top + 0.6} Q${x} ${top - 0.6} ${x + 1.1} ${top + 0.6}`} fill="none" stroke={PALETTE.gold} strokeWidth="0.35" />
            {Array.from({ length: warmth > 0.6 ? 4 : 2 }, (_, i) => (
              <Candle key={i} x={x - 1.5 + i * 1} y={base + 3.2 + (i % 2) * 0.4} h={1.2 + (i % 2) * 0.5} lit={i !== 1} />
            ))}
            <rect x={x - 2.4} y={base + 3.2} width="4.8" height="0.6" fill="#5a3a12" />
            <rect x={x - 2.4} y={base + 3.2} width="4.8" height="0.6" fill="#000" opacity="0.2" />
            <line x1={x - 1.8} y1={base + h * 0.02} x2={x - 1.8} y2={base + 3.2} stroke="#5a3a12" strokeWidth="0.3" />
          </g>
        );
      })}
    </Layer>
  );
}

function Choir({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="choir" variant={variant}>
      {variant === 'front' && (
        <g>
          <rect x="24" y="34" width="12" height="7" fill="#000" opacity="0.15" />
          <rect x="25" y="33" width="6" height="2.4" fill="#1c1917" />
          <rect x="25.5" y="33.2" width="5" height="0.5" fill="#e6e6e6" />
          <rect x="27.5" y="35.4" width="0.6" height="3" fill="#333" />
          <path d="M33 32 q1.2 0 1.2 1.6 v3 q0 1.4 -1.2 1.4 q-1.2 0 -1.2 -1.4 v-3 q0 -1.6 1.2 -1.6 Z" fill="#a8713a" stroke="#3f2410" strokeWidth="0.2" />
          <line x1="33" y1="26" x2="33" y2="33" stroke="#3f2410" strokeWidth="0.5" />
          {[24.5, 35.5].map((x) => (
            <g key={x}>
              <line x1={x} y1="30" x2={x} y2="36" stroke="#333" strokeWidth="0.4" />
              <rect x={x - 0.6} y="29" width="1.2" height="1.6" rx="0.6" fill="#222" />
            </g>
          ))}
          <path d="M34 39 h3 l0.6 2 h-4.2 Z" fill="#7a3f19" />
        </g>
      )}
      {variant === 'schola' && (
        <g>
          {[63, 66, 69, 72].map((x, i) => (
            <g key={x}>
              <rect x={x} y={33 + (i % 2) * 0.4} width="1.8" height="4.5" fill="#1c1917" />
              <circle cx={x + 0.9} cy={32.4 + (i % 2) * 0.4} r="0.85" fill="#e3c69c" />
            </g>
          ))}
          <rect x="62" y="37.8" width="12.5" height="0.8" fill="url(#wood)" />
          <rect x="64.5" y="35" width="2.4" height="1.6" fill="#f3eee0" transform="rotate(-8 65.7 35.8)" />
        </g>
      )}
      {variant === 'loft' && (
        <g>
          <rect x="30" y="-1" width="40" height="3" fill="#2a1408" opacity="0.5" />
          {[34, 38, 42, 46, 50, 54, 58, 62].map((x, i) => (
            <rect key={x} x={x} y={-1} width="1.6" height={2.2 + (i % 3)} fill="#c9c0b0" opacity="0.7" />
          ))}
        </g>
      )}
    </Layer>
  );
}

function Confessionals({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="confessionals" variant={variant}>
      {(variant === 'booths' || variant === 'both') && (
        <g>
          <rect x="80" y="20" width="12" height="20" fill="url(#wood)" />
          <rect x="80" y="17.5" width="12" height="2.8" fill={PALETTE.oakDark} />
          <path d="M80 17.5 Q86 14 92 17.5 Z" fill={PALETTE.oakDark} />
          <rect x="82" y="23" width="3.2" height="16" fill="#120a05" />
          <rect x="86.8" y="23" width="3.2" height="16" fill="#120a05" />
          <rect x="82" y="23" width="3.2" height="16" fill="#7a1f1f" opacity="0.6" />
          <rect x="86.8" y="23" width="3.2" height="16" fill="#7a1f1f" opacity="0.6" />
          <rect x="85.2" y="24" width="1.6" height="10" fill="#2a1408" />
          <circle cx="86" cy="19" r="0.55" fill="#e04a2a" opacity="0.9" />
          <rect x="80.5" y="40" width="11" height="0.8" fill="#000" opacity="0.3" />
        </g>
      )}
      {variant === 'room' && (
        <g>
          <rect x="80" y="22" width="12" height="18" fill="#d8cfb8" stroke="#7a6a4a" strokeWidth="0.3" />
          <rect x="84.5" y="26" width="4" height="14" fill={PALETTE.oak} />
          <circle cx="87.8" cy="33" r="0.4" fill="url(#brass)" />
          <rect x="81" y="23" width="10" height="1.2" fill={PALETTE.gold} opacity="0.5" />
          <rect x="82.6" y="23.3" width="6.8" height="0.6" fill="#3a2a1a" />
        </g>
      )}
      {variant === 'both' && (
        <g>
          <rect x="93" y="24" width="7" height="16" fill="#d8cfb8" stroke="#7a6a4a" strokeWidth="0.3" />
          <rect x="95.5" y="28" width="3.5" height="12" fill={PALETTE.oak} />
          <circle cx="98.3" cy="34" r="0.35" fill="url(#brass)" />
        </g>
      )}
    </Layer>
  );
}

function AltarRail({ variant }: { variant: string }) {
  if (variant === 'none') return null;
  const color = variant === 'marble' ? 'url(#marble)' : 'url(#wood)';
  return (
    <Layer scene="church" layer="altar_rail" variant={variant}>
      <rect x="22" y="40" width="56" height="1.5" fill={color} stroke="#3a2a14" strokeWidth="0.2" />
      {Array.from({ length: 15 }, (_, i) => {
        const x = 23 + i * 4;
        if (x > 46 && x < 54) return null;
        return <rect key={i} x={x} y="41.5" width="1" height="3" fill={color} />;
      })}
      <rect x="22" y="44.5" width="56" height="0.8" fill="#000" opacity="0.25" />
      <rect x="46" y="40" width="8" height="1.5" fill="url(#brass)" />
      <rect x="22" y="44.5" width="24" height="1.2" fill="#7a1f1f" opacity="0.8" />
      <rect x="54" y="44.5" width="24" height="1.2" fill="#7a1f1f" opacity="0.8" />
    </Layer>
  );
}

function Baptistery({ rich }: { rich: boolean }) {
  return (
    <g>
      <ellipse cx="12" cy="49" rx="6" ry="2" fill="#1a0f08" opacity="0.3" filter="url(#soft)" />
      <path d="M8 40 h8 l1 7 h-10 Z" fill={rich ? 'url(#marble)' : '#c9bda4'} />
      <ellipse cx="12" cy="40" rx="4.5" ry="1.4" fill={rich ? '#e7e0d0' : '#d9cdb5'} stroke="#8a7a5a" strokeWidth="0.2" />
      <ellipse cx="12" cy="40" rx="3.4" ry="0.9" fill="#7fa7c9" />
      <Candle x={17} y={40} h={9} lit />
      <rect x="16.4" y="40" width="1.2" height="0.8" fill="url(#brass)" />
    </g>
  );
}

function Pews({ color }: { color: string }) {
  const rows = [44.5, 47.5, 51, 55, 59.5];
  return (
    <g>
      {rows.map((y, i) => {
        const spread = i * 1.6;
        const backH = 2 + i * 0.35;
        const pew = (x: number, w: number) => (
          <g>
            <rect x={x} y={y - backH} width={w} height={backH} fill={color} />
            <rect x={x} y={y - backH} width={w} height="0.4" fill="#fff" opacity="0.3" />
            <rect x={x} y={y - backH} width={w} height={backH} fill="url(#wallShade)" opacity="0.6" />
            <rect x={x - 0.6} y={y} width={w + 1.2} height="1" fill={color} />
            <rect x={x - 0.6} y={y + 1} width={w + 1.2} height="0.7" fill="#000" opacity="0.35" />
            <rect x={x - 0.6} y={y + 1.7} width="1" height={1.2 + i * 0.2} fill="#000" opacity="0.3" />
            <rect x={x + w - 0.4} y={y + 1.7} width="1" height={1.2 + i * 0.2} fill="#000" opacity="0.3" />
            <rect x={x + 1} y={y - backH + 0.6} width={w - 2} height="0.25" fill="#000" opacity="0.15" />
          </g>
        );
        return (
          <g key={y}>
            {pew(20 - spread, 24 + spread * 0.8)}
            {pew(56, 24 + spread * 0.8)}
          </g>
        );
      })}
    </g>
  );
}

function Doors() {
  return (
    <g>
      <rect x="44" y="52" width="12" height="8" fill="#000" opacity="0.12" />
    </g>
  );
}
