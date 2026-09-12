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

export interface PriestLook { skin: string; hair: string }

/**
 * The church, looking up the nave to the sanctuary. The shell (walls,
 * glass, ceiling) comes from the parish's kind; everything the pastor can
 * change is a layer on top. The floor plan, so nothing sits on anything
 * else: the chancel is raised at the back with the altar in the middle, the
 * ambo at its left and the chair at its right; the tabernacle is on the
 * gradine behind the altar or on a side altar in the left bay of the back
 * wall; statues stand in the back-wall bays and on plinths flanking the
 * steps; the rail runs along the top step; the pews start below it; the
 * confessionals are on the left side wall; the font is at the front left;
 * the musicians, if they are up front, are at the front right.
 */
export function Church({ decor, parish, priest }: { decor: PlaceDecor; parish: Parish | undefined; priest?: PriestLook }) {
  const shell = SHELLS[parish?.kind ?? 'rural'];
  const rich = (parish?.wealth ?? 3) >= 4;
  const tl = wallPoint('left', 0, 0);
  const bl = wallPoint('left', 0, 1);
  const tr = wallPoint('right', 100, 0);
  const br = wallPoint('right', 100, 1);
  const sanctuary = art(decor, 'sanctuary', 'plain');
  const tabernacle = art(decor, 'tabernacle', 'center');
  const rail = art(decor, 'altar_rail', 'none');
  const massForm = art(decor, 'mass_form', 'vernacular');
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
      {(parish?.kind === 'flagship_suburban' || parish?.kind === 'difficult') && <polygon points={pts([[46, 48], [54, 48], [62, 60], [38, 60]])} fill="#000" opacity="0.08" />}
      {parish?.kind !== 'flagship_suburban' && parish?.kind !== 'difficult' && [49, 52, 55.5, 59].map((y, i) => <line key={y} x1={4 + i * 2} y1={y} x2={96 - i * 2} y2={y} stroke="#000" strokeWidth="0.15" opacity="0.25" />)}

      {/* the chancel: a raised floor and two steps */}
      <polygon points={pts([[BACK.x0 + 2, BACK.y1], [BACK.x1 - 2, BACK.y1], [84, 46], [16, 46]])} fill={rich ? 'url(#marble)' : '#d9cdb5'} />
      <polygon points={pts([[16, 46], [84, 46], [86, 48], [14, 48]])} fill={rich ? '#bfb4a0' : '#a89a80'} />
      <polygon points={pts([[14, 48], [86, 48], [88, 50], [12, 50]])} fill={rich ? '#d3c9b6' : '#b9ab90'} />
      <polygon points={pts([[14, 48], [86, 48], [88, 50], [12, 50]])} fill="#000" opacity="0.08" />

      <Reredos variant={sanctuary} shell={shell} rich={rich} />
      <Crucifix x={50} y={sanctuary === 'modern' ? 9 : 10.5} s={sanctuary === 'modern' ? 1.3 : 1.5} corpus={sanctuary !== 'modern'} />
      <Bays statues={art(decor, 'statues', 'many')} tabernacle={tabernacle} rich={rich} warmth={shell.warmth} />
      <Gradine tabernacle={tabernacle} sanctuary={sanctuary} rich={rich} />
      {art(decor, 'orientation', 'populum') === 'populum' && <Priest x={50} y={31.5} facing="toward" {...(priest ? { look: priest } : {})} />}
      <Altar sanctuary={sanctuary} rich={rich} massForm={massForm} />
      {art(decor, 'orientation', 'populum') === 'orientem' && <Priest x={50} y={36.5} facing="away" {...(priest ? { look: priest } : {})} />}
      <Orientation variant={art(decor, 'orientation', 'populum')} />
      <Ambo massForm={massForm} />
      <Chair rich={rich} />
      <Plinths statues={art(decor, 'statues', 'many')} warmth={shell.warmth} />
      <AltarRail variant={rail} massForm={massForm} />
      <MassForm variant={massForm} rail={rail} />
      <Confessionals variant={art(decor, 'confessionals', 'booths')} />
      <Pews color={parish?.kind === 'difficult' ? '#8a6a4a' : parish?.kind === 'flagship_suburban' ? '#a87a4a' : PALETTE.oak} />
      <Font rich={rich} />
      <Choir variant={art(decor, 'choir', 'loft')} />
    </g>
  );
}

