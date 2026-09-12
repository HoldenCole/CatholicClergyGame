import type { DioceseSize, GameState, Parish } from '@/types';
import { presetById } from '@/content/dioceses';
import { milesAcrossOf } from '@/generation/geo';

/** How wide the map is, in miles, by the size of the diocese. Invented. */
export const MILES_ACROSS: Record<DioceseSize, number> = { small: 60, medium: 100, large: 150, huge: 220 };

/** How wide the diocese's map is, in miles: the preset's real width, or a guess by size. */
export function milesAcross(world: { diocese: { presetId: string; visible: { size: DioceseSize } } } | null | undefined): number {
  if (!world) return MILES_ACROSS.medium;
  const preset = presetById(world.diocese.presetId);
  return preset ? milesAcrossOf(preset) : MILES_ACROSS[world.diocese.visible.size];
}

/** Miles between two parishes, from their places on the map; `scale` is the map's width in miles, or a size to guess it from. */
export function milesBetween(a: Parish, b: Parish, scale: DioceseSize | number): number {
  const dx = (a.x ?? 50) - (b.x ?? 50);
  const dy = (a.y ?? 50) - (b.y ?? 50);
  const across = typeof scale === 'number' ? scale : MILES_ACROSS[scale];
  return Math.round((Math.sqrt(dx * dx + dy * dy) / 100) * across);
}

export function milesFromHere(state: GameState, parish: Parish): number | null {
  const here = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  if (!here || !state.world) return null;
  return milesBetween(here, parish, milesAcross(state.world));
}

/** The parishes nearest to one, nearest first, not counting itself. */
export function nearestParishes(parishes: Parish[], from: Parish, scale: DioceseSize | number, count: number): Parish[] {
  return parishes
    .filter((p) => p.id !== from.id)
    .map((p) => ({ p, miles: milesBetween(from, p, scale) }))
    .sort((a, b) => a.miles - b.miles || (a.p.id < b.p.id ? -1 : 1))
    .slice(0, count)
    .map((x) => x.p);
}

/** A word for a distance, for the letters. */
export function milesWord(miles: number): string {
  if (miles <= 3) return 'across town';
  if (miles <= 12) return `${miles} miles away`;
  if (miles <= 40) return `${miles} miles out`;
  return `${miles} miles away, the far end of the diocese`;
}
