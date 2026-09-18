import type { OrderProfile, ReligiousHouse } from '@/types';
import data from './orders.json';

/** The orders told apart. DESIGN §9.4b. */
export const orderProfiles = (data as { orders: OrderProfile[] }).orders;

export function orderProfile(id: string): OrderProfile | undefined {
  return orderProfiles.find((o) => o.id === id);
}

/** The profile of a house, by the order it is a house of. */
export function profileForHouse(house: Pick<ReligiousHouse, 'order'>): OrderProfile | undefined {
  return orderProfiles.find((o) => o.houseOrder === house.order);
}
