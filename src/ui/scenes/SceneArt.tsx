import type { Season } from '@/types';
import type { SceneId } from './scenes';

/**
 * Painted-room backdrops in SVG, drawn in a 100×60 box so hotspot
 * percentages line up. The palette follows the reference: gold damask
 * walls, a red damask dado, a checkered floor in perspective, warm wood.
 * Season tints the light through the window.
 */
const SEASON_SKY: Record<Season, [string, string]> = {
  advent: ['#6b7a9e', '#c9b6a0'],
  christmas: ['#5a6690', '#e0c8a8'],
  ordinary: ['#79a6d8', '#dfe9f0'],
  lent: ['#8a8fa8', '#d8d0c8'],
  holy_week: ['#7b6f88', '#d9c4b0'],
  easter: ['#8fbce8', '#f3ecd8'],
};

export default function SceneArt({ scene, season }: { scene: SceneId; season: Season }) {
  const [skyTop, skyBottom] = SEASON_SKY[season];
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a4a22" />
          <stop offset="0.5" stopColor="#6b3416" />
          <stop offset="1" stopColor="#3f1d0b" />
        </linearGradient>
        <linearGradient id="woodTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a65d2e" />
          <stop offset="1" stopColor="#7a3f19" />
        </linearGradient>
        <linearGradient id="wallLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.15" />
        </linearGradient>
        <pattern id="damask" width="8" height="10" patternUnits="userSpaceOnUse">
          <rect width="8" height="10" fill="#d8c08a" />
          <path d="M4 0 C6 2 7 3 7 5 C7 7 6 8 4 10 C2 8 1 7 1 5 C1 3 2 2 4 0 Z" fill="#c4a86a" />
          <path d="M4 2 C5 3 5.5 4 5.5 5 C5.5 6 5 7 4 8 C3 7 2.5 6 2.5 5 C2.5 4 3 3 4 2 Z" fill="#d8c08a" />
          <circle cx="0" cy="5" r="0.9" fill="#c4a86a" />
          <circle cx="8" cy="5" r="0.9" fill="#c4a86a" />
        </pattern>
        <pattern id="redDamask" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#7a1f1f" />
          <path d="M3 0.5 L5 3 L3 5.5 L1 3 Z" fill="#9b2f2f" />
          <circle cx="3" cy="3" r="0.8" fill="#c9a24a" opacity="0.8" />
        </pattern>
        <pattern id="rug" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#8b2424" />
          <path d="M2 0.4 L3.6 2 L2 3.6 L0.4 2 Z" fill="#b8892f" opacity="0.7" />
          <circle cx="2" cy="2" r="0.5" fill="#8b2424" />
        </pattern>
        <pattern id="tiles" width="10" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#e8e2d2" />
          <rect x="5" width="5" height="5" fill="#2f3b45" />
        </pattern>
        <pattern id="tilesSkew" width="10" height="5" patternUnits="userSpaceOnUse" patternTransform="skewX(-12) scale(1.2, 0.8)">
          <rect width="5" height="5" fill="#e8e2d2" />
          <rect x="5" width="5" height="5" fill="#2f3b45" />
        </pattern>
        <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      {scene === 'office' && <Office />}
      {scene === 'rectory' && <Rectory />}
      {scene === 'church' && <Church />}
      {scene === 'hall' && <Hall />}
      {scene === 'chapel' && <Chapel />}
      {scene === 'street' && <Street />}
      {scene === 'study' && <Study />}
      <rect width="100" height="60" fill="url(#vignette)" />
    </svg>
  );
}

/** Walls, dado, and floor shared by the indoor rooms. */
function Room({ floorY = 42, dadoY = 30 }: { floorY?: number; dadoY?: number }) {
  return (
    <g>
      <rect width="100" height={floorY} fill="url(#damask)" />
      <rect width="100" height={floorY} fill="url(#wallLight)" />
      <rect y={dadoY} width="100" height={floorY - dadoY} fill="url(#redDamask)" />
      <rect y={dadoY - 0.8} width="100" height="1.4" fill="#5a3a12" />
      <rect y={dadoY + 0.6} width="100" height="0.4" fill="#c9a24a" opacity="0.7" />
      <rect y={floorY} width="100" height={60 - floorY} fill="url(#tilesSkew)" />
      <rect y={floorY} width="100" height={60 - floorY} fill="url(#wallLight)" opacity="0.8" />
      <rect y={floorY - 0.5} width="100" height="1" fill="#3a2a14" />
    </g>
  );
}

