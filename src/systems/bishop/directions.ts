import type { ChanceryOffice, DirectionAnswer, DirectionDef, GameState, GivenDirection, Letter, Npc, Parish } from '@/types';
import { createRng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { applySeeHours } from '@/engine/see';
import { directionDef, directionDefs } from '@/content/see';
import { OFFICE_LABEL } from '@/generation/chancery';

/**
 * E4 R1.2 — directions to people: the bishop calls a priest of his diocese
 * in and gives him a direction, as data (content/see/directions.json). The
 * man answers by his regard for the bishop and how a priest usually takes
 * such a thing; the see's dials hear it; the diocese changes as the answer
 * says. The inverse of the letters the man received as a priest. Tunables
 * are invented and flagged.
 */
export const DIRECTIONS = {
  /** One direction a month: more, and it is a purge. */
  everyWeeks: 4,
  /** Not the same man twice within a year. */
  sameManWeeks: 52,
  /** The answer: the direction's welcome and his regard, with noise; at or above `accepts` he accepts, above `reluctant` he goes badly, below he refuses where he can. */
  answer: { welcome: 40, regard: 0.6, noise: 15, accepts: 0, reluctant: -30 },
  /** His regard afterwards. */
  regard: { accepted: 8, reluctant: -8, refused: -25 } as Record<DirectionAnswer, number>,
  /** The see's dials, by answer, as a share of the direction's own. */
  dials: { accepted: 1, reluctant: 0.5, refused: -1 } as Record<DirectionAnswer, number>,
  /** A correction of a man of the majority wing costs the presbyterate this much more. */
  rebukeMajority: 3,
  /** A resignation asked before seventy-five costs; at seventy-five the canon asks it. */
  retireEarly: 3,
  canonAge: 75,
  /** Deans: one to about this many parishes. */
  parishesPerDean: 5,
} as const;

const OFFICES: ChanceryOffice[] = ['vicar_general', 'chancellor', 'vicar_for_clergy'];

export function ageOf(state: GameState, npc: Npc): number {
  return dateOf(state.clock).year - npc.birthYear;
}

function inSee(state: GameState, n: Npc): boolean {
  const id = state.see?.dioceseId;
  return !!id && n.tags.includes(`diocese:${id}`);
}

/** The priests of the see, the chancery's included, oldest first. */
export function priestsOfSee(state: GameState): Npc[] {
  if (!state.see || state.world?.diocese.presetId !== state.see.dioceseId) return [];
  return Object.values(state.npcs)
    .filter((n) => n.status === 'active' && (n.role === 'priest' || (n.role === 'official' && n.title !== 'Ms.' && n.title !== 'Mr.')) && inSee(state, n))
    .sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id));
}

export function parishOf(state: GameState, npc: Npc): Parish | undefined {
  const tag = npc.tags.find((t) => t.startsWith('pastor:'));
  return tag ? state.world?.parishes.find((p) => p.id === tag.slice(7)) : undefined;
}

export function officeOf(npc: Npc): ChanceryOffice | undefined {
  return OFFICES.find((o) => npc.tags.includes(o));
}

/** Where a man is, if a direction sent him away, and when he is due back. */
export function awayOf(npc: Npc): { what: string; until: number } | null {
  const tag = npc.tags.find((t) => t.startsWith('away:'));
  if (!tag) return null;
  const [, what, until] = tag.split(':');
  return { what: what ?? '', until: Number(until) };
}

function deansOf(state: GameState): number {
  return priestsOfSee(state).filter((n) => n.tags.includes('dean')).length;
}

