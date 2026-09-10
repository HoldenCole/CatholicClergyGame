import type { ReactNode } from 'react';
import { paintedLayer } from '../art';

/** A layer that prefers a painted PNG at src/art/<scene>/<layer>/<variant>.png and falls back to the SVG children. */
export function Layer({ scene, layer, variant, x = 0, y = 0, w = 100, h = 60, children }: { scene: string; layer: string; variant: string; x?: number; y?: number; w?: number; h?: number; children: ReactNode }) {
  const painted = paintedLayer(scene, layer, variant);
  if (painted) return <image href={painted} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />;
  return <g data-layer={layer} data-variant={variant}>{children}</g>;
}
