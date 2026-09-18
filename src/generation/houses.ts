import type { DioceseSize, Institute, Npc, ReligiousHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { orderDefs } from '@/content/houses';

/** How many houses a diocese holds. Invented. */
const COUNT: Record<DioceseSize, [number, number]> = { small: [1, 2], medium: [2, 3], large: [2, 4], huge: [3, 4] };

/**
 * The religious houses of a diocese: distinct orders, each house named from
 * its order's list, with an alignment rolled around the order's mean and a
 * size of its own. Alignment and size roll independently.
 */
export function generateHouses(rng: Rng, size: DioceseSize): ReligiousHouse[] {
  const [lo, hi] = COUNT[size];
  const n = rng.int(lo, hi);
  const pool = [...orderDefs];
  const out: ReligiousHouse[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const order = rng.pick(pool);
    pool.splice(pool.indexOf(order), 1);
    const name = rng.pick(order.names);
    const members = rng.int(order.size[0], order.size[1]);
    const alignment = Math.max(-100, Math.min(100, Math.round(order.alignmentMean + rng.gaussian() * 25)));
    const setting = order.setting === 'country' ? (rng.chance(0.8) ? 'country' : 'city') : rng.chance(0.85) ? 'city' : 'country';
    const line = order.line.replace('{name}', name).replace('{size}', String(members)).replace('{members}', order.members).replace('{order}', order.label);
    out.push({ id: `house:${order.id}`, name, order: order.id, orderLabel: order.label, members: order.members, charism: order.charism, alignment, setting, size: members, line });
  }
  return out;
}

/** The first house of a charism, for the sheets that name one. */
export function houseOf(houses: ReligiousHouse[] | undefined, charism: 'contemplative' | 'active' | 'any' = 'any'): ReligiousHouse | undefined {
  return (houses ?? []).find((h) => charism === 'any' || h.charism === charism);
}

/**
 * The houses and the institutes are the same religious seen from two sides:
 * §9.4's congregations, and the buildings they keep in this diocese. Where a
 * charism matches, the house is given the institute's id and the men and women
 * of that institute are tagged with the house they live in, so a scene about
 * the priory and a scene about the order are about the same people.
 */
export function linkHouses(houses: ReligiousHouse[], institutes: Institute[], religious: Npc[]): { houses: ReligiousHouse[]; religious: Npc[] } {
  const taken = new Set<string>();
  const linked = houses.map((h) => {
    const match = institutes.find((i) => !taken.has(i.id) && (h.charism === 'contemplative' ? i.charism === 'contemplative' : i.charism !== 'contemplative') && (h.members === 'nuns') === !!i.women);
    if (!match) return h;
    taken.add(match.id);
    return { ...h, instituteId: match.id };
  });
  const byInstitute = new Map(linked.filter((h) => h.instituteId).map((h) => [h.instituteId!, h]));
  const placed = religious.map((n) => {
    const house = n.institute ? byInstitute.get(n.institute) : undefined;
    return house ? { ...n, tags: [...new Set([...n.tags, `house:${house.id}`])] } : n;
  });
  return { houses: linked, religious: placed };
}
