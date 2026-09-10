import type { ReactNode } from 'react';
import { BACK, PALETTE, VP } from './defs';

/** A point on the left or right wall: `x` across the canvas, `f` down the wall from 0 (top) to 1 (floor). */
export function wallPoint(side: 'left' | 'right', x: number, f: number): [number, number] {
  const cx = side === 'left' ? BACK.x0 : BACK.x1;
  const t = (VP.x - x) / (VP.x - cx);
  const top = VP.y + (BACK.y0 - VP.y) * t;
  const bottom = VP.y + (BACK.y1 - VP.y) * t;
  return [x, top + (bottom - top) * f];
}

/** Where a floor line from back-edge x reaches y. */
export function floorX(bx: number, y: number): number {
  const t = (y - BACK.y1) / (BACK.y1 - VP.y);
  return bx + (bx - VP.x) * t;
}

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

export type Floor = 'boards' | 'tiles' | 'carpet' | 'lino' | 'stone' | 'marble';

/**
 * A one-point-perspective interior: ceiling, three walls, floor. `wall` is
 * the paint of the walls, `dado` the wainscot below the chair rail if any.
 */
export function Room({ wall, dado, dadoAt = 0.7, floor, ceiling = '#e9e2cf', rail = PALETTE.oakDark, children }: { wall: string; dado?: string; dadoAt?: number; floor: Floor; ceiling?: string; rail?: string; children?: ReactNode }) {
  const tl = wallPoint('left', 0, 0);
  const bl = wallPoint('left', 0, 1);
  const tr = wallPoint('right', 100, 0);
  const br = wallPoint('right', 100, 1);
  return (
    <g>
      <polygon points={pts([tl, tr, [BACK.x1, BACK.y0], [BACK.x0, BACK.y0]])} fill={ceiling} />
      <polygon points={pts([tl, tr, [BACK.x1, BACK.y0], [BACK.x0, BACK.y0]])} fill="url(#ceilShade)" />
      <rect x={BACK.x0} y={BACK.y0} width={BACK.x1 - BACK.x0} height={BACK.y1 - BACK.y0} fill={wall} />
      <rect x={BACK.x0} y={BACK.y0} width={BACK.x1 - BACK.x0} height={BACK.y1 - BACK.y0} fill="url(#wallShade)" />
      <polygon points={pts([tl, [BACK.x0, BACK.y0], [BACK.x0, BACK.y1], bl])} fill={wall} />
      <polygon points={pts([tl, [BACK.x0, BACK.y0], [BACK.x0, BACK.y1], bl])} fill="url(#sideLeft)" />
      <polygon points={pts([tr, [BACK.x1, BACK.y0], [BACK.x1, BACK.y1], br])} fill={wall} />
      <polygon points={pts([tr, [BACK.x1, BACK.y0], [BACK.x1, BACK.y1], br])} fill="url(#sideRight)" />
      {dado && <Dado color={dado} at={dadoAt} rail={rail} />}
      <FloorPlane kind={floor} />
      {children}
    </g>
  );
}

function Dado({ color, at, rail }: { color: string; at: number; rail: string }) {
  const y = BACK.y0 + (BACK.y1 - BACK.y0) * at;
  const l0 = wallPoint('left', 0, at);
  const l1 = wallPoint('left', 0, 1);
  const r0 = wallPoint('right', 100, at);
  const r1 = wallPoint('right', 100, 1);
  return (
    <g>
      <rect x={BACK.x0} y={y} width={BACK.x1 - BACK.x0} height={BACK.y1 - y} fill={color} />
      <rect x={BACK.x0} y={y} width={BACK.x1 - BACK.x0} height={BACK.y1 - y} fill="url(#wallShade)" opacity="0.5" />
      <polygon points={pts([l0, [BACK.x0, y], [BACK.x0, BACK.y1], l1])} fill={color} />
      <polygon points={pts([l0, [BACK.x0, y], [BACK.x0, BACK.y1], l1])} fill="url(#sideLeft)" />
      <polygon points={pts([r0, [BACK.x1, y], [BACK.x1, BACK.y1], r1])} fill={color} />
      <polygon points={pts([r0, [BACK.x1, y], [BACK.x1, BACK.y1], r1])} fill="url(#sideRight)" />
      <polyline points={pts([l0, [BACK.x0, y], [BACK.x1, y], r0])} fill="none" stroke={rail} strokeWidth="0.7" />
      <polyline points={pts([l0, [BACK.x0, y], [BACK.x1, y], r0])} fill="none" stroke="#fff" strokeWidth="0.2" opacity="0.35" transform="translate(0 -0.5)" />
    </g>
  );
}

