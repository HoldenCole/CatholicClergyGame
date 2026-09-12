import { PALETTE } from './defs';
import { Chair, Crucifix, Candle, Door, LightPool, Room, Shadow, pts } from './primitives';

/** The parish hall: folding tables, a stage, a kitchen pass-through, the bulletin board. */
export function Hall() {
  return (
    <g>
      <Room wall="#d8d0bc" dado="#8a7a5a" dadoAt={0.72} floor="lino" ceiling="#e6e2d6">
        <rect x="30" y="1.5" width="40" height="1.4" fill="#f4f1e6" />
        <rect x="30" y="1.5" width="40" height="1.4" fill="#fff" opacity="0.7" filter="url(#soft)" />
      </Room>
      {/* stage */}
      <rect x="34" y="26" width="32" height="14" fill="url(#wood)" />
      <rect x="34" y="26" width="32" height="0.8" fill="#fff" opacity="0.3" />
      <rect x="34" y="12" width="32" height="14" fill="#5a1414" />
      <path d="M34 12 q4 8 0 14 M66 12 q-4 8 0 14" stroke="#3a0a0a" strokeWidth="0.8" fill="none" />
      <rect x="34" y="11" width="32" height="1.6" fill={PALETTE.oakDark} />
      {/* bulletin board */}
      <rect x="4" y="10" width="20" height="14" fill="#8a6a3a" stroke="#5a3a12" strokeWidth="0.4" />
      <rect x="4.8" y="10.8" width="18.4" height="12.4" fill="#b8925a" />
      {[6, 11, 16].map((x) => (
        <rect key={x} x={x} y={12 + (x % 3)} width="4.2" height="5" fill="#f3eee0" transform={`rotate(${(x % 5) - 2} ${x + 2} 14)`} />
      ))}
      {[7, 13, 19].map((x) => (
        <rect key={x} x={x} y="18.5" width="3.5" height="3.5" fill={x === 13 ? '#d9e7f3' : '#f6e7b0'} />
      ))}
      {/* kitchen pass-through */}
      <rect x="74" y="10" width="20" height="14" fill="#2a1a0a" />
      <rect x="74" y="10" width="20" height="14" fill="url(#lamp)" />
      <rect x="75" y="20" width="18" height="4" fill="#d8d3c7" />
      <rect x="77" y="14" width="4" height="4" fill="#c9c4bb" />
      <rect x="85" y="15" width="6" height="3" fill="#8a8378" />
      <Crucifix x={70} y={4} s={0.6} />
      {/* folding tables */}
      {[[10, 44], [40, 44], [70, 44], [24, 52], [56, 52]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <Shadow x={x!} y={y! + 7} w={20} />
          <polygon points={pts([[x! + 2, y!], [x! + 18, y!], [x! + 20, y! + 3.5], [x!, y! + 3.5]])} fill="#e9e2cf" />
          <rect x={x!} y={y! + 3.5} width="20" height="1" fill="#b9b3a6" />
          <rect x={x! + 1.5} y={y! + 4.5} width="0.8" height="4.5" fill="#6b6660" />
          <rect x={x! + 17.7} y={y! + 4.5} width="0.8" height="4.5" fill="#6b6660" />
          <rect x={x! + 4} y={y! + 0.6} width="3" height="1.6" fill="#f6e7b0" />
          <circle cx={x! + 12} cy={y! + 1.6} r="1" fill="#f3eee0" />
        </g>
      ))}
      <Chair x={8} y={49} s={0.7} kind="folding" facing="away" />
      <Chair x={46} y={49} s={0.7} kind="folding" facing="away" />
      <Chair x={76} y={49} s={0.7} kind="folding" facing="away" />
      <Door x={45} y={50} w={10} h={10} color="#8a8378" />
    </g>
  );
}