/** Whether a direction may be given to this man now, and why not. */
export function directionAvailable(state: GameState, def: DirectionDef, npc: Npc): { ok: boolean; why: string | null } {
  const see = state.see;
  if (!see || !inSee(state, npc) || npc.status !== 'active') return { ok: false, why: 'Not one of yours.' };
  if (awayOf(npc)) return { ok: false, why: 'Away.' };
  if (see.lastDirectionWeek !== undefined && state.clock.week - see.lastDirectionWeek < DIRECTIONS.everyWeeks) return { ok: false, why: 'One a month.' };
  const last = (see.directions ?? []).filter((d) => d.npcId === npc.id).at(-1);
  if (last && state.clock.week - last.week < DIRECTIONS.sameManWeeks) return { ok: false, why: 'Not the same man twice in a year.' };
  const rested = (see.directions ?? []).filter((d) => d.id === def.id).at(-1);
  if (def.restWeeks && rested && state.clock.week - rested.week < def.restWeeks) return { ok: false, why: 'Not again so soon.' };
  const r = def.requires ?? {};
  const age = ageOf(state, npc);
  if (r.minAge !== undefined && age < r.minAge) return { ok: false, why: 'Too young for it.' };
  if (r.maxAge !== undefined && age > r.maxAge) return { ok: false, why: 'Too old for it.' };
  if (r.struggle && !r.struggle.includes(npc.struggle)) return { ok: false, why: 'Nothing in the file asks it.' };
  if (r.struggle && r.known && !state.flags[`known:${npc.id}`]) return { ok: false, why: 'The file does not know it; a visit might.' };
  if (r.titleNot && npc.title === r.titleNot) return { ok: false, why: 'He has it.' };
  if (r.stat && npc.stats[r.stat.key] < r.stat.min) return { ok: false, why: 'Not the man for it.' };
  if (r.pastor === true && !parishOf(state, npc)) return { ok: false, why: 'Not a pastor.' };
  if (r.pastor === false && parishOf(state, npc)) return { ok: false, why: 'A pastor.' };
  if (def.kind === 'dean' && npc.tags.includes('dean')) return { ok: false, why: 'Already dean.' };
  if (def.kind === 'dean' && deansOf(state) >= Math.max(1, Math.ceil((state.world?.parishes.length ?? 0) / DIRECTIONS.parishesPerDean))) return { ok: false, why: 'Deans enough.' };
  if (def.kind === 'chancery' && officeOf(npc)) return { ok: false, why: 'Already of the chancery.' };
  return { ok: true, why: null };
}

export function directionsFor(state: GameState, npc: Npc): { def: DirectionDef; ok: boolean; why: string | null }[] {
  return directionDefs.map((def) => ({ def, ...directionAvailable(state, def, npc) }));
}

/** The parishes a man could be moved to: the vacant ones first, then the rest but his own and the cathedral. */
export function destinationsFor(state: GameState, npc: Npc): Parish[] {
  const own = parishOf(state, npc);
  const world = state.world;
  if (!world) return [];
  const vacant = (p: Parish) => !state.npcs[p.pastorId] || state.npcs[p.pastorId]!.status !== 'active';
  return world.parishes.filter((p) => p.id !== own?.id && !p.cathedral).sort((a, b) => Number(vacant(b)) - Number(vacant(a)) || a.name.localeCompare(b.name));
}

/** How he takes it: the direction's welcome, his regard, and a roll of the seed. */
export function answerTo(state: GameState, def: DirectionDef, npc: Npc): DirectionAnswer {
  const a = DIRECTIONS.answer;
  const rng = createRng(`${state.seed}:direction:${def.id}:${npc.id}:${state.clock.week}`);
  const score = def.welcome * a.welcome + npc.relationship * a.regard + rng.gaussian() * a.noise;
  if (score >= a.accepts) return 'accepted';
  if (score >= a.reluctant || !def.refusable) return 'reluctant';
  return 'refused';
}

function retag(n: Npc, drop: (t: string) => boolean, add: string[] = []): Npc {
  return { ...n, tags: [...n.tags.filter((t) => !drop(t)), ...add] };
}

