import type { Season } from '@/types';
import type { SceneId } from './scenes';

/**
 * Stylized SVG backdrops. Each scene is drawn in a 100×60 box so hotspot
 * percentages line up. Palette shifts with the liturgical season.
 */
const SEASON_TINT: Record<Season, string> = {
  advent: '#4c3a6b',
  christmas: '#6b4c2a',
  ordinary: '#2f4a3a',
  lent: '#5a3a5a',
  holy_week: '#5a2a2a',
  easter: '#6b6b3a',
};

export default function SceneArt({ scene, season }: { scene: SceneId; season: Season }) {
  const tint = SEASON_TINT[season];
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1917" />
          <stop offset="1" stopColor="#292524" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f3a36" />
          <stop offset="1" stopColor="#1c1917" />
        </linearGradient>
      </defs>
      <rect width="100" height="60" fill="url(#wall)" />
      {scene === 'church' && <Church tint={tint} />}
      {scene === 'rectory' && <Rectory tint={tint} />}
      {scene === 'office' && <Office tint={tint} />}
      {scene === 'hall' && <Hall tint={tint} />}
      {scene === 'chapel' && <Chapel tint={tint} />}
      {scene === 'street' && <Street tint={tint} />}
      {scene === 'study' && <Study tint={tint} />}
    </svg>
  );
}

const stroke = '#0c0a09';

function Church({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="40" width="100" height="20" fill="url(#floor)" />
      {/* nave perspective */}
      <polygon points="0,40 100,40 60,18 40,18" fill="#292524" stroke={stroke} strokeWidth="0.3" />
      {/* sanctuary */}
      <rect x="38" y="14" width="24" height="26" fill="#1c1917" stroke={stroke} strokeWidth="0.3" />
      <rect x="42" y="22" width="16" height="10" fill={tint} stroke={stroke} strokeWidth="0.3" />
      <rect x="47" y="10" width="6" height="12" fill="#d6d3d1" opacity="0.6" />
      {/* side altar */}
      <rect x="8" y="24" width="14" height="10" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      <rect x="12" y="20" width="6" height="4" fill={tint} />
      {/* confessional */}
      <rect x="78" y="24" width="14" height="18" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      <rect x="82" y="28" width="6" height="12" fill="#1c1917" />
      <rect x="78" y="17" width="14" height="4" fill="#57534e" />
      {/* baptistery */}
      <ellipse cx="16" cy="43" rx="7" ry="3" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      {/* sacristy door */}
      <rect x="63" y="18" width="8" height="14" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      {/* pews */}
      {[44, 47, 50, 53].map((y) => (
        <g key={y}>
          <rect x="24" y={y} width="20" height="1.4" fill="#57534e" />
          <rect x="56" y={y} width="20" height="1.4" fill="#57534e" />
        </g>
      ))}
      {/* doors */}
      <rect x="45" y="47" width="10" height="11" fill="#292524" stroke={stroke} strokeWidth="0.3" />
      {/* window light */}
      <rect x="0" y="0" width="100" height="14" fill={tint} opacity="0.12" />
    </g>
  );
}

function Rectory({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="36" width="100" height="24" fill="url(#floor)" />
      <rect x="0" y="0" width="100" height="36" fill="#292524" />
      <rect x="0" y="0" width="100" height="36" fill={tint} opacity="0.15" />
      {/* table */}
      <rect x="30" y="34" width="40" height="3" fill="#57534e" stroke={stroke} strokeWidth="0.3" />
      <rect x="32" y="37" width="2" height="8" fill="#44403c" />
      <rect x="66" y="37" width="2" height="8" fill="#44403c" />
      {[34, 44, 54, 64].map((x) => (
        <rect key={x} x={x} y="26" width="4" height="8" fill="#3f3a36" stroke={stroke} strokeWidth="0.2" />
      ))}
      {/* phone on the wall */}
      <rect x="7" y="18" width="7" height="8" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
      {/* sideboard with mail */}
      <rect x="6" y="36" width="16" height="7" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      <rect x="9" y="34" width="6" height="2" fill="#d6d3d1" opacity="0.7" />
      {/* office door */}
      <rect x="79" y="14" width="10" height="24" fill="#1c1917" stroke="#57534e" strokeWidth="0.3" />
      {/* stairs */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={60 + i * 4} y={16 - i * 2.5} width="4" height="2" fill="#57534e" />
      ))}
      {/* front door */}
      <rect x="41" y="48" width="10" height="10" fill="#292524" stroke={stroke} strokeWidth="0.3" />
      {/* window */}
      <rect x="22" y="6" width="14" height="12" fill={tint} opacity="0.5" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}