/** The chapel: small, dim, the lamp burning. */
export function Chapel() {
  return (
    <g>
      <Room wall="#4a3a3c" floor="tiles" ceiling="#3a2a2c" />
      <rect x="40" y="10" width="20" height="20" fill="#e2d6be" stroke={PALETTE.gold} strokeWidth="0.5" />
      <path d="M40 10 Q50 2 60 10 Z" fill="#e2d6be" stroke={PALETTE.gold} strokeWidth="0.5" />
      <rect x="46" y="17" width="8" height="8" fill="url(#brass)" stroke="#5a3a12" strokeWidth="0.3" />
      <rect x="49.7" y="17.6" width="0.6" height="6.8" fill="#5a3a12" opacity="0.7" />
      <circle cx="50" cy="8" r="0.9" fill="url(#brass)" />
      <Crucifix x={50} y={-0.5} s={0.7} />
      <rect x="64" y="20" width="1.6" height="9" fill="#f3eee0" />
      <circle cx="64.8" cy="19" r="1" fill="#e04a2a" />
      <circle cx="64.8" cy="19" r="4" fill="url(#glow)" opacity="0.7" />
      <circle cx="50" cy="18" r="14" fill="url(#glow)" opacity="0.25" />
      {/* small altar */}
      <polygon points="42,32 58,32 59,34 41,34" fill="url(#cloth)" />
      <rect x="41" y="34" width="18" height="5" fill="#8a7a5a" />
      <Candle x={44} y={32} h={2.4} lit />
      <Candle x={56} y={32} h={2.4} lit />
      {/* kneelers */}
      {[30, 46, 62].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="46" width="12" height="2.2" fill="url(#wood)" />
          <rect x={x - 6} y="48.2" width="12" height="1.6" fill="#5a1414" />
          <rect x={x - 5.5} y="49.8" width="1" height="3" fill={PALETTE.oakDark} />
          <rect x={x + 4.5} y="49.8" width="1" height="3" fill={PALETTE.oakDark} />
        </g>
      ))}
      <rect x="44" y="53" width="12" height="7" fill="#000" opacity="0.15" />
      <Door x={4} y={20} w={10} h={26} open />
    </g>
  );
}

