/**
 * The free hours a week always leaves him, in seminary, away at study, in a
 * parish, and in a friar's house: whatever the obligations, the offices, and
 * the common life take, at least this many are his to give. Clubs, side
 * works, projects, and the jobs taken from letters meet in their own time and
 * take nothing from these. A player's request, over the earlier tighter week.
 */
export const HOURS = {
  /** In the unit each sheet shows: hours in seminary, away, and the parish; blocks in a friar's week. */
  freeFloor: 10,
} as const;

/** The free hours of a week, never fewer than the floor. */
export function withFloor(free: number): number {
  return Math.max(HOURS.freeFloor, free);
}
