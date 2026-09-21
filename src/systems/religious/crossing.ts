import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { religiousOrder } from '@/content/religious';

/**
 * Crossing over, from the province's side. E3 §3.14, the ground for E4. A
 * diocesan priest or seminarian a scene marked (`crossing` effect) enters
 * the order a year on: he leaves his parish or his seminary, the bishop
 * loses a man and remembers it, and he is a novice of the province in the
 * novitiate, in the house's list and at its table. A friar of the house
 * who leaves for a diocese goes the other way: the province loses him and
 * the diocese gains a curate. Tunables are invented.
 */
export const CROSSING = {
  /** Weeks from the mark to the novitiate door. */
  enterWeeks: 52,
  /** What the bishop makes of losing a priest to the order. */
  bishop: [{ target: 'reputation', key: 'local_bishop', delta: -4 }, { target: 'reputation', key: 'diocesan_clergy', delta: -2 }, { target: 'reputation', key: 'order', delta: 3 }] as const,
} as const;

function markedWeek(n: Npc): number {
  return Number(n.tags.find((t) => t.startsWith('crossing:week:'))?.slice('crossing:week:'.length) ?? 0);
}

/** The year: marked men cross. */
export function crossingYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const p = state.province;
  if (!r || !p || !state.orderHouses) return state;
  const week = state.clock.week;
  const novitiate = Object.values(state.orderHouses).find((h) => h.provinceId === p.id && h.kind === 'novitiate');
  let next = state;
  for (const n of Object.values(state.npcs)) {
    if (n.status !== 'active') continue;
    if (n.tags.includes('crossing:entering') && week - markedWeek(n) >= CROSSING.enterWeeks && novitiate) {
      const did = n.tags.find((t) => t.startsWith('diocese:'))?.slice('diocese:'.length);
      const parishTag = n.tags.find((t) => t.startsWith('pastor:'));
      const order = religiousOrder(r.order);
      const npcs = { ...next.npcs };
      // His parish, if he had one, goes to another priest of the diocese.
      if (parishTag && did) {
        // A priest of the diocese without a parish; failing that, a neighbouring pastor holds two, as dioceses do.
        const priests = Object.values(npcs).filter((x) => x.id !== n.id && x.status === 'active' && x.role === 'priest' && x.tags.includes(`diocese:${did}`)).sort((a, b) => a.id.localeCompare(b.id));
        const free = priests.filter((x) => !x.tags.some((t) => t.startsWith('pastor:')));
        const heir = free.length ? rng.derive(`heir:${n.id}`).pick(free) : priests.length ? rng.derive(`heir:${n.id}`).pick(priests) : undefined;
        if (heir) npcs[heir.id] = { ...heir, tags: [...heir.tags, parishTag] };
      }
      npcs[n.id] = {
        ...n,
        role: 'religious',
        title: n.role === 'priest' ? 'Fr.' : 'Br.',
        institute: `inst_${order.instituteId}`,
        tags: [...n.tags.filter((t) => !t.startsWith('crossing:') && !t.startsWith('pastor:') && !t.startsWith('diocese:') && t !== 'priest' && t !== 'vicar' && t !== 'seminarian' && t !== 'diocesan_classmate' && t !== 'diocesan_seminarian' && t !== 'directee'), 'religious', 'friar', `order:${r.order}`, `house:${novitiate.id}`, 'vows:novice', 'crossed_over', ...(n.role === 'priest' ? ['was_diocesan_priest'] : ['was_diocesan_seminarian'])],
      };
      next = {
        ...next,
        npcs,
        orderHouses: { ...next.orderHouses!, [novitiate.id]: { ...next.orderHouses![novitiate.id]!, memberIds: [...next.orderHouses![novitiate.id]!.memberIds, n.id] } },
        province: { ...next.province!, friarIds: [...next.province!.friarIds, n.id] },
        flags: { ...next.flags, [`crossing:entered:${n.id}`]: week, 'crossing:someone_entered': week },
        career: [...next.career, { week, kind: 'note', text: `${n.title ? `${n.title} ` : ''}${n.name.first} ${n.name.last}, of the diocese, is a novice of the province at ${novitiate.name}.` }],
      };
      if (did === next.world?.diocese.presetId) next = applyEffects(next, [...CROSSING.bishop], {}, 'a priest of the diocese entered the order');
    }
    if (n.tags.includes('crossing:leaving') && week - markedWeek(n) >= CROSSING.enterWeeks) {
      const houseId = n.tags.find((t) => t.startsWith('house:'))?.slice('house:'.length);
      const house = houseId ? next.orderHouses?.[houseId] : undefined;
      const did = house?.dioceseId ?? next.world?.diocese.presetId ?? '';
      const npcs = { ...next.npcs, [n.id]: { ...n, role: 'priest' as const, title: 'Fr.', tags: [...n.tags.filter((t) => !t.startsWith('crossing:') && !t.startsWith('house:') && !t.startsWith('vows:') && !t.startsWith('order:') && t !== 'religious' && t !== 'friar' && t !== 'prior'), 'priest', 'ex_religious', `former:${r.order}`, `diocese:${did}`] } };
      delete (npcs[n.id] as Partial<Npc>).institute;
      next = {
        ...next,
        npcs,
        ...(house ? { orderHouses: { ...next.orderHouses!, [house.id]: { ...house, memberIds: house.memberIds.filter((x) => x !== n.id) } } } : {}),
        province: { ...next.province!, friarIds: next.province!.friarIds.filter((x) => x !== n.id) },
        flags: { ...next.flags, [`crossing:left:${n.id}`]: week, 'crossing:confrere_left': week },
        career: [...next.career, { week, kind: 'note', text: `${n.name.first} ${n.name.last} has left the order for the diocese, and is a priest of it.` }],
      };
    }
  }
  return next;
}
