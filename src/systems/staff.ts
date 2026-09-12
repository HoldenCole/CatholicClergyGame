import type { GameState, Npc, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { STAFF_SPECS, generateStaffMember } from '@/generation/parishPeople';
import { applyEffects } from '@/engine/effects';
import { controlsMoney } from './finance';
import { currentParish } from './liturgy';

/** Requested in playtesting; numbers invented. */
export const STAFF = {
  /** Weeks a hire reads as new. */
  newWeeks: 26,
  /** A member of staff who has come to dislike the priest may leave: below this regard, this chance a week. */
  quitBelow: -40,
  quitChance: 0.05,
  /** Fallout of letting someone go: the people, and the rest of the staff. */
  letGoPeople: -3,
  letGoLiked: -4,
  letGoStaff: -5,
} as const;

export const STAFF_LABEL: Record<string, string> = { secretary: 'the secretary', dre: 'the director of religious education', music_director: 'the music director', maintenance: 'the maintenance man' };

/** The staff of the current parish, in the order of the desks. */
export function staffOf(state: GameState): { tag: string; npc: Npc | null }[] {
  const pid = state.assignment?.parishId;
  const parish = currentParish(state);
  if (!pid || !parish) return [];
  return STAFF_SPECS.filter((s) => s.when(parish)).map((s) => ({
    tag: s.tag,
    npc: Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(s.tag) && n.tags.includes(`parish:${pid}`)) ?? null,
  }));
}

export function vacanciesOf(state: GameState): string[] {
  return staffOf(state).filter((s) => !s.npc).map((s) => s.tag);
}

/** Whether the man may hire and fire: the pastor's staff, or the administrator's. */
export function mayManageStaff(state: GameState): { ok: boolean; why: string | null } {
  if (!controlsMoney(state)) return { ok: false, why: "The pastor's staff, not yours" };
  return { ok: true, why: null };
}

/** Three candidates for an empty desk, rolled once and kept until one is hired. */
export function candidatesFor(state: GameState, tag: string, rng: Rng, parish: Parish): Npc[] {
  const year = new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
  return [0, 1, 2].map((i) => generateStaffMember(rng.derive(`candidate:${tag}:${state.clock.week}:${i}`), parish, state.world?.diocese.presetId ?? 'chicago', year, tag, `${parish.id}_${tag}_${state.clock.week}_${i}`));
}

/** What a candidate would be like, in a line. */
export function candidateLine(n: Npc): string {
  const order = n.stats.administration >= 55 ? 'runs a tight desk' : n.stats.administration >= 40 ? 'keeps up' : 'will need watching';
  const warmth = n.stats.charisma >= 55 ? 'the people would take to her at once' : n.stats.charisma >= 40 ? 'pleasant enough' : 'not a warm person';
  const lean = n.alignment <= -30 ? 'wears a scapular' : n.alignment >= 30 ? 'asked about the parish council first' : 'asked about the hours';
  return `${order.charAt(0).toUpperCase() + order.slice(1)}; ${warmth.replace('her', n.name.first.endsWith('a') ? 'her' : 'him')}; ${lean}.`;
}

/** Let a member of staff go. The people mind, the staff mind more, and the desk is empty. */
export function letGo(state: GameState, npcId: string): GameState {
  const may = mayManageStaff(state);
  if (!may.ok) throw new Error(may.why ?? 'not allowed');
  const npc = state.npcs[npcId];
  const tag = npc?.tags.find((t) => t in STAFF_LABEL);
  if (!npc || !tag || npc.status !== 'active') throw new Error('no such member of staff');
  const pid = state.assignment!.parishId;
  let next: GameState = { ...state, npcs: { ...state.npcs, [npcId]: { ...npc, status: 'dismissed' } } };
  for (const other of Object.values(next.npcs)) {
    if (other.id !== npcId && other.status === 'active' && other.tags.includes('staff') && other.tags.includes(`parish:${pid}`)) {
      next = { ...next, npcs: { ...next.npcs, [other.id]: { ...other, relationship: Math.max(-100, other.relationship + STAFF.letGoStaff) } } };
    }
  }
  const liked = npc.relationship >= 20 || (state.parish?.weeksServed ?? 0) < 52;
  next = applyEffects(next, [{ target: 'reputation', key: 'parishioners', delta: STAFF.letGoPeople + (liked ? STAFF.letGoLiked : 0) }], {}, `letting ${STAFF_LABEL[tag]} go`);
  return {
    ...next,
    flags: { ...next.flags, [`staff:let_go:${tag}`]: true, staff_let_go_any: true, 'staff:let_go_any': true },
    career: [...next.career, { week: state.clock.week, kind: 'note', text: `Let ${npc.name.first} ${npc.name.last}, ${STAFF_LABEL[tag]}, go.` }],
  };
}

/** Hire one of the candidates for a desk. */
export function hire(state: GameState, candidateId: string): GameState {
  const may = mayManageStaff(state);
  if (!may.ok) throw new Error(may.why ?? 'not allowed');
  const hiring = state.parish?.hiring ?? {};
  const tag = Object.keys(hiring).find((t) => hiring[t]!.some((c) => c.id === candidateId));
  const candidate = tag ? hiring[tag]!.find((c) => c.id === candidateId) : undefined;
  if (!tag || !candidate || !state.parish) throw new Error('nobody by that name came to interview');
  const rest = { ...hiring };
  delete rest[tag];
  return {
    ...state,
    npcs: { ...state.npcs, [candidate.id]: candidate },
    parish: { ...state.parish, hiring: rest, staffHired: { ...(state.parish.staffHired ?? {}), [tag]: state.clock.week } },
    flags: { ...state.flags, [`staff:new:${tag}`]: true, [`staff:vacancy:${tag}`]: false },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Hired ${candidate.name.first} ${candidate.name.last} as ${STAFF_LABEL[tag]}.` }],
  };
}

/**
 * The week: a desk found empty gets its candidates; a hire stops being new
 * after half a year; a member of staff who cannot stand the priest may leave.
 */
export function staffWeek(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const parish = currentParish(state);
  if (!state.parish || !parish) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  const pid = parish.id;
  // Someone leaves.
  for (const { npc, tag } of staffOf(next)) {
    if (npc && npc.relationship <= STAFF.quitBelow && rng.derive(`quit:${npc.id}:${state.clock.week}`).chance(STAFF.quitChance)) {
      next = { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, status: 'left' } } };
      lines.push(`${npc.name.first} ${npc.name.last}, ${STAFF_LABEL[tag]}, gave notice. Nobody in the office was surprised.`);
    }
  }
  // Empty desks get their candidates.
  const hiring = { ...(next.parish!.hiring ?? {}) };
  const flags = { ...next.flags };
  for (const tag of vacanciesOf(next)) {
    flags[`staff:vacancy:${tag}`] = true;
    if (!hiring[tag]) hiring[tag] = candidatesFor(next, tag, rng, parish);
  }
  for (const tag of Object.keys(hiring)) if (!vacanciesOf(next).includes(tag)) delete hiring[tag];
  // A hire stops being new.
  for (const [tag, week] of Object.entries(next.parish!.staffHired ?? {})) if (state.clock.week - week >= STAFF.newWeeks) flags[`staff:new:${tag}`] = false;
  next = { ...next, flags, parish: { ...next.parish!, hiring } };
  void pid;
  return { state: next, lines };
}
