import type { Portrait as Spec, PortraitSpec } from './spec';

const SKIN = ['#f3d9c4', '#e8c39e', '#d1a074', '#b07a4c', '#8a5a34', '#5a3a22'];
const SKIN_SHADE = ['#dcbba3', '#d0a680', '#b8865c', '#94623a', '#6e4526', '#3e2716'];
const HAIR = ['#1b1512', '#3b2416', '#6b4423', '#c9a24a', '#a0431c', '#8f8c86'];
const EYES = ['#4a2e1a', '#4f7ea8', '#5c7a4a'];
const BACK: Record<Spec['dress'], string> = { lay_m: '#6f7f8a', lay_f: '#8a6f7f', seminarian: '#5f6f5a', priest: '#4a3a2e', monsignor: '#5a3a5a', bishop: '#6b2a5a' };

function hairColor(spec: PortraitSpec, age: number): string {
  if (age >= 74) return '#e8e4dc';
  if (age >= 58) return '#a8a49c';
  if (age >= 48) return spec.hairColor === 0 ? '#3a3632' : HAIR[spec.hairColor]! ;
  return HAIR[spec.hairColor]!;
}

/** The colors a scene figure borrows from a face. */
export function lookFor(p: Spec): { skin: string; hair: string } {
  return { skin: SKIN[p.spec.skin]!, hair: hairColor(p.spec, p.age) };
}

/** A face, drawn from its spec. Size is the rendered square in pixels. */
export default function Portrait({ portrait, size = 56, title }: { portrait: Spec; size?: number; title?: string }) {
  const { spec, dress, age, female } = portrait;
  const skin = SKIN[spec.skin]!;
  const shade = SKIN_SHADE[spec.skin]!;
  const hair = hairColor(spec, age);
  const rx = spec.face === 1 ? 24 : spec.face === 2 ? 20 : spec.face === 3 ? 23 : 22;
  const ry = spec.face === 2 ? 30 : spec.face === 1 ? 26 : 28;
  const old = age >= 60;
  const lines = age >= 45;
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
        {/* shoulders and dress */}
        <Dress dress={dress} female={female} />
        {/* neck */}
        <rect x="42" y="66" width="16" height="16" fill={shade} />
        {/* hair behind for longer styles */}
        {female && (spec.hairStyle === 1 || spec.hairStyle === 4) && <ellipse cx="50" cy="60" rx={rx + 8} ry={ry + 14} fill={hair} />}
        {female && spec.hairStyle === 3 && <ellipse cx="50" cy="52" rx={rx + 9} ry={ry + 8} fill={hair} />}
        {/* head */}
        <ellipse cx="50" cy="48" rx={rx} ry={ry} fill={skin} />
        <ellipse cx="50" cy="48" rx={rx} ry={ry} fill="#000" opacity="0.06" transform="translate(3 2)" />
        {/* ears */}
        <ellipse cx={50 - rx} cy="50" rx="3.2" ry="4.5" fill={skin} />
        <ellipse cx={50 + rx} cy="50" rx="3.2" ry="4.5" fill={skin} />
        {/* eyes */}
        <ellipse cx="41" cy="46" rx="3.2" ry="2" fill="#fff" />
        <ellipse cx="59" cy="46" rx="3.2" ry="2" fill="#fff" />
        <circle cx="41.4" cy="46.2" r="1.5" fill={EYES[spec.eyes]} />
        <circle cx="59.4" cy="46.2" r="1.5" fill={EYES[spec.eyes]} />
        <circle cx="41.4" cy="46.2" r="0.7" fill="#111" />
        <circle cx="59.4" cy="46.2" r="0.7" fill="#111" />
        {/* brows */}
        <path d={spec.brows === 1 ? 'M36 41 q5 -3 10 0' : spec.brows === 2 ? 'M35.5 41.5 h11' : 'M36 41 h10'} stroke={old ? '#8a8a84' : hair} strokeWidth={spec.brows === 2 ? 2 : 1.3} fill="none" strokeLinecap="round" />
        <path d={spec.brows === 1 ? 'M54 41 q5 -3 10 0' : spec.brows === 2 ? 'M53.5 41.5 h11' : 'M54 41 h10'} stroke={old ? '#8a8a84' : hair} strokeWidth={spec.brows === 2 ? 2 : 1.3} fill="none" strokeLinecap="round" />
        {/* nose */}
        <path d="M50 46 q-3 9 -1 11 h3" stroke={shade} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* mouth */}
        <path d={spec.mouth === 1 ? 'M44 64 q6 4 12 0' : spec.mouth === 2 ? 'M44.5 64 h11' : 'M45 64 q5 1.5 10 0'} stroke="#7a3a34" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {lines && (
          <g stroke={shade} strokeWidth="0.8" fill="none" opacity="0.7">
            <path d="M36 58 q2 4 5 6" />
            <path d="M64 58 q-2 4 -5 6" />
            {old && <path d="M40 34 h20 M38 37 h24" opacity="0.5" />}
          </g>
        )}
        {/* facial hair */}
        {!female && spec.facial === 1 && <path d="M43 60 q7 -3 14 0 q-7 2.5 -14 0 Z" fill={hair} />}
        {!female && spec.facial === 2 && <path d={`M${50 - rx + 3} 52 q2 20 ${rx - 3} 24 q${rx - 3} -4 ${rx - 3} -24 q-6 10 -${rx - 3} 8 q-${rx - 5} 2 -${rx - 3} -8 Z`} fill={hair} opacity="0.9" />}
        {!female && spec.facial === 3 && <path d={`M${50 - rx + 4} 54 q3 16 ${rx - 4} 20 q${rx - 4} -4 ${rx - 4} -20 q-6 8 -${rx - 4} 6 q-${rx - 6} 2 -${rx - 4} -6 Z`} fill={hair} opacity="0.35" />}
        {/* hair */}
        <Hair spec={spec} female={female} hair={hair} rx={rx} ry={ry} age={age} />
        {/* glasses */}
        {spec.glasses === 1 && (
          <g stroke="#2b2116" strokeWidth="1.2" fill="none">
            <circle cx="41" cy="46.5" r="6" />
            <circle cx="59" cy="46.5" r="6" />
            <path d="M47 46.5 h6" />
          </g>
        )}
        {spec.glasses === 2 && (
          <g stroke="#2b2116" strokeWidth="1.2" fill="none">
            <rect x="34.5" y="41.5" width="12.5" height="9" rx="1.5" />
            <rect x="53" y="41.5" width="12.5" height="9" rx="1.5" />
            <path d="M47 46 h6" />
          </g>
        )}
        {dress === 'bishop' && <path d={`M${50 - rx * 0.7} ${48 - ry + 6} q${rx * 0.7} -9 ${rx * 1.4} 0 q-${rx * 0.7} 3 -${rx * 1.4} 0 Z`} fill="#7a2a7a" />}
      </g>
    </svg>
  );
}

