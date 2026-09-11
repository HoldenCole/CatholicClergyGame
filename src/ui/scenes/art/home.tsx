import type { AmbientItem, Parish, PlaceDecor } from '@/types';
import { decorOptions } from '@/systems/decor';
import { PALETTE } from './defs';
import { Bookcase, Candle, Chair, Crucifix, Desk, Door, Frame, Lamp, LightPool, Radiator, Room, Rug, Shadow, Window, pts, wallPoint } from './primitives';
import { Ambient, CornerItem, WallItem } from './ambient';
import { SideDoor } from './office';

function art(decor: PlaceDecor, slot: keyof PlaceDecor, fallback: string): string {
  const id = decor[slot];
  return decorOptions.find((o) => o.id === id)?.art ?? fallback;
}

/** The rectory: the room where the priests eat. Wealth decides whether it is a dining room or a kitchen. */
export function Rectory({ decor, ambient, parish }: { decor: PlaceDecor; ambient: AmbientItem[]; parish: Parish | undefined }) {
  const wall = art(decor, 'wall', 'crucifix');
  const corner = art(decor, 'corner', 'tv');
  const poor = (parish?.wealth ?? 3) <= 2;
  const fine = (parish?.wealth ?? 3) >= 4;
  return (
    <g>
      {fine ? <Room wall="#c9b58a" dado="#5a3b22" dadoAt={0.66} floor="boards" ceiling="#e9e0cc" /> : poor ? <Room wall="#e6e0cf" floor="lino" ceiling="#efece3" /> : <Room wall="url(#stripe)" dado="#b9a482" dadoAt={0.7} floor="boards" ceiling="#ece5d4" />}
      <Window x={54} y={9} w={20} h={16} view="yard" {...(fine ? { curtains: '#3a4a6a' } : poor ? {} : { curtains: '#c9c0a8' })} />
      <LightPool x={52} y={40} w={22} h={14} />
      {wall === 'crucifix' ? <Crucifix x={40} y={10} s={0.85} /> : <WallItem scene="rectory" variant={wall} x={36} y={10} />}
      {wall !== 'crucifix' && <Crucifix x={48} y={10} s={0.7} />}
      <SideDoor color={PALETTE.oak} />
      <CornerItem scene="rectory" variant={corner} x={12} y={48} />
      <Ambient scene="rectory" items={ambient.filter((i) => i.layer === 'family' || i.layer === 'prayer')} anchor={{ books: [0, 0], wall: [22, 10], desk: [30, 33] }} />
      {/* sideboard with the mail and the phone */}
      <Shadow x={4} y={43} w={16} />
      <rect x="4" y="33" width="16" height="9" fill="url(#wood)" />
      <rect x="4" y="33" width="16" height="0.7" fill="#fff" opacity="0.3" />
      <rect x="5" y="35" width="6.5" height="5.5" fill="#000" opacity="0.2" />
      <rect x="12.5" y="35" width="6.5" height="5.5" fill="#000" opacity="0.2" />
      <rect x="6" y="31.4" width="6" height="1.6" fill="#f3eee0" transform="rotate(-6 9 32)" />
      <rect x="7.5" y="30.6" width="6" height="1.6" fill="#f3eee0" opacity="0.95" transform="rotate(4 10 31)" />
      <rect x="15" y="29.5" width="4" height="3.5" rx="0.4" fill="#1c1917" />
      <rect x="15.6" y="30" width="2.8" height="0.8" rx="0.4" fill="#3f3a35" />
      {/* table and chairs */}
      {fine && <Rug x={16} y={44} w={68} h={16} />}
      <Chair x={30} y={24} s={0.95} kind={fine ? 'leather' : 'wood'} />
      <Chair x={44} y={24} s={0.95} kind={fine ? 'leather' : 'wood'} />
      <Chair x={58} y={24} s={0.95} kind={fine ? 'leather' : 'wood'} />
      <Shadow x={24} y={49} w={54} h={2.5} />
      <polygon points={pts([[28, 34], [72, 34], [77, 41], [23, 41]])} fill={poor ? '#e8e2d2' : 'url(#woodTop)'} />
      {!poor && <polygon points={pts([[30, 34.5], [70, 34.5], [74, 40], [26, 40]])} fill="url(#cloth)" opacity="0.9" />}
      <rect x="23" y="41" width="54" height="2.2" fill={poor ? '#b9b3a6' : 'url(#wood)'} />
      <rect x="26" y="43.2" width="1.8" height="8" fill={poor ? '#8a8478' : PALETTE.oakDark} />
      <rect x="72" y="43.2" width="1.8" height="8" fill={poor ? '#8a8478' : PALETTE.oakDark} />
      <Candle x={50} y={35} h={2.6} lit={fine} />
      <ellipse cx="40" cy="37" rx="2.4" ry="0.9" fill="#f3eee0" />
      <ellipse cx="60" cy="37" rx="2.4" ry="0.9" fill="#f3eee0" />
      <rect x="47" y="35.5" width="2" height="2.4" fill="#5a1414" opacity="0.8" />
      {/* stairs up to the study */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x={80 + i * 2.6} y={26 - i * 3} width="4" height="3" fill={PALETTE.oak} />
          <rect x={80 + i * 2.6} y={26 - i * 3} width="4" height="0.6" fill="#fff" opacity="0.3" />
        </g>
      ))}
      <rect x="93" y="6" width="6" height="8" fill="#1b1008" opacity="0.7" />
      <rect x="79" y="10" width="0.8" height="18" fill={PALETTE.oakDark} />
      <Door x={82} y={28} w={9} h={12} open={false} color={PALETTE.oakDark} />
      {!poor && <Radiator x={62} y={27} w={9} />}
    </g>
  );
}

