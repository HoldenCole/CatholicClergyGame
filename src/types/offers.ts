import type { Condition, Effect } from './events';
import type { Phase } from './stats';

/** DESIGN.md §7.5 categories. */
export type OfferCategory = 'academic' | 'chancery' | 'patronage' | 'social' | 'seminary';

/**
 * A multi-year (or multi-week) commitment that runs in the background once
 * an offer is accepted. It costs AP each week (read by the parish loop) and
 * pays out when it completes.
 */
export interface CommitmentDef {
  label: string;
  weeks: number;
  apPerWeek: number;
  /** Years away from the diocese: the man leaves his parish and lives where he studies (content/study/programs.json). */
  away?: string;
  onComplete: Effect[];
  completeOutcome: string;
}

export interface OfferDef {
  id: string;
  category: OfferCategory;
  phase: Phase[];
  yearGate?: number[];
  title: string;
  /** The offer as it is made. May use {tokens}. */
  body: string;
  /** Selector of the person making the offer; declining costs that relationship. */
  from?: string;
  requires: Condition[];
  /** Arrival weight; roughly the chance in 1,000 per week that it arrives when eligible. */
  weight: number;
  bias?: { when: Condition; multiplier: number }[];
  /** Weeks to decide. 0 means one scene: decide now. */
  windowWeeks: number;
  once?: boolean;
  /** Accepting raises the arrival weight of every offer in the same cluster. */
  cluster?: string;
  accept: { effects: Effect[]; outcome: string; commitment?: CommitmentDef };
  decline: { effects: Effect[]; outcome: string };
  /**
   * Risk when accepted without meeting `unless`: the failure fires with
   * `chance`, applying its effects instead of the commitment's payout (or
   * immediately, when there is no commitment).
   */
  failure?: { chance: number; unless: Condition[]; effects: Effect[]; outcome: string };
}

export interface ActiveOffer {
  offerId: string;
  arrivedWeek: number;
  /** Absolute week after which the offer lapses. Equal to arrivedWeek for one-scene offers. */
  expiresWeek: number;
  bindings: Record<string, string>;
}

export interface Commitment {
  offerId: string;
  label: string;
  startWeek: number;
  endWeek: number;
  apPerWeek: number;
  /** Set when the failure roll went against the player; applied at the end instead of the payout. */
  failed: boolean;
}

export type OfferDecision = 'accepted' | 'declined' | 'expired' | 'completed' | 'failed';

export interface OfferRecord {
  offerId: string;
  week: number;
  decision: OfferDecision;
}
