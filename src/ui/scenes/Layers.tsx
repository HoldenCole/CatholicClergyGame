import type { AmbientItem } from '@/types';
import { paintedLayer } from './art';

/** A layer that prefers a painted PNG and falls back to the SVG children. */
export function Layer({ scene, layer, variant, x = 0, y = 0, w = 100, h = 60, children }: { scene: string; layer: string; variant: string; x?: number; y?: number; w?: number; h?: number; children: React.ReactNode }) {
  const painted = paintedLayer(scene, layer, variant);
  if (painted) return <image href={painted} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />;
  return <g data-layer={layer} data-variant={variant}>{children}</g>;
}

/* ---------- church variants ---------- */

export function Sanctuary({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="sanctuary" variant={variant}>
      {variant === 'high_altar' && (
        <g>
          <rect x="40" y="10" width="20" height="14" fill="#e8dcc0" stroke="#c9a24a" strokeWidth="0.4" />
          {[42, 46, 50, 54, 58].map((x) => (
            <rect key={x} x={x} y="11" width="1.5" height="12" fill="#c9a24a" opacity="0.6" />
          ))}
          <rect x="43" y="24" width="14" height="6" fill="#f3eee0" stroke="#c9a24a" strokeWidth="0.4" />
          {[44, 47, 50, 53, 56].map((x) => (
            <rect key={x} x={x} y="20" width="0.8" height="4" fill="#f5f0dc" />
          ))}
        </g>
      )}
      {variant === 'plain' && (
        <g>
          <rect x="44" y="12" width="12" height="10" fill="#7a3f19" opacity="0.5" />
          <rect x="40" y="24" width="20" height="8" fill="#e8dcc0" stroke="#7a6a4a" strokeWidth="0.3" />
          <rect x="30" y="32" width="40" height="8" fill="#7a1f1f" opacity="0.35" />
        </g>
      )}
      {variant === 'modern' && (
        <g>
          <rect x="24" y="8" width="52" height="32" fill="#d9d3c5" />
          <rect x="48" y="8" width="4" height="32" fill="url(#sky)" />
          <rect x="42" y="26" width="16" height="6" fill="#b5ada0" />
          <rect x="49.5" y="12" width="1" height="12" fill="#3a2a14" />
          <rect x="46" y="15" width="8" height="1" fill="#3a2a14" />
        </g>
      )}
      {(variant === 'restored' || variant === 'gothic') && (
        <g>
          <rect x="36" y="8" width="28" height="24" fill={variant === 'gothic' ? '#1f3a6e' : '#e8dcc0'} stroke="#c9a24a" strokeWidth="0.5" />
          <path d="M40 16 Q50 4 60 16" fill="none" stroke="#c9a24a" strokeWidth="0.8" />
          {[40, 45, 50, 55, 60].map((x) => (
            <path key={x} d={`M${x - 2} 22 Q${x} 16 ${x + 2} 22`} fill="none" stroke="#c9a24a" strokeWidth="0.5" />
          ))}
          <rect x="42" y="24" width="16" height="7" fill="#f3eee0" stroke="#c9a24a" strokeWidth="0.4" />
          {[43, 46, 49, 52, 55, 58].map((x) => (
            <rect key={x} x={x} y="20" width="0.8" height="4" fill="#f5f0dc" />
          ))}
        </g>
      )}
    </Layer>
  );
}

export function AltarRail({ variant }: { variant: string }) {
  if (variant === 'none') return null;
  const color = variant === 'marble' ? '#e9e2cc' : '#7a3f19';
  return (
    <Layer scene="church" layer="altar_rail" variant={variant}>
      <rect x="24" y="38" width="52" height="1.4" fill={color} stroke="#3a2a14" strokeWidth="0.2" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={25 + i * 4} y="39.4" width="0.9" height="3" fill={color} />
      ))}
      <rect x="47" y="38" width="6" height="1.4" fill="#c9a24a" />
    </Layer>
  );
}

