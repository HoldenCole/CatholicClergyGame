import type { GameState, OrderFeastDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { fromDayNumber, toDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';
import { religiousOrder, religiousOrders } from '@/content/religious';
import { patronalOf } from '@/generation/patronal';
import { currentHouse } from './house';
import feastLinesJson from '@/content/religious/feastLines.json';

/**
 * The order's calendar beside the parish's: the founder's solemnity, the
 * doctors and patrons, the devotions the order carries, the dead of the
 * order, and the house's own patron from its name. Data on OrderDef.feasts
 * (rule 9); this only reads it. Scenes hang on the keys through the
 * `feast` condition, which reads both calendars.
 */
export const HOUSE_PATRON_KEY = 'house_patron';

/** Every key an order feast can carry, for the content validator. */
export const ORDER_FEAST_KEYS: readonly string[] = [...new Set([...religiousOrders.flatMap((o) => o.feasts.map((f) => f.key)), HOUSE_PATRON_KEY])];

export interface OrderFeast extends OrderFeastDef {
  day: number;
}

/** The days the friar's order keeps, the house's patron among them. Empty for a diocesan run. */
export function orderFeastDefs(state: GameState): OrderFeastDef[] {
  const r = state.religious;
  if (!r) return [];
  const out = [...religiousOrder(r.order).feasts];
  const house = currentHouse(state);
  if (house) {
    const patron = patronalOf(house.name, house.id);
    const already = out.find((f) => f.month === patron.month && f.day === patron.day);
    if (!already && patron.month && patron.day) out.push({ key: HOUSE_PATRON_KEY, label: `the patron of the house, ${patron.label.replace(/^the feast of /, '')}`, month: patron.month, day: patron.day, rank: 'solemnity', kind: 'patron', line: 'The house kept its own patron: the church full of the neighbourhood, a better dinner, and the prior\'s toast.' });
  }
  return out;
}

/** The order's feasts falling in the week that begins on the clock's Sunday. */
export function orderFeastsOfWeek(state: GameState, week = state.clock.week): OrderFeastDef[] {
  const sunday = sundayOf(state.clock, week);
  const { year } = fromDayNumber(sunday);
  return orderFeastDefs(state).filter((f) => [year, year + 1].some((y) => { const d = toDayNumber({ year: y, month: f.month, day: f.day }); return d >= sunday && d <= sunday + 6; }));
}

export interface UpcomingOrderFeast {
  key: string;
  label: string;
  weeks: number;
  day: number;
}

/** The order's feasts ahead, this week first. */
export function upcomingOrderFeasts(state: GameState, count = 4): UpcomingOrderFeast[] {
  const sunday = sundayOf(state.clock);
  const { year } = fromDayNumber(sunday);
  const out: UpcomingOrderFeast[] = [];
  for (const f of orderFeastDefs(state)) {
    for (const y of [year, year + 1]) {
      const d = toDayNumber({ year: y, month: f.month, day: f.day });
      if (d < sunday) continue;
      out.push({ key: f.key, label: f.label, weeks: Math.floor((d - sunday) / 7), day: d });
      break;
    }
  }
  return out.sort((a, b) => a.day - b.day).slice(0, count);
}

const LINES = feastLinesJson as unknown as { feasts: Record<string, string[]>; rank: Record<OrderFeastDef['rank'], string[]> };

/** The digest's line for an order feast: an authored one for the day, else one for its rank, else the data's own. */
export function orderFeastLine(feast: OrderFeastDef, rng: Rng): string {
  const own = LINES.feasts[feast.key];
  const pool = own && own.length ? own : LINES.rank[feast.rank];
  const label = feast.label.charAt(0).toUpperCase() + feast.label.slice(1);
  const incident = pool && pool.length ? rng.pick(pool) : feast.line;
  return `${feast.kind === 'dead' ? label : `The feast of ${feast.label}`} this week. ${incident}`;
}