function Window({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} fill="#e9e2cc" stroke="#7a6a4a" strokeWidth="0.3" />
      <rect x={x} y={y} width={w} height={h} fill="url(#sky)" />
      {/* distant hill with a church */}
      <path d={`M${x} ${y + h * 0.42} Q${x + w * 0.3} ${y + h * 0.3} ${x + w * 0.55} ${y + h * 0.38} T${x + w} ${y + h * 0.4} L${x + w} ${y + h} L${x} ${y + h} Z`} fill="#6f7f5a" />
      <rect x={x + w * 0.42} y={y + h * 0.3} width={w * 0.16} height={h * 0.1} fill="#cdb98f" />
      <path d={`M${x + w * 0.5} ${y + h * 0.18} L${x + w * 0.58} ${y + h * 0.3} L${x + w * 0.42} ${y + h * 0.3} Z`} fill="#b9a27a" />
      <rect x={x + w * 0.495} y={y + h * 0.12} width={w * 0.01} height={h * 0.07} fill="#3a2a14" />
      {/* piazza and colonnade */}
      <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#c8bda0" />
      <path d={`M${x} ${y + h * 0.62} Q${x + w * 0.5} ${y + h * 0.5} ${x + w} ${y + h * 0.62} L${x + w} ${y + h * 0.68} Q${x + w * 0.5} ${y + h * 0.58} ${x} ${y + h * 0.68} Z`} fill="#e3dcc4" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={x + 1 + i * (w / 14)} y={y + h * 0.54 + Math.abs(i - 6.5) * 0.2} width={w / 30} height={h * 0.12} fill="#efe8d2" />
      ))}
      <rect x={x + w * 0.49} y={y + h * 0.36} width={w * 0.02} height={h * 0.5} fill="#a0784e" />
      <path d={`M${x + w * 0.49} ${y + h * 0.36} L${x + w * 0.5} ${y + h * 0.31} L${x + w * 0.51} ${y + h * 0.36} Z`} fill="#c9a24a" />
      {/* mullion and sill */}
      <rect x={x + w / 2 - 0.4} y={y} width="0.8" height={h} fill="#e9e2cc" />
      <rect x={x - 2} y={y + h} width={w + 4} height="1.2" fill="#d9d0b6" stroke="#7a6a4a" strokeWidth="0.2" />
      {/* open shutters */}
      <rect x={x - 5} y={y - 0.5} width="3.5" height={h + 1} fill="#e4dcc4" stroke="#7a6a4a" strokeWidth="0.2" />
      <rect x={x + w + 1.5} y={y - 0.5} width="3.5" height={h + 1} fill="#e4dcc4" stroke="#7a6a4a" strokeWidth="0.2" />
    </g>
  );
}

function Crucifix({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-0.9" y="0" width="1.8" height="12" fill="#5a3a12" />
      <rect x="-4" y="2.4" width="8" height="1.6" fill="#5a3a12" />
      <rect x="-0.5" y="2" width="1" height="5" fill="#e8caa0" />
      <rect x="-3.2" y="2.9" width="6.4" height="0.6" fill="#e8caa0" />
      <circle cx="0" cy="1.6" r="0.8" fill="#e8caa0" />
    </g>
  );
}

function Icon({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="8" height="10" fill="#b8892f" stroke="#5a3a12" strokeWidth="0.3" />
      <rect x={x + 0.7} y={y + 0.7} width="6.6" height="8.6" fill="#c9a24a" />
      <path d={`M${x + 4} ${y + 2} C${x + 6} ${y + 2} ${x + 6.5} ${y + 5} ${x + 5.5} ${y + 9} L${x + 2.5} ${y + 9} C${x + 1.5} ${y + 5} ${x + 2} ${y + 2} ${x + 4} ${y + 2} Z`} fill="#1f3a6e" />
      <circle cx={x + 4} cy={y + 2.6} r="1" fill="#e8caa0" />
      <circle cx={x + 5} cy={y + 5} r="0.7" fill="#e8caa0" />
    </g>
  );
}

function Globe({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="5" fill="#d8c8a0" stroke="#5a3a12" strokeWidth="0.4" />
      <path d={`M${x - 3} ${y - 2} q2 -1 3 1 t3 0 M${x - 4} ${y + 1} q3 2 6 -1 M${x - 1} ${y + 2} q2 1 3 0`} stroke="#8a7a50" strokeWidth="0.5" fill="none" />
      <path d={`M${x - 5.5} ${y + 1} A6 6 0 0 0 ${x + 5.5} ${y + 1}`} stroke="#5a3a12" strokeWidth="0.6" fill="none" />
      <rect x={x - 0.6} y={y + 5} width="1.2" height="4" fill="#5a3a12" />
      <path d={`M${x - 4} ${y + 10} L${x + 4} ${y + 10} L${x + 2} ${y + 9} L${x - 2} ${y + 9} Z`} fill="#5a3a12" />
    </g>
  );
}