export function Orientation({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="orientation" variant={variant}>
      {variant === 'orientem' ? (
        <g>
          <rect x="47" y="30" width="6" height="5" fill="#0c0a09" />
          <circle cx="50" cy="29.5" r="1.4" fill="#e8caa0" />
        </g>
      ) : (
        <g>
          <rect x="47" y="32" width="6" height="6" fill="#0c0a09" />
          <circle cx="50" cy="31.5" r="1.4" fill="#e8caa0" />
        </g>
      )}
    </Layer>
  );
}

export function Confessionals({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="confessionals" variant={variant}>
      {(variant === 'booths' || variant === 'both') && (
        <g>
          <rect x="64" y="24" width="12" height="16" fill="url(#wood)" stroke="#3f1d0b" strokeWidth="0.3" />
          <rect x="68" y="27" width="4" height="12" fill="#1c1917" />
          <rect x="64" y="21" width="12" height="3" fill="#7a3f19" />
        </g>
      )}
      {(variant === 'room' || variant === 'both') && (
        <g>
          <rect x="80" y="26" width="10" height="14" fill="#d8c8a0" stroke="#7a6a4a" strokeWidth="0.3" />
          <rect x="84" y="30" width="3" height="10" fill="#7a3f19" />
          <rect x="81" y="27" width="8" height="1" fill="#c9a24a" opacity="0.6" />
        </g>
      )}
    </Layer>
  );
}

export function Choir({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="choir" variant={variant}>
      {variant === 'loft' && (
        <g>
          <rect x="30" y="44" width="40" height="3" fill="#5a2a0e" opacity="0.5" />
          {[34, 40, 46, 52, 58, 64].map((x) => (
            <rect key={x} x={x} y="41" width="3" height="3" fill="#3a2a14" opacity="0.5" />
          ))}
        </g>
      )}
      {variant === 'front' && (
        <g>
          <rect x="24" y="30" width="12" height="6" fill="#7a3f19" opacity="0.6" />
          <rect x="26" y="26" width="1" height="4" fill="#1c1917" />
          <rect x="31" y="27" width="4" height="3" fill="#1c1917" />
          <circle cx="29" cy="25" r="1" fill="#e8caa0" />
        </g>
      )}
      {variant === 'schola' && (
        <g>
          {[25, 28, 31].map((x) => (
            <rect key={x} x={x} y="28" width="1.6" height="5" fill="#1c1917" />
          ))}
          <rect x="24" y="33" width="10" height="1" fill="#7a3f19" />
        </g>
      )}
    </Layer>
  );
}

export function Statues({ variant }: { variant: string }) {
  if (variant === 'none') return null;
  const spots = variant === 'many' ? [3, 9, 15, 85, 91, 97] : [9, 91];
  return (
    <Layer scene="church" layer="statues" variant={variant}>
      {spots.map((x) => (
        <g key={x}>
          <rect x={x - 1.2} y="26" width="2.4" height="6" fill="#e8dcc0" />
          <circle cx={x} cy="25" r="1" fill="#e8caa0" />
          <rect x={x - 1.6} y="32" width="3.2" height="1" fill="#7a6a4a" />
          <rect x={x - 0.4} y="33.5" width="0.8" height="1.5" fill="#f5c542" opacity="0.7" />
        </g>
      ))}
    </Layer>
  );
}

export function Tabernacle({ variant }: { variant: string }) {
  return (
    <Layer scene="church" layer="tabernacle" variant={variant}>
      {variant === 'center' ? (
        <rect x="47.5" y="18" width="5" height="4.5" fill="#c9a24a" stroke="#5a3a12" strokeWidth="0.3" />
      ) : (
        <g>
          <rect x="24" y="12" width="10" height="10" fill="#e8dcc0" stroke="#c9a24a" strokeWidth="0.3" />
          <rect x="27" y="16" width="4" height="3.5" fill="#c9a24a" />
          <circle cx="29" cy="14" r="0.8" fill="#f5c542" opacity="0.7" />
        </g>
      )}
    </Layer>
  );
}

/* ---------- personal items ---------- */

