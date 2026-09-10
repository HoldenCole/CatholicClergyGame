import type { AmbientItem } from '@/types';
import { PALETTE } from './defs';
import { Bookcase, Candle, Frame, Plant, Cabinet } from './primitives';
import { Layer } from './layer';

/* ---------- the man's own choices: wall and corner ---------- */

export function WallItem({ scene, variant, x, y }: { scene: string; variant: string; x: number; y: number }) {
  return (
    <Layer scene={scene} layer="wall" variant={variant} x={x} y={y} w={14} h={12}>
      {variant === 'icon' && (
        <Frame x={x} y={y} w={8} h={10} mat="url(#brass)" gilt>
          <path d={`M${x + 4} ${y + 2.2} C${x + 6} ${y + 2.2} ${x + 6.6} ${y + 5} ${x + 5.6} ${y + 9} L${x + 2.4} ${y + 9} C${x + 1.4} ${y + 5} ${x + 2} ${y + 2.2} ${x + 4} ${y + 2.2} Z`} fill="#1f3a6e" />
          <path d={`M${x + 4} ${y + 4} C${x + 5.2} ${y + 4} ${x + 5.6} ${y + 6} ${x + 5} ${y + 8} L${x + 3} ${y + 8} C${x + 2.4} ${y + 6} ${x + 2.8} ${y + 4} ${x + 4} ${y + 4} Z`} fill="#7a1f1f" />
          <circle cx={x + 4} cy={y + 2.8} r="1" fill="#e3c69c" />
          <circle cx={x + 4} cy={y + 2.8} r="1.5" fill="none" stroke={PALETTE.gold} strokeWidth="0.3" />
          <circle cx={x + 4.9} cy={y + 5.4} r="0.7" fill="#e3c69c" />
        </Frame>
      )}
      {variant === 'pope' && (
        <Frame x={x} y={y} w={8} h={10} gilt>
          <rect x={x + 0.6} y={y + 0.6} width="6.8" height="8.8" fill="#c9c0b0" />
          <circle cx={x + 4} cy={y + 4} r="1.7" fill="#e3c69c" />
          <path d={`M${x + 2.2} ${y + 9.4} Q${x + 4} ${y + 5.5} ${x + 5.8} ${y + 9.4} Z`} fill="#f5f5f4" />
          <rect x={x + 3} y={y + 1.9} width="2" height="0.9" rx="0.3" fill="#f5f5f4" />
        </Frame>
      )}
      {variant === 'photos' && (
        <g>
          {[0, 4.6, 9.2].map((dx, i) => (
            <Frame key={dx} x={x + dx} y={y + (i % 2) * 0.6} w={4} h={4.4} mat="#d9d0b6">
              <rect x={x + dx + 0.9} y={y + (i % 2) * 0.6 + 0.9} width="2.2" height="2.6" fill={['#8a9aa8', '#a8b08a', '#b89a8a'][i]} />
            </Frame>
          ))}
          <Frame x={x + 2.5} y={y + 6} w={7} h={5} mat="#d9d0b6">
            <rect x={x + 3.4} y={y + 6.9} width="5.2" height="3.2" fill="#8a9aa8" />
          </Frame>
        </g>
      )}
      {variant === 'family' && (
        <g>
          {[0, 5.2].map((dx) => (
            <Frame key={dx} x={x + dx} y={y} w={4.6} h={5.4} mat="#d9d0b6">
              <circle cx={x + dx + 2.3} cy={y + 2.4} r="0.9" fill="#e3c69c" />
              <circle cx={x + dx + 1.4} cy={y + 3.2} r="0.7" fill="#e3c69c" />
              <circle cx={x + dx + 3.2} cy={y + 3.2} r="0.7" fill="#e3c69c" />
            </Frame>
          ))}
          <Frame x={x + 2.6} y={y + 6.2} w={4.6} h={5.4} mat="#d9d0b6">
            <circle cx={x + 4.9} cy={y + 8.6} r="1" fill="#e3c69c" />
          </Frame>
        </g>
      )}
    </Layer>
  );
}