const FLOOR_BASE: Record<Floor, string> = { boards: '#8a5a2e', tiles: '#d9d0bd', carpet: '#6b2a26', lino: '#b9b19a', stone: '#9c9282', marble: '#e7e0d0' };

function FloorPlane({ kind }: { kind: Floor }) {
  const bl = wallPoint('left', 0, 1);
  const br = wallPoint('right', 100, 1);
  const poly = pts([[BACK.x0, BACK.y1], [BACK.x1, BACK.y1], br, [100, 60], [0, 60], bl]);
  const rows = [BACK.y1, 42.2, 44.8, 47.8, 51.2, 55.2, 60];
  return (
    <g>
      <polygon points={poly} fill={FLOOR_BASE[kind]} />
      {kind === 'boards' &&
        Array.from({ length: 22 }, (_, i) => {
          const bx = BACK.x0 - 12 + i * 4.2;
          const nx = bx + 4.2;
          return <polygon key={i} points={pts([[bx, BACK.y1], [nx, BACK.y1], [floorX(nx, 60), 60], [floorX(bx, 60), 60]])} fill={i % 2 ? '#8f5f31' : '#7c4f27'} stroke="#4a2a12" strokeWidth="0.15" />;
        })}
      {(kind === 'tiles' || kind === 'marble' || kind === 'lino' || kind === 'stone') && (
        <g>
          {Array.from({ length: 26 }, (_, i) => {
            const bx = BACK.x0 - 20 + i * 4;
            return <line key={i} x1={bx} y1={BACK.y1} x2={floorX(bx, 60)} y2={60} stroke={kind === 'marble' ? '#c9bfa8' : '#5a5147'} strokeWidth="0.18" opacity="0.7" />;
          })}
          {rows.map((y) => (
            <line key={y} x1={0} y1={y} x2={100} y2={y} stroke={kind === 'marble' ? '#c9bfa8' : '#5a5147'} strokeWidth="0.18" opacity="0.7" />
          ))}
          {kind === 'tiles' &&
            Array.from({ length: 13 }, (_, i) =>
              rows.slice(0, -1).map((y, r) => {
                if ((i + r) % 2) return null;
                const bx = BACK.x0 - 20 + i * 8;
                const y2 = rows[r + 1]!;
                return <polygon key={`${i}-${r}`} points={pts([[floorX(bx, y), y], [floorX(bx + 4, y), y], [floorX(bx + 4, y2), y2], [floorX(bx, y2), y2]])} fill="#3b3a3f" opacity="0.85" />;
              }),
            )}
        </g>
      )}
      <polygon points={poly} fill="url(#floorShade)" />
      <polygon points={poly} fill="none" stroke="#2a1a0c" strokeWidth="0.4" opacity="0.5" />
    </g>
  );
}

/** Light from a window falling on the floor. */
export function LightPool({ x, y, w, h, tilt = 14 }: { x: number; y: number; w: number; h: number; tilt?: number }) {
  return <polygon points={pts([[x, y], [x + w, y], [x + w + tilt, y + h], [x - tilt * 0.3, y + h]])} fill="url(#lightShaft)" filter="url(#soft)" />;
}

export function Shadow({ x, y, w, h = 2 }: { x: number; y: number; w: number; h?: number }) {
  return <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={h} fill="#1a0f08" opacity="0.4" filter="url(#soft)" />;
}

