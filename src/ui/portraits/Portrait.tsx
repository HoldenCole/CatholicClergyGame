import type { Portrait as Spec, PortraitSpec } from './spec';

const SKIN = ['#f7e4d2', '#f1d4ba', '#e4bf9a', '#d3a276', '#ba8b5b', '#a06b43', '#7b4e2d', '#4f311d'];
const SKIN_SHADE = ['#e0c3ab', '#d9b493', '#c79d76', '#b5835a', '#9c6c40', '#82522f', '#5e3a20', '#35211066'];
const SKIN_DEEP = ['#c9a48a', '#c19b78', '#ad8460', '#9d6d46', '#835932', '#6b4224', '#4a2d18', '#26160b'];
const HAIR = ['#1c1613', '#3a2416', '#6b4423', '#8f6d3f', '#d0aa4f', '#a4451c', '#7c3b1f', '#8f8c86'];
const HAIR_LIGHT = ['#3a322d', '#5c3d2a', '#8d6238', '#b08a55', '#e9c878', '#c96a3a', '#a25a36', '#b6b3ac'];
const EYES = ['#5a3a20', '#4f7ea8', '#5c7a4a', '#7a6a2e', '#2a2018'];
const BACK: Record<Spec['dress'], string> = { lay_m: '#6f7f8a', lay_f: '#8a6f7f', seminarian: '#5f6f5a', priest: '#4a3a2e', monsignor: '#5a3a5a', bishop: '#6b2a5a' };

