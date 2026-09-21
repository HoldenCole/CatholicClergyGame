import type { GameState, Npc, ReligiousHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { orderDef } from '@/content/houses';
import { housesOf, standingOf } from './houses';
import { finishNpc, rollBaseStats } from '@/generation/npc';

/**
 * The orders come and go, seen from the diocese. E3 §3.14. A collapsing
 * institute withdraws a house some year: its arrangements end, the diocese
 * has one fewer door, and the pastor who leaned on it learns it from a
 * letter. A growing one founds. And a religious of a collapsing house may
 * leave his order and come to the diocese as a curate: a pastor without a
 * vicar gets a man with a habit-shaped history. Diocesan campaign only;
 * the friar's campaign does the same from the province's side. Tunables
 * are invented.
 */
export const INSTITUTES_DRIFT = {
  withdrawPerYear: 0.06,
  foundPerYear: 0.05,
  /** A former religious arrives as the pastor's curate, some year, when the parish has none. */
  curatePerYear: 0.05,
} as const;

function trajectoryOf(state: GameState, house: ReligiousHouse): 'growing' | 'stable' | 'collapsing' | undefined {
  return state.world?.institutes?.find((i) => i.id === house.instituteId)?.trajectory;
}

export function institutesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (state.religious || !state.world) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  const week = state.clock.week;
  const houses = housesOf(next);
  for (const house of houses) {
    const t = trajectoryOf(next, house);
    if (t === 'collapsing' && rng.derive(`withdraw:${house.id}`).chance(INSTITUTES_DRIFT.withdrawPerYear)) {
      const s = standingOf(next, house.id);
      const flags = { ...next.flags, [`friars_leaving:${house.order}`]: week, 'friars_leaving': week };
      for (const a of s.arrangements) delete flags[`house:${a.id}`];
      next = { ...next, flags, world: { ...next.world!, diocese: { ...next.world!.diocese, visible: { ...next.world!.diocese.visible, houses: housesOf(next).filter((h) => h.id !== house.id) } } }, houses: Object.fromEntries(Object.entries(next.houses ?? {}).filter(([id]) => id !== house.id)) };
      lines.push(`${house.name} is closing: the provincial has written to the bishop that the province cannot keep it, and the ${house.members} go in the spring. ${s.arrangements.length ? 'Every arrangement the parish had with them ends with the house.' : 'The diocese is one door fewer.'}`);
      break;
    }
    if (t === 'growing' && rng.derive(`found:${house.id}`).chance(INSTITUTES_DRIFT.foundPerYear) && !housesOf(next).some((h) => h.motherId === house.id)) {
      const def = orderDef(house.order);
      if (!def) continue;
      const freeNames = def.names.filter((n) => !housesOf(next).some((h) => h.name === n));
      if (!freeNames.length) continue;
      const name = rng.derive(`name:${house.id}`).pick(freeNames);
      const founded: ReligiousHouse = { ...house, id: `house:${house.order}:${week}`, name, size: rng.derive(`size:${house.id}`).int(3, 6), setting: 'city', line: `${name}, a new foundation of ${def.label} from ${house.name}, made by the province and blessed by the bishop.`, foundedWeek: week, motherId: house.id };
      next = { ...next, flags: { ...next.flags, [`friars_arriving:${house.order}`]: week, 'friars_arriving': week }, world: { ...next.world!, diocese: { ...next.world!.diocese, visible: { ...next.world!.diocese.visible, houses: [...housesOf(next), founded] } } } };
      lines.push(`${def.label} have founded ${name}: a house bought, a chapel blessed, and ${founded.size} ${def.members} the diocese did not have last year.`);
      break;
    }
  }
  return { state: next, lines };
}

/** A religious who left his order comes to the diocese, and to a pastor without a curate. */
export function formerReligiousArrives(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const pid = state.assignment?.parishId;
  if (state.religious || !pid || !state.parish || state.assignment?.role !== 'pastor' || state.parish.vicarId || !state.world) return { state, line: null };
  if (!rng.chance(INSTITUTES_DRIFT.curatePerYear)) return { state, line: null };
  const houses = housesOf(state).filter((h) => h.members === 'friars' || h.members === 'monks' || h.members === 'canons');
  const collapsing = houses.filter((h) => trajectoryOf(state, h) === 'collapsing');
  const house = (collapsing.length ? collapsing : houses).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!house) return { state, line: null };
  const def = orderDef(house.order);
  const year = new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
  const men = Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'religious' && n.institute && (n.institute === house.instituteId || n.tags.includes(`institute:${house.id}`)) && year - n.birthYear < 58 && !n.tags.includes('religious:prior') && !n.tags.includes('religious:guardian'));
  const from = men.length ? rng.pick(men.sort((a, b) => a.id.localeCompare(b.id))) : undefined;
  const npc: Npc = from
    ? { ...from, id: `${from.id}_exreligious`, role: 'priest', title: 'Fr.', status: 'active', relationship: rng.int(0, 20), tags: ['priest', 'vicar', `vicar:${pid}`, `parish:${pid}`, 'ex_religious', `former:${house.order}`] }
    : { ...finishNpc(rng, { id: `exreligious_${week(state)}`, name: { first: 'Paul', last: 'Kenner' }, role: 'priest', title: 'Fr.', birthYear: year - rng.int(34, 52), origin: 'suburban', stats: rollBaseStats(rng, 32, 60), relationship: rng.int(0, 20) }), tags: ['priest', 'vicar', `vicar:${pid}`, `parish:${pid}`, 'ex_religious', `former:${house.order}`] };
  const npcs = { ...state.npcs, [npc.id]: npc };
  if (from) npcs[from.id] = { ...from, status: 'left' };
  delete (npcs[npc.id] as Partial<Npc>).institute;
  delete (npcs[npc.id] as Partial<Npc>).charism;
  const next: GameState = {
    ...state,
    npcs,
    parish: { ...state.parish, vicarId: npc.id },
    flags: { ...state.flags, 'vicar:former_religious': state.clock.week, [`vicar:former:${house.order}`]: state.clock.week },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Fr. ${npc.name.first} ${npc.name.last}, until last year one of ${def?.label ?? house.orderLabel}, was sent to you as parochial vicar.` }],
  };
  return { state: next, line: `A letter of appointment: Fr. ${npc.name.first} ${npc.name.last} comes as your parochial vicar. Until last year he was ${def?.label ? `one of ${def.label}` : `a religious of ${house.name}`}, and the bishop incardinated him at Easter. He says the Office alone, still, at the old hours.` };
}

function week(state: GameState): number {
  return state.clock.week;
}