export function CornerItem({ scene, variant, x, y }: { scene: string; variant: string; x: number; y: number }) {
  return (
    <Layer scene={scene} layer="corner" variant={variant} x={x - 8} y={y - 14} w={18} h={28}>
      {variant === 'plant' && <Plant x={x} y={y - 2} s={1.5} />}
      {variant === 'files' && <Cabinet x={x - 4.5} y={y - 10} w={9} h={22} drawers={4} />}
      {variant === 'chapel' && (
        <g>
          <rect x={x - 3.5} y={y + 6} width="7" height="2.4" fill="url(#wood)" />
          <rect x={x - 3.5} y={y + 8.4} width="7" height="1.4" fill="#5a1414" />
          <Frame x={x - 2} y={y - 7} w={4} h={5} mat="url(#brass)" gilt>
            <path d={`M${x} ${y - 5.8} C${x + 1.2} ${y - 5.8} ${x + 1.4} ${y - 4} ${x + 1} ${y - 2.6} L${x - 1} ${y - 2.6} C${x - 1.4} ${y - 4} ${x - 1.2} ${y - 5.8} ${x} ${y - 5.8} Z`} fill="#1f3a6e" />
          </Frame>
          <Candle x={x + 4} y={y + 6} h={2} lit />
          <rect x={x + 3} y={y + 6} width="2" height="0.6" fill="url(#brass)" />
        </g>
      )}
      {variant === 'tv' && (
        <g>
          <rect x={x - 5.5} y={y - 4} width="11" height="7.5" rx="0.4" fill="#0c0a09" stroke="#3f3a35" strokeWidth="0.4" />
          <rect x={x - 4.8} y={y - 3.3} width="9.6" height="6" fill="#1e3a5a" />
          <rect x={x - 4.8} y={y - 3.3} width="9.6" height="6" fill="url(#lamp)" />
          <rect x={x - 2} y={y + 3.5} width="4" height="1" fill="#3f3a35" />
          <rect x={x - 6} y={y + 4.5} width="12" height="5" fill="url(#wood)" />
        </g>
      )}
      {variant === 'books' && (
        <g>
          <path d={`M${x - 5} ${y - 4} q0 -3 3 -3 h4 q3 0 3 3 v9 h-10 Z`} fill="url(#leather)" />
          <rect x={x - 4} y={y + 1} width="8" height="4" fill="#5a160f" />
          <rect x={x - 6} y={y + 5} width="12" height="1.2" fill={PALETTE.oakDark} />
          <rect x={x + 6.5} y={y - 10} width="0.8" height="16" fill="url(#brass)" />
          <polygon points={`${x + 4},${y - 10} ${x + 9.8},${y - 10} ${x + 8.6},${y - 6.5} ${x + 5.2},${y - 6.5}`} fill="#e6c96a" opacity="0.9" />
          <ellipse cx={x + 6.9} cy={y - 4} rx="7" ry="6" fill="url(#lamp)" />
          <rect x={x - 5} y={y - 2} width="3" height="0.8" fill="#f3eee0" opacity="0.6" />
        </g>
      )}
    </Layer>
  );
}