function hairColor(spec: PortraitSpec, age: number): string {
  if (age >= 74) return '#e8e4dc';
  if (age >= 58) return '#a8a49c';
  if (age >= 48) return spec.hairColor <= 1 ? '#3a3632' : HAIR[spec.hairColor]!;
  return HAIR[spec.hairColor]!;
}
function hairLight(spec: PortraitSpec, age: number): string {
  if (age >= 74) return '#f7f4ee';
  if (age >= 58) return '#c8c4bc';
  return HAIR_LIGHT[spec.hairColor]!;
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

let uid = 0;

/** A face, drawn from its spec. Size is the rendered square in pixels. */
export default function Portrait({ portrait, size = 56, title }: { portrait: Spec; size?: number; title?: string }) {
  const { spec, dress, age, female } = portrait;
  const skin = SKIN[spec.skin]!;
  const shade = SKIN_SHADE[spec.skin]!;
  const deep = SKIN_DEEP[spec.skin]!;
  const hair = hairColor(spec, age);
  const light = hairLight(spec, age);
  const { rx, ry, jaw } = headShape(spec.face);
  const old = age >= 60;
  const lines = age >= 45;
  const cy = 48;
  const id = `pt${(uid = (uid + 1) % 100000)}`;
  // The head: an ellipse whose lower half is widened or narrowed by the jaw.
  const head = `M${50 - rx} ${cy} A${rx} ${ry} 0 0 1 ${50 + rx} ${cy} Q${50 + rx * jaw} ${cy + ry * 0.9} 50 ${cy + ry} Q${50 - rx * jaw} ${cy + ry * 0.9} ${50 - rx} ${cy} Z`;
  const eyeY = 46.5;
  const lidColor = deep;
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} className="shrink-0" aria-label={title} role="img">
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`${id}c`}><rect width="100" height="110" rx="6" /></clipPath>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d47a" />
          <stop offset="1" stopColor="#8a6a1e" />
        </linearGradient>
        <radialGradient id={`${id}l`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        <radialGradient id={`${id}s`} cx="0.42" cy="0.36" r="0.72">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="100" height="110" fill={BACK[dress]} />
        <rect width="100" height="110" fill={`url(#${id}l)`} />
        <Dress dress={dress} female={female} brass={`url(#${id}b)`} />
        {/* neck */}
        <path d="M41 66 h18 v14 q-9 5 -18 0 Z" fill={shade} />
        <path d="M41 66 h18 v4 q-9 6 -18 0 Z" fill={deep} opacity="0.45" />
        <HairBack spec={spec} female={female} hair={hair} rx={rx} ry={ry} />
        {/* ears */}
        <ellipse cx={50 - rx} cy="50" rx="3.4" ry="4.8" fill={skin} />
        <ellipse cx={50 + rx} cy="50" rx="3.4" ry="4.8" fill={skin} />
        <path d={`M${50 - rx - 1.2} 48 q1.6 -1 2.2 1.2 q0 2.4 -1.6 3`} fill="none" stroke={shade} strokeWidth="0.8" />
        <path d={`M${50 + rx + 1.2} 48 q-1.6 -1 -2.2 1.2 q0 2.4 1.6 3`} fill="none" stroke={shade} strokeWidth="0.8" />
        {/* head */}
        <path d={head} fill={skin} />
        <path d={head} fill={`url(#${id}s)`} />
        {/* cheek and temple shading */}
        <ellipse cx={50 - rx * 0.62} cy="55" rx="5" ry="3.2" fill={shade} opacity="0.28" />
        <ellipse cx={50 + rx * 0.62} cy="55" rx="5" ry="3.2" fill={shade} opacity="0.28" />
        <path d={`M${50 - rx * 0.55} ${cy + ry * 0.55} Q50 ${cy + ry * 0.98} ${50 + rx * 0.55} ${cy + ry * 0.55}`} fill="none" stroke={deep} strokeWidth="1.2" opacity="0.18" />
        {/* eyes: socket, white, iris, pupil, lid, lashes */}
        {[41, 59].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={eyeY + 0.6} rx="5" ry="3.2" fill={shade} opacity="0.22" />
            <path d={`M${x - 3.6} ${eyeY} Q${x} ${eyeY - 3} ${x + 3.6} ${eyeY} Q${x} ${eyeY + 2.6} ${x - 3.6} ${eyeY} Z`} fill="#fbf7f0" />
            <circle cx={x + 0.3} cy={eyeY} r="1.85" fill={EYES[spec.eyes]} />
            <circle cx={x + 0.3} cy={eyeY} r="1.85" fill="none" stroke="#1c1410" strokeWidth="0.35" opacity="0.7" />
            <circle cx={x + 0.3} cy={eyeY} r="0.85" fill="#120c08" />
            <circle cx={x + 1} cy={eyeY - 0.7} r="0.45" fill="#fff" opacity="0.9" />
            <path d={`M${x - 3.8} ${eyeY} Q${x} ${eyeY - 3.3} ${x + 3.8} ${eyeY}`} fill="none" stroke={lidColor} strokeWidth="0.9" strokeLinecap="round" />
            <path d={`M${x - 3.2} ${eyeY + 1.8} Q${x} ${eyeY + 3} ${x + 3.2} ${eyeY + 1.8}`} fill="none" stroke={lidColor} strokeWidth="0.45" opacity="0.6" />
            {female && <path d={`M${x + 3.4} ${eyeY - 0.6} l1.4 -1 M${x + 2.4} ${eyeY - 1.6} l0.9 -1.2`} stroke="#1c1410" strokeWidth="0.6" strokeLinecap="round" />}
          </g>
        ))}
        <Brows spec={spec} color={old ? '#8a8a84' : hair} female={female} />
        <Nose nose={spec.nose} shade={shade} deep={deep} />
        <Mouth mouth={spec.mouth} female={female} deep={deep} />
        {lines && (
          <g stroke={deep} strokeWidth="0.8" fill="none" opacity="0.55" strokeLinecap="round">
            <path d="M36.5 57 q1.5 4.5 4.5 7" />
            <path d="M63.5 57 q-1.5 4.5 -4.5 7" />
            <path d="M34 47 q1 3 1.5 6 M66 47 q-1 3 -1.5 6" opacity="0.6" />
            {old && <path d="M40 33 q10 -1.5 20 0 M38 36.5 q12 -1.5 24 0 M43 30 q7 -1 14 0" opacity="0.5" />}
          </g>
        )}
        <Mark mark={spec.mark} shade={shade} />
        {!female && <Facial facial={spec.facial} hair={hair} light={light} rx={rx} ry={ry} jaw={jaw} />}
        <Hair spec={spec} female={female} hair={hair} light={light} rx={rx} ry={ry} age={age} shine={`url(#${id}h)`} />
        <Glasses glasses={spec.glasses} />
        {dress === 'bishop' && (
          <g>
            <path d={`M${50 - rx * 0.62} ${cy - ry + 7} q${rx * 0.62} -9 ${rx * 1.24} 0 q-${rx * 0.62} 3.2 -${rx * 1.24} 0 Z`} fill="#7a2a7a" />
            <path d={`M${50 - rx * 0.62} ${cy - ry + 7} q${rx * 0.62} -9 ${rx * 1.24} 0`} fill="none" stroke="#a04aa0" strokeWidth="0.8" />
          </g>
        )}
      </g>
    </svg>
  );
}