/** The street outside: church, hall, rectory, the car, and the hospital down the block. */
/** What stands on the horizon in each see, so the street says where it is. */
function Skyline({ see, urban }: { see: string | undefined; urban: boolean }) {
  switch (see) {
    case 'chicago':
      return (
        <g opacity="0.85">
          {[36, 42, 47, 53, 58, 64].map((x, i) => <rect key={x} x={x} y={[8, 4, 12, 2, 10, 6][i]} width={[5, 4, 5, 6, 4, 5][i]} height="34" fill={i % 2 ? '#4d4a55' : '#5e5b66'} />)}
          <rect x="53.5" y="-2" width="1" height="5" fill="#4d4a55" />
          <rect x="56.5" y="-2" width="1" height="5" fill="#4d4a55" />
          <rect x="30" y="30" width="44" height="1.2" fill="#3a3a3a" />
          {[32, 40, 48, 56, 64].map((x) => <rect key={x} x={x} y="31.2" width="1" height="6" fill="#3a3a3a" />)}
        </g>
      );
    case 'new_york':
      return (
        <g opacity="0.85">
          {[34, 39, 43, 48, 52, 57, 62, 66].map((x, i) => <rect key={x} x={x} y={[10, 6, 14, 0, 9, 5, 12, 8][i]} width={[4, 3.5, 4.5, 4, 5, 3.5, 4, 4][i]} height="36" fill={i % 3 ? '#5a5f6b' : '#6e737f'} />)}
          <polygon points="48,0 50,-6 52,0" fill="#5a5f6b" />
          {[34, 39, 43, 48, 52, 57, 62].map((x) => [0, 1, 2, 3].map((r) => <rect key={`${x}-${r}`} x={x + 1} y={16 + r * 4} width="0.8" height="1.2" fill="#f5e6b0" opacity="0.6" />))}
        </g>
      );
    case 'los_angeles':
      return (
        <g opacity="0.9">
          <path d="M0 26 Q20 14 40 22 T80 18 T100 24 V38 H0 Z" fill="#b9a27a" />
          <path d="M20 30 Q40 22 60 28 T100 27 V38 H20 Z" fill="#cbb68d" opacity="0.8" />
          {[36, 44, 58, 70].map((x) => (
            <g key={x}>
              <rect x={x} y="16" width="0.7" height="18" fill="#5a4a2a" />
              <path d={`M${x + 0.35} 16 q-4 -1 -6 2 M${x + 0.35} 16 q4 -1 6 2 M${x + 0.35} 16 q-3 -3 -2 -5 M${x + 0.35} 16 q3 -3 2 -5 M${x + 0.35} 16 q0 -4 1 -5`} stroke="#4f7a3f" strokeWidth="0.9" fill="none" />
            </g>
          ))}
        </g>
      );
    case 'houston':
      return (
        <g opacity="0.85">
          <path d="M0 30 H100 V38 H0 Z" fill="#8fa06a" />
          {[38, 45, 52, 60].map((x, i) => <rect key={x} x={x} y={[12, 8, 14, 10][i]} width={[4, 5, 4, 5][i]} height="26" fill={i % 2 ? '#6b7b8a' : '#7d8c9a'} />)}
          <rect x="30" y="29" width="50" height="1.6" fill="#7a7a72" />
          {[33, 41, 49, 57, 65, 73].map((x) => <rect key={x} x={x} y="30.6" width="0.9" height="4" fill="#7a7a72" />)}
          <ellipse cx="50" cy="8" rx="30" ry="4" fill="#fff" opacity="0.25" filter="url(#softer)" />
        </g>
      );
    case 'washington':
      return (
        <g opacity="0.85">
          <rect x="40" y="22" width="20" height="14" fill="#e6e0d0" />
          <path d="M43 22 Q50 8 57 22 Z" fill="#e6e0d0" />
          <rect x="49.4" y="6" width="1.2" height="4" fill="#e6e0d0" />
          {[42, 46, 50, 54, 58].map((x) => <rect key={x} x={x} y="26" width="1.2" height="8" fill="#d9d0b6" />)}
          <rect x="74" y="4" width="1.6" height="32" fill="#e6e0d0" />
          <polygon points="74,4 74.8,2 75.6,4" fill="#e6e0d0" />
          <path d="M0 30 Q20 24 40 28 V38 H0 Z" fill="#6f7f5a" />
        </g>
      );
    default:
      return urban ? <g>{[40, 48, 56, 64].map((x, i) => <rect key={x} x={x} y={10 - (i % 2) * 4} width="8" height="28" fill={i % 2 ? '#6e6a70' : '#7d7a80'} />)}</g> : <path d="M0 30 Q25 22 50 28 T100 26 V38 H0 Z" fill="#6f7f5a" />;
  }
}

