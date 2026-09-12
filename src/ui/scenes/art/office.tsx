import type { AmbientItem, GameState, Parish, PlaceDecor } from '@/types';
import { decorOptions } from '@/systems/decor';
import { BACK, PALETTE } from './defs';
import { Cabinet, Chair, Crucifix, Desk, Frame, Lamp, LightPool, Plant, Room, Rug, Window, wallPoint, pts } from './primitives';
import { Ambient, CornerItem, WallItem } from './ambient';

function art(decor: PlaceDecor, slot: keyof PlaceDecor, fallback: string): string {
  const id = decor[slot];
  return decorOptions.find((o) => o.id === id)?.art ?? fallback;
}

type Grade = 'poor' | 'plain' | 'fine';

function gradeOf(parish: Parish | undefined, pastor: boolean): Grade {
  const w = parish?.wealth ?? 3;
  if (w <= 2) return 'poor';
  if (w >= 4 && pastor) return 'fine';
  if (w >= 4 || pastor) return 'plain';
  return w === 3 ? 'plain' : 'poor';
}

/**
 * The parish office. A poor parish gives you a painted-block room with a
 * metal desk under a fluorescent tube; a pastor in a rich parish sits in
 * paneling. The wall, desk, and corner are the slots the man chooses.
 */
export function Office({ decor, ambient, parish, role }: { decor: PlaceDecor; ambient: AmbientItem[]; parish: Parish | undefined; role: string | undefined }) {
  const pastor = role === 'pastor';
  const grade = gradeOf(parish, pastor);
  const wall = art(decor, 'wall', 'crucifix');
  const corner = art(decor, 'corner', 'files');
  const desk = art(decor, 'desk', 'inherited');
  const deskKind = desk === 'plain' ? 'plain' : grade === 'poor' ? 'metal' : grade === 'fine' ? 'walnut' : 'oak';
  return (
    <g>
      {grade === 'fine' && (
        <Room wall="url(#damask)" dado="#5a3b22" dadoAt={0.62} floor="boards" ceiling="#e6dcc6">
          <Paneling />
        </Room>
      )}
      {grade === 'plain' && <Room wall="#d9c9a8" dado="#b9a482" dadoAt={0.7} floor="boards" ceiling="#ece5d4" />}
      {grade === 'poor' && (
        <Room wall="url(#block)" floor="lino" ceiling="#dcd8cc">
          <rect x="34" y="1.5" width="32" height="1.6" fill="#f4f1e6" />
          <rect x="34" y="1.5" width="32" height="1.6" fill="#fff" opacity="0.7" filter="url(#soft)" />
          {[BACK.x0 + 8, BACK.x0 + 24, BACK.x0 + 40, BACK.x0 + 56].map((x) => (
            <line key={x} x1={x} y1={BACK.y0} x2={x + (x - 50) * 0.35} y2={-1} stroke="#000" strokeWidth="0.2" opacity="0.15" />
          ))}
        </Room>
      )}
      <Window x={38} y={9} w={24} h={19} view={parish?.terrain === 'urban' ? 'city' : parish?.terrain === 'rural' ? 'hills' : 'town'} frame={grade === 'poor' ? '#cfc9bb' : PALETTE.cream} {...(grade === 'fine' ? { curtains: '#6b1f1f' } : {})} />
      <LightPool x={36} y={40} w={26} h={16} />
      {/* the chosen wall */}
      {wall === 'crucifix' && <Crucifix x={28} y={11} s={1} />}
      {wall === 'icon' && (
        <g>
          <Crucifix x={26} y={11} s={0.9} />
          <WallItem scene="office" variant="icon" x={68} y={11} />
        </g>
      )}
      {wall !== 'icon' && wall !== 'crucifix' && (
        <g>
          <Crucifix x={26} y={11} s={0.85} />
          <WallItem scene="office" variant={wall} x={66} y={10} />
        </g>
      )}
      {/* corner */}
      {corner === 'globe' && <Globe x={14} y={31} />}
      {corner !== 'globe' && <CornerItem scene="office" variant={corner} x={14} y={31} />}
      {grade !== 'poor' && <Rug x={14} y={45} w={72} h={15} pattern={grade === 'fine' ? 'rug' : 'rugBlue'} />}
      {/* his chair behind the desk, the desk hiding its seat */}
      <Chair x={46.5} y={25} s={0.85} kind={grade === 'poor' ? 'office' : 'leather'} />
      <Desk x={22} y={35} w={56} kind={deskKind} />
      <Lamp x={70} y={31} s={0.9} lit />
      <Ambient scene="office" items={ambient} anchor={{ books: [84, 6], wall: [84, 8], desk: [24, 37] }} />
      {/* two chairs for visitors, pulled up to the near side */}
      <Chair x={31} y={47} s={0.9} kind={grade === 'poor' ? 'folding' : grade === 'fine' ? 'leather' : 'wood'} facing="away" />
      <Chair x={61} y={47} s={0.9} kind={grade === 'poor' ? 'folding' : grade === 'fine' ? 'leather' : 'wood'} facing="away" />
      <SideDoor color={grade === 'poor' ? '#8a8378' : PALETTE.oak} />
      {grade === 'fine' && <Plant x={92} y={44} s={1.3} />}
    </g>
  );
}

