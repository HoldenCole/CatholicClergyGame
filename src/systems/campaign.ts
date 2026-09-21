import type { CampaignDef, CampaignKind, ConstituencyDef, ConstituencyKey, GameState, PillarDef } from '@/types';
import { campaignDefOf } from '@/content/campaigns';
import { religiousOrder } from '@/content/religious';

/**
 * The campaign a state belongs to. A save without the field is the base
 * game, so nothing written before E3 changes meaning. E3 §13.1–13.3.
 */
export function campaignOf(state: Pick<GameState, 'campaign'>): CampaignKind {
  return state.campaign ?? 'diocesan';
}

export function campaignDef(state: Pick<GameState, 'campaign'>): CampaignDef {
  return campaignDefOf(campaignOf(state));
}

/** The constituencies live in this run, in the order the sheets show them. */
export function constituenciesOf(state: Pick<GameState, 'campaign'>): ConstituencyDef[] {
  return campaignDef(state).constituencies;
}

export function constituencyLabel(state: Pick<GameState, 'campaign'>, key: ConstituencyKey): string {
  return constituenciesOf(state).find((c) => c.key === key)?.label ?? key.replace(/_/g, ' ');
}

/**
 * Where a reputation effect lands in this campaign: the key itself when it
 * is one of the campaign's, its alias when the scene was written for the
 * other campaign, and the key as written otherwise.
 */
export function resolveConstituency(state: Pick<GameState, 'campaign'>, key: ConstituencyKey): ConstituencyKey {
  const def = campaignDef(state);
  if (def.constituencies.some((c) => c.key === key)) return key;
  return def.aliases[key] ?? key;
}

/**
 * The four pillars as this run names them: the order's, once a man is
 * professed into one; the campaign's otherwise. Ids never change, so the
 * formation engine reads one shape. E3 §5, §13.3.
 */
export function pillarsOf(state: Pick<GameState, 'campaign' | 'religious'>): PillarDef[] {
  if (state.religious) return religiousOrder(state.religious.order).pillars;
  return campaignDef(state).pillars;
}

export function pillarLabel(state: Pick<GameState, 'campaign' | 'religious'>, id: PillarDef['id']): string {
  return pillarsOf(state).find((p) => p.id === id)?.label ?? id;
}

/** "the diocese" or "the province"; "the bishop" or "the provincial". */
export function institutionWords(state: Pick<GameState, 'campaign'>): CampaignDef['institution'] {
  return campaignDef(state).institution;
}