export function Street({ terrain, see }: { terrain: string | undefined; see?: string }) {
  const urban = terrain === 'urban' || terrain === 'latino';
  return (
    <g>
      <rect width="100" height="38" fill="url(#sky)" />
      <ellipse cx="80" cy="6" rx="14" ry="3" fill="#fff" opacity="0.35" filter="url(#softer)" />
      <ellipse cx="30" cy="10" rx="10" ry="2.4" fill="#fff" opacity="0.28" filter="url(#softer)" />
      <Skyline see={see} urban={urban} />
      {!urban && see === undefined && <path d="M0 30 Q25 22 50 28 T100 26 V38 H0 Z" fill="#6f7f5a" />}
      {/* church */}
      <polygon points="4,36 4,16 17,7 30,16 30,36" fill={urban ? 'url(#stone)' : '#efe8d8'} stroke="#7a6a4a" strokeWidth="0.3" />
      <polygon points="4,16 17,7 30,16" fill="#5a4a3a" />
      <rect x="15" y="0" width="4" height="9" fill={urban ? '#a89c86' : '#efe8d8'} />
      <polygon points="14.5,0.5 17,-3 19.5,0.5" fill="#5a4a3a" />
      <rect x="16.6" y="-4" width="0.8" height="3" fill={PALETTE.gold} />
      <rect x="15.8" y="-3.2" width="2.4" height="0.6" fill={PALETTE.gold} />
      <rect x="13" y="24" width="8" height="12" fill={PALETTE.oakDark} />
      <path d="M13 24 Q17 20 21 24 Z" fill={PALETTE.oakDark} />
      <circle cx="17" cy="15" r="2.4" fill="#2e5aac" opacity="0.8" />
      {[7, 25].map((x) => (
        <rect key={x} x={x} y="20" width="2.2" height="7" fill="#2e5aac" opacity="0.7" />
      ))}
      {/* hall */}
      <rect x="38" y="20" width="24" height="16" fill="#c8bda0" stroke="#7a6a4a" strokeWidth="0.3" />
      <polygon points="37,20 50,15 63,20" fill="#7a5a3a" />
      {[41, 47, 53].map((x) => (
        <rect key={x} x={x} y="24" width="3.5" height="5" fill="#dfe9f0" />
      ))}
      <rect x="57" y="27" width="3.5" height="9" fill={PALETTE.oakDark} />
      <rect x="40" y="31" width="10" height="3" fill="#f3eee0" />
      {/* rectory */}
      <rect x="66" y="18" width="22" height="18" fill={urban ? 'url(#brick)' : '#d9d0b6'} stroke="#5a4a3a" strokeWidth="0.3" />
      <polygon points="64,18 77,10 90,18" fill="#4a2c17" />
      {[69, 76, 83].map((x) => (
        <rect key={x} x={x} y="22" width="3.6" height="5" fill="#f6e7b0" opacity="0.9" />
      ))}
      <rect x="75" y="29" width="4.6" height="7" fill={PALETTE.oakDark} />
      <rect x="73" y="27" width="8.6" height="1" fill="#e9e2cc" />
      {/* hospital at the end of the block */}
      <rect x="91" y="2" width="9" height="34" fill="#d9d3c5" stroke="#8a8478" strokeWidth="0.3" />
      {[6, 12, 18, 24].map((y) => (
        <g key={y}>
          <rect x="92.5" y={y} width="2.2" height="3" fill="#dfe9f0" />
          <rect x="96.3" y={y} width="2.2" height="3" fill="#dfe9f0" />
        </g>
      ))}
      <rect x="94.7" y="29" width="1.6" height="4.4" fill="#b91c1c" />
      <rect x="93.3" y="30.4" width="4.4" height="1.6" fill="#b91c1c" />
      {/* pavement and street */}
      <rect y="36" width="100" height="4" fill="#bfb8a8" />
      <rect y="40" width="100" height="20" fill="#4a4540" />
      <rect y="40" width="100" height="20" fill="url(#floorShade)" />
      {[6, 26, 46, 66, 86].map((x) => (
        <rect key={x} x={x} y="49" width="8" height="0.8" fill="#e9e2cc" opacity="0.6" />
      ))}
      <Shadow x={8} y={53} w={26} h={2.5} />
      <path d="M10 46 q1 -5 5 -5 h12 q4 0 5 5 v5 h-22 Z" fill="#1c1917" />
      <path d="M13 42 h11 q2 0 3 3 h-17 q1 -3 3 -3 Z" fill="#7fa7c9" opacity="0.8" />
      <rect x="9" y="51" width="24" height="1.5" fill="#0c0a09" />
      <circle cx="14" cy="53" r="2.2" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="28" cy="53" r="2.2" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
      <circle cx="14" cy="53" r="0.8" fill="#8a8478" />
      <circle cx="28" cy="53" r="0.8" fill="#8a8478" />
      {/* lamp post */}
      <rect x="62" y="24" width="0.8" height="14" fill="#2a2724" />
      <circle cx="62.4" cy="23" r="1.2" fill="#ffe9a8" opacity="0.7" />
      <LightPool x={58} y={40} w={9} h={8} tilt={4} />
      {/* tree */}
      <rect x="49.5" y="30" width="1.2" height="8" fill="#4a2c17" />
      <ellipse cx="50" cy="27" rx="5" ry="6" fill="#3f6a2f" />
      <ellipse cx="48" cy="25" rx="3" ry="3.5" fill="#4f7a3a" />
    </g>
  );
}