/** The study upstairs: shelves, a desk under the eave, a lamp. */
export function Study({ ambient }: { ambient: AmbientItem[] }) {
  return (
    <g>
      <Room wall="#a8794a" dado="#5a3b22" dadoAt={0.75} floor="boards" ceiling="#e2d8c2" />
      <Bookcase x={6} y={4} w={36} h={36} rows={5} />
      <Window x={62} y={7} w={20} h={16} view="hills" curtains="#4a3a2a" />
      <LightPool x={60} y={40} w={22} h={14} />
      <Rug x={20} y={46} w={64} h={14} pattern="rugBlue" />
      <Desk x={50} y={30} w={40} kind="oak" />
      <Lamp x={82} y={26} s={0.85} lit />
      <Chair x={64} y={19} s={0.8} kind="wood" />
      <Chair x={8} y={42} s={1.1} kind="leather" />
      <Ambient scene="study" items={ambient.filter((i) => i.layer === 'prayer' || i.layer === 'desk_state' || i.layer === 'archetype')} anchor={{ books: [0, 0], wall: [44, 8], desk: [52, 30] }} />
      <rect x="54" y="27.8" width="9" height="2.4" fill="#f3eee0" transform="rotate(-3 58 29)" />
      <Door x={4} y={42} w={9} h={16} open />
    </g>
  );
}

/** A room in the seminary: bed, desk, shelf, the same window as every other room in the wing. */
export function SeminaryRoom({ ambient, seminaryName }: { ambient: AmbientItem[]; seminaryName: string | undefined }) {
  return (
    <g>
      <Room wall="#e8dcc0" floor="lino" ceiling="#f0ece0" />
      <Window x={62} y={8} w={20} h={16} view="yard" frame="#efe9dc" />
      <LightPool x={60} y={40} w={22} h={14} />
      <Crucifix x={50} y={9} s={0.75} />
      {/* bed */}
      <Shadow x={4} y={46} w={36} h={2} />
      <rect x="6" y="34" width="34" height="10" fill="#f3eee0" stroke="#7a6a4a" strokeWidth="0.3" />
      <rect x="6" y="30" width="34" height="4" fill="#5a3a5a" />
      <rect x="6" y="30" width="34" height="0.6" fill="#fff" opacity="0.3" />
      <rect x="8" y="31" width="9" height="3" rx="0.6" fill="#faf7ef" />
      <rect x="4" y="26" width="2.2" height="20" fill="url(#wood)" />
      <rect x="40" y="28" width="2" height="18" fill="url(#wood)" />
      {/* desk under the window */}
      <Desk x={50} y={31} w={40} kind="plain" />
      <Chair x={66} y={19} s={0.8} kind="wood" />
      <Lamp x={84} y={27} s={0.75} lit />
      <rect x="56" y="28.4" width="8" height="2.6" fill="#f3eee0" transform="rotate(-4 60 29.5)" />
      {/* shelf */}
      <Bookcase x={6} y={6} w={30} h={18} rows={3} density={0.7} />
      <Frame x={40} y={12} w={6} h={4} mat="#e9e2cc">
        <text x="43" y="14.8" fontSize="1.2" textAnchor="middle" fill="#5a4a32" fontFamily="serif">{(seminaryName ?? 'The seminary').split(' ')[0]}</text>
      </Frame>
      <Ambient scene="seminary_room" items={ambient} anchor={{ books: [7, 7], wall: [40, 18], desk: [56, 31] }} />
      <Door x={90} y={30} w={8} h={16} open={false} color="#8a8378" />
    </g>
  );
}

