/**
 * Painted-layer override. Drop a PNG at src/art/<scene>/<layer>/<variant>.png
 * and the renderer draws it instead of the SVG for that layer. The game
 * logic never knows; only the look changes.
 */
const files = import.meta.glob<{ default: string }>('/src/art/**/*.png', { eager: true });

export function paintedLayer(scene: string, layer: string, variant: string): string | null {
  const key = `/src/art/${scene}/${layer}/${variant}.png`;
  return files[key]?.default ?? null;
}