/** The diocese changes as the direction says, once he has not refused it. */
function carryOut(state: GameState, def: DirectionDef, npc: Npc, target: { parishId?: string; office?: ChanceryOffice }, answer: DirectionAnswer): { state: GameState; to?: Parish; presbyterateExtra: number } {
  const npcs = { ...state.npcs };
  let world = state.world!;
  let extra = 0;
  let to: Parish | undefined;
  const week = state.clock.week;
  const own = parishOf(state, npc);
  switch (def.kind) {
    case 'move': {
      const dest = world.parishes.find((p) => p.id === target.parishId);
      if (!dest || !own) break;
      to = dest;
      const other = npcs[dest.pastorId];
      const swap = other && other.status === 'active' && other.tags.includes(`pastor:${dest.id}`) ? other : undefined;
      npcs[npc.id] = retag(npc, (t) => t === `pastor:${own.id}`, [`pastor:${dest.id}`]);
      if (swap) npcs[swap.id] = retag(swap, (t) => t === `pastor:${dest.id}`, [`pastor:${own.id}`]);
      world = { ...world, parishes: world.parishes.map((p) => (p.id === dest.id ? { ...p, pastorId: npc.id } : p.id === own.id ? { ...p, pastorId: swap ? swap.id : '' } : p)) };
      break;
    }
    case 'dean':
      npcs[npc.id] = retag(npc, () => false, ['dean']);
      break;
    case 'monsignor':
      npcs[npc.id] = { ...npc, title: 'Msgr.' };
      break;
    case 'study':
    case 'sabbatical':
    case 'treatment':
      npcs[npc.id] = retag(npc, (t) => t.startsWith('away:'), [`away:${def.kind}:${week + (def.awayWeeks ?? 26)}`]);
      break;
    case 'rebuke': {
      const disposition = world.diocese.visible.disposition;
      const majority = Math.sign(npc.alignment) === Math.sign(disposition) && Math.abs(npc.alignment) >= 15;
      if (majority) extra -= DIRECTIONS.rebukeMajority;
      npcs[npc.id] = retag(npc, () => false, [`corrected:${week}`]);
      break;
    }
    case 'retire': {
      npcs[npc.id] = { ...retag(npc, (t) => t.startsWith('pastor:') || t === 'dean', ['retired_pastor']), status: 'retired' };
      if (own) world = { ...world, parishes: world.parishes.map((p) => (p.id === own.id ? { ...p, pastorId: '' } : p)) };
      if (ageOf(state, npc) < DIRECTIONS.canonAge) extra -= DIRECTIONS.retireEarly;
      break;
    }
    case 'chancery': {
      const office = target.office;
      if (!office) break;
      const holder = Object.values(npcs).find((n) => n.id !== npc.id && n.status === 'active' && n.tags.includes(office) && inSee(state, n));
      if (holder) npcs[holder.id] = retag(holder, (t) => t === office || t === 'chancery', ['former_official']);
      npcs[npc.id] = retag(npc, () => false, [office, 'chancery']);
      const chanceryIds = [...world.diocese.hidden.chanceryIds.filter((id) => id !== holder?.id), npc.id];
      world = { ...world, diocese: { ...world.diocese, hidden: { ...world.diocese.hidden, chanceryIds } } };
      break;
    }
  }
  void answer;
  return { state: { ...state, npcs, world }, ...(to ? { to } : {}), presbyterateExtra: extra };
}

function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(priest|parish|to|office|see)\}/g, (_, k: string) => tokens[k] ?? `{${k}}`);
}

export function shortName(n: Npc): string {
  return `${n.title ? `${n.title} ` : ''}${n.name.last}`;
}

