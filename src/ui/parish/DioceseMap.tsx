import { useRef, useState } from 'react';
import { mapDataById, presetById } from '@/content/dioceses';
import { project } from '@/generation/geo';
import type { World } from '@/types';

const INK = '#3a2a18';
const WATER = '#c9d3cf';
const PAPER = '#efe6d2';

const pts = (ring: [number, number][]) => ring.map(([x, y]) => `${x},${y}`).join(' ');
const path = (rings: [number, number][][]) => rings.map((r) => `M${r.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('');

export interface MapView {
  /** Map units at the center of the view. */
  cx: number;
  cy: number;
  /** 1 shows the whole sheet; 4 shows a quarter of it. */
  zoom: number;
}

/** A view that fits a set of points with a margin, no closer than `maxZoom`. */
export function fitView(points: { x: number; y: number }[], maxZoom = 3): MapView {
  if (!points.length) return { cx: 50, cy: 50, zoom: 1 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const span = Math.max(w, h) * 1.35 + 6;
  const zoom = Math.max(1, Math.min(maxZoom, 100 / span));
  return { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, zoom };
}

/**
 * The map of a diocese on real ground: the coast and the bays, the rivers, the
 * highways, the county lines, the towns, all clipped from Natural Earth and drawn
 * as ink on paper; every church a small red dot, yours ringed, the cathedral a
 * cross. Pans by dragging and zooms by the wheel or the buttons.
 */
export function DioceseMap({ world, hereId, deaneryIds = [], view, onView, onHover }: { world: World; hereId?: string | undefined; deaneryIds?: string[]; view: MapView; onView?: (v: MapView) => void; onHover?: (id: string | null) => void }) {
  const preset = presetById(world.diocese.presetId);
  const data = mapDataById(world.diocese.presetId);
  const here = world.parishes.find((p) => p.id === hereId);
  const deanery = new Set(deaneryIds);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const z = view.zoom;
  const half = 50 / z;
  const vb = `${view.cx - half} ${view.cy - half} ${100 / z} ${100 / z}`;
  const sw = (w: number) => w / z;
  const fs = (s: number) => s / z;
  const clampView = (v: MapView): MapView => {
    const h = 50 / v.zoom;
    return { zoom: Math.max(1, Math.min(8, v.zoom)), cx: Math.max(h, Math.min(100 - h, v.cx)), cy: Math.max(h, Math.min(100 - h, v.cy)) };
  };
  // Labels: the preset's own places and the towns of the land, thinned by zoom so they do not pile up.
  const labels: { name: string; x: number; y: number; big: boolean }[] = [];
  const consider = (name: string, x: number, y: number, big: boolean) => {
    const dx = 11 / z;
    const dy = 3.4 / z;
    if (labels.some((l) => Math.abs(l.x - x) < dx && Math.abs(l.y - y) < dy)) return;
    labels.push({ name, x, y, big });
  };
  for (const t of (data?.towns ?? []).filter((t) => t.rank <= 8).sort((a, b) => a.rank - b.rank)) consider(t.name, t.x, t.y, true);
  if (preset?.map) for (const pl of preset.places ?? []) { const at = project(preset, pl.lat, pl.lon); consider(pl.name.replace(/^the /, ''), at.x, at.y, false); }
  return (
    <svg
      viewBox={vb}
      className="absolute inset-0 h-full w-full select-none"
      style={{ background: PAPER, cursor: drag.current ? 'grabbing' : 'grab' }}
      aria-hidden
      onWheel={(e) => { if (!onView) return; e.preventDefault(); onView(clampView({ ...view, zoom: view.zoom * (e.deltaY < 0 ? 1.25 : 0.8) })); }}
      onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; }}
      onMouseMove={(e) => {
        if (!drag.current || !onView) return;
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const unitsPerPx = (100 / z) / rect.width;
        onView(clampView({ ...view, cx: drag.current.cx - (e.clientX - drag.current.x) * unitsPerPx, cy: drag.current.cy - (e.clientY - drag.current.y) * unitsPerPx }));
      }}
      onMouseUp={() => { drag.current = null; }}
      onMouseLeave={() => { drag.current = null; }}
    >
      <defs>
        <pattern id="mapgrain" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={PAPER} />
          <circle cx="1" cy="1" r="0.25" fill="#e2d7bd" />
          <circle cx="3" cy="3" r="0.2" fill="#e6dcc4" />
        </pattern>
      </defs>
      <rect x="-20" y="-20" width="140" height="140" fill="url(#mapgrain)" />
      {/* the built-up land, faintly */}
      {data?.urban.map((r, i) => <polygon key={`u${i}`} points={pts(r)} fill="#dcccaa" opacity="0.45" />)}
      {/* the sea, the bays, the lakes */}
      {data?.water.map((rings, i) => <path key={`w${i}`} d={path(rings)} fill={WATER} fillRule="evenodd" stroke="#8a9a96" strokeWidth={sw(0.25)} />)}
      {data?.lakes.map((l, i) => <path key={`l${i}`} d={path(l.rings)} fill={WATER} stroke="#8a9a96" strokeWidth={sw(0.2)} />)}
      {data?.rivers.map((r, i) => <polyline key={`r${i}`} points={pts(r.line)} fill="none" stroke="#8a9a96" strokeWidth={sw(0.45)} strokeLinecap="round" strokeLinejoin="round" />)}
      {/* the county lines, then the state lines */}
      {data?.counties.map((l, i) => <polyline key={`c${i}`} points={pts(l)} fill="none" stroke="#9a8a6a" strokeWidth={sw(0.18)} strokeDasharray={`${sw(0.8)} ${sw(0.6)}`} opacity="0.8" />)}
      {data?.states.map((l, i) => <polyline key={`s${i}`} points={pts(l)} fill="none" stroke="#7a6a4a" strokeWidth={sw(0.4)} strokeDasharray={`${sw(1.6)} ${sw(0.8)}`} />)}
      {/* the highways */}
      {data?.roads.filter((r) => r.kind === 'minor').map((r, i) => <polyline key={`m${i}`} points={pts(r.line)} fill="none" stroke="#b9a482" strokeWidth={sw(0.28)} strokeLinejoin="round" />)}
      {data?.roads.filter((r) => r.kind === 'major').map((r, i) => <polyline key={`h${i}`} points={pts(r.line)} fill="none" stroke="#8a6a3a" strokeWidth={sw(0.42)} strokeLinejoin="round" />)}
      {/* the names of places */}
      {labels.map((l) => (
        <text key={`${l.name}:${l.x}:${l.y}`} x={l.x} y={l.y - fs(1.2)} fontSize={fs(l.big ? 2.3 : 1.8)} textAnchor="middle" fill="#5a4a2a" fontFamily="serif" fontStyle={l.big ? 'normal' : 'italic'} opacity={l.big ? 0.95 : 0.8} style={{ paintOrder: 'stroke', stroke: PAPER, strokeWidth: fs(0.6) }}>{l.name}</text>
      ))}
      {/* the deanery's lines */}
      {here && deanery.size > 0 && world.parishes.filter((p) => deanery.has(p.id)).map((p) => (
        <line key={`d${p.id}`} x1={here.x ?? 50} y1={here.y ?? 50} x2={p.x ?? 50} y2={p.y ?? 50} stroke="#7a1f1f" strokeWidth={sw(0.25)} opacity="0.5" />
      ))}
      {/* every church a small red dot */}
      {world.parishes.map((p) => {
        const x = p.x ?? 50;
        const y = p.y ?? 50;
        const mine = p.id === here?.id;
        const r = mine ? sw(1.1) : sw(0.75);
        return (
          <g key={p.id} onMouseEnter={() => onHover?.(p.id)} onMouseLeave={() => onHover?.(null)} style={{ cursor: 'default' }}>
            {deanery.has(p.id) && !mine && <circle cx={x} cy={y} r={r + sw(1.1)} fill="none" stroke="#7a1f1f" strokeWidth={sw(0.3)} />}
            {p.cathedral ? (
              <g>
                <rect x={x - sw(0.4)} y={y - sw(2.4)} width={sw(0.8)} height={sw(4.8)} fill={INK} />
                <rect x={x - sw(1.6)} y={y - sw(1.3)} width={sw(3.2)} height={sw(0.8)} fill={INK} />
              </g>
            ) : (
              <circle cx={x} cy={y} r={r} fill="#b91c1c" stroke={mine ? '#e6c25a' : PAPER} strokeWidth={mine ? sw(0.5) : sw(0.25)} />
            )}
            {mine && <circle cx={x} cy={y} r={r + sw(1.6)} fill="none" stroke="#7a1f1f" strokeWidth={sw(0.35)} />}
            <circle cx={x} cy={y} r={sw(2.6)} fill="transparent" />
          </g>
        );
      })}
      <text x={view.cx} y={view.cy + half - fs(2)} fontSize={fs(2.2)} textAnchor="middle" fill={INK} fontFamily="serif">{world.diocese.visible.see}</text>
    </svg>
  );
}

/** The zoom buttons, kept outside the drawing. */
export function MapControls({ view, onView, home }: { view: MapView; onView: (v: MapView) => void; home: MapView }) {
  const set = (zoom: number) => onView({ ...view, zoom: Math.max(1, Math.min(8, zoom)) });
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1">
      <button className="pbtn h-6 w-6 px-0 py-0 text-xs" title="Closer" onClick={() => set(view.zoom * 1.5)}>+</button>
      <button className="pbtn h-6 w-6 px-0 py-0 text-xs" title="Farther" onClick={() => set(view.zoom / 1.5)}>−</button>
      <button className="pbtn h-6 w-6 px-0 py-0 text-[10px]" title="Back to the parishes" onClick={() => onView(home)}>⌂</button>
    </div>
  );
}

/** Keep the view in state, starting fitted to the parishes. */
export function useMapView(home: MapView): [MapView, (v: MapView) => void] {
  const [view, setView] = useState<MapView>(home);
  return [view, setView];
}