/** The corridor outside the room: the chapel at the end, doors on both sides, the gym and the language lab, the front door. */
export function SeminaryHall() {
  const sign = (x: number, y: number, text: string) => (
    <g>
      <rect x={x - 5} y={y - 1.4} width="10" height="2.8" fill="#e9e2cc" stroke="#7a6a4a" strokeWidth="0.2" />
      <text x={x} y={y + 0.7} fontSize="1.6" textAnchor="middle" fill="#5a4a32" fontFamily="serif">{text}</text>
    </g>
  );
  const sideDoor = (side: 'left' | 'right', x0: number, x1: number) => (
    <g>
      <polygon points={pts([wallPoint(side, x0, 0.22), wallPoint(side, x1, 0.22), wallPoint(side, x1, 1), wallPoint(side, x0, 1)])} fill={PALETTE.oak} />
      <polygon points={pts([wallPoint(side, x0 + 0.8, 0.28), wallPoint(side, x1 - 0.8, 0.28), wallPoint(side, x1 - 0.8, 0.55), wallPoint(side, x0 + 0.8, 0.55)])} fill="#000" opacity="0.18" />
      <polygon points={pts([wallPoint(side, x0, 0.22), wallPoint(side, x1, 0.22), wallPoint(side, x1, 1), wallPoint(side, x0, 1)])} fill={side === 'left' ? 'url(#sideLeft)' : 'url(#sideRight)'} />
    </g>
  );
  return (
    <g>
      <Room wall="#e6dfcd" dado="#8a7a5a" dadoAt={0.72} floor="lino" ceiling="#efece3">
        <rect x="34" y="1.5" width="32" height="1.4" fill="#f4f1e6" />
        <rect x="34" y="1.5" width="32" height="1.4" fill="#fff" opacity="0.7" filter="url(#soft)" />
      </Room>
      {/* the chapel doors at the end of the corridor */}
      <rect x="36" y="9" width="28" height="31" fill={PALETTE.oakDark} />
      <path d="M36 9 Q50 -2 64 9 Z" fill={PALETTE.oakDark} />
      <rect x="38" y="12" width="11" height="28" fill={PALETTE.oak} />
      <rect x="51" y="12" width="11" height="28" fill={PALETTE.oak} />
      <rect x="40" y="15" width="7" height="10" fill="#7a1f1f" opacity="0.8" />
      <rect x="53" y="15" width="7" height="10" fill="#2e5aac" opacity="0.8" />
      <circle cx="49" cy="27" r="0.6" fill="url(#brass)" />
      <circle cx="51" cy="27" r="0.6" fill="url(#brass)" />
      <Crucifix x={50} y={2.5} s={0.55} />
      <circle cx="50" cy="28" r="14" fill="url(#glow)" opacity="0.18" />
      {/* doors along the walls */}
      {sideDoor('left', 3, 12)}
      {sideDoor('left', 16, 22)}
      {sideDoor('left', 27, 32)}
      {sideDoor('right', 78, 84)}
      {sideDoor('right', 87, 96)}
      <g>{sign(8, 12, 'Library')}</g>
      <g>{sign(19, 14, 'Director')}</g>
      <g>{sign(29.5, 16, 'Room 12')}</g>
      <g>{sign(81, 14, 'Rector')}</g>
      <g>{sign(91.5, 12, 'Common')}</g>
      {/* the gym bag, the language lab cart, the front door mat */}
      <Shadow x={8} y={57} w={12} />
      <path d="M8 48 q1 -3 4 -3 h6 q3 0 4 3 v7 h-14 Z" fill="#2f3a4a" />
      <rect x="12" y="43" width="6" height="2" rx="1" fill="#1c1917" />
      <circle cx="26" cy="52" r="3.2" fill="#c7742a" />
      <path d="M22.8 52 h6.4 M26 48.8 v6.4" stroke="#1c1917" strokeWidth="0.3" />
      <Shadow x={76} y={57} w={16} />
      <rect x="76" y="44" width="14" height="10" fill="#8a8378" />
      <rect x="77" y="45" width="12" height="4" fill="#1e3a5a" />
      <rect x="78" y="46" width="5" height="1" fill="#e9e2cc" />
      <rect x="78" y="47.5" width="7" height="0.6" fill="#e9e2cc" opacity="0.7" />
      {[79, 82, 85].map((x) => <rect key={x} x={x} y="50" width="2.4" height="3" fill={['#7a1f1f', '#2e6b4f', '#c9a24a'][(x - 79) / 3]} />)}
      <rect x="40" y="50" width="20" height="4" fill="#5a3a12" opacity="0.6" />
      <text x="50" y="52.9" fontSize="1.8" textAnchor="middle" fill="#e9e2cc" fontFamily="serif" opacity="0.8">To the parishes</text>
      <Door x={44} y={40} w={12} h={10} color="#8a8378" />
    </g>
  );
}
