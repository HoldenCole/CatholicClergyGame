import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { generateClassmate } from '@/generation/classmates';
import { rollTrajectory } from '@/systems/trajectories';
import { dateOf } from '@/engine/time';
import { formationStage } from './formation';
import { currentHouse } from './house';
import { worldOf } from './transfer';

/**
 * Diocesan classmates. E3 §3.13. The studium or the union shares its
 * lecture halls with the diocesan seminary of the city, and two or three
 * of its men sit beside the friar for the theology years. They are rolled
 * by the base game's classmate generator (independent rolls, never a
 * premade man), ordained the June he is, and become priests of that
 * diocese: pastors of its parishes, chancery men, a bishop, or gone. He
 * meets them for forty years, in the deanery and at the chancery, and
 * the file says so. Tunables are invented.
 */
export const DIOCESAN_CLASSMATES = {
  count: [2, 3] as [number, number],
  /** Years after the friar's ordination before one of them can be a pastor, whatever his trajectory says. */
  pastorAfterYears: 4,
} as const;

/** The first year of the studium: the men arrive with him. */
export function diocesanClassmatesStart(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const stage = formationStage(state);
  if (!r || !stage || stage.house !== 'studium' || r.diocesanClassmateIds) return state;
  const house = currentHouse(state);
  if (!house) return state;
  const year = dateOf(state.clock).year;
  const n = rng.int(...DIOCESAN_CLASSMATES.count);
  const npcs = { ...state.npcs };
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const base = generateClassmate(rng.derive(`dcm:${i}`), i, year - (stage.year - 1));
    const id = `dcm_${i + 1}`;
    const npc: Npc = { ...base, id, tags: [...base.tags.filter((t) => t !== 'classmate'), 'diocesan_classmate', 'seminarian', `diocese:${house.dioceseId}`], relationship: rng.int(0, 15) };
    npcs[id] = npc;
    ids.push(id);
  }
  const names = ids.map((id) => `${npcs[id]!.name.first} ${npcs[id]!.name.last}`);
  return {
    ...state,
    npcs,
    religious: { ...r, diocesanClassmateIds: ids },
    flags: { ...state.flags, 'dcm:met': state.clock.week, [`dcm:diocese:${house.dioceseId}`]: true },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `The diocesan seminary sends its men to the same lectures: ${names.join(', ')}.` }],
  };
}

export function diocesanClassmates(state: GameState): Npc[] {
  return (state.religious?.diocesanClassmateIds ?? []).map((id) => state.npcs[id]).filter((n): n is Npc => !!n);
}

function dioceseOf(npc: Npc): string | undefined {
  return npc.tags.find((t) => t.startsWith('diocese:'))?.slice('diocese:'.length);
}

/** Ordained the June he is, with a diocesan trajectory rolled from his own stats. */
export function diocesanClassmatesOrdain(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r?.diocesanClassmateIds?.length) return state;
  const npcs = { ...state.npcs };
  for (const id of r.diocesanClassmateIds) {
    const n = npcs[id];
    if (!n || n.status !== 'active' || n.role === 'priest') continue;
    npcs[id] = { ...n, role: 'priest', title: 'Fr.', tags: [...n.tags.filter((t) => t !== 'seminarian'), 'priest', 'vicar'], trajectory: rollTrajectory(rng.derive(`traj:${id}`), n) };
  }
  return { ...state, npcs, flags: { ...state.flags, 'dcm:ordained': state.clock.week } };
}

/**
 * A year: a classmate whose trajectory made him a pastor takes a parish of
 * his diocese, its old pastor going elsewhere; the flags say what the men
 * have become and whether one is in the diocese the friar is in now.
 */
export function diocesanClassmateYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const men = diocesanClassmates(state);
  if (!r || !men.length) return state;
  const ordainedAt = state.flags.ordination_week;
  const years = typeof ordainedAt === 'number' ? (state.clock.week - ordainedAt) / 52 : 0;
  let next = state;
  const npcs = { ...state.npcs };
  let changed = false;
  for (const n of men) {
    if (n.status !== 'active' || !n.tags.includes('pastor') || n.tags.some((t) => t.startsWith('pastor:')) || years < DIOCESAN_CLASSMATES.pastorAfterYears) continue;
    const did = dioceseOf(n);
    const world = did ? worldOf(state, did) : undefined;
    if (!world) continue;
    const taken = new Set(Object.values(npcs).flatMap((x) => x.tags.filter((t) => t.startsWith('pastor:')).map((t) => t.slice('pastor:'.length))));
    const pool = world.parishes.filter((p) => !p.cathedral && !taken.has(p.id) && !Object.values(state.orderHouses ?? {}).some((h) => h.parishId === p.id)).sort((a, b) => a.id.localeCompare(b.id));
    const free = world.parishes.filter((p) => !p.cathedral && !Object.values(state.orderHouses ?? {}).some((h) => h.parishId === p.id)).sort((a, b) => a.id.localeCompare(b.id));
    const parish = rng.derive(`dcm-parish:${n.id}`).pick(pool.length ? pool : free);
    if (!parish) continue;
    const old = Object.values(npcs).find((x) => x.id !== n.id && x.tags.includes(`pastor:${parish.id}`));
    if (old) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== `pastor:${parish.id}`).concat('priest') };
    npcs[n.id] = { ...n, tags: [...n.tags, `pastor:${parish.id}`] };
    parish.pastorId = n.id;
    changed = true;
    next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `${n.name.first} ${n.name.last}, from the seminary lectures, is pastor of ${parish.name}.` }] };
  }
  if (changed) next = { ...next, npcs };
  const here = next.world?.diocese.presetId;
  const live = diocesanClassmates(next);
  const flags = { ...next.flags };
  const set = (k: string, v: boolean) => { if (v) flags[k] = true; else delete flags[k]; };
  set('dcm:pastor', live.some((n) => n.status === 'active' && n.tags.includes('pastor')));
  set('dcm:chancery', live.some((n) => n.status === 'active' && n.tags.includes('chancery')));
  set('dcm:bishop', live.some((n) => n.tags.includes('bishop_elsewhere')));
  set('dcm:left', live.some((n) => n.status === 'left'));
  set('dcm:dead', live.some((n) => n.status === 'dead'));
  set('dcm:here', live.some((n) => n.status === 'active' && dioceseOf(n) === here));
  return { ...next, flags };
}

/** For the sheet: what each man is now. */
export function diocesanClassmateLine(npc: Npc): string {
  if (npc.status === 'left') return 'left the priesthood';
  if (npc.status === 'dead') return 'dead';
  if (npc.status === 'retired') return 'retired';
  const t = new Set(npc.tags);
  if (t.has('bishop_elsewhere')) return 'a bishop, elsewhere';
  if (t.has('on_leave')) return 'on leave, and nobody says why';
  if (t.has('chancery')) return 'at the chancery, a monsignor';
  if (t.has('pastor')) return 'a pastor';
  if (t.has('priest')) return 'a parochial vicar';
  return 'a seminarian of the diocese';
}
