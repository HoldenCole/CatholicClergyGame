import type { GameEvent, GameState, PendingEvent } from '@/types';
import { resolveSelector } from '@/engine/selectors';
import { seasonOf } from '@/engine/time';
import { renderText } from '@/engine/text';
import { SEASON_LABELS } from '@/engine/calendar';
import { PROBLEM_LABEL } from '@/generation/parishes';

/**
 * The narrow, explicitly constructed context the model receives. CLAUDE.md:
 * never the full save. Everything here is already resolved; the model
 * writes prose about it and decides nothing.
 */
export interface SkinContext {
  kind: 'event' | 'outcome' | 'arc';
  characterName: string;
  role: string;
  year: number;
  season: string;
  diocese: string | null;
  parish: { name: string; place: string; kind: string; problem: string; terrain: string } | null;
  people: { name: string; role: string; standing: string }[];
  title: string;
  /** The authored text, with tokens rendered. The model rewrites it; it does not change what happened. */
  authored: string;
  flavorPrompt: string | null;
}

/** DESIGN 11 and CLAUDE.md: sensitive material is never routed through the model. */
export function isSensitive(event: GameEvent): boolean {
  if (!event.flavorPrompt) return true;
  if (event.category === 'scandal') return true;
  if (event.pressure.some((p) => p === 'doubt' || p === 'body_vs_vow')) return true;
  return false;
}

function standing(v: number): string {
  if (v >= 40) return 'a friend';
  if (v >= 15) return 'warm';
  if (v > -15) return 'civil';
  if (v > -40) return 'cool';
  return 'hostile';
}

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

function base(state: GameState): Omit<SkinContext, 'kind' | 'title' | 'authored' | 'flavorPrompt' | 'people'> {
  const c = state.character!;
  const parish = state.world && state.assignment ? state.world.parishes.find((p) => p.id === state.assignment!.parishId) : undefined;
  return {
    characterName: `${c.name.first} ${c.name.last}`,
    role: state.phase === 'seminary' ? `seminarian, year ${state.seminary?.year ?? 1}` : (state.assignment?.role ?? 'priest').replace('_', ' '),
    year: calendarYear(state),
    season: SEASON_LABELS[seasonOf(state.clock)],
    diocese: state.world?.diocese.visible.name ?? null,
    parish: parish ? { name: parish.name, place: parish.place, kind: parish.kind.replace('_', ' '), problem: PROBLEM_LABEL[parish.problem] ?? parish.problem, terrain: parish.terrain } : null,
  };
}

export function eventContext(state: GameState, event: GameEvent, pending: PendingEvent, choiceOutcome?: string): SkinContext {
  const people: SkinContext['people'] = [];
  for (const [selector, id] of Object.entries(pending.bindings)) {
    const npc = resolveSelector(state, id);
    if (!npc) continue;
    const title = npc.title ? `${npc.title} ` : '';
    people.push({ name: `${title}${npc.name.first} ${npc.name.last}`, role: selector.slice(1).replace(/_/g, ' '), standing: standing(npc.relationship) });
  }
  return {
    ...base(state),
    kind: choiceOutcome ? 'outcome' : 'event',
    people,
    title: renderText(event.title, state, pending.bindings),
    authored: renderText(choiceOutcome ?? event.body, state, pending.bindings),
    flavorPrompt: event.flavorPrompt ?? null,
  };
}

/** The arc-start portrait: the parish, the pastor, the staff, in a few paragraphs. */
export function arcContext(state: GameState): SkinContext | null {
  const parish = state.world && state.assignment ? state.world.parishes.find((p) => p.id === state.assignment!.parishId) : undefined;
  if (!parish) return null;
  const people: SkinContext['people'] = [];
  const pastor = state.npcs[parish.pastorId];
  if (pastor && state.assignment?.role === 'parochial_vicar') people.push({ name: `${pastor.title} ${pastor.name.first} ${pastor.name.last}`, role: 'pastor', standing: standing(pastor.relationship) });
  for (const id of parish.staffIds) {
    const n = state.npcs[id];
    if (n) people.push({ name: `${n.name.first} ${n.name.last}`, role: (n.tags[0] ?? 'staff').replace('_', ' '), standing: standing(n.relationship) });
  }
  return {
    ...base(state),
    kind: 'arc',
    people,
    title: `${parish.name}, ${parish.place}`,
    authored: `${parish.name} in ${parish.place}: about ${parish.households} households, ${parish.generational}, ${parish.school === 'none' ? 'no school' : `a school that is ${parish.school.replace('_', ' ')}`}. ${PROBLEM_LABEL[parish.problem] ?? ''}`,
    flavorPrompt: 'A portrait of the parish and the people in the rectory on the new priest’s first week.',
  };
}
