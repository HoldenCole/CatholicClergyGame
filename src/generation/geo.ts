import type { DiocesePreset } from '@/types';
import type { Rng } from '@/engine/rng';

const MILES_PER_DEGREE = 69.17;

/** How wide a map is, in miles: the preset's own width, or a guess by size. */
export function milesAcrossOf(preset: Pick<DiocesePreset, 'map' | 'size'> | undefined): number {
  if (preset?.map) return preset.map.milesAcross;
  return { small: 60, medium: 100, large: 150, huge: 220 }[preset?.size ?? 'medium'];
}

/**
 * A place on the earth onto the map: the see's cathedral at the center,
 * miles to map units by the diocese's width, clamped to the sheet.
 */
export function project(preset: Pick<DiocesePreset, 'map' | 'size'>, lat: number, lon: number): { x: number; y: number } {
  const m = preset.map;
  if (!m) return { x: 50, y: 50 };
  const miles = milesAcrossOf(preset);
  const dx = (lon - m.lon) * Math.cos((m.lat * Math.PI) / 180) * MILES_PER_DEGREE;
  const dy = (lat - m.lat) * MILES_PER_DEGREE;
  const x = 50 + (dx / miles) * 100;
  const y = 50 - (dy / miles) * 100;
  return { x: Math.round(Math.max(2, Math.min(98, x)) * 10) / 10, y: Math.round(Math.max(2, Math.min(98, y)) * 10) / 10 };
}

/** The coordinates of a named place of the diocese, if the preset knows it. */
export function placeCoords(preset: Pick<DiocesePreset, 'places'>, name: string): { lat: number; lon: number } | undefined {
  return preset.places?.find((p) => p.name === name);
}

/**
 * Where a parish sits: a real church at its real place; a rolled one near
 * its named place, a little off so two in one town do not overlap; and a
 * parish with no known place in a ring by its terrain.
 */
export function placeParish(rng: Rng, preset: DiocesePreset, opts: { real?: { lat?: number; lon?: number } | undefined; place: string; terrain: string; cathedral?: boolean }): { x: number; y: number } {
  if (opts.cathedral && preset.map) return project(preset, preset.map.lat, preset.map.lon);
  if (opts.real && typeof opts.real.lat === 'number' && typeof opts.real.lon === 'number') return project(preset, opts.real.lat, opts.real.lon);
  const known = placeCoords(preset, opts.place);
  if (known && preset.map) {
    const at = project(preset, known.lat, known.lon);
    const spread = opts.terrain === 'rural' ? 3 : 1.6;
    const angle = rng.float(0, Math.PI * 2);
    const r = rng.float(0.4, spread);
    return { x: Math.round(Math.max(2, Math.min(98, at.x + Math.cos(angle) * r)) * 10) / 10, y: Math.round(Math.max(2, Math.min(98, at.y + Math.sin(angle) * r)) * 10) / 10 };
  }
  const radius = opts.cathedral ? 0 : opts.terrain === 'urban' ? rng.float(3, 12) : opts.terrain === 'latino' ? rng.float(4, 18) : opts.terrain === 'suburban' ? rng.float(12, 30) : rng.float(28, 48);
  const angle = rng.float(0, Math.PI * 2);
  return { x: Math.round((50 + Math.cos(angle) * radius) * 10) / 10, y: Math.round((50 + Math.sin(angle) * radius) * 10) / 10 };
}