function Office({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="38" width="100" height="22" fill="url(#floor)" />
      <rect x="0" y="0" width="100" height="38" fill="#292524" />
      {/* whiteboard */}
      <rect x="30" y="5" width="40" height="16" fill="#e7e5e4" opacity="0.85" stroke="#57534e" strokeWidth="0.3" />
      {[8, 11, 14, 17].map((y) => (
        <rect key={y} x="33" y={y} width={20 + (y % 3) * 4} height="0.8" fill="#57534e" opacity="0.6" />
      ))}
      {/* calendar */}
      <rect x="6" y="8" width="16" height="14" fill="#f5f5f4" opacity="0.8" stroke="#57534e" strokeWidth="0.3" />
      <rect x="6" y="8" width="16" height="3" fill={tint} />
      {/* desk */}
      <rect x="28" y="30" width="44" height="4" fill="#57534e" stroke={stroke} strokeWidth="0.3" />
      <rect x="30" y="34" width="3" height="10" fill="#44403c" />
      <rect x="67" y="34" width="3" height="10" fill="#44403c" />
      <rect x="40" y="26" width="10" height="4" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
      <rect x="55" y="28" width="8" height="2" fill="#d6d3d1" opacity="0.8" />
      {/* ledger shelf */}
      <rect x="76" y="12" width="16" height="12" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      {[77, 80, 83, 86, 89].map((x) => (
        <rect key={x} x={x} y="13" width="2.5" height="10" fill={x % 2 ? '#7c2d12' : '#1c1917'} />
      ))}
      {/* side table with plans */}
      <rect x="76" y="32" width="18" height="3" fill="#57534e" />
      <rect x="78" y="29" width="14" height="3" fill="#e7e5e4" opacity="0.7" />
      {/* door */}
      <rect x="4" y="36" width="12" height="20" fill="#1c1917" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}

function Hall({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="34" width="100" height="26" fill="url(#floor)" />
      <rect x="0" y="0" width="100" height="34" fill="#292524" />
      <rect x="0" y="0" width="100" height="34" fill={tint} opacity="0.1" />
      {/* bulletin board */}
      <rect x="6" y="7" width="22" height="16" fill="#7c6f5a" stroke={stroke} strokeWidth="0.3" />
      {[8, 14, 20].map((x) => (
        <rect key={x} x={x} y="9" width="5" height="6" fill="#f5f5f4" opacity="0.8" />
      ))}
      {/* kitchen pass-through */}
      <rect x="74" y="6" width="20" height="16" fill="#1c1917" stroke="#57534e" strokeWidth="0.3" />
      <rect x="76" y="16" width="16" height="2" fill="#57534e" />
      {/* tables */}
      {[24, 46, 68].map((x) => (
        <g key={x}>
          <rect x={x} y="36" width="16" height="2.5" fill="#57534e" stroke={stroke} strokeWidth="0.2" />
          <rect x={x + 1} y="38.5" width="1.5" height="6" fill="#44403c" />
          <rect x={x + 13.5} y="38.5" width="1.5" height="6" fill="#44403c" />
        </g>
      ))}
      {/* stage */}
      <rect x="30" y="24" width="40" height="8" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      {/* exit */}
      <rect x="45" y="48" width="10" height="10" fill="#292524" stroke={stroke} strokeWidth="0.3" />
      <rect x="46" y="46" width="8" height="1.5" fill="#dc2626" opacity="0.6" />
    </g>
  );
}

function Chapel({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="38" width="100" height="22" fill="url(#floor)" />
      <rect x="0" y="0" width="100" height="38" fill="#1c1917" />
      <rect x="0" y="0" width="100" height="38" fill={tint} opacity="0.2" />
      {/* tabernacle */}
      <rect x="40" y="12" width="20" height="16" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      <rect x="46" y="16" width="8" height="9" fill="#a16207" opacity="0.8" stroke={stroke} strokeWidth="0.2" />
      <circle cx="50" cy="8" r="2" fill="#fbbf24" opacity="0.5" />
      {/* candle */}
      <rect x="64" y="20" width="1.5" height="8" fill="#e7e5e4" />
      <circle cx="64.75" cy="19" r="1" fill="#fbbf24" opacity="0.8" />
      {/* kneeler */}
      <rect x="38" y="38" width="24" height="3" fill="#57534e" stroke={stroke} strokeWidth="0.3" />
      <rect x="40" y="41" width="20" height="5" fill="#44403c" />
      {/* door */}
      <rect x="4" y="24" width="10" height="24" fill="#292524" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}

function Street({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="0" width="100" height="36" fill={tint} opacity="0.35" />
      <rect x="0" y="36" width="100" height="24" fill="#1c1917" />
      <rect x="0" y="44" width="100" height="1" fill="#57534e" opacity="0.5" />
      {/* church facade */}
      <polygon points="6,32 6,14 16,6 26,14 26,32" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      <rect x="13" y="22" width="6" height="10" fill="#1c1917" />
      <rect x="15" y="2" width="2" height="6" fill="#57534e" />
      {/* city hall */}
      <rect x="38" y="12" width="26" height="20" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      {[41, 47, 53, 59].map((x) => (
        <rect key={x} x={x} y="16" width="3" height="12" fill="#d6d3d1" opacity="0.4" />
      ))}
      {/* hospital */}
      <rect x="68" y="8" width="26" height="24" fill="#57534e" stroke={stroke} strokeWidth="0.3" />
      <rect x="78" y="12" width="6" height="2" fill="#dc2626" opacity="0.8" />
      <rect x="80" y="10" width="2" height="6" fill="#dc2626" opacity="0.8" />
      {/* hall */}
      <rect x="40" y="36" width="20" height="12" fill="#3f3a36" stroke={stroke} strokeWidth="0.3" />
      {/* rectory */}
      <rect x="70" y="36" width="24" height="14" fill="#44403c" stroke={stroke} strokeWidth="0.3" />
      <polygon points="70,36 82,30 94,36" fill="#292524" />
      {/* car */}
      <rect x="10" y="40" width="22" height="7" rx="2" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="15" cy="48" r="2" fill="#292524" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="27" cy="48" r="2" fill="#292524" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}

function Study({ tint }: { tint: string }) {
  return (
    <g>
      <rect x="0" y="40" width="100" height="20" fill="url(#floor)" />
      <rect x="0" y="0" width="100" height="40" fill="#292524" />
      {/* shelves */}
      <rect x="6" y="4" width="40" height="36" fill="#1c1917" stroke={stroke} strokeWidth="0.3" />
      {[8, 16, 24, 32].map((y) => (
        <g key={y}>
          <rect x="7" y={y + 6} width="38" height="0.8" fill="#57534e" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={8 + i * 3} y={y} width="2.2" height="6" fill={['#7c2d12', '#1e3a8a', '#365314', '#44403c'][(i + y) % 4]} opacity="0.8" />
          ))}
        </g>
      ))}
      {/* window */}
      <rect x="60" y="6" width="26" height="16" fill={tint} opacity="0.5" stroke="#57534e" strokeWidth="0.3" />
      <rect x="72.5" y="6" width="1" height="16" fill="#57534e" />
      {/* desk with lamp */}
      <rect x="52" y="30" width="40" height="3" fill="#57534e" stroke={stroke} strokeWidth="0.3" />
      <rect x="54" y="33" width="3" height="10" fill="#44403c" />
      <rect x="87" y="33" width="3" height="10" fill="#44403c" />
      <rect x="82" y="22" width="1" height="8" fill="#a8a29e" />
      <polygon points="78,22 87,22 84,26 81,26" fill="#fbbf24" opacity="0.6" />
      <rect x="58" y="27" width="10" height="3" fill="#e7e5e4" opacity="0.7" />
      {/* door */}
      <rect x="4" y="42" width="10" height="16" fill="#1c1917" stroke="#57534e" strokeWidth="0.3" />
    </g>
  );
}
