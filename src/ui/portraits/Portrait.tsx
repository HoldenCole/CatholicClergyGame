import type { Portrait as Spec, PortraitSpec } from './spec';

const SKIN = ['#f6e3d1', '#f0d2b8', '#e2bd98', '#d1a074', '#b8895a', '#a06a42', '#7a4d2c', '#4e301c'];
const SKIN_SHADE = ['#dcc4ad', '#d6b497', '#c59f78', '#b8865c', '#9a6d40', '#82522e', '#5c381f', '#33200f'];
const HAIR = ['#1b1512', '#3b2416', '#6b4423', '#8a6a3e', '#c9a24a', '#a0431c', '#7a3a1e', '#8f8c86'];
const EYES = ['#4a2e1a', '#4f7ea8', '#5c7a4a', '#7a6a2e', '#2a2018'];
const BACK: Record<Spec['dress'], string> = { lay_m: '#6f7f8a', lay_f: '#8a6f7f', seminarian: '#5f6f5a', priest: '#4a3a2e', monsignor: '#5a3a5a', bishop: '#6b2a5a' };

function hairColor(spec: PortraitSpec, age: number): string {
  if (age >= 74) return '#e8e4dc';
  if (age >= 58) return '#a8a49c';
  if (age >= 48) return spec.hairColor <= 1 ? '#3a3632' : HAIR[spec.hairColor]!;
  return HAIR[spec.hairColor]!;
}

/** The colors a scene figure borrows from a face. */
export function lookFor(p: Spec): { skin: string; hair: string } {
  return { skin: SKIN[p.spec.skin]!, hair: hairColor(p.spec, p.age) };
}

/** Head radii by face shape: oval, round, long, square, heart, wide. */
function headShape(face: number): { rx: number; ry: number; jaw: number } {
  switch (face) {
    case 1: return { rx: 24, ry: 26, jaw: 1 };
    case 2: return { rx: 20, ry: 30, jaw: 0.9 };
    case 3: return { rx: 23, ry: 28, jaw: 1.15 };
    case 4: return { rx: 23, ry: 28, jaw: 0.7 };
    case 5: return { rx: 25, ry: 27, jaw: 1.2 };
    default: return { rx: 22, ry: 28, jaw: 1 };
  }
}

