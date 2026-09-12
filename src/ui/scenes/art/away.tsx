import type { StudyCity } from '@/types';
import { PALETTE } from './defs';
import { Bookcase, Chair, Crucifix, Desk, Door, Frame, Lamp, LightPool, Room, Shadow, Window, pts } from './primitives';

/**
 * A room at the college: ochre plaster in Rome, painted brick in Washington;
 * a narrow bed, a desk under a shuttered window, and the city in it.
 */
export function StudyRoom({ city, school }: { city: StudyCity; school: string }) {
  const rome = city === 'rome';
  const home = city !== 'rome' && city !== 'washington';
  return (
    <g>
      {rome ? <Room wall="#d9b26a" dado="#8a5a2e" dadoAt={0.78} floor="tiles" ceiling="#efe4c8" /> : home ? <Room wall="#e6e0cf" dado="#8a7a5a" dadoAt={0.74} floor="carpet" ceiling="#efece3" /> : <Room wall="#c9c2b0" dado="#6b4a3a" dadoAt={0.72} floor="boards" ceiling="#efece3" />}
      {/* shutters and the window on the city */}
      <rect x="58" y="5" width="3.6" height="22" fill={rome ? '#4f6b3a' : '#3a4a5a'} />
      <rect x="84.4" y="5" width="3.6" height="22" fill={rome ? '#4f6b3a' : '#3a4a5a'} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          <rect x="58.4" y={6 + i * 3} width="2.8" height="0.7" fill="#000" opacity="0.18" />
          <rect x="84.8" y={6 + i * 3} width="2.8" height="0.7" fill="#000" opacity="0.18" />
        </g>
      ))}
      <Window x={62} y={7} w={22} h={18} view={rome ? 'piazza' : home ? 'yard' : 'city'} frame={rome ? '#efe4c8' : '#efe9dc'} />
      {rome && <Dome x={73} y={7} w={22} h={18} />}
      <LightPool x={60} y={40} w={24} h={14} />
      <Crucifix x={50} y={9} s={0.75} />
      {/* bed */}
      <Shadow x={4} y={46} w={36} h={2} />
      <rect x="6" y="34" width="34" height="10" fill="#f3eee0" stroke="#7a6a4a" strokeWidth="0.3" />
      <rect x="6" y="30" width="34" height="4" fill={rome ? '#7a2a2a' : '#3a4a6a'} />
      <rect x="6" y="30" width="34" height="0.6" fill="#fff" opacity="0.3" />
      <rect x="8" y="31" width="9" height="3" rx="0.6" fill="#faf7ef" />
      <rect x="4" y="26" width="2.2" height="20" fill={rome ? '#1c1917' : 'url(#wood)'} />
      <rect x="40" y="28" width="2" height="18" fill={rome ? '#1c1917' : 'url(#wood)'} />
      {/* desk under the window, the thesis on it */}
      <Chair x={66} y={22} s={0.85} kind="wood" />
      <Desk x={50} y={31} w={40} kind={rome ? 'walnut' : 'plain'} />
      <Lamp x={84} y={27} s={0.75} lit />
      <rect x="55" y="29.6" width="8" height="2.8" fill="#f3eee0" transform="rotate(-4 59 31)" />
      <rect x="56.5" y="29" width="8" height="2.8" fill="#f3eee0" opacity="0.95" transform="rotate(3 60 30.4)" />
      <rect x="66" y="29.4" width="5" height="3.2" fill={rome ? '#5a1414' : '#1e3a5a'} />
      {/* shelf with the language books and a map of the city */}
      <Bookcase x={6} y={6} w={30} h={18} rows={3} density={0.8} />
      <Frame x={39} y={12} w={8} h={5} mat="#e9e2cc">
        <path d={rome ? 'M40 16 q2 -3 4 -1 t3 -1' : 'M40 13 h6 v3 h-6 z'} stroke="#7a6a4a" strokeWidth="0.3" fill="none" />
        <text x="43" y="16.4" fontSize="1" textAnchor="middle" fill="#5a4a32" fontFamily="serif">{school.replace('the ', '').split(' ')[0]}</text>
      </Frame>
      {/* a bottle of water and an espresso cup: the room's only luxuries */}
      <rect x="78" y="30.4" width="1.4" height="3.2" rx="0.4" fill="#cfe3ea" opacity="0.9" />
      <ellipse cx="75" cy="32.6" rx="1.1" ry="0.5" fill="#f3eee0" />
      <Door x={90} y={30} w={8} h={16} open={false} color={rome ? '#5a3a12' : '#8a8378'} />
    </g>
  );
}