/* ---------- what the room shows because of who he is ---------- */

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
            const rows = it.variant === 'wall' ? 5 : it.variant === 'many' ? 4 : it.variant === 'some' ? 2 : 1;
            const density = it.variant === 'few' ? 0.4 : 1;
            return (
              <Layer key={key} scene={scene} layer="books" variant={it.variant} x={bx} y={by} w={12} h={rows * 6}>
                <Bookcase x={bx} y={by} w={12} h={rows * 6 + 1} rows={rows} density={density} />
              </Layer>
            );
          }
          case 'prayer':
            return (
              <Layer key={key} scene={scene} layer="prayer" variant={it.variant} x={dx + 34} y={dy - 6} w={6} h={7}>
                {it.variant === 'candle' ? (
                  <g>
                    <Candle x={dx + 36} y={dy} h={3.4} lit />
                    <rect x={dx + 35} y={dy} width="2" height="0.7" fill="url(#brass)" />
                    <rect x={dx + 38} y={dy - 1.6} width="3.6" height="1.6" fill="#1c1917" />
                    <rect x={dx + 38.3} y={dy - 1.4} width="3" height="0.4" fill="#f3eee0" />
                  </g>
                ) : (
                  <g>
                    <rect x={dx + 34} y={dy - 1.4} width="4.6" height="1.4" fill="#1c1917" opacity="0.8" />
                    <rect x={dx + 33} y={dy - 2.4} width="5" height="1.1" fill="#f3eee0" transform={`rotate(-5 ${dx + 35} ${dy - 2})`} />
                    <rect x={dx + 34} y={dy - 3.2} width="5" height="1.1" fill="#f3eee0" transform={`rotate(6 ${dx + 36} ${dy - 3})`} />
                  </g>
                )}
              </Layer>
            );
          case 'clippings':
            return (
              <Layer key={key} scene={scene} layer="clippings" variant={it.variant} x={wx - 14} y={wy} w={10} h={7}>
                {[0, 3.2, 6.4].map((o) => (
                  <g key={o}>
                    <rect x={wx - 14 + o} y={wy + (o % 2)} width="2.8" height="3.8" fill="#f3eee0" opacity="0.95" transform={`rotate(${o - 3} ${wx - 13 + o} ${wy + 2})`} />
                    {[0.8, 1.6, 2.4].map((ly) => (
                      <rect key={ly} x={wx - 13.6 + o} y={wy + (o % 2) + ly} width="2" height="0.3" fill="#8a8478" transform={`rotate(${o - 3} ${wx - 13 + o} ${wy + 2})`} />
                    ))}
                    <circle cx={wx - 12.6 + o} cy={wy + (o % 2) + 0.3} r="0.3" fill="#b91c1c" />
                  </g>
                ))}
              </Layer>
            );
          case 'desk_state':
            return (
              <Layer key={key} scene={scene} layer="desk_state" variant={it.variant} x={dx} y={dy - 4} w={14} h={4}>
                {it.variant === 'piles' ? (
                  <g>
                    {[0, 3.4, 6.8, 10].map((o, i) => (
                      <g key={o}>
                        {Array.from({ length: 3 + (i % 3) }, (_, j) => (
                          <rect key={j} x={dx + 4 + o + (j % 2) * 0.3} y={dy - 0.6 - j * 0.5} width="3.2" height="0.5" fill={j % 2 ? '#f3eee0' : '#e9e2cc'} stroke="#b9b3a6" strokeWidth="0.1" />
                        ))}
                      </g>
                    ))}
                  </g>
                ) : (
                  <g>
                    <rect x={dx + 6} y={dy - 0.9} width="6" height="0.9" fill="#f3eee0" />
                    <rect x={dx + 13} y={dy - 1.2} width="1.2" height="1.2" fill="#1c1917" />
                    <rect x={dx + 14.6} y={dy - 0.5} width="3" height="0.5" fill="#b91c1c" />
                  </g>
                )}
              </Layer>
            );
          case 'family':
            return (
              <Layer key={key} scene={scene} layer="family" variant={it.variant} x={dx + 44} y={dy - 5} w={5} h={5}>
                <Frame x={dx + 44} y={dy - 5} w={4} h={4.6} mat="#d9d0b6">
                  {it.variant === 'mother' ? (
                    <circle cx={dx + 46} cy={dy - 2.8} r="1" fill="#e3c69c" />
                  ) : (
                    <g>
                      <circle cx={dx + 45.4} cy={dy - 2.9} r="0.6" fill="#e3c69c" />
                      <circle cx={dx + 46.6} cy={dy - 2.9} r="0.6" fill="#e3c69c" />
                      <circle cx={dx + 46} cy={dy - 1.9} r="0.5" fill="#e3c69c" />
                    </g>
                  )}
                </Frame>
              </Layer>
            );
          case 'diploma':
            return (
              <Layer key={key} scene={scene} layer="diploma" variant={it.variant} x={wx} y={wy + 14} w={8} h={6}>
                <Frame x={wx} y={wy + 14} w={7.5} h={5.5} mat="#f3eee0" gilt>
                  <rect x={wx + 1.2} y={wy + 15.6} width="5" height="0.4" fill="#57534e" />
                  <rect x={wx + 1.8} y={wy + 16.6} width="3.8" height="0.4" fill="#57534e" />
                  <rect x={wx + 2.4} y={wy + 17.6} width="2.6" height="0.4" fill="#57534e" />
                  <circle cx={wx + 5.8} cy={wy + 18.3} r="0.6" fill="#b91c1c" />
                </Frame>
              </Layer>
            );
          case 'archetype':
            return (
              <Layer key={key} scene={scene} layer="archetype" variant={it.variant} x={wx - 26} y={wy + 12} w={12} h={9}>
                {it.variant === 'map' && (
                  <Frame x={wx - 26} y={wy + 12} w={11} h={8} mat="#e8dcc0">
                    <path d={`M${wx - 24} ${wy + 15} q3 -2 5 0 t4 1 M${wx - 24} ${wy + 17.5} q2 1 4 -0.5 t3 0.5`} stroke="#6f7f5a" strokeWidth="0.6" fill="none" />
                    {[[-22, 14.5], [-19, 16], [-17.5, 17.8]].map(([px, py]) => (
                      <circle key={px} cx={wx + px!} cy={wy + py!} r="0.4" fill="#b91c1c" />
                    ))}
                  </Frame>
                )}
                {it.variant === 'chalkboard' && (
                  <Frame x={wx - 26} y={wy + 12} w={11} h={8} mat="#1f2f24">
                    {[14, 15.6, 17.2].map((ly, i) => (
                      <rect key={ly} x={wx - 24.5} y={wy + ly} width={6 - i * 1.5} height="0.35" fill="#e9e2cc" opacity="0.8" />
                    ))}
                  </Frame>
                )}
                {it.variant === 'journals' && [0, 2.6, 5.2].map((o, i) => <rect key={o} x={dx + 4 + o} y={dy - 1.6 - i * 0.3} width="3" height={1.6 + i * 0.3} fill={['#f3eee0', '#e2e8f0', '#fef3c7'][i]} stroke="#8a8478" strokeWidth="0.1" />)}
                {it.variant === 'binders' && [0, 2.2, 4.4].map((o, i) => <rect key={o} x={dx + 4 + o} y={dy - 4.2} width="2" height="4.2" fill={['#1e3a8a', '#7a1f1f', '#365314'][i]} stroke="#000" strokeOpacity="0.3" strokeWidth="0.1" />)}
                {it.variant === 'gifts' && (
                  <g>
                    <path d={`M${dx + 4} ${dy - 1} q1 -3 2.5 -1.5 t1 1.5 Z`} fill="#7a3f19" />
                    <rect x={dx + 8} y={dy - 2.2} width="3" height="2.2" fill="#f3eee0" />
                    <path d={`M${dx + 8.5} ${dy - 1.6} l0.7 0.8 l0.7 -1 l0.6 1`} stroke="#b91c1c" strokeWidth="0.25" fill="none" />
                    <rect x={dx + 12} y={dy - 3.5} width="1.4" height="3.5" fill="#2f5a2f" />
                    <rect x={dx + 12.2} y={dy - 4} width="1" height="0.6" fill="#1c1917" />
                  </g>
                )}
              </Layer>
            );
          default:
            if (it.layer.startsWith('achievement:')) {
              const idx = wallOffset++;
              const ax = wx - 14 + (idx % 3) * 4.4;
              const ay = wy + 7 + Math.floor(idx / 3) * 5.4;
              const kind = it.layer.split(':')[1];
              return (
                <Layer key={key} scene={scene} layer={it.layer.replace(':', '_')} variant={it.variant} x={ax} y={ay} w={4} h={4.6}>
                  <Frame x={ax} y={ay} w={3.8} h={4.4} mat={kind === 'plaque' ? '#7a3f19' : kind === 'photo' ? '#d9d0b6' : '#f3eee0'} gilt={kind === 'plaque'}>
                    {kind === 'plaque' && <rect x={ax + 1} y={ay + 1.6} width="1.8" height="1.4" fill="url(#brass)" />}
                    {kind === 'photo' && <circle cx={ax + 1.9} cy={ay + 2.1} r="0.7" fill="#e3c69c" />}
                    {kind === 'frame' && [1.2, 2, 2.8].map((ly) => <rect key={ly} x={ax + 0.9} y={ay + ly} width="2" height="0.3" fill="#57534e" />)}
                  </Frame>
                </Layer>
              );
            }
            if (it.layer === 'room') {
              return (
                <Layer key={key} scene={scene} layer="room" variant={it.variant} x={dx - 14} y={dy + 6} w={12} h={10}>
                  {it.variant === 'sports' && (
                    <g>
                      <path d={`M${dx - 12} ${dy + 14} h5 q1.5 0 1.5 -1.2 q-2 -1.8 -3.5 -1 l-3 0.4 Z`} fill="#1c1917" />
                      <path d={`M${dx - 11} ${dy + 13} h4`} stroke="#f3eee0" strokeWidth="0.3" />
                      <path d={`M${dx - 5} ${dy + 4} q3 0 3 3 q0 3 -3 3 q-2.5 0 -2.5 -3 q0 -3 2.5 -3 Z`} fill="#a8713a" stroke="#3f2410" strokeWidth="0.2" />
                      <line x1={dx - 5} y1={dy - 4} x2={dx - 5} y2={dy + 4} stroke="#3f2410" strokeWidth="0.5" />
                    </g>
                  )}
                  {it.variant === 'kneeler' && (
                    <g>
                      <rect x={dx - 13} y={dy + 8} width="9" height="2" fill="url(#wood)" />
                      <rect x={dx - 13} y={dy + 10} width="9" height="1.2" fill="#5a1414" />
                      <rect x={dx - 12.5} y={dy + 11.2} width="0.8" height="2.5" fill={PALETTE.oakDark} />
                      <rect x={dx - 4.8} y={dy + 11.2} width="0.8" height="2.5" fill={PALETTE.oakDark} />
                    </g>
                  )}
                  {it.variant === 'papers' && [0, 3.4].map((o) => <rect key={o} x={dx + 8 + o} y={dy - 1.2} width="3.2" height="1.2" fill="#f3eee0" stroke="#b9b3a6" strokeWidth="0.1" />)}
                  {it.variant === 'stole' && (
                    <g>
                      <path d={`M${dx + 16} ${dy - 6} q1 6 0 12`} stroke="#2f5a2f" strokeWidth="1.6" fill="none" />
                      <path d={`M${dx + 16} ${dy - 6} q1 6 0 12`} stroke={PALETTE.gold} strokeWidth="0.3" fill="none" />
                    </g>
                  )}
                </Layer>
              );
            }
            return null;
        }
      })}
    </g>
  );
}