/** A back-wall window with a view of the world outside. */
export function Window({ x, y, w, h, view = 'town', frame = PALETTE.cream, curtains }: { x: number; y: number; w: number; h: number; view?: 'town' | 'hills' | 'city' | 'yard' | 'piazza'; frame?: string; curtains?: string }) {
  return (
    <g>
      <rect x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} fill={frame} stroke="#5a4a32" strokeWidth="0.3" />
      <rect x={x - 0.8} y={y - 0.8} width={w + 1.6} height={h + 1.6} fill="#000" opacity="0.25" />
      <rect x={x} y={y} width={w} height={h} fill="url(#sky)" />
      <View x={x} y={y} w={w} h={h} kind={view} />
      <rect x={x} y={y} width={w} height={h} fill="#fff" opacity="0.08" />
      <rect x={x + w / 2 - 0.45} y={y} width="0.9" height={h} fill={frame} />
      <rect x={x} y={y + h * 0.45} width={w} height="0.8" fill={frame} />
      <rect x={x - 2.2} y={y + h} width={w + 4.4} height="1.4" fill={frame} stroke="#5a4a32" strokeWidth="0.25" />
      <rect x={x - 2.2} y={y + h + 1.4} width={w + 4.4} height="0.6" fill="#000" opacity="0.25" />
      {curtains && (
        <g>
          <path d={`M${x - 3} ${y - 2} h5 q-1 ${h * 0.5} 0.5 ${h + 4} h-5.5 Z`} fill={curtains} />
          <path d={`M${x + w + 3} ${y - 2} h-5 q1 ${h * 0.5} -0.5 ${h + 4} h5.5 Z`} fill={curtains} />
          <rect x={x - 3.5} y={y - 2.6} width={w + 7} height="0.8" fill={PALETTE.oakDark} />
        </g>
      )}
    </g>
  );
}

