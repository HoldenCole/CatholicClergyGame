import type { GameState, Npc } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { ageOf, parishOf, priestsOfSee, shortName } from './directions';

/**
 * E4 R1.5 — the presbyterate as people. The see's priests age, die, and
 * retire; the council of priests is elected by the presbyterate and filled
 * out by the bishop; its regard weighs on his decrees; a wing that has
 * had enough writes to the nuncio; and the presbyterate dial is drawn each
 * year toward what the men themselves think of him, so a visit or a
 * direction to one man is felt in the whole. Rates invented and flagged;
 * the council of priests (cc. 495–501) and the college of consultors
 * (can. 502) are folded into one body, to verify.
 */
export const PRESBYTERATE = {
  /** Death: a chance a year past seventy, more past eighty. */
  death: { from: 70, perYear: 0.02, past80: 0.06 },
  /** Retirement: the letter at seventy-five, accepted a share of years; the parish is vacant after. */
  retire: { at: 75, accepted: 0.4 },
  /** The council: elected men (the presbyterate's own, by age and the wings) and the bishop's, renewed every five years. */
  council: { elected: 4, named: 2, termWeeks: 260 },
  /** The dial closes on the men's mean regard by this share a year. */
  pull: 0.3,
  /** The council's regard below this makes a decree cost the presbyterate more; a closing, more still. */
  cold: -10,
  coldCost: { decree: 2, closing: 3 },
  /** A wing writes to the nuncio: when the dial is this low, this chance a year; Rome's regard falls. */
  nuncio: { below: -30, chance: 0.5, rome: -4 },
} as const;

export function councilOf(state: GameState): Npc[] {
  const c = state.see?.council;
  if (!c) return [];
  return [...c.electedIds, ...c.namedIds].map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active');
}

/** The council's regard for the bishop: the mean of its members'. */
export function councilRegard(state: GameState): number {
  const men = councilOf(state);
  return men.length ? Math.round(men.reduce((a, n) => a + n.relationship, 0) / men.length) : 0;
}

export function councilCold(state: GameState): boolean {
  return councilOf(state).length > 0 && councilRegard(state) < PRESBYTERATE.cold;
}

/** The presbyterate elects: its senior men, weighted toward the majority wing. */
function elect(state: GameState, rng: Rng): string[] {
  const priests = priestsOfSee(state).filter((n) => ageOf(state, n) < 75);
  const disposition = state.world?.diocese.visible.disposition ?? 0;
  const weight = (n: Npc) => 1 + Math.max(0, ageOf(state, n) - 40) / 20 + (Math.sign(n.alignment) === Math.sign(disposition) ? 1 : 0);
  const out: string[] = [];
  let pool = [...priests];
  while (out.length < PRESBYTERATE.council.elected && pool.length) {
    const pick = rng.weighted(pool, weight);
    out.push(pick.id);
    pool = pool.filter((n) => n.id !== pick.id);
  }
  return out;
}

/** The council as the chair finds it: elected men, and the vicar general among the named. */
export function seedCouncil(state: GameState, rng: Rng): GameState {
  if (!state.see || state.see.council) return state;
  const elected = elect(state, rng.derive('elect'));
  const vg = priestsOfSee(state).find((n) => n.tags.includes('vicar_general') && !elected.includes(n.id));
  return { ...state, see: { ...state.see, council: { electedIds: elected, namedIds: vg ? [vg.id] : [], electedWeek: state.clock.week } } };
}