/** A face, drawn from its spec. Size is the rendered square in pixels. */
export default function Portrait({ portrait, size = 56, title }: { portrait: Spec; size?: number; title?: string }) {
  const { spec, dress, age, female } = portrait;
  const skin = SKIN[spec.skin]!;
  const shade = SKIN_SHADE[spec.skin]!;
  const hair = hairColor(spec, age);
  const { rx, ry, jaw } = headShape(spec.face);
  const old = age >= 60;
  const lines = age >= 45;
  const cy = 48;
  // The head: an ellipse whose lower half is widened or narrowed by the jaw.
  const head = `M${50 - rx} ${cy} A${rx} ${ry} 0 0 1 ${50 + rx} ${cy} Q${50 + rx * jaw} ${cy + ry * 0.9} 50 ${cy + ry} Q${50 - rx * jaw} ${cy + ry * 0.9} ${50 - rx} ${cy} Z`;
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} className="shrink-0" aria-label={title} role="img">
      {title && <title>{title}</title>}
      <defs>
        <clipPath id="pt-clip"><rect width="100" height="110" rx="6" /></clipPath>
        <linearGradient id="pt-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d47a" />
          <stop offset="1" stopColor="#8a6a1e" />
        </linearGradient>
        <radialGradient id="pt-light" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <g clipPath="url(#pt-clip)">
        <rect width="100" height="110" fill={BACK[dress]} />
        <rect width="100" height="110" fill="url(#pt-light)" />
        <Dress dress={dress} female={female} />
        <rect x="42" y="66" width="16" height="16" fill={shade} />
        <HairBack spec={spec} female={female} hair={hair} rx={rx} ry={ry} />
        <path d={head} fill={skin} />
        <path d={head} fill="#000" opacity="0.06" transform="translate(3 2)" />
        <ellipse cx={50 - rx} cy="50" rx="3.2" ry="4.5" fill={skin} />
        <ellipse cx={50 + rx} cy="50" rx="3.2" ry="4.5" fill={skin} />
        {/* eyes */}
        <ellipse cx="41" cy="46" rx="3.2" ry="2" fill="#fff" />
        <ellipse cx="59" cy="46" rx="3.2" ry="2" fill="#fff" />
        <circle cx="41.4" cy="46.2" r="1.5" fill={EYES[spec.eyes]} />
        <circle cx="59.4" cy="46.2" r="1.5" fill={EYES[spec.eyes]} />
        <circle cx="41.4" cy="46.2" r="0.7" fill="#111" />
        <circle cx="59.4" cy="46.2" r="0.7" fill="#111" />
        <Brows spec={spec} color={old ? '#8a8a84' : hair} />
        <Nose nose={spec.nose} shade={shade} />
        <Mouth mouth={spec.mouth} />
        {lines && (
          <g stroke={shade} strokeWidth="0.8" fill="none" opacity="0.7">
            <path d="M36 58 q2 4 5 6" />
            <path d="M64 58 q-2 4 -5 6" />
            {old && <path d="M40 34 h20 M38 37 h24" opacity="0.5" />}
          </g>
        )}
        <Mark mark={spec.mark} shade={shade} />
        {!female && <Facial facial={spec.facial} hair={hair} rx={rx} ry={ry} jaw={jaw} />}
        <Hair spec={spec} female={female} hair={hair} rx={rx} ry={ry} age={age} />
        <Glasses glasses={spec.glasses} />
        {dress === 'bishop' && <path d={`M${50 - rx * 0.7} ${cy - ry + 6} q${rx * 0.7} -9 ${rx * 1.4} 0 q-${rx * 0.7} 3 -${rx * 1.4} 0 Z`} fill="#7a2a7a" />}
      </g>
    </svg>
  );
}

function Brows({ spec, color }: { spec: PortraitSpec; color: string }) {
  const d = (x: number) => (spec.brows === 1 ? `M${x} 41 q5 -3 10 0` : spec.brows === 2 ? `M${x - 0.5} 41.5 h11` : `M${x} 41 h10`);
  const w = spec.brows === 2 ? 2.2 : spec.brows === 3 ? 0.8 : 1.3;
  return (
    <g stroke={color} strokeWidth={w} fill="none" strokeLinecap="round">
      <path d={d(36)} />
      <path d={d(54)} />
    </g>
  );
}

function Nose({ nose, shade }: { nose: number; shade: string }) {
  const d = nose === 1 ? 'M50 44 q-3.5 11 -1.5 13.5 h3.5' : nose === 2 ? 'M50 46 q-5 8 -2.5 11 h5 q2.5 -3 -2.5 -11' : 'M50 46 q-3 9 -1 11 h3';
  return <path d={d} stroke={shade} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
}

function Mouth({ mouth }: { mouth: number }) {
  const d = mouth === 1 ? 'M44 64 q6 4 12 0' : mouth === 2 ? 'M44.5 64 h11' : mouth === 3 ? 'M44 65 q6 -3 12 0' : 'M45 64 q5 1.5 10 0';
  return <path d={d} stroke="#7a3a34" strokeWidth="1.3" fill="none" strokeLinecap="round" />;
}