function Brows({ spec, color, female }: { spec: PortraitSpec; color: string; female: boolean }) {
  const brow = (x: number, flip: number) => {
    const w = (spec.brows === 2 ? 2.6 : spec.brows === 3 ? 1 : 1.7) * (female ? 0.65 : 1);
    const arch = spec.brows === 1 ? 3.2 : spec.brows === 2 ? 1.2 : 0.9;
    const inner = x + flip * 5;
    const outer = x - flip * 5;
    return <path d={`M${inner} 41.8 Q${x} ${41.8 - arch} ${outer} 41 L${outer} ${41 + w * 0.5} Q${x} ${42.2 - arch + w * 0.5} ${inner} ${41.8 + w}`} fill={color} />;
  };
  return (
    <g>
      {brow(41, 1)}
      {brow(59, -1)}
    </g>
  );
}

function Nose({ nose, shade, deep }: { nose: number; shade: string; deep: string }) {
  const long = nose === 1;
  const broad = nose === 2;
  const tip = long ? 58 : 56.5;
  const w = broad ? 5.2 : 3.8;
  return (
    <g>
      <path d={`M48.6 44 q-1.2 6 -2 ${tip - 45}`} stroke={shade} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d={`M${50 - w} ${tip} q${w * 0.5} -1.6 ${w} -0.6 q${w * 0.5} -1 ${w} 0.6`} fill="none" stroke={deep} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      <ellipse cx={50 - w * 0.62} cy={tip} rx="1.1" ry="0.7" fill={deep} opacity="0.55" />
      <ellipse cx={50 + w * 0.62} cy={tip} rx="1.1" ry="0.7" fill={deep} opacity="0.55" />
      <path d={`M49 ${tip - 4} q1.6 1 2.4 3`} stroke="#fff" strokeWidth="0.7" fill="none" opacity="0.18" strokeLinecap="round" />
    </g>
  );
}

function Mouth({ mouth, female, deep }: { mouth: number; female: boolean; deep: string }) {
  const y = 64;
  const line = mouth === 1 ? `M43.5 ${y} q6.5 4.6 13 0` : mouth === 2 ? `M44 ${y + 0.3} h12` : mouth === 3 ? `M44 ${y + 1} q6 -3.4 12 0` : `M44.5 ${y} q5.5 1.8 11 0`;
  const lip = female ? '#9a4a4e' : '#8a4a44';
  return (
    <g>
      <path d={`M44.5 ${y - 0.6} q2.5 -1.6 5 -0.4 q0.5 -0.4 1 0 q2.5 -1.2 5 0.4 q-5.5 1.4 -11 0 Z`} fill={lip} opacity={female ? 0.8 : 0.45} />
      <path d={mouth === 1 ? `M44 ${y} q6 5.6 12 0 q-6 3 -12 0 Z` : mouth === 3 ? `M44.5 ${y + 0.6} q5.5 -2.2 11 0 q-5.5 3.4 -11 0 Z` : `M44.5 ${y + 0.2} q5.5 2.6 11 0 q-5.5 3 -11 0 Z`} fill={lip} opacity={female ? 0.9 : 0.55} />
      <path d={line} stroke={deep} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d={`M45.5 ${y + 3.6} q4.5 1.5 9 0`} stroke={deep} strokeWidth="0.6" fill="none" opacity="0.3" strokeLinecap="round" />
    </g>
  );
}

