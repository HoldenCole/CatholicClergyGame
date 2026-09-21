import raw from './orders.json';
import horariumRaw from './horarium.json';
import permissionsRaw from './permissions.json';
import type { HorariumDef, HorariumKey, OrderDef, OrderKey, PermissionDef, ProvinceSeed } from '@/types';

/** The orders a friar can be professed into. E3 §6–7, as data. */
const data = raw as unknown as { orders: OrderDef[]; provinceComplications: string[] };

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

/** The common life's obligations, in the order the sheet shows them. E3 §3.3. */
export const horariumDefs: HorariumDef[] = (horariumRaw as unknown as { horarium: HorariumDef[] }).horarium;

export function horariumDef(key: HorariumKey): HorariumDef {
  const def = horariumDefs.find((h) => h.key === key);
  if (!def) throw new Error(`no horarium line ${key}`);
  return def;
}

/** What a friar may ask his prior for. E3 §3.4. */
export const permissionDefs: PermissionDef[] = (permissionsRaw as unknown as { permissions: PermissionDef[] }).permissions;