function View({ x, y, w, h, kind }: { x: number; y: number; w: number; h: number; kind: 'town' | 'hills' | 'city' | 'yard' | 'piazza' }) {
  const g = (fx: number, fy: number): [number, number] => [x + w * fx, y + h * fy];
  if (kind === 'hills')
    return (
      <g>
        <path d={`M${x} ${y + h * 0.55} Q${x + w * 0.25} ${y + h * 0.35} ${x + w * 0.5} ${y + h * 0.5} T${x + w} ${y + h * 0.45} V${y + h} H${x} Z`} fill="#6f7f5a" />
        <path d={`M${x} ${y + h * 0.7} Q${x + w * 0.4} ${y + h * 0.55} ${x + w} ${y + h * 0.72} V${y + h} H${x} Z`} fill="#55683f" />
        <rect x={x + w * 0.62} y={y + h * 0.36} width={w * 0.06} height={h * 0.14} fill="#e0d7c0" />
        <polygon points={pts([g(0.61, 0.36), g(0.69, 0.36), g(0.65, 0.26)])} fill="#8a5a2e" />
      </g>
    );
  if (kind === 'city')
    return (
      <g>
        {[0, 0.18, 0.34, 0.52, 0.7, 0.86].map((fx, i) => (
          <rect key={i} x={x + w * fx} y={y + h * (0.25 + (i % 3) * 0.12)} width={w * 0.14} height={h} fill={i % 2 ? '#6a6a72' : '#7d7a80'} />
        ))}
        {[0.05, 0.22, 0.4, 0.58, 0.74, 0.9].map((fx, i) => (
          <rect key={i} x={x + w * fx} y={y + h * 0.45} width={w * 0.04} height={h * 0.05} fill="#ffe9a8" opacity="0.7" />
        ))}
      </g>
    );
  if (kind === 'yard')
    return (
      <g>
        <rect x={x} y={y + h * 0.6} width={w} height={h * 0.4} fill="#5e7a3e" />
        <ellipse cx={x + w * 0.3} cy={y + h * 0.5} rx={w * 0.18} ry={h * 0.24} fill="#3f6a2f" />
        <rect x={x + w * 0.29} y={y + h * 0.6} width={w * 0.025} height={h * 0.2} fill="#4a2c17" />
        <rect x={x + w * 0.62} y={y + h * 0.42} width={w * 0.36} height={h * 0.2} fill="#c9b18a" />
        <polygon points={pts([g(0.6, 0.42), g(1, 0.42), g(0.8, 0.28)])} fill="#7a4a2a" />
      </g>
    );
  if (kind === 'piazza')
    return (
      <g>
        <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#c8bda0" />
        <path d={`M${x} ${y + h * 0.62} Q${x + w * 0.5} ${y + h * 0.5} ${x + w} ${y + h * 0.62} L${x + w} ${y + h * 0.68} Q${x + w * 0.5} ${y + h * 0.58} ${x} ${y + h * 0.68} Z`} fill="#e3dcc4" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={x + 1 + i * (w / 12)} y={y + h * 0.54 + Math.abs(i - 5.5) * 0.25} width={w / 28} height={h * 0.12} fill="#efe8d2" />
        ))}
        <rect x={x + w * 0.44} y={y + h * 0.3} width={w * 0.12} height={h * 0.32} fill="#d9cfb2" />
        <path d={`M${x + w * 0.42} ${y + h * 0.3} Q${x + w * 0.5} ${y + h * 0.1} ${x + w * 0.58} ${y + h * 0.3} Z`} fill="#b9a27a" />
      </g>
    );
  return (
    <g>
      <rect x={x} y={y + h * 0.58} width={w} height={h * 0.42} fill="#8a8f7a" />
      <rect x={x + w * 0.05} y={y + h * 0.36} width={w * 0.3} height={h * 0.3} fill="#b89a74" />
      <polygon points={pts([g(0.03, 0.36), g(0.37, 0.36), g(0.2, 0.22)])} fill="#6b4a2e" />
      <rect x={x + w * 0.45} y={y + h * 0.3} width={w * 0.22} height={h * 0.36} fill="#cdbca0" />
      <rect x={x + w * 0.53} y={y + h * 0.12} width={w * 0.06} height={h * 0.2} fill="#cdbca0" />
      <polygon points={pts([g(0.52, 0.12), g(0.6, 0.12), g(0.56, 0.04)])} fill="#4a2c17" />
      <ellipse cx={x + w * 0.85} cy={y + h * 0.5} rx={w * 0.12} ry={h * 0.2} fill="#4f6d3a" />
      <rect x={x + w * 0.845} y={y + h * 0.66} width={w * 0.012} height={h * 0.12} fill="#4a2c17" />
    </g>
  );
}

export function Crucifix({ x, y, s = 1, corpus = true }: { x: number; y: number; s?: number; corpus?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-0.9" y="0" width="1.8" height="12" fill={PALETTE.oakDark} />
      <rect x="-4" y="2.4" width="8" height="1.6" fill={PALETTE.oakDark} />
      <rect x="-0.9" y="0" width="0.5" height="12" fill="#fff" opacity="0.2" />
      {corpus && (
        <g>
          <rect x="-0.5" y="2.6" width="1" height="4.6" rx="0.4" fill="#e3c69c" />
          <rect x="-3.4" y="3" width="6.8" height="0.6" rx="0.3" fill="#e3c69c" />
          <circle cx="0" cy="2" r="0.85" fill="#e3c69c" />
          <rect x="-0.9" y="5.2" width="1.8" height="1" fill="#f5f0e2" />
        </g>
      )}
    </g>
  );
}

export function Frame({ x, y, w, h, children, mat = '#f3eee0', gilt = false }: { x: number; y: number; w: number; h: number; children?: ReactNode; mat?: string; gilt?: boolean }) {
  return (
    <g>
      <rect x={x + 0.4} y={y + 0.6} width={w} height={h} fill="#000" opacity="0.25" filter="url(#soft)" />
      <rect x={x} y={y} width={w} height={h} fill={gilt ? 'url(#brass)' : PALETTE.oakDark} />
      <rect x={x + 0.6} y={y + 0.6} width={w - 1.2} height={h - 1.2} fill={mat} />
      {children}
    </g>
  );
}