function Mark({ mark, shade }: { mark: number; shade: string }) {
  if (mark === 1) return <circle cx="60" cy="58" r="0.9" fill={shade} />;
  if (mark === 2) return <g fill={shade} opacity="0.55">{[[38, 52], [42, 55], [46, 53], [54, 53], [58, 55], [62, 52], [50, 57], [40, 58], [60, 59]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.55" />)}</g>;
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
          <circle cx="41" cy="46.5" r="6.2" fill="#fff" fillOpacity="0.08" />
          <circle cx="59" cy="46.5" r="6.2" fill="#fff" fillOpacity="0.08" />
        </g>
      ) : (
        <g>
          <rect x="34.5" y="41.5" width="12.5" height="9.4" rx="1.8" fill="#fff" fillOpacity="0.08" />
          <rect x="53" y="41.5" width="12.5" height="9.4" rx="1.8" fill="#fff" fillOpacity="0.08" />
        </g>
      )}
      <path d="M47 46.5 h6" />
      <path d="M34.5 45 h-6 M65.5 45 h6" />
    </g>
  );
}

function Facial({ facial, hair, light, rx, ry, jaw }: { facial: number; hair: string; light: string; rx: number; ry: number; jaw: number }) {
  const bottom = 48 + ry;
  const w = rx * jaw;
  const beard = (inset: number, drop: number) =>
    `M${50 - w + inset} 52 Q${50 - w + inset + 1} ${bottom - 2} 50 ${bottom + drop} Q${50 + w - inset - 1} ${bottom - 2} ${50 + w - inset} 52 Q${50 + w * 0.5} 58 50 58.5 Q${50 - w * 0.5} 58 ${50 - w + inset} 52 Z`;
  switch (facial) {
    case 1:
      return <path d="M43 60.2 q7 -3.4 14 0 q-7 2.8 -14 0 Z" fill={hair} />;
    case 2: // full beard
      return (
        <g>
          <path d={beard(1, 5)} fill={hair} />
          <path d={`M${50 - w * 0.6} 56 Q50 ${bottom} ${50 + w * 0.6} 56`} fill="none" stroke={light} strokeWidth="0.8" opacity="0.35" />
          <path d="M43 60.2 q7 -3.4 14 0 q-7 2.8 -14 0 Z" fill={hair} />
          <path d="M45 65.5 q5 2.5 10 0" fill="none" stroke={light} strokeWidth="0.6" opacity="0.35" />
        </g>
      );
    case 3: // stubble
      return <path d={beard(2, 1)} fill={hair} opacity="0.28" />;
    case 4: // goatee
      return <path d={`M44 61 q6 -2 12 0 L${50 + 5} ${bottom - 1} q-5 3 -10 0 Z`} fill={hair} opacity="0.95" />;
    case 5: // short beard
      return (
        <g>
          <path d={beard(1.5, 2.5)} fill={hair} opacity="0.85" />
          <path d="M43 60.2 q7 -3.4 14 0 q-7 2.8 -14 0 Z" fill={hair} opacity="0.85" />
        </g>
      );
    default:
      return null;
  }
}

