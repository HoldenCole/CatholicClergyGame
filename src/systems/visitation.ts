import type { GameEvent, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { drawEvents } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';

/**
 * Once a year the bishop comes for confirmations and looks at the church,
 * the books, the music, and the school. The scene is authored (beat
 * 'visitation'); this decides the week. Requested in playtesting.
 */
export const VISITATION = {
  /** The visit falls somewhere in these weeks of the calendar year, fixed per parish. */
  firstWeek: 8,
  span: 36,
} as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The week of the calendar year (0..52) the bishop comes to this parish. */
export function visitationWeekOf(parishId: string): number {
  return VISITATION.firstWeek + (hash(parishId) % VISITATION.span);
}

function weekOfYear(state: GameState): number {
  const d = dateOf(state.clock);
  const start = Date.UTC(d.year, 0, 1);
  const now = Date.UTC(d.year, d.month - 1, d.day);
  return Math.floor((now - start) / (7 * 86_400_000));
}

/** Whether the visitation is due this week: a pastor or administrator, the parish's week, not yet this year. */
export function visitationDue(state: GameState): boolean {
  const p = state.parish;
  const role = state.assignment?.role;
  if (!p || !state.character || state.away || (role !== 'pastor' && role !== 'administrator')) return false;
  const year = dateOf(state.clock).year;
  if (p.visitationYear === year) return false;
  return weekOfYear(state) >= visitationWeekOf(p.parishId);
}

/** The bishop comes: one authored scene whose conditions hold, or a plain line when none does. */
export function visitationStep(state: GameState, rng: Rng, pool: GameEvent[]): { state: GameState; event: GameEvent | null; line: string | null } {
  if (!visitationDue(state)) return { state, event: null, line: null };
  const year = dateOf(state.clock).year;
  const next: GameState = { ...state, parish: { ...state.parish!, visitationYear: year } };
  const scenes = pool.filter((e) => e.beat === 'visitation');
  // What must be said this time comes before the draw.
  const urgent = scenes.filter((e) => (e.priority ?? 0) > 0 && evaluateAll(e.requires ?? [], next) && !next.history.some((h) => h.eventId === e.id && e.once)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : 1));
  let [event] = urgent.length ? [urgent[0]] : drawEvents(scenes, next, rng.derive(`visitation:${year}`), 1);
  if (!event) {
    const any = scenes.filter((e) => evaluateAll(e.requires ?? [], next));
    if (any.length) event = rng.derive(`visitation-any:${year}`).pick([...any].sort((a, b) => (a.id < b.id ? -1 : 1)));
  }
  return { state: next, event: event ?? null, line: event ? null : 'The bishop came for confirmations, shook every hand, and left before the cake.' };
}