/** A door on the left wall, drawn in the wall's perspective. */
export function SideDoor({ color, side = 'left' }: { color: string; side?: 'left' | 'right' }) {
  const x0 = side === 'left' ? 3 : 90;
  const x1 = side === 'left' ? 10 : 97;
  const quad = (a: number, b: number, f0: number, f1: number) => pts([wallPoint(side, a, f0), wallPoint(side, b, f0), wallPoint(side, b, f1), wallPoint(side, a, f1)]);
  return (
    <g>
      <polygon points={quad(x0 - 0.8, x1 + 0.8, 0.2, 1)} fill={PALETTE.cream} />
      <polygon points={quad(x0, x1, 0.22, 1)} fill={color} />
      <polygon points={quad(x0 + 1, x1 - 1, 0.28, 0.55)} fill="#000" opacity="0.18" />
      <polygon points={quad(x0 + 1, x1 - 1, 0.6, 0.95)} fill="#000" opacity="0.18" />
      <circle cx={wallPoint(side, side === 'left' ? x1 - 1.2 : x0 + 1.2, 0.6)[0]} cy={wallPoint(side, side === 'left' ? x1 - 1.2 : x0 + 1.2, 0.6)[1]} r="0.5" fill="url(#brass)" />
      <polygon points={quad(x0, x1, 0.22, 1)} fill={side === 'left' ? 'url(#sideLeft)' : 'url(#sideRight)'} />
    </g>
  );
}

function Paneling() {
  const cols = [BACK.x0, 30, 42, 58, 70, BACK.x1];
  return (
    <g>
      {cols.slice(0, -1).map((x, i) => {
        const w = cols[i + 1]! - x;
        const y = BACK.y0 + (BACK.y1 - BACK.y0) * 0.62;
        return <rect key={x} x={x + 1} y={y + 1} width={w - 2} height={BACK.y1 - y - 2} fill="none" stroke="#3a2210" strokeWidth="0.35" opacity="0.8" />;
      })}
    </g>
  );
}

