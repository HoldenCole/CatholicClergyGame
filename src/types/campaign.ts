import type { ConstituencyKey, StatKey } from './stats';
import type { Pillar } from './character';

/**
 * Which game is being played. The diocesan campaign is the base game; the
 * religious campaign (expansion E3) shares the engine and swaps the player's
 * home institution, his constituencies, and the names of the four pillars.
 * Everything below is data in content/campaigns.json, read through
 * systems/campaign.ts. E3 §12–13.
 */
export type CampaignKind = 'diocesan' | 'religious';

export const CAMPAIGN_KINDS: readonly CampaignKind[] = ['diocesan', 'religious'] as const;

/** One constituency as a campaign names it: the key, a short label, and who it is. */
export interface ConstituencyDef {
  key: ConstituencyKey;
  label: string;
  who: string;
}

/**
 * One of the four pillars as a campaign (or an order) names it, and the
 * stats it feeds. The ids are fixed at the base game's four so the
 * formation engine, the evaluation record, and the emphasis panel need no
 * second shape; only the label and the mapping are data. E3 §13.3.
 */
export interface PillarDef {
  id: Pillar;
  label: string;
  stats: { key: StatKey; share: number }[];
}

export interface CampaignDef {
  id: CampaignKind;
  label: string;
  /** "the diocese" / "the province": the player's home institution, as prose names it. */
  institution: { noun: string; superior: string };
  constituencies: ConstituencyDef[];
  /**
   * Where a reputation effect written for the other campaign lands here, so a
   * shared scene that moves `parishioners` moves `laity` for a friar. A key
   * with no alias and not in the set is applied as written.
   */
  aliases: Partial<Record<ConstituencyKey, ConstituencyKey>>;
  pillars: PillarDef[];
}