/** The bishop names a man to the council, the oldest of his own named going if the seats are full. */
export function nameToCouncil(state: GameState, npcId: string): GameState {
  const c = state.see?.council;
  const npc = state.npcs[npcId];
  if (!c || !npc || !priestsOfSee(state).some((n) => n.id === npcId) || c.electedIds.includes(npcId) || c.namedIds.includes(npcId)) return state;
  const namedIds = [...c.namedIds, npcId].slice(-PRESBYTERATE.council.named);
  return { ...state, see: { ...state.see!, council: { ...c, namedIds } }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Named ${shortName(npc)} to the council of priests.` }] };
}

export interface PresbyterateYear {
  state: GameState;
  lines: string[];
}

/** The year: the men age, some die, some retire; the council is renewed on its term; the dial follows the men; a wing may write to Rome. */
export function presbyterateYear(state: GameState, rng: Rng): PresbyterateYear {
  const see = state.see;
  if (!see || !state.world || state.world.diocese.presetId !== see.dioceseId) return { state, lines: [] };
  const week = state.clock.week;
  const year = dateOf(state.clock).year;
  const npcs = { ...state.npcs };
  let world = state.world;
  const lines: string[] = [];
  const losses = [...(see.losses ?? [])];
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('presbyterate:')) delete flags[k];
  for (const n of priestsOfSee(state)) {
    const r = rng.derive(`priest:${n.id}:${week}`);
    const age = year - n.birthYear;
    const parish = parishOf(state, n);
    const vacate = () => {
      if (parish) world = { ...world, parishes: world.parishes.map((p) => (p.id === parish.id ? { ...p, pastorId: '' } : p)) };
    };
    if (age >= PRESBYTERATE.death.from && r.chance(age >= 80 ? PRESBYTERATE.death.past80 : PRESBYTERATE.death.perYear)) {
      npcs[n.id] = { ...n, status: 'dead', tags: n.tags.filter((t) => !t.startsWith('pastor:')) };
      vacate();
      losses.push({ week, npcId: n.id, name: shortName(n), why: 'died' });
      lines.push(`${shortName(n)} died, at ${age}${parish ? `, pastor of ${parish.name}` : ''}.`);
      flags['presbyterate:died'] = true;
      flags['presbyterate:man'] = shortName(n);
      continue;
    }
    if (age >= PRESBYTERATE.retire.at && parish && r.chance(PRESBYTERATE.retire.accepted)) {
      npcs[n.id] = { ...n, status: 'retired', tags: [...n.tags.filter((t) => !t.startsWith('pastor:') && t !== 'dean'), 'retired_pastor'] };
      vacate();
      losses.push({ week, npcId: n.id, name: shortName(n), why: 'retired' });
      lines.push(`${shortName(n)} retired from ${parish.name}, at ${age}; the letter the canon asks had been on your desk.`);
      flags['presbyterate:retired'] = true;
      flags['presbyterate:man'] = shortName(n);
    }
  }
  let next: GameState = { ...state, npcs, world, flags };
  // The council: renewed on its term, and the dead and retired off it.
  let council = see.council;
  if (council) {
    const alive = (id: string) => npcs[id]?.status === 'active';
    council = { ...council, electedIds: council.electedIds.filter(alive), namedIds: council.namedIds.filter(alive) };
    if (week - council.electedWeek >= PRESBYTERATE.council.termWeeks || council.electedIds.length < PRESBYTERATE.council.elected) {
      council = { ...council, electedIds: elect(next, rng.derive(`elect:${week}`)), electedWeek: week };
      lines.push('The presbyterate elected its council of priests.');
      flags['presbyterate:council'] = true;
    }
  }
  // The dial follows the men.
  const men = priestsOfSee(next);
  const mean = men.length ? men.reduce((a, n) => a + n.relationship, 0) / men.length : 0;
  let presbyterate = Math.round(see.presbyterate + (mean - see.presbyterate) * PRESBYTERATE.pull);
  let rome = see.rome;
  // A wing writes to the nuncio.
  if (presbyterate < PRESBYTERATE.nuncio.below && createRng(`${state.seed}:nuncio-letter:${week}`).chance(PRESBYTERATE.nuncio.chance)) {
    rome = Math.max(-100, rome + PRESBYTERATE.nuncio.rome);
    lines.push('A letter about the bishop, signed by several priests, has reached the nunciature; the nuncio\'s office lets you know it was received.');
    flags['presbyterate:nuncio'] = true;
  }
  presbyterate = Math.max(-100, Math.min(100, presbyterate));
  next = { ...next, flags, see: { ...see, presbyterate, rome, losses: losses.slice(-30), ...(council ? { council } : {}) } };
  return { state: next, lines };
}

/** {presbyterate_man}: the man the presbyterate's last news was about. */
export function presbyterateTokens(state: GameState): Record<string, string> {
  const m = state.flags['presbyterate:man'];
  return typeof m === 'string' ? { presbyterate_man: m } : {};
}