/** Give the direction: he answers, the diocese changes, the dials hear it, his reply is a letter, the record keeps the note. */
export function giveDirection(state: GameState, npcId: string, id: string, target: { parishId?: string; office?: ChanceryOffice } = {}): { state: GameState; letter: Letter } | null {
  const def = directionDef(id);
  const npc = state.npcs[npcId];
  if (!def || !npc || !state.see || !directionAvailable(state, def, npc).ok) return null;
  if (def.target === 'parish' && !destinationsFor(state, npc).some((p) => p.id === target.parishId)) return null;
  if (def.target === 'office' && (!target.office || !OFFICES.includes(target.office))) return null;
  const answer = answerTo(state, def, npc);
  const week = state.clock.week;
  let next: GameState = { ...state, npcs: { ...state.npcs, [npc.id]: { ...npc, relationship: Math.max(-100, Math.min(100, npc.relationship + DIRECTIONS.regard[answer])) } } };
  let to: Parish | undefined;
  let extra = 0;
  if (answer !== 'refused') {
    const done = carryOut(next, def, next.npcs[npc.id]!, target, answer);
    next = done.state;
    to = done.to;
    extra = done.presbyterateExtra;
  }
  const share = DIRECTIONS.dials[answer];
  const dials: Partial<Record<'presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number>> = {};
  for (const [k, v] of Object.entries(def.see ?? {}) as ['presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number][]) dials[k] = v * share;
  dials.presbyterate = (dials.presbyterate ?? 0) + extra;
  const see = applySeeHours(next.see!, dials, 1);
  const own = parishOf(state, npc);
  const tokens: Record<string, string> = { priest: shortName(npc), see: state.see.see, ...(own ? { parish: own.name } : {}), ...(to ? { to: to.name } : {}), ...(target.office ? { office: OFFICE_LABEL[target.office] } : {}) };
  const given: GivenDirection = { id, npcId, week, answer, ...(def.awayWeeks && answer !== 'refused' ? { returnWeek: week + def.awayWeeks } : {}), ...(to ? { parishId: to.id } : {}), ...(target.office ? { office: target.office } : {}) };
  // The flags name the last direction only: its kind, its answer, its man. The scenes that hang on them speak of him.
  const flags: GameState['flags'] = { ...next.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('direction:')) delete flags[k];
  flags[`direction:${def.kind}`] = true;
  flags[`direction:${answer}`] = true;
  flags['direction:last'] = npcId;
  next = {
    ...next,
    see: { ...see, directions: [...(see.directions ?? []), given], lastDirectionWeek: week },
    flags,
    career: [...next.career, { week, kind: 'note', text: `${fill(def.note, tokens)}${answer === 'refused' ? ' He refused.' : answer === 'reluctant' ? ' He went badly.' : ''}` }],
  };
  return { state: next, letter: { sort: 'bishop', title: `${shortName(npc)}: ${def.label.toLowerCase()}`, body: def.letter[answer].map((l) => fill(l, tokens)), week } };
}

/** The week: men sent away come home on their week, carrying the tag the direction gives. */
export function directionsWeek(state: GameState): { state: GameState; lines: string[] } {
  if (!state.see) return { state, lines: [] };
  const lines: string[] = [];
  const npcs = { ...state.npcs };
  for (const n of Object.values(npcs)) {
    const away = awayOf(n);
    if (!away || state.clock.week < away.until || !inSee(state, n)) continue;
    const def = directionDefs.find((d) => d.kind === away.what);
    npcs[n.id] = retag(n, (t) => t.startsWith('away:'), def?.returnTag ? [def.returnTag] : []);
    lines.push(`${shortName(n)} is home${away.what === 'study' ? ' from Rome, with the degree' : away.what === 'treatment' ? ' from the treatment center' : ' from his sabbatical'}.`);
  }
  return { state: lines.length ? { ...state, npcs } : state, lines };
}

/** {direction_priest}, {direction_parish}: the man the last direction went to. */
export function directionTokens(state: GameState): Record<string, string> {
  const id = state.flags['direction:last'];
  const npc = typeof id === 'string' ? state.npcs[id] : undefined;
  if (!npc) return {};
  const parish = parishOf(state, npc);
  return { direction_priest: shortName(npc), ...(parish ? { direction_parish: parish.name } : {}) };
}