function Hair({ spec, female, hair, rx, ry, age }: { spec: PortraitSpec; female: boolean; hair: string; rx: number; ry: number; age: number }) {
  const top = 48 - ry;
  if (female) {
    switch (spec.hairStyle) {
      case 0: // bob
        return <path d={`M${50 - rx - 3} 56 q-2 -${ry + 8} ${rx + 3} -${ry + 10} q${rx + 5} 2 ${rx + 3} ${ry + 10} q-3 -8 -6 -14 q-${rx * 0.5} 4 -${rx} 4 q-${rx * 0.5} 0 -${rx} -4 q-3 6 -6 14 Z`} fill={hair} />;
      case 1: // long
      case 4: // waves
        return <path d={`M${50 - rx - 2} 60 q-1 -${ry + 12} ${rx + 2} -${ry + 14} q${rx + 3} 2 ${rx + 2} ${ry + 14} q-2 -12 -5 -16 q-${rx * 0.5} 3 -${rx - 3} 3 q-${rx * 0.5} 0 -${rx - 3} -3 q-3 4 -5 16 Z`} fill={hair} />;
      case 2: // up
      case 6:
        return (
          <g>
            <path d={`M${50 - rx - 1} 44 q0 -${ry + 6} ${rx + 1} -${ry + 8} q${rx + 1} 2 ${rx + 1} ${ry + 8} q-3 -6 -6 -9 q-${rx * 0.5} 2 -${rx - 4} 2 q-${rx * 0.5} 0 -${rx - 4} -2 q-3 3 -6 9 Z`} fill={hair} />
            <circle cx="50" cy={top - 4} r="7" fill={hair} />
          </g>
        );
      case 3: // curly
        return <path d={`M${50 - rx - 4} 52 q-4 -${ry + 10} ${rx + 4} -${ry + 12} q${rx + 8} 2 ${rx + 4} ${ry + 12} q-3 -6 -7 -10 q-${rx * 0.5} 3 -${rx - 3} 3 q-${rx * 0.5} 0 -${rx - 3} -3 q-4 4 -7 10 Z`} fill={hair} />;
      default: // short
        return <path d={`M${50 - rx - 1} 46 q0 -${ry + 5} ${rx + 1} -${ry + 6} q${rx + 1} 1 ${rx + 1} ${ry + 6} q-3 -6 -6 -8 q-${rx * 0.5} 2 -${rx - 4} 2 q-${rx * 0.5} 0 -${rx - 4} -2 q-3 2 -6 8 Z`} fill={hair} />;
    }
  }
  const bald = spec.hairStyle === 5 || (spec.hairStyle === 6 && age >= 55);
  switch (bald ? 5 : spec.hairStyle) {
    case 5: // bald: a horseshoe of hair from temple to temple, behind the head
      return (
        <g fill={hair}>
          <path d={`M${50 - rx - 2.5} 40 q-1.5 12 2 20 q3 3 6 1 q-3 -6 -3 -14 q0 -5 1 -8 Z`} />
          <path d={`M${50 + rx + 2.5} 40 q1.5 12 -2 20 q-3 3 -6 1 q3 -6 3 -14 q0 -5 -1 -8 Z`} />
        </g>
      );
    case 6: // receding
      return <path d={`M${50 - rx - 1} 42 q2 -${ry} ${rx + 1} -${ry + 2} q${rx - 1} 2 ${rx + 1} ${ry + 2} q-2 -6 -5 -8 q-6 6 -${rx - 5} 0 q-${rx - 9} 6 -${rx - 5} 0 q-3 2 -5 8 Z`} fill={hair} />;
    case 1: // parted
      return <path d={`M${50 - rx - 1} 42 q0 -${ry + 4} ${rx + 1} -${ry + 6} q${rx + 1} 2 ${rx + 1} ${ry + 6} q-3 -5 -6 -7 q-${rx * 0.4} 1 -${rx - 6} -1 q-4 2 -${rx - 6} 1 q-3 2 -6 7 Z`} fill={hair} />;
    case 2: // cropped
      return <path d={`M${50 - rx} 44 q0 -${ry + 2} ${rx} -${ry + 4} q${rx} 2 ${rx} ${ry + 4} q-3 -4 -6 -6 q-${rx * 0.4} 1 -${rx - 6} 1 q-${rx * 0.4} 0 -${rx - 6} -1 q-3 2 -6 6 Z`} fill={hair} />;
    case 3: // curly
      return <path d={`M${50 - rx - 3} 46 q-3 -${ry + 8} ${rx + 3} -${ry + 10} q${rx + 6} 2 ${rx + 3} ${ry + 10} q-3 -5 -7 -8 q-${rx * 0.4} 2 -${rx - 4} 2 q-${rx * 0.4} 0 -${rx - 4} -2 q-4 3 -7 8 Z`} fill={hair} />;
    case 4: // waves
      return <path d={`M${50 - rx - 2} 46 q-1 -${ry + 7} ${rx + 2} -${ry + 8} q${rx + 4} 1 ${rx + 2} ${ry + 8} q-2 -6 -6 -9 q-${rx * 0.4} 3 -${rx - 4} 2 q-${rx * 0.4} -1 -${rx - 4} -2 q-4 3 -6 9 Z`} fill={hair} />;
    default: // short
      return <path d={`M${50 - rx - 1} 44 q0 -${ry + 4} ${rx + 1} -${ry + 5} q${rx + 1} 1 ${rx + 1} ${ry + 5} q-3 -5 -6 -7 q-${rx * 0.4} 1 -${rx - 5} 1 q-${rx * 0.4} 0 -${rx - 5} -1 q-3 2 -6 7 Z`} fill={hair} />;
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
          <path d="M42 80 h16 v5 h-16 Z" fill="#fff" />
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
          <path d="M42 80 h16 l-8 8 Z" fill="#cfc4ae" opacity="0.4" />
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
