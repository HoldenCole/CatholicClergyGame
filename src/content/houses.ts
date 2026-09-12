import houses from './houses.json';

export interface OrderDef {
  id: string;
  label: string;
  members: 'monks' | 'friars' | 'nuns' | 'canons';
  charism: 'contemplative' | 'active';
  setting: 'city' | 'country';
  alignmentMean: number;
  size: [number, number];
  names: string[];
  line: string;
}

export const orderDefs = (houses as unknown as { orders: OrderDef[] }).orders;

export function orderDef(id: string): OrderDef | undefined {
  return orderDefs.find((o) => o.id === id);
}