export function WallItem({ scene, variant, x, y }: { scene: string; variant: string; x: number; y: number }) {
  return (
    <Layer scene={scene} layer="wall" variant={variant} x={x} y={y} w={12} h={14}>
      {variant === 'icon' && (
        <g>
          <rect x={x} y={y} width="8" height="10" fill="#b8892f" stroke="#5a3a12" strokeWidth="0.3" />
          <rect x={x + 0.7} y={y + 0.7} width="6.6" height="8.6" fill="#c9a24a" />
          <path d={`M${x + 4} ${y + 2} C${x + 6} ${y + 2} ${x + 6.5} ${y + 5} ${x + 5.5} ${y + 9} L${x + 2.5} ${y + 9} C${x + 1.5} ${y + 5} ${x + 2} ${y + 2} ${x + 4} ${y + 2} Z`} fill="#1f3a6e" />
          <circle cx={x + 4} cy={y + 2.6} r="1" fill="#e8caa0" />
        </g>
      )}
      {variant === 'pope' && (
        <g>
          <rect x={x} y={y} width="8" height="10" fill="#f3eee0" stroke="#c9a24a" strokeWidth="0.5" />
          <circle cx={x + 4} cy={y + 4} r="1.8" fill="#e8caa0" />
          <rect x={x + 2} y={y + 6} width="4" height="3.5" fill="#f5f5f4" />
          <rect x={x + 3} y={y + 1.6} width="2" height="1" fill="#f5f5f4" />
        </g>
      )}
      {variant === 'photos' && (
        <g>
          {[0, 4.5, 9].map((dx) => (
            <rect key={dx} x={x + dx} y={y + (dx % 9) * 0.3} width="3.6" height="4" fill="#d9d0b6" stroke="#5a3a12" strokeWidth="0.2" />
          ))}
          <rect x={x + 2} y={y + 6} width="6" height="4" fill="#d9d0b6" stroke="#5a3a12" strokeWidth="0.2" />
        </g>
      )}
      {variant === 'family' && (
        <g>
          {[0, 5].map((dx) => (
            <rect key={dx} x={x + dx} y={y} width="4.4" height="5" fill="#d9d0b6" stroke="#5a3a12" strokeWidth="0.2" />
          ))}
          <rect x={x + 2.5} y={y + 6} width="4.4" height="5" fill="#d9d0b6" stroke="#5a3a12" strokeWidth="0.2" />
        </g>
      )}
    </Layer>
  );
}

export function CornerItem({ scene, variant, x, y }: { scene: string; variant: string; x: number; y: number }) {
  return (
    <Layer scene={scene} layer="corner" variant={variant} x={x - 8} y={y - 12} w={18} h={26}>
      {variant === 'plant' && (
        <g>
          <rect x={x - 2} y={y + 4} width="4" height="5" fill="#7a3f19" />
          <ellipse cx={x} cy={y} rx="4" ry="5" fill="#2f5a2f" />
          <ellipse cx={x - 2} cy={y - 3} rx="2" ry="3" fill="#3a6f3a" />
        </g>
      )}
      {variant === 'files' && (
        <g>
          <rect x={x - 4} y={y - 8} width="8" height="18" fill="#57534e" stroke="#292524" strokeWidth="0.3" />
          {[-6, -1, 4].map((dy) => (
            <rect key={dy} x={x - 3} y={y + dy} width="6" height="0.8" fill="#292524" />
          ))}
        </g>
      )}
      {variant === 'chapel' && (
        <g>
          <rect x={x - 3} y={y + 4} width="6" height="2" fill="#7a3f19" />
          <rect x={x - 1.5} y={y - 6} width="3" height="4" fill="#c9a24a" />
          <circle cx={x + 4} cy={y - 4} r="0.9" fill="#f5c542" opacity="0.8" />
        </g>
      )}
      {variant === 'tv' && (
        <g>
          <rect x={x - 5} y={y - 4} width="10" height="7" fill="#0c0a09" stroke="#57534e" strokeWidth="0.3" />
          <rect x={x - 2} y={y + 3} width="4" height="1" fill="#57534e" />
        </g>
      )}
      {variant === 'books' && (
        <g>
          <rect x={x - 4} y={y - 2} width="8" height="7" fill="#7a1f1f" />
          <rect x={x - 3} y={y - 6} width="6" height="4" fill="#9b2f2f" />
          <rect x={x + 5} y={y - 8} width="0.8" height="10" fill="#a8a29e" />
          <polygon points={`${x + 3},${y - 8} ${x + 8},${y - 8} ${x + 6.5},${y - 5} ${x + 4.5},${y - 5}`} fill="#f5c542" opacity="0.6" />
        </g>
      )}
    </Layer>
  );
}