/** Hair drawn behind the head: long styles, ponytails, braids, the width of a natural. */
function HairBack({ spec, female, hair, rx, ry }: { spec: PortraitSpec; female: boolean; hair: string; rx: number; ry: number }) {
  const top = 48 - ry;
  if (female) {
    switch (spec.hairStyle) {
      case 0: return <path d={`M${50 - rx - 5} ${top + 12} Q${50 - rx - 6} 72 ${50 - rx + 2} 74 L${50 + rx - 2} 74 Q${50 + rx + 6} 72 ${50 + rx + 5} ${top + 12} Q50 ${top - 6} ${50 - rx - 5} ${top + 12} Z`} fill={hair} />; // bob
      case 1: case 4: return (
        <g fill={hair}>
          <path d={`M${50 - rx + 1} ${top + 12} Q${50 - rx - 6} 60 ${50 - rx - 9} 94 Q${50 - rx - 3} 97 ${50 - rx + 4} 94 Q${50 - rx + 6} 66 ${50 - rx + 4} 48 Z`} />
          <path d={`M${50 + rx - 1} ${top + 12} Q${50 + rx + 6} 60 ${50 + rx + 9} 94 Q${50 + rx + 3} 97 ${50 + rx - 4} 94 Q${50 + rx - 6} 66 ${50 + rx - 4} 48 Z`} />
          <path d={`M${50 - rx + 1} ${top + 12} Q50 ${top + 2} ${50 + rx - 1} ${top + 12} L${50 + rx - 4} 48 L${50 - rx + 4} 48 Z`} />
          {spec.hairStyle === 4 && <path d={`M${50 - rx - 4} 62 q3 6 -1 14 M${50 + rx + 4} 62 q-3 6 1 14`} fill="none" stroke={hair} strokeWidth="1.2" opacity="0.6" />}
        </g>
      ); // long, waves
      case 3: return <ellipse cx="50" cy="54" rx={rx + 11} ry={ry + 12} fill={hair} />; // curly
      case 7: return <g fill={hair}><path d={`M${50 + rx - 2} 36 q15 22 7 56 q-8 -22 -13 -46 Z`} /><ellipse cx="50" cy="46" rx={rx + 3} ry={ry + 4} /></g>; // ponytail
      case 8: return <g fill={hair}><path d={`M${50 - rx + 1} 44 q-7 26 -2 50 q5 -22 5 -50 Z`} /><path d={`M${50 + rx - 1} 44 q7 26 2 50 q-5 -22 -5 -50 Z`} /><ellipse cx="50" cy="48" rx={rx + 4} ry={ry + 6} /></g>; // braids
      case 6: return <g fill={hair}><ellipse cx="50" cy="46" rx={rx + 3} ry={ry + 4} /><circle cx="50" cy={top + ry * 1.9 + 2} r="7" /></g>; // bun at the nape
      case 11: return <ellipse cx="50" cy="50" rx={rx + 14} ry={ry + 14} fill={hair} />; // natural
      case 10: return <path d={`M${50 - rx - 5} ${top + 12} Q${50 - rx - 6} 72 ${50 - rx + 2} 74 L${50 + rx - 2} 74 Q${50 + rx + 6} 72 ${50 + rx + 5} ${top + 12} Q50 ${top - 6} ${50 - rx - 5} ${top + 12} Z`} fill={hair} />; // bangs over a bob
      default: return null;
    }
  }
  if (spec.hairStyle === 11) return (
    <g fill={hair}>
      <path d={`M${50 - rx + 1} ${top + 14} Q${50 - rx - 4} 62 ${50 - rx - 6} 82 Q${50 - rx - 2} 85 ${50 - rx + 3} 82 Q${50 - rx + 5} 66 ${50 - rx + 4} 48 Z`} />
      <path d={`M${50 + rx - 1} ${top + 14} Q${50 + rx + 4} 62 ${50 + rx + 6} 82 Q${50 + rx + 2} 85 ${50 + rx - 3} 82 Q${50 + rx - 5} 66 ${50 + rx - 4} 48 Z`} />
      <path d={`M${50 - rx + 1} ${top + 14} Q50 ${top + 4} ${50 + rx - 1} ${top + 14} L${50 + rx - 4} 48 L${50 - rx + 4} 48 Z`} />
    </g>
  );
  if (spec.hairStyle === 10) return <ellipse cx="50" cy="45" rx={rx + 5} ry={ry + 5} fill={hair} />;
  if (spec.hairStyle === 3) return <ellipse cx="50" cy="45" rx={rx + 4} ry={ry + 5} fill={hair} />;
  return null;
}

