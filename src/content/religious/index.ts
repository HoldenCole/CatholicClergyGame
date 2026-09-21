import raw from './orders.json';
import type { OrderDef, OrderKey, ProvinceSeed } from '@/types';

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