function Mark({ mark, shade }: { mark: number; shade: string }) {
  if (mark === 1) return <circle cx="60" cy="58" r="0.9" fill={shade} />;
  if (mark === 2) return <g fill={shade} opacity="0.6">{[[38, 52], [42, 55], [46, 53], [54, 53], [58, 55], [62, 52], [50, 57]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.6" />)}</g>;
  if (mark === 3) return <path d="M33 40 l3 8" stroke={shade} strokeWidth="1" strokeLinecap="round" />;
  return null;
}

function Glasses({ glasses }: { glasses: number }) {
  if (glasses === 0) return null;
  const stroke = glasses === 4 ? '#1c1917' : '#2b2116';
  const w = glasses === 4 ? 2.2 : glasses === 3 ? 0.6 : 1.2;
  return (
    <g stroke={stroke} strokeWidth={w} fill="none" opacity={glasses === 3 ? 0.7 : 1}>
      {glasses === 1 || glasses === 3 ? (
        <g>
          <circle cx="41" cy="46.5" r="6" />
          <circle cx="59" cy="46.5" r="6" />
        </g>
      ) : (
        <g>
          <rect x="34.5" y="41.5" width="12.5" height="9" rx="1.5" />
          <rect x="53" y="41.5" width="12.5" height="9" rx="1.5" />
        </g>
      )}
      <path d="M47 46.5 h6" />
      <path d="M34.5 45 h-6 M65.5 45 h6" />
    </g>
  );
}

function Facial({ facial, hair, rx, ry, jaw }: { facial: number; hair: string; rx: number; ry: number; jaw: number }) {
  const bottom = 48 + ry;
  const w = rx * jaw;
  switch (facial) {
    case 1:
      return <path d="M43 60 q7 -3 14 0 q-7 2.5 -14 0 Z" fill={hair} />;
    case 2: // full beard
      return <path d={`M${50 - rx + 2} 50 q1 ${ry * 0.8} ${rx - 2} ${ry * 0.9 + 2} q${rx - 2} -2 ${rx - 2} -${ry * 0.9 + 2} q-4 6 -${rx - 2} 5 q-${rx - 6} 1 -${rx - 2} -5 Z M43 60 q7 -3 14 0 q-7 2.5 -14 0 Z`} fill={hair} opacity="0.95" />;
    case 3: // stubble
      return <path d={`M${50 - w + 2} 54 q2 ${ry * 0.6} ${w - 2} ${ry * 0.6 + 4} q${w - 2} -4 ${w - 2} -${ry * 0.6 + 4} q-4 6 -${w - 2} 6 q-${w - 6} 0 -${w - 2} -6 Z`} fill={hair} opacity="0.3" />;
    case 4: // goatee
      return <path d={`M44 61 q6 -2 12 0 v${bottom - 63} q-6 3 -12 0 Z`} fill={hair} opacity="0.95" />;
    case 5: // short beard
      return <path d={`M${50 - w + 1} 54 q1 ${ry * 0.7} ${w - 1} ${ry * 0.7 + 3} q${w - 1} -3 ${w - 1} -${ry * 0.7 + 3} q-4 5 -${w - 1} 5 q-${w - 5} 0 -${w - 1} -5 Z`} fill={hair} opacity="0.85" />;
    default:
      return null;
  }
}

/** Hair drawn behind the head: long styles, ponytails, braids. */
function HairBack({ spec, female, hair, rx, ry }: { spec: PortraitSpec; female: boolean; hair: string; rx: number; ry: number }) {
  if (female) {
    if ([1, 4, 10, 11].includes(spec.hairStyle)) return <ellipse cx="50" cy="60" rx={rx + 8} ry={ry + 14} fill={hair} />;
    if (spec.hairStyle === 3) return <ellipse cx="50" cy="52" rx={rx + 10} ry={ry + 9} fill={hair} />;
    if (spec.hairStyle === 7) return <path d={`M${50 + rx - 4} 30 q14 20 6 50 q-6 -20 -10 -40 Z`} fill={hair} />;
    if (spec.hairStyle === 8) return <g fill={hair}><path d={`M${50 - rx + 2} 40 q-6 24 -2 44 q4 -20 4 -44 Z`} /><path d={`M${50 + rx - 2} 40 q6 24 2 44 q-4 -20 -4 -44 Z`} /><ellipse cx="50" cy="50" rx={rx + 5} ry={ry + 6} /></g>;
    return null;
  }
  if (spec.hairStyle === 11) return <ellipse cx="50" cy="56" rx={rx + 6} ry={ry + 10} fill={hair} />;
  if (spec.hairStyle === 10) return <ellipse cx="50" cy="46" rx={rx + 6} ry={ry + 6} fill={hair} />;
  return null;
}

/** A cap of hair over the top of the head, parameterised by how it sits. */
function cap(rx: number, ry: number, opts: { lift?: number; side?: number; fringe?: number; part?: number; low?: number }): string {
  const lift = opts.lift ?? 4;
  const side = opts.side ?? 1;
  const fringe = opts.fringe ?? 6;
  const low = opts.low ?? 44;
  const top = 48 - ry - lift;
  const l = 50 - rx - side;
  if (opts.part !== undefined) {
    const px = 50 + opts.part;
    return `M${l} ${low} q0 -${ry + lift} ${rx + side} -${ry + lift + 2} q${rx + side} 2 ${rx + side} ${ry + lift + 2} q-3 -5 -6 -${fringe} L${px + 2} ${top + fringe + 2} L${px} ${top + fringe} q-${px - l - 6} 2 -${px - l - 6} ${fringe - 1} q-3 2 -6 ${8 - fringe} Z`;
  }
  return `M${l} ${low} q0 -${ry + lift} ${rx + side} -${ry + lift + 2} q${rx + side} 2 ${rx + side} ${ry + lift + 2} q-3 -${fringe} -6 -${fringe + 2} q-${rx * 0.4} 2 -${rx + side - 6} 2 q-${rx * 0.4} 0 -${rx + side - 6} -2 q-3 2 -6 ${fringe + 2} Z`;
}

function Hair({ spec, female, hair, rx, ry, age }: { spec: PortraitSpec; female: boolean; hair: string; rx: number; ry: number; age: number }) {
  const top = 48 - ry;
  if (female) {
    switch (spec.hairStyle) {
      case 0: return <path d={cap(rx, ry, { lift: 6, side: 3, fringe: 9, low: 56 })} fill={hair} />;
      case 1: case 4: return <path d={cap(rx, ry, { lift: 8, side: 2, fringe: 10, low: 60 })} fill={hair} />;
      case 2: case 6: return <g><path d={cap(rx, ry, { lift: 4, side: 1, fringe: 5, low: 44 })} fill={hair} /><circle cx="50" cy={top - 4} r="7" fill={hair} /></g>;
      case 3: return <path d={cap(rx, ry, { lift: 8, side: 4, fringe: 8, low: 52 })} fill={hair} />;
      case 5: return <path d={cap(rx, ry, { lift: 3, side: 1, fringe: 5, low: 46 })} fill={hair} />;
      case 7: return <path d={cap(rx, ry, { lift: 3, side: 1, fringe: 5, low: 44 })} fill={hair} />;
      case 8: return <path d={cap(rx, ry, { lift: 3, side: 2, fringe: 5, low: 44, part: 0 })} fill={hair} />;
      case 9: return <path d={cap(rx, ry, { lift: 3, side: 0, fringe: 7, low: 42, part: -6 })} fill={hair} />;
      case 10: return <path d={`${cap(rx, ry, { lift: 6, side: 2, fringe: 4, low: 58 })} M${50 - rx + 4} ${top + 2} h${rx * 2 - 8} v10 h-${rx * 2 - 8} Z`} fill={hair} />;
      default: return <path d={cap(rx, ry, { lift: 9, side: 5, fringe: 8, low: 56 })} fill={hair} />;
    }
  }
  const bald = spec.hairStyle === 5 || (spec.hairStyle === 6 && age >= 62);
  switch (bald ? 5 : spec.hairStyle) {
    case 5:
      return (
        <g fill={hair}>
          <path d={`M${50 - rx - 2.5} 40 q-1.5 12 2 20 q3 3 6 1 q-3 -6 -3 -14 q0 -5 1 -8 Z`} />
          <path d={`M${50 + rx + 2.5} 40 q1.5 12 -2 20 q-3 3 -6 1 q3 -6 3 -14 q0 -5 -1 -8 Z`} />
        </g>
      );
    case 6: // receding
      return <path d={`M${50 - rx - 1} 42 q2 -${ry} ${rx + 1} -${ry + 2} q${rx - 1} 2 ${rx + 1} ${ry + 2} q-2 -6 -5 -8 q-6 6 -${rx - 5} 0 q-${rx - 9} 6 -${rx - 5} 0 q-3 2 -5 8 Z`} fill={hair} />;
    case 1: return <path d={cap(rx, ry, { lift: 4, side: 1, fringe: 6, low: 42, part: -5 })} fill={hair} />;
    case 2: return <path d={cap(rx, ry, { lift: 2, side: 0, fringe: 5, low: 44 })} fill={hair} />;
    case 3: return <path d={cap(rx, ry, { lift: 8, side: 3, fringe: 7, low: 46 })} fill={hair} />;
    case 4: return <path d={cap(rx, ry, { lift: 7, side: 2, fringe: 8, low: 46 })} fill={hair} />;
    case 7: return <path d={cap(rx, ry, { lift: 7, side: 0, fringe: 2, low: 44 })} fill={hair} />;
    case 8: return <path d={cap(rx, ry, { lift: 4, side: 1, fringe: 11, low: 44, part: 6 })} fill={hair} />;
    case 9: return <path d={cap(rx, ry, { lift: 1, side: -0.5, fringe: 4, low: 44 })} fill={hair} opacity="0.6" />;
    case 10: return <path d={cap(rx, ry, { lift: 6, side: 4, fringe: 5, low: 44 })} fill={hair} />;
    case 11: return <path d={cap(rx, ry, { lift: 5, side: 3, fringe: 9, low: 54 })} fill={hair} />;
    default: return <path d={cap(rx, ry, { lift: 4, side: 1, fringe: 6, low: 44 })} fill={hair} />;
  }
}

function Dress({ dress, female }: { dress: Spec['dress']; female: boolean }) {
  const shoulders = 'M14 110 q2 -26 22 -30 h28 q20 4 22 30 Z';
  switch (dress) {
    case 'priest':
    case 'monsignor':
      return (
        <g>
          <path d={shoulders} fill="#1c1917" />
          {dress === 'monsignor' && <path d="M35 110 q-2 -22 15 -28 q17 6 15 28 Z" fill="#1c1917" stroke="#7a2a7a" strokeWidth="1.5" />}
          <path d="M36 80 q14 6 28 0 v3 q-14 6 -28 0 Z" fill="#1c1917" />
          <rect x="45.5" y="80" width="9" height="5" fill="#fff" />
        </g>
      );
    case 'bishop':
      return (
        <g>
          <path d={shoulders} fill="#1c1917" />
          <path d="M35 110 q-2 -22 15 -28 q17 6 15 28 Z" fill="#1c1917" stroke="#7a2a7a" strokeWidth="1.5" />
          <rect x="45.5" y="80" width="9" height="5" fill="#fff" />
          <rect x="48.8" y="92" width="2.4" height="12" fill="url(#pt-brass)" />
          <rect x="45" y="95.5" width="10" height="2.4" fill="url(#pt-brass)" />
          <path d="M50 86 q-6 6 0 8 q6 -2 0 -8" stroke="#c9a24a" strokeWidth="0.8" fill="none" />
        </g>
      );
    case 'seminarian':
      return (
        <g>
          <path d={shoulders} fill="#2f3a4a" />
          <path d="M42 80 l8 8 l8 -8 v4 l-8 8 l-8 -8 Z" fill="#e9e2cc" />
        </g>
      );
    case 'lay_f':
      return (
        <g>
          <path d={shoulders} fill={female ? '#6b4a6b' : '#3a4a6b'} />
          <path d="M42 80 q8 8 16 0 v6 q-8 6 -16 0 Z" fill="#f3d9c4" opacity="0.5" />
        </g>
      );
    default:
      return (
        <g>
          <path d={shoulders} fill="#3a4a6b" />
          <path d="M42 80 l8 8 l8 -8 v3 l-8 8 l-8 -8 Z" fill="#e9e2cc" />
          <rect x="48.5" y="84" width="3" height="16" fill="#7a1f1f" />
        </g>
      );
  }
}
