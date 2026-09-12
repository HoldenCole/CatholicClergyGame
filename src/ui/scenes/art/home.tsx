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
      <Stairs />
      {!poor && <Radiator x={75.5} y={33} w={6} />}
      {/* sideboard with the mail and the phone */}
      <Shadow x={3} y={41} w={11} />
      <rect x="3" y="31" width="10" height="9" fill="url(#wood)" />
      <rect x="3" y="31" width="10" height="0.7" fill="#fff" opacity="0.3" />
      <rect x="4" y="33" width="3.6" height="5.5" fill="#000" opacity="0.2" />
      <rect x="8.4" y="33" width="3.6" height="5.5" fill="#000" opacity="0.2" />
      <rect x="4" y="29.4" width="5" height="1.6" fill="#f3eee0" transform="rotate(-6 6.5 30)" />
      <rect x="5" y="28.6" width="5" height="1.6" fill="#f3eee0" opacity="0.95" transform="rotate(4 7.5 29)" />
      <rect x="9.6" y="27.6" width="3.2" height="3.4" rx="0.4" fill="#1c1917" />
      <rect x="10.1" y="28.1" width="2.2" height="0.8" rx="0.4" fill="#3f3a35" />
      <Ambient scene="rectory" items={ambient.filter((i) => i.layer === 'family' || i.layer === 'prayer')} anchor={{ books: [0, 0], wall: [22, 10], desk: [30, 33] }} />
      {fine && <Rug x={16} y={46} w={68} h={14} />}
      <CornerItem scene="rectory" variant={corner} x={15} y={48} />
      {/* the table: two chairs behind it, one pulled out on the near side */}
      <Chair x={32} y={26.5} s={0.95} kind={fine ? 'leather' : 'wood'} />
      <Chair x={58} y={26.5} s={0.95} kind={fine ? 'leather' : 'wood'} />
      <Shadow x={22} y={54} w={56} h={2.5} />
      <rect x="25" y="46" width="1.8" height="8" fill={poor ? '#8a8478' : PALETTE.oakDark} />
      <rect x="73" y="46" width="1.8" height="8" fill={poor ? '#8a8478' : PALETTE.oakDark} />
      <polygon points={pts([[27, 36], [73, 36], [78, 44], [22, 44]])} fill={poor ? '#e8e2d2' : 'url(#woodTop)'} />
      {!poor && <polygon points={pts([[29, 36.6], [71, 36.6], [75, 43], [25, 43]])} fill="url(#cloth)" opacity="0.9" />}
      <rect x="22" y="44" width="56" height="2.4" fill={poor ? '#b9b3a6' : 'url(#wood)'} />
      <rect x="22" y="44" width="56" height="0.5" fill="#fff" opacity="0.25" />
      <Candle x={50} y={38.6} h={2.6} lit={fine} />
      <ellipse cx="38" cy="40.5" rx="2.6" ry="1" fill="#f3eee0" />
      <ellipse cx="62" cy="40.5" rx="2.6" ry="1" fill="#f3eee0" />
      <rect x="46" y="37.6" width="2" height="2.6" fill="#5a1414" opacity="0.8" />
      <Chair x={46} y={46} s={1} kind={fine ? 'leather' : 'wood'} facing="away" />
    </g>
  );
}