/**
 * A cap of hair over the top of the head. `lift` is how high it rises above
 * the skull, `side` how far past the temples, `line` the hairline's shape,
 * `low` how far down the sides it reaches.
 */
function cap(rx: number, ry: number, o: { lift?: number; side?: number; low?: number; line?: 'straight' | 'fringe' | 'peak' | 'part_l' | 'part_r' | 'm' | 'back' | 'bumpy' }): string {
  const lift = o.lift ?? 4;
  const side = o.side ?? 1;
  const low = o.low ?? 44;
  const line = o.line ?? 'straight';
  const top = 48 - ry - lift;
  const l = 50 - rx - side;
  const r = 50 + rx + side;
  const hairline = 48 - ry + 11;
  let front: string;
  switch (line) {
    case 'fringe': front = `L${r - 3} ${hairline + 4} Q${50 + 6} ${hairline + 6} 50 ${hairline + 5.5} Q${50 - 6} ${hairline + 6} ${l + 3} ${hairline + 4}`; break;
    case 'peak': front = `L${r - 4} ${hairline} Q${50 + 4} ${hairline - 3} 50 ${hairline + 2} Q${50 - 4} ${hairline - 3} ${l + 4} ${hairline}`; break;
    case 'part_l': front = `L${r - 4} ${hairline + 2} Q${50 - 2} ${hairline - 1} ${50 - 7} ${hairline + 1} L${50 - 8} ${hairline - 1} Q${l + 8} ${hairline} ${l + 4} ${hairline + 1}`; break;
    case 'part_r': front = `L${r - 4} ${hairline + 1} Q${50 + 8} ${hairline} ${50 + 8} ${hairline - 1} L${50 + 7} ${hairline + 1} Q${50 + 2} ${hairline - 1} ${l + 4} ${hairline + 2}`; break;
    case 'm': front = `L${r - 3} ${hairline - 2} Q${50 + 8} ${hairline + 8} ${50 + 3} ${hairline + 1} Q50 ${hairline - 2} ${50 - 3} ${hairline + 1} Q${50 - 8} ${hairline + 8} ${l + 3} ${hairline - 2}`; break;
    case 'back': front = `L${r - 3} ${hairline - 1} Q50 ${hairline - 4} ${l + 3} ${hairline - 1}`; break;
    case 'bumpy': front = `L${r - 3} ${hairline + 1} q-3 -3 -6 0 q-3 -3 -6 0 q-3 -3 -6 0 q-3 -3 -6 0 q-3 -3 -6 0 L${l + 3} ${hairline + 1}`; break;
    default: front = `L${r - 3} ${hairline} Q50 ${hairline - 1.5} ${l + 3} ${hairline}`;
  }
  return `M${l} ${low} Q${l} ${top} 50 ${top} Q${r} ${top} ${r} ${low} L${r - 3} ${low} ${front} L${l + 3} ${low} Z`;
}