function Glass({ kind }: { kind: Shell['glass'] }) {
  const win = (side: 'left' | 'right', x: number, w: number, f0: number, f1: number, color: string, arch: boolean, key: string) => {
    const a = wallPoint(side, x, f0);
    const b = wallPoint(side, x + w, f0);
    const c = wallPoint(side, x + w, f1);
    const d = wallPoint(side, x, f1);
    const mid = wallPoint(side, x + w / 2, f0);
    return (
      <g key={key}>
        <polygon points={pts([a, b, c, d])} fill={color} opacity="0.9" />
        {arch && <polygon points={pts([a, [mid[0], mid[1] - w * 0.7], b])} fill={color} opacity="0.9" />}
        {arch && <line x1={mid[0]} y1={mid[1] - w * 0.5} x2={(c[0] + d[0]) / 2} y2={(c[1] + d[1]) / 2} stroke="#3a2a1a" strokeWidth="0.25" opacity="0.8" />}
        <polygon points={pts([a, b, c, d])} fill="url(#lightShaft)" />
        <polygon points={pts([a, b, c, d])} fill="none" stroke="#3a2a1a" strokeWidth="0.3" />
      </g>
    );
  };
  const colors = ['#c0392b', '#2e5aac', '#c9a24a', '#2e8b57', '#7b3fa0'];
  if (kind === 'lancet')
    return (
      <g>
        {[3, 9.5].map((x, i) => win('left', x, 3, 0.08, 0.5, colors[i]!, true, `l${x}`))}
        {[87.5, 94].map((x, i) => win('right', x, 3, 0.08, 0.5, colors[i + 2]!, true, `r${x}`))}
        {[3, 9.5].map((x) => <polygon key={x} points={pts([wallPoint('left', x + 1, 0.5), wallPoint('left', x + 2, 0.5), [x + 24, 52], [x + 14, 52]])} fill="url(#lightShaft)" opacity="0.45" />)}
      </g>
    );
  if (kind === 'clerestory')
    return (
      <g>
        {[2, 7, 12].map((x) => win('left', x, 4, 0.05, 0.28, '#dfe9f0', false, `l${x}`))}
        {[84, 89, 94].map((x) => win('right', x, 4, 0.05, 0.28, '#dfe9f0', false, `r${x}`))}
      </g>
    );
  if (kind === 'slab')
    return (
      <g>
        {[2, 4.5, 7, 9.5, 12, 14.5].map((x, i) => win('left', x, 1.4, 0.08, 0.5, ['#e0b93a', '#c7742a', '#e0b93a', '#8a3a2a', '#e0b93a', '#c7742a'][i]!, false, `l${x}`))}
        {[84, 86.5, 89, 91.5, 94, 96.5].map((x, i) => win('right', x, 1.4, 0.08, 0.5, ['#c7742a', '#e0b93a', '#8a3a2a', '#e0b93a', '#c7742a', '#e0b93a'][i]!, false, `r${x}`))}
      </g>
    );
  if (kind === 'round')
    return (
      <g>
        {[4, 11].map((x, i) => win('left', x, 4, 0.1, 0.5, colors[(i + 1) % 5]!, true, `l${x}`))}
        {[85, 92].map((x, i) => win('right', x, 4, 0.1, 0.5, colors[(i + 3) % 5]!, true, `r${x}`))}
        {[[6, 14], [93, 14]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="1.6" fill="#c9a24a" opacity="0.8" />)}
      </g>
    );
  return (
    <g>
      {[4, 11].map((x) => win('left', x, 4, 0.1, 0.5, '#eaf0f3', false, `l${x}`))}
      {[85, 92].map((x) => win('right', x, 4, 0.1, 0.5, '#eaf0f3', false, `r${x}`))}
      <polygon points={pts([wallPoint('left', 6, 0.5), wallPoint('left', 8, 0.5), [30, 54], [18, 54]])} fill="url(#lightShaft)" opacity="0.5" />
    </g>
  );
}

