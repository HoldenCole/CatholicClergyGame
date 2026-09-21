import raw from './campaigns.json';
import type { CampaignDef, CampaignKind } from '@/types';

export const campaignDefs: CampaignDef[] = (raw as { campaigns: CampaignDef[] }).campaigns;

export function campaignDefOf(kind: CampaignKind): CampaignDef {
  const def = campaignDefs.find((c) => c.id === kind);
  if (!def) throw new Error(`no campaign ${kind}`);
  return def;
}