export function Bookcase({ x, y, w, h, rows = 4, density = 1 }: { x: number; y: number; w: number; h: number; rows?: number; density?: number }) {
  const rowH = (h - 1) / rows;
  const colors = ['#7c2d12', '#1e3a8a', '#365314', '#5a3a12', '#7a1f1f', '#3a2a14', '#0f4c5c', '#6b4f1d'];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="url(#wood)" />
      <rect x={x + 0.6} y={y + 0.6} width={w - 1.2} height={h - 1.2} fill="#2a1408" />
      {Array.from({ length: rows }, (_, r) => {
        const ry = y + 0.6 + r * rowH;
        const n = Math.floor(((w - 1.6) / 1.3) * density);
        return (
          <g key={r}>
            {Array.from({ length: n }, (_, i) => {
              const bh = rowH * (0.62 + ((i * 7 + r * 3) % 5) * 0.06);
              return <rect key={i} x={x + 0.9 + i * 1.3} y={ry + rowH - 0.4 - bh} width="1.1" height={bh} fill={colors[(i * 3 + r) % colors.length]} />;
            })}
            <rect x={x + 0.6} y={ry + rowH - 0.4} width={w - 1.2} height="0.5" fill="#8a5a2a" />
          </g>
        );
      })}
      <rect x={x} y={y} width="0.6" height={h} fill="#fff" opacity="0.15" />
    </g>
  );
}

/** A desk seen from the front: top in perspective, a front with drawers, legs or a pedestal. */
export function Desk({ x, y, w, kind = 'oak' }: { x: number; y: number; w: number; kind?: 'oak' | 'walnut' | 'metal' | 'plain' }) {
  const top = kind === 'metal' ? '#c9c4bb' : kind === 'plain' ? '#c9a87a' : 'url(#woodTop)';
  const front = kind === 'metal' ? '#8f8b84' : kind === 'plain' ? '#a8865a' : kind === 'walnut' ? PALETTE.walnut : 'url(#wood)';
  const d = 5;
  return (
    <g>
      <Shadow x={x - 2} y={y + 16} w={w + 4} h={2.2} />
      <polygon points={pts([[x + 3, y], [x + w - 3, y], [x + w, y + d], [x, y + d]])} fill={top} />
      <rect x={x} y={y + d} width={w} height="9.5" fill={front} />
      <rect x={x} y={y + d} width={w} height="0.7" fill="#fff" opacity="0.3" />
      {kind !== 'metal' && kind !== 'plain' && (
        <g>
          <rect x={x + 2} y={y + d + 1.5} width={w * 0.26} height="3" fill="#00000030" stroke={PALETTE.gold} strokeWidth="0.2" />
          <rect x={x + 2} y={y + d + 5.2} width={w * 0.26} height="3" fill="#00000030" stroke={PALETTE.gold} strokeWidth="0.2" />
          <rect x={x + w - 2 - w * 0.26} y={y + d + 1.5} width={w * 0.26} height="3" fill="#00000030" stroke={PALETTE.gold} strokeWidth="0.2" />
          <rect x={x + w - 2 - w * 0.26} y={y + d + 5.2} width={w * 0.26} height="3" fill="#00000030" stroke={PALETTE.gold} strokeWidth="0.2" />
          {[y + d + 3, y + d + 6.7].map((yy) => (
            <g key={yy}>
              <rect x={x + 2 + w * 0.1} y={yy} width={w * 0.06} height="0.7" rx="0.35" fill="url(#brass)" />
              <rect x={x + w - 2 - w * 0.16} y={yy} width={w * 0.06} height="0.7" rx="0.35" fill="url(#brass)" />
            </g>
          ))}
          <rect x={x + w * 0.4} y={y + d + 1.5} width={w * 0.2} height="2" fill="#00000030" stroke={PALETTE.gold} strokeWidth="0.15" />
        </g>
      )}
      {kind === 'metal' && (
        <g>
          {[1.5, 4.5, 7.5].map((dy) => (
            <rect key={dy} x={x + 1.5} y={y + d + dy} width={w * 0.3} height="2.2" fill="#7d7973" stroke="#5f5b55" strokeWidth="0.2" />
          ))}
          <rect x={x + w - 1.5 - w * 0.3} y={y + d + 1.5} width={w * 0.3} height="8" fill="#7d7973" stroke="#5f5b55" strokeWidth="0.2" />
        </g>
      )}
      {(kind === 'plain' || kind === 'metal') && (
        <g>
          <rect x={x + 1} y={y + d + 9.5} width="1.6" height="3.5" fill={kind === 'metal' ? '#5f5b55' : '#8a6a44'} />
          <rect x={x + w - 2.6} y={y + d + 9.5} width="1.6" height="3.5" fill={kind === 'metal' ? '#5f5b55' : '#8a6a44'} />
        </g>
      )}
    </g>
  );
}