function Hair({ spec, female, hair, light, rx, ry, age, shine }: { spec: PortraitSpec; female: boolean; hair: string; light: string; rx: number; ry: number; age: number; shine: string }) {
  const top = 48 - ry;
  const glossy = (d: string, extra?: React.ReactNode) => (
    <g>
      <path d={d} fill={hair} />
      <path d={d} fill={shine} />
      <path d={`M${50 - rx * 0.5} ${top - 1} Q50 ${top - 4} ${50 + rx * 0.5} ${top - 1}`} fill="none" stroke={light} strokeWidth="1.4" opacity="0.35" strokeLinecap="round" />
      {extra}
    </g>
  );
  if (female) {
    switch (spec.hairStyle) {
      case 0: case 10: return glossy(cap(rx, ry, { lift: 7, side: 4, low: 60, line: spec.hairStyle === 10 ? 'fringe' : 'part_l' }));
      case 1: case 4: return glossy(cap(rx, ry, { lift: 7, side: 2, low: 60, line: 'part_l' }), spec.hairStyle === 4 ? <path d={`M${50 - rx - 4} 64 q3 5 0 10 M${50 + rx + 4} 64 q-3 5 0 10`} fill="none" stroke={light} strokeWidth="0.8" opacity="0.4" /> : undefined);
      case 2: return glossy(cap(rx, ry, { lift: 5, side: 1.5, low: 48, line: 'back' }), <g><circle cx="50" cy={top - 5} r="7.5" fill={hair} /><circle cx="50" cy={top - 5} r="7.5" fill={shine} /></g>);
      case 3: return glossy(cap(rx, ry, { lift: 9, side: 6, low: 54, line: 'bumpy' }));
      case 5: case 9: return glossy(cap(rx, ry, { lift: 5, side: 1.5, low: 49, line: spec.hairStyle === 9 ? 'part_r' : 'fringe' }));
      case 6: return glossy(cap(rx, ry, { lift: 4, side: 1.5, low: 48, line: 'back' }));
      case 7: return glossy(cap(rx, ry, { lift: 4, side: 1.5, low: 48, line: 'back' }));
      case 8: return glossy(cap(rx, ry, { lift: 4, side: 2, low: 48, line: 'part_l' }));
      case 11: return glossy(cap(rx, ry, { lift: 12, side: 9, low: 56, line: 'bumpy' }));
      default: return glossy(cap(rx, ry, { lift: 7, side: 4, low: 60, line: 'part_l' }));
    }
  }
  const bald = spec.hairStyle === 5 || (spec.hairStyle === 6 && age >= 62);
  switch (bald ? 5 : spec.hairStyle) {
    case 5:
      return (
        <g fill={hair}>
          <path d={`M${50 - rx - 2} 41 Q${50 - rx - 3} 52 ${50 - rx + 1} 58 Q${50 - rx + 5} 60 ${50 - rx + 6} 56 Q${50 - rx + 2} 52 ${50 - rx + 2} 44 Z`} />
          <path d={`M${50 + rx + 2} 41 Q${50 + rx + 3} 52 ${50 + rx - 1} 58 Q${50 + rx - 5} 60 ${50 + rx - 6} 56 Q${50 + rx - 2} 52 ${50 + rx - 2} 44 Z`} />
          <ellipse cx="46" cy={top + 6} rx="6" ry="2.6" fill="#fff" opacity="0.14" />
        </g>
      );
    case 6: return glossy(cap(rx, ry, { lift: 3, side: 1, low: 49, line: 'm' }));
    case 1: return glossy(cap(rx, ry, { lift: 6, side: 2, low: 49, line: 'part_l' }), <path d={`M${50 - 8} ${top + 5} Q${50 - 14} ${top + 6} ${50 - rx + 2} ${top + 12}`} fill="none" stroke={light} strokeWidth="0.7" opacity="0.4" />);
    case 2: return glossy(cap(rx, ry, { lift: 2.5, side: 0.8, low: 48, line: 'straight' }));
    case 3: return glossy(cap(rx, ry, { lift: 9, side: 5, low: 50, line: 'bumpy' }), <g fill="none" stroke={light} strokeWidth="0.7" opacity="0.35">{[-12, -4, 4, 12].map((dx) => <path key={dx} d={`M${50 + dx} ${top - 2} q2 -2 4 0`} />)}</g>);
    case 4: return glossy(cap(rx, ry, { lift: 8, side: 3, low: 49, line: 'straight' }), <g fill="none" stroke={light} strokeWidth="0.8" opacity="0.4"><path d={`M${50 - 14} ${top + 2} q6 -4 12 0 q6 -4 12 0`} /><path d={`M${50 - 12} ${top + 7} q6 -3 12 0`} /></g>);
    case 7: return glossy(cap(rx, ry, { lift: 9, side: 1, low: 48, line: 'back' }), <g fill="none" stroke={light} strokeWidth="0.8" opacity="0.4">{[-8, -2, 4, 10].map((dx) => <path key={dx} d={`M${50 + dx} ${top + 3} q-2 -5 2 -8`} />)}</g>);
    case 8: return glossy(cap(rx, ry, { lift: 6, side: 2, low: 49, line: 'fringe' }));
    case 9: return <path d={cap(rx, ry, { lift: 1.2, side: 0.3, low: 48, line: 'straight' })} fill={hair} opacity="0.6" />;
    case 10: return glossy(cap(rx, ry, { lift: 7, side: 5, low: 49, line: 'bumpy' }), <g fill={light} opacity="0.35">{[-14, -7, 0, 7, 14].map((dx) => <circle key={dx} cx={50 + dx} cy={top - 1 + Math.abs(dx) * 0.15} r="1.1" />)}</g>);
    case 11: return glossy(cap(rx, ry, { lift: 6, side: 1.5, low: 58, line: 'part_l' }), <g fill="none" stroke={light} strokeWidth="0.8" opacity="0.4"><path d={`M${50 - rx - 3} 56 q1 10 -1 20`} /><path d={`M${50 + rx + 3} 56 q-1 10 1 20`} /></g>);
    default: return glossy(cap(rx, ry, { lift: 5, side: 1.5, low: 48, line: 'straight' }));
  }
}

