import type { DioceseSize, GameState, Parish } from '@/types';

/** How wide the map is, in miles, by the size of the diocese. Invented. */
export const MILES_ACROSS: Record<DioceseSize, number> = { small: 60, medium: 100, large: 150, huge: 220 };

/** Miles between two parishes, from their places on the map. */
export function milesBetween(a: Parish, b: Parish, size: DioceseSize): number {
  const dx = (a.x ?? 50) - (b.x ?? 50);
  const dy = (a.y ?? 50) - (b.y ?? 50);
  return Math.round((Math.sqrt(dx * dx + dy * dy) / 100) * MILES_ACROSS[size]);
}

export function milesFromHere(state: GameState, parish: Parish): number | null {
  const here = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  if (!here || !state.world) return null;
  return milesBetween(here, parish, state.world.diocese.visible.size);
}

/** The parishes nearest to one, nearest first, not counting itself. */
export function nearestParishes(parishes: Parish[], from: Parish, size: DioceseSize, count: number): Parish[] {
  return parishes
    .filter((p) => p.id !== from.id)
    .map((p) => ({ p, miles: milesBetween(from, p, size) }))
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
