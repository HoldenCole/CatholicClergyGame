import raw from './orders.json';
import horariumRaw from './horarium.json';
import permissionsRaw from './permissions.json';
import bishopAsksRaw from './bishopAsks.json';
import pastorAsksRaw from './pastorAsks.json';
import reputationsRaw from './reputations.json';
import spendsRaw from './spends.json';
import type { BishopAskDef, PastorAskDef, ReputationDef, IdentityDef, FriarSpendDef, HorariumDef, HorariumKey, OrderDef, OrderKey, PermissionDef, ProvinceSeed } from '@/types';

/** The orders a friar can be professed into. E3 §6–7, as data. */
const data = raw as unknown as { orders: OrderDef[]; provinceComplications: string[]; doctrinalTopics: string[] };

export const religiousOrders: OrderDef[] = data.orders;

/** The one visible problem a province can carry. */
export const provinceComplications: string[] = data.provinceComplications;

export function religiousOrder(key: OrderKey): OrderDef {
  const def = religiousOrders.find((o) => o.key === key);
  if (!def) throw new Error(`no order ${key}`);
  return def;
}

export function provinceSeed(key: OrderKey, id: string): ProvinceSeed {
  const seed = religiousOrder(key).provinces.find((p) => p.id === id);
  if (!seed) throw new Error(`no province ${id} in ${key}`);
  return seed;
}

/** Topics on which a public position is doctrinal, and an order's mechanics may amplify. E3 §6.2. */
export const doctrinalTopics: string[] = data.doctrinalTopics;

/** The common life's obligations, in the order the sheet shows them. E3 §3.3. */
export const horariumDefs: HorariumDef[] = (horariumRaw as unknown as { horarium: HorariumDef[] }).horarium;

export function horariumDef(key: HorariumKey): HorariumDef {
  const def = horariumDefs.find((h) => h.key === key);
  if (!def) throw new Error(`no horarium line ${key}`);
  return def;
}

/** What a friar may ask his prior for. E3 §3.4. */
export const permissionDefs: PermissionDef[] = (permissionsRaw as unknown as { permissions: PermissionDef[] }).permissions;

/** What a bishop may ask the provincial for. E3 §3.11. */
export const bishopAskDefs: BishopAskDef[] = (bishopAsksRaw as unknown as { asks: BishopAskDef[] }).asks;

/** What a pastor of the diocese may write to the prior for. E3 §3.12. */
export const pastorAskDefs: PastorAskDef[] = (pastorAsksRaw as unknown as { asks: PastorAskDef[] }).asks;

/** What a friar is known for, and the identities two reputations make. E3 §8. */
const reps = reputationsRaw as unknown as { reputations: ReputationDef[]; identities: IdentityDef[] };
export const reputationDefs: ReputationDef[] = reps.reputations;
export const identityDefs: IdentityDef[] = reps.identities;

/** The friar's discretionary week. E3 §3.3. */
export const spendDefs: FriarSpendDef[] = (spendsRaw as unknown as { spends: FriarSpendDef[] }).spends;