function Dress({ dress, female, brass }: { dress: Spec['dress']; female: boolean; brass: string }) {
  const shoulders = 'M12 110 q2 -26 24 -30 h28 q22 4 24 30 Z';
  const fold = 'M36 84 q14 5 28 0';
  switch (dress) {
    case 'priest':
    case 'monsignor':
      return (
        <g>
          <path d={shoulders} fill="#1c1917" />
          <path d={shoulders} fill="#fff" opacity="0.05" />
          {dress === 'monsignor' && <path d="M34 110 q-2 -22 16 -28 q18 6 16 28 Z" fill="#1c1917" stroke="#7a2a7a" strokeWidth="1.6" />}
          <path d="M36 80 q14 6 28 0 v3.5 q-14 6 -28 0 Z" fill="#1c1917" />
          <rect x="45.5" y="80.2" width="9" height="5" fill="#fff" />
          <path d={fold} fill="none" stroke="#000" strokeWidth="0.6" opacity="0.5" />
        </g>
      );
    case 'bishop':
      return (
        <g>
          <path d={shoulders} fill="#1c1917" />
          <path d="M34 110 q-2 -22 16 -28 q18 6 16 28 Z" fill="#1c1917" stroke="#7a2a7a" strokeWidth="1.6" />
          <rect x="45.5" y="80.2" width="9" height="5" fill="#fff" />
          <path d="M50 87 q-7 4 -7 10 M50 87 q7 4 7 10" stroke="#c9a24a" strokeWidth="0.8" fill="none" />
          <rect x="48.8" y="94" width="2.4" height="12" fill={brass} />
          <rect x="45" y="97.5" width="10" height="2.4" fill={brass} />
        </g>
      );
    case 'seminarian':
      return (
        <g>
          <path d={shoulders} fill="#2f3a4a" />
          <path d="M40 80 l10 9 l10 -9 v4 l-10 9 l-10 -9 Z" fill="#e9e2cc" />
          <path d="M42 80.5 l8 7 l8 -7" fill="none" stroke="#1c1917" strokeWidth="0.6" opacity="0.4" />
        </g>
      );
    case 'lay_f':
      return (
        <g>
          <path d={shoulders} fill={female ? '#6b4a6b' : '#3a4a6b'} />
          <path d="M40 80 q10 9 20 0 v7 q-10 7 -20 0 Z" fill="#f3d9c4" opacity="0.5" />
          <circle cx="50" cy="90" r="1.1" fill={brass} opacity="0.8" />
        </g>
      );
    default:
      return (
        <g>
          <path d={shoulders} fill="#3a4a6b" />
          <path d="M40 80 l10 9 l10 -9 v3 l-10 9 l-10 -9 Z" fill="#e9e2cc" />
          <rect x="48.5" y="84" width="3" height="17" fill="#7a1f1f" />
        </g>
      );
  }
}