/** St. Peter's, seen over the roofs from a window on the Janiculum. */
function Dome({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w * 0.5;
  const base = y + h * 0.62;
  return (
    <g>
      <rect x={cx - w * 0.16} y={base - h * 0.16} width={w * 0.32} height={h * 0.16} fill="#d9cfb2" />
      <path d={`M${cx - w * 0.16} ${base - h * 0.16} Q${cx} ${base - h * 0.62} ${cx + w * 0.16} ${base - h * 0.16} Z`} fill="#8fa3a0" />
      <rect x={cx - w * 0.03} y={base - h * 0.66} width={w * 0.06} height={h * 0.08} fill="#d9cfb2" />
      <rect x={cx - 0.25} y={base - h * 0.74} width="0.5" height={h * 0.08} fill={PALETTE.gold} />
      {[0.3, 0.42, 0.58, 0.7].map((f) => (
        <rect key={f} x={cx - w * 0.5 + w * f} y={base - h * 0.2} width="0.5" height={h * 0.2} fill="#e9e2cc" opacity="0.8" />
      ))}
    </g>
  );
}

/**
 * The city from the college steps: the university on the left, the
 * basilica ahead, the hospital and a parish on the right, a piazza with a
 * fountain, café tables, and the pitch behind the wall.
 */
export function StudyCity({ city }: { city: StudyCity }) {
  const rome = city === 'rome';
  if (city !== 'rome' && city !== 'washington') return null;
  const facade = rome ? '#d9a860' : '#9a5a44';
  const facade2 = rome ? '#c98f52' : '#b4735a';
  const roof = rome ? '#8a4a2a' : '#4a4a52';
  return (
    <g>
      <rect width="100" height="40" fill="url(#sky)" />
      <ellipse cx="78" cy="6" rx="14" ry="3" fill="#fff" opacity="0.35" filter="url(#softer)" />
      {/* the university */}
      <rect x="2" y="16" width="22" height="24" fill={facade2} stroke="#7a5a3a" strokeWidth="0.3" />
      <rect x="2" y="14" width="22" height="2.4" fill={roof} />
      {[5, 10, 15, 20].map((x) => <rect key={x} x={x} y="20" width="2.4" height="4" fill="#dfe9f0" />)}
      {[5, 10, 15, 20].map((x) => <rect key={x} x={x} y="27" width="2.4" height="4" fill="#dfe9f0" />)}
      <rect x="10" y="32" width="6" height="8" fill={PALETTE.oakDark} />
      <path d="M10 32 Q13 28 16 32 Z" fill={PALETTE.oakDark} />
      <text x="13" y="18.8" fontSize="1.4" textAnchor="middle" fill="#3a2a18" fontFamily="serif">{rome ? 'GREGORIANA' : 'CUA'}</text>
      {/* the offices, a narrow building */}
      <rect x="25" y="22" width="10" height="18" fill={facade} stroke="#7a5a3a" strokeWidth="0.3" />
      <rect x="25" y="20.6" width="10" height="1.8" fill={roof} />
      {[27, 31].map((x) => <rect key={x} x={x} y="25" width="2" height="3.4" fill="#dfe9f0" />)}
      <rect x="28.5" y="34" width="3" height="6" fill={PALETTE.oakDark} />
      {/* the basilica */}
      {rome ? (
        <g>
          <rect x="38" y="20" width="24" height="20" fill="#e9e2cc" stroke="#9a8a6a" strokeWidth="0.3" />
          <rect x="41" y="16" width="18" height="5" fill="#e3dcc4" />
          <path d="M41 16 Q50 4 59 16 Z" fill="#8fa3a0" />
          <rect x="48.8" y="3.2" width="2.4" height="3" fill="#e9e2cc" />
          <rect x="49.85" y="1" width="0.5" height="2.4" fill={PALETTE.gold} />
          {[40, 44, 48, 52, 56].map((x) => <rect key={x} x={x} y="24" width="1.6" height="12" fill="#d9cfb2" />)}
          <rect x="47" y="30" width="6" height="10" fill={PALETTE.oakDark} />
        </g>
      ) : (
        <g>
          <rect x="38" y="18" width="24" height="22" fill="#d9cfb2" stroke="#9a8a6a" strokeWidth="0.3" />
          <path d="M42 18 Q50 8 58 18 Z" fill="#2e6b8a" />
          <rect x="60" y="8" width="3" height="32" fill="#c8bda0" />
          <rect x="61.2" y="5" width="0.6" height="3" fill={PALETTE.gold} />
          <rect x="47" y="30" width="6" height="10" fill={PALETTE.oakDark} />
        </g>
      )}
      {/* the college office door, the hospital, the parish */}
      <rect x="64" y="26" width="7" height="14" fill={facade2} stroke="#7a5a3a" strokeWidth="0.3" />
      <rect x="66" y="33" width="3" height="7" fill={PALETTE.oakDark} />
      <rect x="71" y="18" width="15" height="22" fill="#e6e0d0" stroke="#8a8a7a" strokeWidth="0.3" />
      {[73, 77, 81].map((x) => <rect key={x} x={x} y="22" width="2.4" height="3" fill="#cfe3ea" />)}
      {[73, 77, 81].map((x) => <rect key={x} x={x} y="28" width="2.4" height="3" fill="#cfe3ea" />)}
      <rect x="77" y="14" width="3" height="3" fill="#fff" />
      <rect x="78.1" y="14.3" width="0.8" height="2.4" fill="#b02020" />
      <rect x="77.3" y="15.1" width="2.4" height="0.8" fill="#b02020" />
      <rect x="86" y="22" width="12" height="18" fill={facade} stroke="#7a5a3a" strokeWidth="0.3" />
      <polygon points="86,22 92,16 98,22" fill={roof} />
      <rect x="91.2" y="13" width="1.6" height="3.4" fill={PALETTE.gold} />
      <rect x="90.4" y="14" width="3.2" height="0.7" fill={PALETTE.gold} />
      <rect x="90" y="32" width="4" height="8" fill={PALETTE.oakDark} />
      <circle cx="92" cy="26" r="1.6" fill="#2e5aac" opacity="0.8" />
      {/* the piazza */}
      <rect x="0" y="40" width="100" height="20" fill={rome ? '#c8bda0' : '#9a9a92'} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x="0" y={41 + i * 2.2} width="100" height="0.35" fill="#000" opacity="0.08" />)}
      {rome && (
        <g>
          <ellipse cx="44" cy="52" rx="9" ry="3" fill="#8fa3a0" opacity="0.9" />
          <ellipse cx="44" cy="51.4" rx="7.6" ry="2.2" fill="#cfe3ea" />
          <rect x="43.2" y="44" width="1.6" height="7" fill="#d9cfb2" />
          <ellipse cx="44" cy="44" rx="3" ry="0.9" fill="#d9cfb2" />
          <path d="M44 41 q-1.5 3 0 3 q1.5 0 0 -3" fill="#cfe3ea" opacity="0.8" />
        </g>
      )}
      {/* café tables and the awning */}
      <rect x="62" y="44" width="20" height="2.2" fill={rome ? '#7a1f1f' : '#2e4a6a'} />
      {[64, 70, 76].map((x) => (
        <g key={x}>
          <ellipse cx={x + 2} cy="53" rx="2.4" ry="0.9" fill="#f3eee0" />
          <rect x={x + 1.7} y="53" width="0.6" height="4" fill="#1c1917" />
          <rect x={x - 1} y="52" width="1.6" height="2.4" fill="#4a3a2a" />
          <rect x={x + 3.6} y="52" width="1.6" height="2.4" fill="#4a3a2a" />
        </g>
      ))}
      {/* the pitch behind the wall, and the pilgrims */}
      <rect x="2" y="48" width="22" height="9" fill="#5a7a3a" opacity="0.9" />
      <rect x="2" y="47" width="22" height="1.2" fill="#8a7a5a" />
      <rect x="3" y="49" width="20" height="7" fill="none" stroke="#e9e2cc" strokeWidth="0.3" />
      <circle cx="13" cy="52.5" r="1.4" fill="none" stroke="#e9e2cc" strokeWidth="0.3" />
      {[32, 35, 38, 41, 52, 55].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="54.6" r="0.9" fill={['#e0b89a', '#c9a07a', '#f0d0b0'][i % 3]} />
          <rect x={x - 1.1} y="55.5" width="2.2" height="2.8" rx="0.6" fill={['#3a4a6a', '#7a3a3a', '#4a6a4a', '#6a5a3a', '#2a2a2a', '#8a6a4a'][i]} />
          <rect x={x - 0.9} y="58.2" width="0.7" height="1.8" fill="#2a2a2a" />
          <rect x={x + 0.2} y="58.2" width="0.7" height="1.8" fill="#2a2a2a" />
        </g>
      ))}
      <Shadow x={30} y={59.4} w={28} h={1} />
      {/* the college steps, home */}
      <polygon points={pts([[86, 60], [98, 60], [98, 56], [86, 56]])} fill="#d9cfb2" />
      <polygon points={pts([[87, 56], [97, 56], [97, 53], [87, 53]])} fill="#e3dcc4" />
      <text x="92" y="58.6" fontSize="1.4" textAnchor="middle" fill="#3a2a18" fontFamily="serif">home</text>
    </g>
  );
}