/** What is on the back wall behind the altar: a reredos, a plain wall with a hanging, a modern slot of light, or a restored one. */
function Reredos({ variant, shell, rich }: { variant: string; shell: Shell; rich: boolean }) {
  return (
    <Layer scene="church" layer="sanctuary" variant={variant}>
      {variant === 'high_altar' && (
        <g>
          <rect x="34" y="9" width="32" height="31" fill={rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.35" />
          <path d="M36 12 Q50 1 64 12 V14.5 Q50 4 36 14.5 Z" fill={PALETTE.gold} opacity="0.75" />
          {[37.5, 43, 57, 62.5].map((x) => (
            <g key={x}>
              <rect x={x - 0.8} y="14" width="1.6" height="17" fill={rich ? '#d9cbb0' : '#cdbf9e'} stroke="#8a7a5a" strokeWidth="0.15" />
              <rect x={x - 1.3} y="13" width="2.6" height="1.1" fill={PALETTE.gold} opacity="0.85" />
              <rect x={x - 1.3} y="30.6" width="2.6" height="0.8" fill={PALETTE.gold} opacity="0.85" />
            </g>
          ))}
          <rect x="39" y="17" width="4.5" height="12" fill="#2a3f6e" opacity="0.8" />
          <rect x="56.5" y="17" width="4.5" height="12" fill="#6e2a2a" opacity="0.8" />
          <rect x="36" y="31.5" width="28" height="1.6" fill={PALETTE.gold} opacity="0.55" />
        </g>
      )}
      {variant === 'plain' && (
        <g>
          <rect x="38" y="9" width="24" height="24" fill="url(#wood)" opacity="0.75" />
          <rect x="38" y="9" width="24" height="24" fill={shell.wall} opacity="0.2" />
          {[41, 45.5, 50, 54.5, 59].map((x) => <rect key={x} x={x - 0.6} y="9" width="1.2" height="24" fill="#000" opacity="0.08" />)}
          <rect x="30" y="10" width="40" height="26" fill="#8a3a30" opacity="0.08" />
        </g>
      )}
      {variant === 'modern' && (
        <g>
          <rect x="26" y="8" width="48" height="32" fill="#d9d3c5" />
          <rect x="26" y="8" width="48" height="32" fill="url(#wallShade)" />
          <rect x="48" y="8" width="4" height="28" fill="url(#sky)" />
          <rect x="47.5" y="8" width="0.4" height="28" fill="#000" opacity="0.2" />
          <polygon points="48,36 52,36 62,48 38,48" fill="url(#lightShaft)" opacity="0.8" />
        </g>
      )}
      {(variant === 'restored' || variant === 'gothic') && (
        <g>
          <rect x="33" y="8" width="34" height="32" fill={variant === 'gothic' ? '#1f3a6e' : rich ? 'url(#marble)' : '#e2d6be'} stroke={PALETTE.gold} strokeWidth="0.5" />
          {variant === 'gothic' && [37, 42, 47, 53, 58, 63].map((x) => <circle key={x} cx={x} cy={11 + (x % 3)} r="0.5" fill={PALETTE.gold} opacity="0.8" />)}
          <path d="M37 20 Q50 3 63 20" fill="none" stroke={PALETTE.gold} strokeWidth="1" />
          {[38, 44, 56, 62].map((x) => (
            <path key={x} d={`M${x - 2.4} 30 L${x - 2.4} 20 Q${x} 14 ${x + 2.4} 20 L${x + 2.4} 30 Z`} fill={variant === 'gothic' ? '#c9a24a' : '#d9cbb0'} stroke={PALETTE.gold} strokeWidth="0.4" opacity="0.9" />
          ))}
          <rect x="35" y="31.5" width="30" height="1.6" fill={PALETTE.gold} opacity="0.55" />
        </g>
      )}
    </Layer>
  );
}

/** The back-wall bays either side of the sanctuary: a side altar for the tabernacle, or a statue on a pedestal. */
function Bays({ statues, tabernacle, rich, warmth }: { statues: string; tabernacle: string; rich: boolean; warmth: number }) {
  const statue = (x: number, robe: string, key: string) => (
    <g key={key}>
      <rect x={x - 3} y="30" width="6" height="8" fill={rich ? 'url(#marble)' : '#b9ab90'} />
      <rect x={x - 3.4} y="29.4" width="6.8" height="0.9" fill={rich ? '#e7e0d0' : '#cdbf9e'} />
      <path d={`M${x - 2.3} 29.4 L${x - 1.6} 18 Q${x} 15.6 ${x + 1.6} 18 L${x + 2.3} 29.4 Z`} fill={robe} />
      <path d={`M${x - 1} 20 Q${x} 19 ${x + 1} 20 L${x + 1.4} 29.4 L${x - 1.4} 29.4 Z`} fill="#fff" opacity="0.18" />
      <circle cx={x} cy={16.6} r="1.35" fill="#e8d6bc" />
      <path d={`M${x - 1.6} 15.6 Q${x} 13.4 ${x + 1.6} 15.6`} fill="none" stroke={PALETTE.gold} strokeWidth="0.45" />
      {Array.from({ length: warmth > 0.6 ? 5 : 3 }, (_, i) => <Candle key={i} x={x - 2.2 + i * 1.1} y={38.5 + (i % 2) * 0.3} h={1.1 + (i % 2) * 0.4} lit={i !== 1} />)}
      <rect x={x - 3.2} y="38.6" width="6.4" height="0.7" fill="#5a3a12" />
    </g>
  );
  const many = statues === 'many';
  const few = statues === 'few';
  return (
    <Layer scene="church" layer="statues" variant={statues}>
      {tabernacle === 'side' ? (
        <g>
          <rect x="20" y="30" width="12" height="9" fill={rich ? 'url(#marble)' : '#d9cdb5'} />
          <rect x="20" y="29.4" width="12" height="1" fill={rich ? '#e7e0d0' : '#e8dfcc'} />
          <rect x="21" y="18" width="10" height="11.4" fill="#e6dcc4" stroke={PALETTE.gold} strokeWidth="0.3" />
          <path d="M21 18 Q26 12 31 18 Z" fill="#e6dcc4" stroke={PALETTE.gold} strokeWidth="0.3" />
          <rect x="23.8" y="22.5" width="4.4" height="4.6" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.25" />
          <rect x="25.85" y="23" width="0.4" height="3.6" fill="#5a3a12" opacity="0.7" />
          <circle cx="26" cy="21.4" r="0.7" fill="url(#brass)" />
          <circle cx="30.2" cy="20.5" r="0.55" fill="#e04a2a" />
          <circle cx="30.2" cy="20.5" r="1.6" fill="url(#glow)" opacity="0.55" />
          <Candle x={22.5} y={29.4} h={2.2} lit />
          <Candle x={29.5} y={29.4} h={2.2} lit />
          {(many || few) && statue(74, '#3d5a9a', 'right')}
        </g>
      ) : (
        <g>
          {(many || few) && statue(26, '#3d5a9a', 'left')}
          {(many || few) && statue(74, '#8a5a2e', 'right')}
        </g>
      )}
    </Layer>
  );
}

/** Statues on plinths flanking the steps, when the parish has many. */
function Plinths({ statues, warmth }: { statues: string; warmth: number }) {
  if (statues !== 'many') return null;
  const one = (x: number, robe: string) => (
    <g key={x}>
      <rect x={x - 2.2} y="40" width="4.4" height="4.4" fill="#8a7a5a" />
      <rect x={x - 2.5} y="39.6" width="5" height="0.7" fill="#a89a80" />
      <path d={`M${x - 1.7} 39.6 L${x - 1.2} 32.3 Q${x} 30.9 ${x + 1.2} 32.3 L${x + 1.7} 39.6 Z`} fill={robe} />
      <circle cx={x} cy={31.4} r={1.05} fill="#e8d6bc" />
      <path d={`M${x - 1.2} 30.7 Q${x} 29.1 ${x + 1.2} 30.7`} fill="none" stroke={PALETTE.gold} strokeWidth="0.4" />
      {Array.from({ length: warmth > 0.6 ? 4 : 2 }, (_, i) => <Candle key={i} x={x - 1.5 + i * 1} y={45.6} h={1 + (i % 2) * 0.4} lit={i !== 1} />)}
      <rect x={x - 2.4} y="45.7" width="4.8" height="0.6" fill="#5a3a12" />
    </g>
  );
  return (
    <g>
      {one(8, '#dfe4ea')}
      {one(92, '#7a2a2a')}
    </g>
  );
}

/** The gradine behind the altar: the tabernacle, when it is in the center, and its lamp. */
function Gradine({ tabernacle, sanctuary, rich }: { tabernacle: string; sanctuary: string; rich: boolean }) {
  return (
    <Layer scene="church" layer="tabernacle" variant={tabernacle}>
      {tabernacle === 'center' && (
        <g>
          <rect x="43" y="33.6" width="14" height="2.6" fill={sanctuary === 'modern' ? '#b5ada0' : rich ? 'url(#marble)' : '#d9cdb5'} />
          <rect x="43" y="33.6" width="14" height="0.5" fill="#fff" opacity="0.3" />
          <rect x="46.6" y="28.4" width="6.8" height="5.4" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.3" />
          <rect x="49.7" y="29" width="0.6" height="4.2" fill="#5a3a12" opacity="0.7" />
          <path d="M46.6 28.4 Q50 26.4 53.4 28.4 Z" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.25" />
          <circle cx="50" cy="26.6" r="0.75" fill="url(#brass)" />
          <circle cx="55.6" cy="30.4" r="0.6" fill="#e04a2a" />
          <circle cx="55.6" cy="30.4" r="1.9" fill="url(#glow)" opacity="0.55" />
          <line x1="55.6" y1="24" x2="55.6" y2="29.6" stroke="#5a3a12" strokeWidth="0.25" />
        </g>
      )}
    </Layer>
  );
}

function Altar({ sanctuary, rich, massForm }: { sanctuary: string; rich: boolean; massForm: string }) {
  const top = sanctuary === 'modern' ? '#b5ada0' : rich ? 'url(#marble)' : '#e8dfcc';
  const front = sanctuary === 'modern' ? '#a29a8c' : rich ? '#cfc4ae' : '#d9cdb5';
  const candles = sanctuary === 'high_altar' || sanctuary === 'restored' || sanctuary === 'gothic' ? [42.4, 44.6, 55.4, 57.6] : [42.6, 57.4];
  return (
    <g>
      <ellipse cx="50" cy="44" rx="12" ry="1.4" fill="#1a0f08" opacity="0.32" filter="url(#soft)" />
      <polygon points="40,36 60,36 61.5,37.6 38.5,37.6" fill={top} />
      <rect x="39.2" y="37.6" width="21.6" height="6" fill={front} />
      <rect x="39.2" y="37.6" width="21.6" height="0.7" fill="#fff" opacity="0.35" />
      {sanctuary !== 'modern' && <rect x="39.2" y="37.6" width="21.6" height="6" fill="url(#cloth)" opacity="0.9" />}
      {sanctuary !== 'modern' && <rect x="39.2" y="37.6" width="21.6" height="6" fill="#2e6b4f" opacity="0.55" />}
      {sanctuary !== 'modern' && <rect x="48.6" y="37.6" width="2.8" height="6" fill={PALETTE.gold} opacity="0.7" />}
      <rect x="39.6" y="36.2" width="20.8" height="1.4" fill="#f6f1e4" />
      {candles.map((x) => <Candle key={x} x={x} y={36.2} h={3.4} lit />)}
      {massForm === 'tlm' && [46, 50, 54].map((x) => <rect key={x} x={x - 1.5} y="33.8" width="3" height="2.3" fill="#f6f1e4" stroke={PALETTE.gold} strokeWidth="0.15" />)}
      {massForm !== 'tlm' && <rect x="48.4" y="35" width="3.2" height="1.3" fill="#f6f1e4" />}
      {massForm !== 'tlm' && <rect x="48.8" y="35.3" width="2.4" height="0.5" fill="#7a1f1f" opacity="0.8" />}
    </g>
  );
}

/** The priest: behind the altar facing the people, or in front of it with his back to them. */
function Priest({ x, y, facing, look }: { x: number; y: number; facing: 'away' | 'toward'; look?: PriestLook }) {
  const skin = look?.skin ?? '#e3c69c';
  const hair = look?.hair ?? '#4a3020';
  const green = '#3a8a4a';
  const dark = '#2d6d3a';
  if (facing === 'toward') {
    return (
      <g>
        <path d={`M${x - 4.2} ${y + 6.4} Q${x - 3.6} ${y + 1.6} ${x - 1.6} ${y + 1.2} L${x} ${y + 2.2} L${x + 1.6} ${y + 1.2} Q${x + 3.6} ${y + 1.6} ${x + 4.2} ${y + 6.4} Z`} fill={green} />
        <path d={`M${x - 1.2} ${y + 1.6} h2.4 v4.8 h-2.4 Z`} fill={PALETTE.gold} opacity="0.8" />
        <path d={`M${x - 4.2} ${y + 6.4} Q${x - 3.6} ${y + 1.6} ${x - 1.6} ${y + 1.2}`} fill="none" stroke={dark} strokeWidth="0.3" />
        <rect x={x - 0.7} y={y + 0.2} width="1.4" height="1.4" fill={skin} />
        <circle cx={x} cy={y - 0.9} r="1.55" fill={skin} />
        <path d={`M${x - 1.6} ${y - 1.1} A1.6 1.6 0 0 1 ${x + 1.6} ${y - 1.1} Q${x + 1.1} ${y - 1.9} ${x} ${y - 2.1} Q${x - 1.1} ${y - 1.9} ${x - 1.6} ${y - 1.1} Z`} fill={hair} />
        <circle cx={x - 0.55} cy={y - 0.8} r="0.17" fill="#2a2018" />
        <circle cx={x + 0.55} cy={y - 0.8} r="0.17" fill="#2a2018" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={x} cy={y + 9.6} rx="2.6" ry="0.7" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      <path d={`M${x - 3.4} ${y + 9.6} L${x - 2.6} ${y + 1.8} Q${x} ${y + 0.6} ${x + 2.6} ${y + 1.8} L${x + 3.4} ${y + 9.6} Z`} fill={green} />
      <path d={`M${x - 1} ${y + 1.6} h2 v8 h-2 Z`} fill={PALETTE.gold} opacity="0.8" />
      <path d={`M${x - 3.4} ${y + 9.6} L${x - 2.6} ${y + 1.8}`} fill="none" stroke={dark} strokeWidth="0.3" />
      <path d={`M${x + 3.4} ${y + 9.6} L${x + 2.6} ${y + 1.8}`} fill="none" stroke={dark} strokeWidth="0.3" />
      <rect x={x - 0.7} y={y + 0.4} width="1.4" height="1.2" fill={skin} />
      <circle cx={x} cy={y - 0.6} r="1.55" fill={hair} />
      <path d={`M${x - 1.55} ${y - 0.6} A1.55 1.55 0 0 0 ${x + 1.55} ${y - 0.6} L${x + 1.2} ${y + 0.5} L${x - 1.2} ${y + 0.5} Z`} fill={skin} opacity="0.35" />
    </g>
  );
}

/** Kept as a layer for painted overrides; the figure itself is drawn around the altar. */
function Orientation({ variant }: { variant: string }) {
  return <Layer scene="church" layer="orientation" variant={variant}>{null}</Layer>;
}

function Ambo({ massForm }: { massForm: string }) {
  return (
    <g>
      <ellipse cx="33.5" cy="45.2" rx="4.2" ry="0.8" fill="#1a0f08" opacity="0.3" filter="url(#soft)" />
      <rect x="31" y="38" width="5" height="7" fill="url(#wood)" />
      <polygon points="29.6,36.2 36.4,36.2 37,38 29,38" fill="url(#woodTop)" />
      <rect x="30.4" y="35.2" width="5.2" height="1.4" fill="#7a1f1f" />
      <rect x="30.8" y="35.5" width="4.4" height="0.35" fill={PALETTE.gold} opacity="0.8" />
      {massForm === 'latin_novus' && <rect x="31.6" y="34.2" width="2.8" height="1" fill="#2a1408" />}
      <rect x="31" y="38" width="5" height="0.5" fill="#fff" opacity="0.25" />
    </g>
  );
}

function Chair({ rich }: { rich: boolean }) {
  return (
    <g>
      <ellipse cx="66.5" cy="44.6" rx="3.4" ry="0.7" fill="#1a0f08" opacity="0.3" filter="url(#soft)" />
      <rect x="64" y="33.5" width="5" height="7.5" rx="0.6" fill={rich ? '#6e2a2a' : PALETTE.oakDark} />
      <rect x="63.4" y="40" width="6.2" height="2.6" fill={rich ? '#8a3a3a' : PALETTE.oak} />
      <rect x="63.4" y="42.6" width="0.9" height="2" fill={PALETTE.oakDark} />
      <rect x="68.7" y="42.6" width="0.9" height="2" fill={PALETTE.oakDark} />
      <rect x="64.6" y="34.2" width="3.8" height="5.6" fill="#fff" opacity="0.08" />
    </g>
  );
}

function AltarRail({ variant, massForm }: { variant: string; massForm: string }) {
  if (variant === 'none') return null;
  const color = variant === 'marble' ? 'url(#marble)' : 'url(#wood)';
  const edge = variant === 'marble' ? '#8a8072' : '#3a2a14';
  return (
    <Layer scene="church" layer="altar_rail" variant={variant}>
      {Array.from({ length: 16 }, (_, i) => {
        const x = 19 + i * 4.1;
        if (x > 44.5 && x < 55.5) return null;
        return <rect key={i} x={x - 0.5} y="47.2" width="1" height="3.2" fill={color} stroke={edge} strokeWidth="0.12" />;
      })}
      <rect x="18" y="46" width="64" height="1.6" fill={color} stroke={edge} strokeWidth="0.2" />
      <rect x="18" y="46" width="64" height="0.4" fill="#fff" opacity="0.3" />
      <rect x="45.5" y="46" width="9" height="1.6" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.2" />
      <rect x="18" y="50.2" width="27" height="1.1" fill="#7a1f1f" opacity="0.85" />
      <rect x="55" y="50.2" width="27" height="1.1" fill="#7a1f1f" opacity="0.85" />
      {massForm === 'tlm' && <rect x="18" y="45.4" width="64" height="0.8" fill="#f6f1e4" opacity="0.95" />}
    </Layer>
  );
}

function MassForm({ variant, rail }: { variant: string; rail: string }) {
  if (variant === 'vernacular') return null;
  return (
    <Layer scene="church" layer="mass_form" variant={variant}>
      {variant === 'tlm' && rail === 'none' && <rect x="36" y="48" width="28" height="0.9" fill="#f6f1e4" opacity="0.9" />}
      {variant === 'latin_novus' && (
        <g>
          <rect x="76" y="19" width="4.2" height="6.4" fill="#2a1408" />
          {[20.2, 21.6, 23, 24.4].map((y) => <rect key={y} x={76.6} y={y} width="3" height="0.5" fill="#f3eee0" />)}
        </g>
      )}
    </Layer>
  );
}

/** The confessionals, on the left side wall toward the back: booths, a room, or both. */
function Confessionals({ variant }: { variant: string }) {
  const box = (x0: number, x1: number, f0: number, f1: number, fill: string, key: string) => {
    const a = wallPoint('left', x0, f0);
    const b = wallPoint('left', x1, f0);
    const c = wallPoint('left', x1, f1);
    const d = wallPoint('left', x0, f1);
    return <polygon key={key} points={pts([a, b, c, d])} fill={fill} />;
  };
  const booths = variant === 'booths' || variant === 'both';
  const room = variant === 'room' || variant === 'both';
  return (
    <Layer scene="church" layer="confessionals" variant={variant}>
      {booths && (
        <g>
          {box(9, 17.5, 0.56, 1, 'url(#wood)', 'body')}
          {box(9, 17.5, 0.52, 0.58, PALETTE.oakDark, 'cornice')}
          {box(10, 12.4, 0.64, 0.98, '#120a05', 'door1')}
          {box(13.4, 15.8, 0.64, 0.98, '#120a05', 'door2')}
          {box(10, 12.4, 0.64, 0.98, '#7a1f1f', 'curtain1')}
          {box(13.4, 15.8, 0.64, 0.98, '#7a1f1f', 'curtain2')}
          {box(12.6, 13.2, 0.66, 0.92, '#2a1408', 'grille')}
          <circle cx={wallPoint('left', 12.9, 0.61)[0]} cy={wallPoint('left', 12.9, 0.61)[1]} r="0.45" fill="#e04a2a" opacity="0.9" />
        </g>
      )}
      {room && (
        <g>
          {box(room && booths ? 2 : 9, room && booths ? 8 : 17.5, 0.56, 1, '#d8cfb8', 'roombody')}
          {box(room && booths ? 3.2 : 11.5, room && booths ? 6.4 : 15, 0.66, 1, PALETTE.oak, 'roomdoor')}
          {box(room && booths ? 2 : 9, room && booths ? 8 : 17.5, 0.56, 0.6, PALETTE.gold, 'roomsign')}
        </g>
      )}
    </Layer>
  );
}

/** The font: at the front left, by the door, where people are brought in. */
function Font({ rich }: { rich: boolean }) {
  return (
    <g>
      <ellipse cx="9" cy="56.6" rx="5.6" ry="1.4" fill="#1a0f08" opacity="0.3" filter="url(#soft)" />
      <polygon points="5.4,51 12.6,51 13.6,56.4 4.4,56.4" fill={rich ? 'url(#marble)' : '#c9bda4'} />
      <path d="M4.4 56.4 h9.2" stroke="#000" strokeWidth="0.3" opacity="0.2" />
      <ellipse cx="9" cy="51" rx="4.2" ry="1.3" fill={rich ? '#e7e0d0' : '#d9cdb5'} stroke="#8a7a5a" strokeWidth="0.2" />
      <ellipse cx="9" cy="51" rx="3.1" ry="0.85" fill="#7fa7c9" />
      <ellipse cx="8.4" cy="50.8" rx="1" ry="0.3" fill="#fff" opacity="0.5" />
      <Candle x={14.6} y={51.6} h={9} lit />
      <rect x="13.9" y="51.6" width="1.4" height="1" fill="url(#brass)" />
    </g>
  );
}

/** The musicians: a loft over the door, a group at the front right, or a schola in cassocks. */
function Choir({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="choir" variant={variant}>
      {variant === 'loft' && (
        <g>
          <rect x="30" y="-1" width="40" height="3.6" fill="#2a1408" opacity="0.55" />
          {[36, 39.5, 43, 46.5, 50, 53.5, 57, 60.5, 64].map((x, i) => <rect key={x} x={x - 0.8} y={-1} width="1.6" height={2.4 + (i % 3) * 0.6} fill="#c9c0b0" opacity="0.75" />)}
          <rect x="30" y="2.4" width="40" height="0.5" fill={PALETTE.oakDark} />
        </g>
      )}
      {variant === 'front' && (
        <g>
          <ellipse cx="90" cy="55" rx="8" ry="1.6" fill="#1a0f08" opacity="0.28" filter="url(#soft)" />
          <rect x="84" y="49" width="9" height="2.2" fill="#1c1917" />
          <rect x="84.4" y="49.3" width="8.2" height="0.5" fill="#e6e6e6" />
          <rect x="85" y="51.2" width="0.7" height="3.4" fill="#333" />
          <rect x="91.4" y="51.2" width="0.7" height="3.4" fill="#333" />
          <path d="M96 45.6 q1.3 0 1.3 1.8 v3.4 q0 1.5 -1.3 1.5 q-1.3 0 -1.3 -1.5 v-3.4 q0 -1.8 1.3 -1.8 Z" fill="#a8713a" stroke="#3f2410" strokeWidth="0.2" />
          <line x1="96" y1="39.5" x2="96" y2="45.6" stroke="#3f2410" strokeWidth="0.5" />
          {[82.6, 94].map((x) => (
            <g key={x}>
              <line x1={x} y1="42" x2={x} y2="49" stroke="#333" strokeWidth="0.4" />
              <rect x={x - 0.6} y="41" width="1.2" height="1.6" rx="0.6" fill="#222" />
            </g>
          ))}
          <path d="M86 46.6 h3.4 l0.6 2 h-4.6 Z" fill="#7a3f19" />
          <line x1="87.7" y1="48.6" x2="87.7" y2="51" stroke="#7a3f19" strokeWidth="0.4" />
        </g>
      )}
      {variant === 'schola' && (
        <g>
          {[83, 86.5, 90, 93.5].map((x, i) => (
            <g key={x}>
              <ellipse cx={x + 1} cy={52.4 + (i % 2) * 0.3} rx="1.6" ry="0.4" fill="#1a0f08" opacity="0.3" />
              <path d={`M${x - 0.4} ${52.4 + (i % 2) * 0.3} L${x + 0.2} ${45.6 + (i % 2) * 0.3} Q${x + 1} ${45} ${x + 1.8} ${45.6 + (i % 2) * 0.3} L${x + 2.4} ${52.4 + (i % 2) * 0.3} Z`} fill="#1c1917" />
              <path d={`M${x + 0.1} ${46} Q${x + 1} ${45.5} ${x + 1.9} ${46} L${x + 2.1} ${49.4} L${x - 0.1} ${49.4} Z`} fill="#f3eee0" />
              <circle cx={x + 1} cy={44.6 + (i % 2) * 0.3} r="1" fill="#e3c69c" />
              <rect x={x + 0.2} y="47.4" width="1.6" height="1.2" fill="#2a1408" transform={`rotate(-12 ${x + 1} 48)`} />
            </g>
          ))}
          <rect x="82" y="52.8" width="14" height="0.6" fill="url(#wood)" />
        </g>
      )}
    </Layer>
  );
}

function Pews({ color }: { color: string }) {
  const rows = [53, 56.2, 59.6];
  return (
    <g>
      {rows.map((y, i) => {
        const spread = i * 1.5;
        const backH = 2.1 + i * 0.4;
        const pew = (x: number, w: number, key: string) => (
          <g key={key}>
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
            {pew(20 - spread, 22 + spread * 0.7, 'l')}
            {pew(58, 22 + spread * 0.7, 'r')}
          </g>
        );
      })}
    </g>
  );
}