export function Chair({ x, y, s = 1, kind = 'leather' }: { x: number; y: number; s?: number; kind?: 'leather' | 'wood' | 'office' | 'folding' }) {
  const seat = kind === 'leather' ? 'url(#leather)' : kind === 'office' ? '#2e2a2a' : kind === 'folding' ? '#8a8378' : PALETTE.oak;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="4" cy="15.5" rx="5" ry="1.2" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      {kind === 'leather' ? (
        <g>
          <path d="M0 0 Q4 -3 8 0 L7.6 9 L0.4 9 Z" fill={seat} />
          <path d="M1 0.9 Q4 -1.4 7 0.9 L6.6 8 L1.4 8 Z" fill="#000" opacity="0.15" />
          {[2.5, 5.5].map((cx) => [2.5, 5.5].map((cy) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="0.28" fill="#f0d47a" opacity="0.6" />))}
        </g>
      ) : kind === 'wood' ? (
        <g>
          <rect x="0.6" y="0" width="1" height="9" fill={PALETTE.oakDark} />
          <rect x="6.4" y="0" width="1" height="9" fill={PALETTE.oakDark} />
          {[1.5, 4, 6.5].map((yy) => (
            <rect key={yy} x="1" y={yy} width="6" height="1" fill={PALETTE.oak} />
          ))}
        </g>
      ) : (
        <path d="M0.5 0 h7 v9 h-7 Z" fill={seat} />
      )}
      <rect x="-0.4" y="9" width="8.8" height="2.6" rx="0.4" fill={kind === 'leather' ? '#5a160f' : seat} />
      <rect x="-0.4" y="9" width="8.8" height="0.5" fill="#fff" opacity="0.2" />
      {kind === 'office' ? (
        <g>
          <rect x="3.6" y="11.6" width="0.8" height="3" fill="#333" />
          <path d="M0 15 h8" stroke="#333" strokeWidth="0.8" />
        </g>
      ) : (
        <g>
          <rect x="0" y="11.6" width="0.9" height="3.8" fill={PALETTE.oakDark} />
          <rect x="7.1" y="11.6" width="0.9" height="3.8" fill={PALETTE.oakDark} />
        </g>
      )}
    </g>
  );
}

export function Door({ x, y, w, h, color = PALETTE.oak, open = false }: { x: number; y: number; w: number; h: number; color?: string; open?: boolean }) {
  return (
    <g>
      <rect x={x - 0.8} y={y - 0.8} width={w + 1.6} height={h + 0.8} fill={PALETTE.cream} stroke="#5a4a32" strokeWidth="0.25" />
      <rect x={x} y={y} width={w} height={h} fill={open ? '#1b1008' : color} />
      {!open && (
        <g>
          <rect x={x + w * 0.15} y={y + h * 0.08} width={w * 0.7} height={h * 0.36} fill="#000" opacity="0.18" />
          <rect x={x + w * 0.15} y={y + h * 0.52} width={w * 0.7} height={h * 0.4} fill="#000" opacity="0.18" />
          <circle cx={x + w * 0.82} cy={y + h * 0.5} r="0.55" fill="url(#brass)" />
        </g>
      )}
      <rect x={x} y={y} width="0.5" height={h} fill="#fff" opacity="0.15" />
    </g>
  );
}