function Chair({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y} Q${x + 4} ${y - 3} ${x + 8} ${y} L${x + 7.4} ${y + 9} L${x + 0.6} ${y + 9} Z`} fill="#b8892f" />
      <path d={`M${x + 1} ${y + 0.8} Q${x + 4} ${y - 1.6} ${x + 7} ${y + 0.8} L${x + 6.5} ${y + 8.2} L${x + 1.5} ${y + 8.2} Z`} fill="#e8dcc0" />
      <rect x={x - 0.5} y={y + 9} width="9" height="2.5" fill="#e8dcc0" stroke="#b8892f" strokeWidth="0.4" />
      <rect x={x} y={y + 11.5} width="1" height="4" fill="#8a5a1a" />
      <rect x={x + 7} y={y + 11.5} width="1" height="4" fill="#8a5a1a" />
    </g>
  );
}

function Desk({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <path d={`M${x + 4} ${y} L${x + w - 4} ${y} L${x + w} ${y + 5} L${x} ${y + 5} Z`} fill="url(#woodTop)" />
      <rect x={x} y={y + 5} width={w} height="9" fill="url(#wood)" />
      <rect x={x} y={y + 5} width={w} height="0.8" fill="#c48a4a" opacity="0.6" />
      <rect x={x + 3} y={y + 7} width={w * 0.24} height="4.5" fill="#5a2a0e" stroke="#c9a24a" strokeWidth="0.25" />
      <rect x={x + w - 3 - w * 0.24} y={y + 7} width={w * 0.24} height="4.5" fill="#5a2a0e" stroke="#c9a24a" strokeWidth="0.25" />
      <rect x={x + 3 + w * 0.09} y={y + 9} width={w * 0.06} height="0.8" rx="0.4" fill="#c9a24a" />
      <rect x={x + w - 3 - w * 0.15} y={y + 9} width={w * 0.06} height="0.8" rx="0.4" fill="#c9a24a" />
      <path d={`M${x + w * 0.44} ${y + 7} h${w * 0.12} l-1 4.5 h${-(w * 0.12 - 2)} Z`} fill="#4a2410" stroke="#c9a24a" strokeWidth="0.2" />
      <rect x={x + 1} y={y + 14} width="2" height="4" fill="#3f1d0b" />
      <rect x={x + w - 3} y={y + 14} width="2" height="4" fill="#3f1d0b" />
      {/* papers and a ledger */}
      <rect x={x + w * 0.38} y={y + 1.2} width={w * 0.14} height="2.2" fill="#f3eee0" transform={`rotate(-4 ${x + w * 0.45} ${y + 2})`} />
      <rect x={x + w * 0.7} y={y + 1} width={w * 0.12} height="2.6" fill="#5a1f1f" />
    </g>
  );
}

function Office() {
  return (
    <g>
      <Room floorY={44} dadoY={31} />
      <Window x={37} y={4} w={26} h={22} />
      <Crucifix x={19} y={9} s={1.1} />
      <Icon x={73} y={8} />
      <Globe x={14} y={28} />
      <Chair x={26} y={24} />
      <Chair x={66} y={24} />
      <rect x="16" y="46" width="68" height="14" fill="url(#rug)" />
      <rect x="16" y="46" width="68" height="14" fill="none" stroke="#c9a24a" strokeWidth="0.6" />
      <Desk x={22} y={34} w={56} />
    </g>
  );
}

function Rectory() {
  return (
    <g>
      <Room floorY={42} dadoY={30} />
      <Window x={56} y={6} w={18} h={14} />
      <Crucifix x={10} y={8} s={0.8} />
      {/* sideboard with mail */}
      <rect x="4" y="34" width="16" height="7" fill="url(#wood)" stroke="#3f1d0b" strokeWidth="0.3" />
      <rect x="6" y="32.4" width="6" height="1.6" fill="#f3eee0" />
      <rect x="7" y="31.4" width="6" height="1.6" fill="#f3eee0" opacity="0.9" />
      {/* phone */}
      <rect x="6" y="18" width="6" height="7" fill="#1c1917" stroke="#5a3a12" strokeWidth="0.3" />
      {/* table and chairs */}
      <path d="M28 33 L72 33 L76 38 L24 38 Z" fill="url(#woodTop)" />
      <rect x="24" y="38" width="52" height="2" fill="url(#wood)" />
      <rect x="27" y="40" width="1.6" height="8" fill="#3f1d0b" />
      <rect x="71" y="40" width="1.6" height="8" fill="#3f1d0b" />
      {[30, 42, 54].map((x) => (
        <Chair key={x} x={x} y={24} />
      ))}
      <rect x="40" y="34.4" width="6" height="1.2" fill="#f3eee0" />
      <circle cx="58" cy="35" r="1.4" fill="#e8dcc0" />
      {/* stairs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={80 + i * 3.5} y={22 - i * 3} width="4" height="2.6" fill="#7a3f19" stroke="#3f1d0b" strokeWidth="0.2" />
      ))}
      <rect x="86" y="8" width="8" height="18" fill="#2a1a0a" opacity="0.6" />
      {/* front door */}
      <rect x="44" y="46" width="12" height="14" fill="#5a2a0e" stroke="#3f1d0b" strokeWidth="0.3" />
      <circle cx="54" cy="53" r="0.5" fill="#c9a24a" />
    </g>
  );
}

function Church() {
  return (
    <g>
      <rect width="100" height="60" fill="#2a2420" />
      <rect y="40" width="100" height="20" fill="url(#tiles)" />
      <rect y="40" width="100" height="20" fill="url(#wallLight)" />
      {/* nave walls in perspective */}
      <polygon points="0,0 22,10 22,40 0,44" fill="#d8c8a0" />
      <polygon points="100,0 78,10 78,40 100,44" fill="#d8c8a0" />
      {[3, 9, 15].map((x) => (
        <rect key={x} x={x} y={10 + x * 0.3} width="3" height="12" fill="url(#sky)" opacity="0.8" />
      ))}
      {[82, 88, 94].map((x) => (
        <rect key={x} x={x} y={10 + (100 - x) * 0.3} width="3" height="12" fill="url(#sky)" opacity="0.8" />
      ))}
      {/* sanctuary */}
      <rect x="22" y="8" width="56" height="32" fill="#e8dcc0" />
      <path d="M36 8 Q50 -2 64 8 Z" fill="#c9a24a" opacity="0.5" />
      <rect x="40" y="22" width="20" height="9" fill="#f3eee0" stroke="#c9a24a" strokeWidth="0.4" />
      <rect x="44" y="12" width="12" height="10" fill="#b8892f" opacity="0.4" />
      <Crucifix x={50} y={10} s={1.2} />
      <rect x="47" y="19" width="6" height="3" fill="#c9a24a" />
      {/* side altar */}
      <rect x="24" y="24" width="12" height="7" fill="#e8dcc0" stroke="#c9a24a" strokeWidth="0.3" />
      <rect x="28" y="20" width="4" height="4" fill="#1f3a6e" />
      {/* baptistery */}
      <ellipse cx="30" cy="42" rx="6" ry="2.5" fill="#d8c8a0" stroke="#7a6a4a" strokeWidth="0.3" />
      {/* confessional */}
      <rect x="64" y="24" width="12" height="16" fill="url(#wood)" stroke="#3f1d0b" strokeWidth="0.3" />
      <rect x="68" y="27" width="4" height="12" fill="#1c1917" />
      <rect x="64" y="21" width="12" height="3" fill="#7a3f19" />
      {/* pews */}
      {[44, 47.5, 51, 54.5].map((y) => (
        <g key={y}>
          <rect x="18" y={y} width="24" height="1.6" fill="#7a3f19" />
          <rect x="58" y={y} width="24" height="1.6" fill="#7a3f19" />
        </g>
      ))}
      <rect x="44" y="47" width="12" height="13" fill="#5a2a0e" stroke="#3f1d0b" strokeWidth="0.3" />
    </g>
  );
}

function Hall() {
  return (
    <g>
      <Room floorY={36} dadoY={26} />
      <rect x="6" y="6" width="22" height="16" fill="#8a6a3a" stroke="#5a3a12" strokeWidth="0.3" />
      {[8, 14, 20].map((x) => (
        <rect key={x} x={x} y="8" width="5" height="6" fill="#f3eee0" />
      ))}
      <rect x="74" y="6" width="20" height="16" fill="#3a2a14" />
      <rect x="76" y="16" width="16" height="2" fill="#c9a24a" opacity="0.6" />
      <rect x="30" y="24" width="40" height="8" fill="#7a3f19" />
      {[22, 44, 66].map((x) => (
        <g key={x}>
          <rect x={x} y="38" width="16" height="2.5" fill="url(#woodTop)" />
          <rect x={x + 1} y="40.5" width="1.5" height="6" fill="#3f1d0b" />
          <rect x={x + 13.5} y="40.5" width="1.5" height="6" fill="#3f1d0b" />
        </g>
      ))}
      <rect x="45" y="48" width="10" height="12" fill="#5a2a0e" stroke="#3f1d0b" strokeWidth="0.3" />
    </g>
  );
}

function Chapel() {
  return (
    <g>
      <rect width="100" height="40" fill="#3a2a30" />
      <rect y="40" width="100" height="20" fill="url(#tiles)" />
      <rect y="40" width="100" height="20" fill="url(#wallLight)" />
      <rect x="40" y="12" width="20" height="16" fill="#e8dcc0" stroke="#c9a24a" strokeWidth="0.4" />
      <rect x="46" y="16" width="8" height="9" fill="#b8892f" stroke="#5a3a12" strokeWidth="0.3" />
      <circle cx="50" cy="8" r="2.2" fill="#f5c542" opacity="0.6" />
      <rect x="64" y="20" width="1.5" height="8" fill="#f3eee0" />
      <circle cx="64.75" cy="19" r="1" fill="#f5c542" />
      <Crucifix x={50} y={1} s={0.7} />
      <rect x="38" y="38" width="24" height="3" fill="url(#wood)" />
      <rect x="40" y="41" width="20" height="5" fill="#7a1f1f" />
      <rect x="4" y="24" width="10" height="24" fill="#5a2a0e" stroke="#3f1d0b" strokeWidth="0.3" />
    </g>
  );
}

function Street() {
  return (
    <g>
      <rect width="100" height="36" fill="url(#sky)" />
      <rect y="36" width="100" height="24" fill="#4a4540" />
      <rect y="44" width="100" height="1" fill="#c9c0b0" opacity="0.4" />
      <polygon points="6,32 6,14 16,6 26,14 26,32" fill="#d8c8a0" stroke="#7a6a4a" strokeWidth="0.3" />
      <rect x="13" y="22" width="6" height="10" fill="#5a2a0e" />
      <rect x="15" y="2" width="2" height="6" fill="#7a6a4a" />
      <rect x="38" y="12" width="26" height="20" fill="#c8bda0" stroke="#7a6a4a" strokeWidth="0.3" />
      {[41, 47, 53, 59].map((x) => (
        <rect key={x} x={x} y="16" width="3" height="12" fill="#e3dcc4" />
      ))}
      <rect x="68" y="8" width="26" height="24" fill="#d9d0b6" stroke="#7a6a4a" strokeWidth="0.3" />
      <rect x="78" y="12" width="6" height="2" fill="#b91c1c" />
      <rect x="80" y="10" width="2" height="6" fill="#b91c1c" />
      <rect x="40" y="36" width="20" height="12" fill="#a08a5a" stroke="#5a3a12" strokeWidth="0.3" />
      <rect x="70" y="36" width="24" height="14" fill="#c8a878" stroke="#5a3a12" strokeWidth="0.3" />
      <polygon points="70,36 82,30 94,36" fill="#7a3f19" />
      <rect x="10" y="40" width="22" height="7" rx="2" fill="#1c1917" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="15" cy="48" r="2" fill="#292524" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="27" cy="48" r="2" fill="#292524" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}

function Study() {
  return (
    <g>
      <Room floorY={40} dadoY={30} />
      <rect x="6" y="4" width="40" height="36" fill="#3a2410" stroke="#3f1d0b" strokeWidth="0.3" />
      {[8, 16, 24, 32].map((y) => (
        <g key={y}>
          <rect x="7" y={y + 6} width="38" height="0.8" fill="#8a5a1a" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={8 + i * 3} y={y} width="2.2" height="6" fill={['#7c2d12', '#1e3a8a', '#365314', '#5a3a12'][(i + y) % 4]} opacity="0.9" />
          ))}
        </g>
      ))}
      <Window x={62} y={6} w={22} h={16} />
      <path d="M52 30 L92 30 L94 33 L50 33 Z" fill="url(#woodTop)" />
      <rect x="50" y="33" width="44" height="2" fill="url(#wood)" />
      <rect x="53" y="35" width="2" height="9" fill="#3f1d0b" />
      <rect x="89" y="35" width="2" height="9" fill="#3f1d0b" />
      <rect x="82" y="22" width="1" height="8" fill="#a8a29e" />
      <polygon points="78,22 87,22 84,26 81,26" fill="#f5c542" opacity="0.6" />
      <rect x="58" y="27.5" width="10" height="2.5" fill="#f3eee0" />
      <rect x="4" y="42" width="10" height="16" fill="#5a2a0e" stroke="#3f1d0b" strokeWidth="0.3" />
    </g>
  );
}