/* ---------- reactive items ---------- */

export function Ambient({ scene, items, anchor }: { scene: string; items: AmbientItem[]; anchor: { books: [number, number]; wall: [number, number]; desk: [number, number] } }) {
  const [bx, by] = anchor.books;
  const [wx, wy] = anchor.wall;
  const [dx, dy] = anchor.desk;
  let wallOffset = 0;
  return (
    <g>
      {items.map((it) => {
        const key = `${it.layer}:${it.variant}`;
        switch (it.layer) {
          case 'books': {
            const rows = it.variant === 'wall' ? 4 : it.variant === 'many' ? 3 : it.variant === 'some' ? 2 : 1;
            return (
              <Layer key={key} scene={scene} layer="books" variant={it.variant} x={bx} y={by} w={14} h={rows * 4 + 1}>
                {Array.from({ length: rows }, (_, r) => (
                  <g key={r}>
                    <rect x={bx} y={by + r * 4 + 3.4} width="14" height="0.6" fill="#8a5a1a" />
                    {Array.from({ length: 6 }, (_, i) => (
                      <rect key={i} x={bx + 0.5 + i * 2.2} y={by + r * 4} width="1.8" height="3.4" fill={['#7c2d12', '#1e3a8a', '#365314', '#5a3a12', '#7a1f1f', '#3a2a14'][(i + r) % 6]} />
                    ))}
                  </g>
                ))}
              </Layer>
            );
          }
          case 'prayer':
            return (
              <Layer key={key} scene={scene} layer="prayer" variant={it.variant} x={dx + 30} y={dy - 6} w={4} h={6}>
                {it.variant === 'candle' ? (
                  <g>
                    <rect x={dx + 31} y={dy - 4} width="1.2" height="4" fill="#f3eee0" />
                    <circle cx={dx + 31.6} cy={dy - 4.6} r="0.8" fill="#f5c542" />
                  </g>
                ) : (
                  <rect x={dx + 30} y={dy - 1.5} width="4" height="1.5" fill="#1c1917" opacity="0.7" />
                )}
              </Layer>
            );
          case 'clippings':
            return (
              <Layer key={key} scene={scene} layer="clippings" variant={it.variant} x={wx + 12} y={wy} w={8} h={6}>
                {[0, 3, 6].map((o) => (
                  <rect key={o} x={wx + 12 + o} y={wy + (o % 2)} width="2.6" height="3.4" fill="#f3eee0" opacity="0.9" transform={`rotate(${o - 3} ${wx + 13 + o} ${wy + 2})`} />
                ))}
              </Layer>
            );
          case 'desk_state':
            return (
              <Layer key={key} scene={scene} layer="desk_state" variant={it.variant} x={dx} y={dy - 3} w={12} h={3}>
                {it.variant === 'piles' ? (
                  <g>
                    {[0, 3, 6].map((o) => (
                      <rect key={o} x={dx + o} y={dy - 2 - (o % 3)} width="3" height={2 + (o % 3)} fill="#f3eee0" opacity="0.9" />
                    ))}
                  </g>
                ) : (
                  <rect x={dx + 2} y={dy - 1} width="6" height="0.6" fill="#f3eee0" />
                )}
              </Layer>
            );
          case 'family':
            return (
              <Layer key={key} scene={scene} layer="family" variant={it.variant} x={dx + 40} y={dy - 5} w={5} h={5}>
                <rect x={dx + 40} y={dy - 5} width="4" height="4.5" fill="#d9d0b6" stroke="#5a3a12" strokeWidth="0.2" />
                <circle cx={dx + 42} cy={dy - 3.2} r="0.9" fill="#e8caa0" />
              </Layer>
            );
          case 'diploma': {
            wallOffset += 1;
            return (
              <Layer key={key} scene={scene} layer="diploma" variant={it.variant} x={wx} y={wy + 14} w={7} h={5}>
                <rect x={wx} y={wy + 14} width="7" height="5" fill="#f3eee0" stroke="#c9a24a" strokeWidth="0.4" />
                <rect x={wx + 1} y={wy + 15.5} width="5" height="0.5" fill="#57534e" />
                <rect x={wx + 1.5} y={wy + 17} width="4" height="0.5" fill="#57534e" />
              </Layer>
            );
          }
          case 'archetype':
            return (
              <Layer key={key} scene={scene} layer="archetype" variant={it.variant} x={wx + 24} y={wy + 12} w={10} h={8}>
                {it.variant === 'map' && <rect x={wx + 24} y={wy + 12} width="10" height="7" fill="#d8c8a0" stroke="#5a3a12" strokeWidth="0.3" />}
                {it.variant === 'chalkboard' && <rect x={wx + 24} y={wy + 12} width="10" height="7" fill="#1f2f24" stroke="#7a3f19" strokeWidth="0.4" />}
                {it.variant === 'journals' && [0, 2, 4].map((o) => <rect key={o} x={dx + 44 + o} y={dy - 2.5 - o * 0.4} width="3" height="2.5" fill="#f3eee0" />)}
                {it.variant === 'binders' && [0, 2.5, 5].map((o) => <rect key={o} x={dx + 44 + o} y={dy - 4} width="2" height="4" fill={['#1e3a8a', '#7a1f1f', '#365314'][o / 2.5]} />)}
                {it.variant === 'gifts' && (
                  <g>
                    <rect x={dx + 44} y={dy - 3} width="2.5" height="3" fill="#7a3f19" />
                    <rect x={dx + 47} y={dy - 2} width="3" height="2" fill="#f3eee0" />
                    <circle cx={dx + 51.5} cy={dy - 1.5} r="1.2" fill="#2f5a2f" />
                  </g>
                )}
              </Layer>
            );
          default:
            if (it.layer.startsWith('achievement:')) {
              const idx = wallOffset++;
              const ax = wx + 12 + (idx % 3) * 4;
              const ay = wy + 8 + Math.floor(idx / 3) * 5;
              const kind = it.layer.split(':')[1];
              return (
                <Layer key={key} scene={scene} layer={it.layer.replace(':', '_')} variant={it.variant} x={ax} y={ay} w={3.5} h={4}>
                  <rect x={ax} y={ay} width="3.5" height="4" fill={kind === 'plaque' ? '#7a3f19' : kind === 'photo' ? '#d9d0b6' : '#f3eee0'} stroke="#c9a24a" strokeWidth="0.3" />
                </Layer>
              );
            }
            if (it.layer === 'room') {
              return (
                <Layer key={key} scene={scene} layer="room" variant={it.variant} x={dx} y={dy} w={10} h={8}>
                  {it.variant === 'sports' && <rect x={dx} y={dy + 4} width="5" height="2" fill="#1c1917" />}
                  {it.variant === 'kneeler' && <rect x={dx} y={dy + 2} width="8" height="3" fill="#7a3f19" />}
                  {it.variant === 'papers' && [0, 3].map((o) => <rect key={o} x={dx + o} y={dy + 1} width="3" height="2.5" fill="#f3eee0" />)}
                  {it.variant === 'stole' && <rect x={dx + 2} y={dy - 2} width="1.5" height="8" fill="#2f5a2f" />}
                </Layer>
              );
            }
            return null;
        }
      })}
    </g>
  );
}