export function Rug({ x, y, w, h, pattern = 'rug' }: { x: number; y: number; w: number; h: number; pattern?: 'rug' | 'rugBlue' }) {
  const inset = 8;
  return (
    <g>
      <polygon points={pts([[x + inset, y], [x + w - inset, y], [x + w, y + h], [x, y + h]])} fill={`url(#${pattern})`} />
      <polygon points={pts([[x + inset, y], [x + w - inset, y], [x + w, y + h], [x, y + h]])} fill="none" stroke={PALETTE.gold} strokeWidth="0.6" opacity="0.8" />
      <polygon points={pts([[x + inset + 1.5, y + 1], [x + w - inset - 1.5, y + 1], [x + w - 2, y + h - 1], [x + 2, y + h - 1]])} fill="none" stroke={PALETTE.gold} strokeWidth="0.25" opacity="0.6" />
    </g>
  );
}

export function Lamp({ x, y, s = 1, lit = true }: { x: number; y: number; s?: number; lit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {lit && <ellipse cx="0" cy="3" rx="9" ry="7" fill="url(#lamp)" />}
      <polygon points="-4,0 4,0 3,-4 -3,-4" fill={lit ? '#2f5f3a' : '#274a30'} />
      <polygon points="-4,0 4,0 3,-4 -3,-4" fill="#fff" opacity={lit ? 0.18 : 0.05} />
      <rect x="-0.4" y="0" width="0.8" height="5" fill="url(#brass)" />
      <ellipse cx="0" cy="5.2" rx="2" ry="0.6" fill="url(#brass)" />
    </g>
  );
}

export function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="9" rx="4" ry="1" fill="#1a0f08" opacity="0.35" filter="url(#soft)" />
      <path d="M-2.5 4 h5 l-0.6 5 h-3.8 Z" fill="#8a4a2a" />
      <path d="M-2.5 4 h5 l-0.6 5 h-3.8 Z" fill="url(#sideRight)" />
      {[-30, -10, 10, 30, 50, -50].map((a) => (
        <ellipse key={a} cx="0" cy="0" rx="1.6" ry="4.5" fill={a % 20 ? '#2f5a2f' : '#3d7a3d'} transform={`rotate(${a} 0 4)`} />
      ))}
    </g>
  );
}

export function Radiator({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="6" fill="#d8d3c7" stroke="#8a8478" strokeWidth="0.2" />
      {Array.from({ length: Math.floor(w / 1.6) }, (_, i) => (
        <rect key={i} x={x + 0.5 + i * 1.6} y={y + 0.5} width="0.7" height="5" fill="#b9b3a6" />
      ))}
    </g>
  );
}

export function Cabinet({ x, y, w, h, drawers = 4, color = '#6b6660' }: { x: number; y: number; w: number; h: number; drawers?: number; color?: string }) {
  const dh = (h - 1) / drawers;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} stroke="#2a2724" strokeWidth="0.25" />
      {Array.from({ length: drawers }, (_, i) => (
        <g key={i}>
          <rect x={x + 0.6} y={y + 0.6 + i * dh} width={w - 1.2} height={dh - 0.4} fill="#fff" opacity="0.08" />
          <rect x={x + w / 2 - 1.2} y={y + 0.6 + i * dh + dh / 2 - 0.3} width="2.4" height="0.6" rx="0.3" fill="#2a2724" />
        </g>
      ))}
      <rect x={x} y={y} width="0.5" height={h} fill="#fff" opacity="0.12" />
    </g>
  );
}

/** A candle with a small glow. */
export function Candle({ x, y, h = 3, lit = true }: { x: number; y: number; h?: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x - 0.4} y={y - h} width="0.8" height={h} fill="#f3eadb" />
      {lit && (
        <g>
          <ellipse cx={x} cy={y - h - 0.6} rx="0.42" ry="0.8" fill="#ffd166" />
          <ellipse cx={x} cy={y - h - 0.6} rx="0.2" ry="0.45" fill="#fff6d5" />
          <circle cx={x} cy={y - h - 0.6} r="2.4" fill="url(#glow)" opacity="0.6" />
        </g>
      )}
    </g>
  );
}

/** Points helper for scenes that build their own polygons. */
export { pts };