function Globe({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 13} rx="5" ry="1" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      <circle cx={x} cy={y} r="5" fill="#d8c8a0" stroke="#5a3a12" strokeWidth="0.4" />
      <circle cx={x - 1.5} cy={y - 1.5} r="3" fill="#fff" opacity="0.2" />
      <path d={`M${x - 3} ${y - 2} q2 -1 3 1 t3 0 M${x - 4} ${y + 1} q3 2 6 -1 M${x - 1} ${y + 2} q2 1 3 0`} stroke="#6f7f5a" strokeWidth="0.7" fill="none" />
      <path d={`M${x - 5.5} ${y + 1} A6 6 0 0 0 ${x + 5.5} ${y + 1}`} stroke="url(#brass)" strokeWidth="0.7" fill="none" />
      <rect x={x - 0.6} y={y + 5} width="1.2" height="5" fill="url(#wood)" />
      <path d={`M${x - 4} ${y + 11.5} L${x + 4} ${y + 11.5} L${x + 2.5} ${y + 10} L${x - 2.5} ${y + 10} Z`} fill="url(#wood)" />
    </g>
  );
}

/** Which chancery office the man holds, from his flags. */
export function chanceryRank(state: GameState): 'corner' | 'modest' | null {
  const keys = Object.keys(state.flags).filter((k) => k.startsWith('office:') && state.flags[k]);
  if (keys.length === 0) return null;
  const senior = ['office:vicar_general', 'office:chancellor', 'office:bishops_secretary', 'office:vicar_for_clergy'];
  return keys.some((k) => senior.includes(k)) ? 'corner' : 'modest';
}

/** An office at the chancery: a modern building, carpet, a portrait of the bishop, files. Seniority buys a second window. */
export function Chancery({ ambient, rank, bishopName }: { ambient: AmbientItem[]; rank: 'corner' | 'modest'; bishopName: string }) {
  const corner = rank === 'corner';
  return (
    <g>
      <Room wall={corner ? '#e4dccb' : '#ddd8cc'} {...(corner ? { dado: '#7a5a3a' } : {})} dadoAt={0.72} floor="carpet" ceiling="#eae6dc">
        {!corner && (
          <g>
            <rect x="30" y="1.5" width="40" height="1.4" fill="#f4f1e6" />
            <rect x="30" y="1.5" width="40" height="1.4" fill="#fff" opacity="0.7" filter="url(#soft)" />
          </g>
        )}
      </Room>
      <Window x={corner ? 30 : 38} y={9} w={corner ? 20 : 24} h={19} view="city" frame="#efe9dc" />
      {corner && <Window x={56} y={9} w={20} h={19} view="city" frame="#efe9dc" />}
      <LightPool x={34} y={40} w={30} h={16} />
      <Frame x={corner ? 20 : 24} y={11} w={7} h={9} gilt={corner}>
        <ellipse cx={corner ? 23.5 : 27.5} cy={15.5} rx="2" ry="2.6" fill="#e3c69c" />
        <rect x={corner ? 21.2 : 25.2} y={17.5} width="4.6" height="2" fill="#7a1f7a" />
        <title>{bishopName}</title>
      </Frame>
      <Crucifix x={corner ? 79 : 78} y={11} s={0.8} />
      <Cabinet x={84} y={16} w={11} h={24} drawers={4} color={corner ? '#5a3a22' : '#6b6660'} />
      <Cabinet x={4} y={18} w={10} h={22} drawers={3} color={corner ? '#5a3a22' : '#7a756e'} />
      <Chair x={46.5} y={25} s={0.85} kind="office" />
      <Desk x={26} y={35} w={48} kind={corner ? 'walnut' : 'plain'} />
      <Lamp x={33} y={31} s={0.8} lit />
      <Chair x={33} y={47} s={0.9} kind={corner ? 'leather' : 'office'} facing="away" />
      <Chair x={59} y={47} s={0.9} kind={corner ? 'leather' : 'office'} facing="away" />
      {corner && <Plant x={92} y={44} s={1.4} />}
      <Ambient scene="chancery" items={ambient} anchor={{ books: [4, 6], wall: [64, 8], desk: [28, 37] }} />
      <polygon points={pts([wallPoint('left', 2, 0.15), wallPoint('left', 10, 0.15), wallPoint('left', 10, 0.95), wallPoint('left', 2, 0.95)])} fill="#000" opacity="0.08" />
    </g>
  );
}