/** The stairs up to the study, climbing the right wall. */
function Stairs() {
  const n = 7;
  const x0 = 83;
  const dx = 2.1;
  const df = 0.095;
  const prof: [number, number][] = [wallPoint('right', x0, 1)];
  for (let i = 0; i < n; i++) {
    prof.push(wallPoint('right', x0 + i * dx, 1 - i * df));
    prof.push(wallPoint('right', x0 + i * dx, 1 - (i + 1) * df));
    prof.push(wallPoint('right', x0 + (i + 1) * dx, 1 - (i + 1) * df));
  }
  const top = wallPoint('right', x0 + n * dx, 1 - n * df);
  prof.push(wallPoint('right', x0 + n * dx, 1));
  const rail0 = wallPoint('right', x0, 0.7);
  const rail1 = wallPoint('right', x0 + n * dx, 0.7 - n * df);
  return (
    <g>
      <polygon points={pts([top, wallPoint('right', 100, 1 - n * df), wallPoint('right', 100, 1 - n * df - 0.28), wallPoint('right', x0 + n * dx, 1 - n * df - 0.28)])} fill="#1b1008" opacity="0.65" />
      <polygon points={pts(prof)} fill="#7a4a22" />
      <polygon points={pts(prof)} fill="url(#sideRight)" />
      {Array.from({ length: n }, (_, i) => {
        const a = wallPoint('right', x0 + i * dx, 1 - (i + 1) * df);
        const b = wallPoint('right', x0 + (i + 1) * dx, 1 - (i + 1) * df);
        const c = wallPoint('right', x0 + i * dx, 1 - i * df);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth="0.35" opacity="0.4" />
            <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke="#3a2210" strokeWidth="0.3" opacity="0.7" />
          </g>
        );
      })}
      {Array.from({ length: n }, (_, i) => {
        const foot = wallPoint('right', x0 + i * dx + 1, 1 - (i + 1) * df);
        const head = wallPoint('right', x0 + i * dx + 1, 0.7 - (i + 1) * df);
        return <line key={i} x1={foot[0]} y1={foot[1]} x2={head[0]} y2={head[1]} stroke="#e9e2cc" strokeWidth="0.35" />;
      })}
      <line x1={rail0[0]} y1={rail0[1]} x2={rail1[0]} y2={rail1[1]} stroke={PALETTE.oakDark} strokeWidth="0.9" strokeLinecap="round" />
      <line x1={rail0[0]} y1={rail0[1]} x2={rail0[0]} y2={wallPoint('right', x0, 1)[1]} stroke={PALETTE.oakDark} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

/** The study upstairs: shelves, a desk under the eave, a lamp. */
export function Study({ ambient }: { ambient: AmbientItem[] }) {
  return (
    <g>
      <Room wall="#a8794a" dado="#5a3b22" dadoAt={0.75} floor="boards" ceiling="#e2d8c2" />
      <SideDoor color={PALETTE.oakDark} />
      <Bookcase x={19} y={9} w={28} h={31} rows={5} />
      <Window x={62} y={7} w={20} h={16} view="hills" curtains="#4a3a2a" />
      <LightPool x={60} y={40} w={22} h={14} />
      <Rug x={20} y={46} w={64} h={14} pattern="rugBlue" />
      <Chair x={66} y={23} s={0.85} kind="wood" />
      <Desk x={50} y={32} w={40} kind="oak" />
      <Lamp x={56} y={28} s={0.85} lit />
      <Ambient scene="study" items={ambient.filter((i) => i.layer === 'prayer' || i.layer === 'desk_state' || i.layer === 'archetype')} anchor={{ books: [0, 0], wall: [56, 8], desk: [52, 34] }} />
      <rect x="64" y="30.8" width="9" height="2.4" fill="#f3eee0" transform="rotate(-3 68 32)" />
      <Chair x={6} y={42} s={1.2} kind="leather" />
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
      <Chair x={66} y={22} s={0.85} kind="wood" />
      <Desk x={50} y={31} w={40} kind="plain" />
      <Lamp x={84} y={27} s={0.75} lit />
      <rect x="56" y="29.8" width="8" height="2.6" fill="#f3eee0" transform="rotate(-4 60 31)" />
      {/* shelf */}
      <Bookcase x={6} y={6} w={30} h={18} rows={3} density={0.7} />
      <Frame x={40} y={12} w={6} h={4} mat="#e9e2cc">
        <text x="43" y="14.8" fontSize="1.2" textAnchor="middle" fill="#5a4a32" fontFamily="serif">{(seminaryName ?? 'The seminary').split(' ')[0]}</text>
      </Frame>
      <Ambient scene="seminary_room" items={ambient} anchor={{ books: [7, 7], wall: [40, 18], desk: [56, 33] }} />
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
