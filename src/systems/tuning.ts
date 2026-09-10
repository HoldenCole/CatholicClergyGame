/**
 * Every numeric constant that shapes the simulation, in one place.
 * Formulas that DESIGN.md leaves unspecified are marked "invented" so they can
 * be found and revisited.
 */

export const STAT_MIN = 0;
export const STAT_MAX = 100;

/** Gains slow above this stat value. DESIGN.md §4.1 */
export const STAT_LOG_KNEE = 70;
/**
 * Invented: at knee + N, a gain is scaled by 1 / (1 + N / SCALE).
 * With SCALE 10: 70 → ×1.00, 80 → ×0.50, 90 → ×0.33, 100 → ×0.25.
 */
export const STAT_LOG_SCALE = 10;

/** Weekly decay. DESIGN.md §4.2. Values invented. */
export const DECAY = {
  /** Theology and Knowledge atrophy per week when unused. */
  atrophyPerWeek: 0.04,
  /** Piety baseline drain per week. */
  pietyBasePerWeek: 0.03,
  /** Extra Piety drain per AP of administrative load in the week. */
  pietyPerAdminAp: 0.05,
  /** No stat decays below this floor by decay alone. */
  floor: 20,
} as const;

/** Outspokenness added per recorded position, by volume. Invented. */
export const OUTSPOKENNESS_PER_VOLUME = {
  private: 0,
  semi_public: 3,
  public: 8,
} as const;

/** Fraction of the gap between alignment and a stated position that alignment drifts. Invented. */
export const ALIGNMENT_DRIFT_PER_POSITION = 0.08;

/** DESIGN.md §5.6: past this outspokenness, with bloc support, the priest becomes a figure. */
export const FIGURE_OUTSPOKENNESS = 60;
export const FIGURE_BLOC_SUPPORT = 40;

/**
 * Standing fades when nothing feeds it. Above the resting point a
 * constituency's opinion of a man drifts back toward it every week; below
 * it, nothing moves without an action. Outspokenness fades the same way:
 * a man who stops talking is, in time, less loud. Invented.
 */
export const REPUTATION_REST = {
  /** Absolute value a reputation settles toward on its own. */
  floor: 35,
  /** Fraction of the excess above the floor lost each week (half-life near a year). */
  ratePerWeek: 0.015,
  outspokennessFloor: 15,
  outspokennessRatePerWeek: 0.01,
} as const;
