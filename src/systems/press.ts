import type { GameState } from '@/types';
import columns from '@/content/parish/columns.json';
import type { Condition, Effect } from '@/types';
import { applyEffects } from '@/engine/effects';
import { evaluateAll } from '@/engine/conditions';
import { recordPosition } from './reputation';

/** A column in the diocesan paper: a topic, a stance, and a public position that draws replies. Requested in playtesting; numbers invented. */
export const PRESS = {
  /** Weeks between columns: the editor has other priests. */
  everyWeeks: 13,
  /** The block of the week the writing takes. */
  apCost: 1,
  /** A column that lands on the far side of the bishop's own mind costs the chancery's warmth. */
  crossBishopGap: 45,
  crossChancery: -3,
  crossBishop: -3,
} as const;

export interface ColumnStance {
  id: string;
  label: string;
  /** −100 traditional .. +100 progressive, the position the column takes. */
  value: number;
  line: string;
  effects: Effect[];
}

export interface ColumnTopic {
  id: string;
  label: string;
  blurb: string;
  requires?: Condition[];
  stances: ColumnStance[];
}

export const columnTopics = (columns as { topics: ColumnTopic[] }).topics;

export function columnTopic(id: string): ColumnTopic | undefined {
  return columnTopics.find((t) => t.id === id);
}

/** Weeks until the editor will take another, 0 when he will. */
export function weeksUntilColumn(state: GameState): number {
  const last = state.flags['column:last'];
  if (typeof last !== 'number') return 0;
  return Math.max(0, PRESS.everyWeeks - (state.clock.week - last));
}

export function mayWriteColumn(state: GameState): { ok: boolean; why: string | null } {
  if (!state.parish || !state.character) return { ok: false, why: 'No desk to write at' };
  if (state.away) return { ok: false, why: 'You are away' };
  const wait = weeksUntilColumn(state);
  if (wait > 0) return { ok: false, why: `The editor has other priests; ${wait} more week${wait === 1 ? '' : 's'}` };
  return { ok: true, why: null };
}

export function topicsFor(state: GameState): { topic: ColumnTopic; available: boolean; why: string | null }[] {
  const may = mayWriteColumn(state);
  return columnTopics.map((topic) => {
    if (!may.ok) return { topic, available: false, why: may.why };
    if (topic.requires && !evaluateAll(topic.requires, state)) return { topic, available: false, why: 'Not yours to write on yet' };
    return { topic, available: true, why: null };
  });
}

/** Write it: a public position, the stance's effects, a block of next week, and the flags the replies read. */
export function writeColumn(state: GameState, topicId: string, stanceId: string): GameState {
  const may = mayWriteColumn(state);
  if (!may.ok) throw new Error(may.why ?? 'not now');
  const topic = columnTopic(topicId);
  const stance = topic?.stances.find((s) => s.id === stanceId);
  if (!topic || !stance) throw new Error('no such column');
  if (topic.requires && !evaluateAll(topic.requires, state)) throw new Error('Not yours to write on yet');
  const why = `a column on ${topic.label.toLowerCase()}`;
  let next = applyEffects(state, stance.effects, {}, why);
  next = { ...next, character: recordPosition(next.character!, { topic: topic.id, value: stance.value, volume: 'public', week: state.clock.week }) };
  const bishop = next.world ? next.npcs[next.world.diocese.hidden.bishop.npcId] : undefined;
  const crossed = !!bishop && Math.abs(stance.value - bishop.alignment) >= PRESS.crossBishopGap && Math.abs(stance.value) >= 40;
  if (crossed) next = applyEffects(next, [{ target: 'reputation', key: 'chancery', delta: PRESS.crossChancery }, { target: 'relationship', key: '@bishop', delta: PRESS.crossBishop }], {}, `${why}, on the far side of the bishop`);
  const flags: GameState['flags'] = { ...next.flags, 'column:written': true, 'column:last': state.clock.week, [`column:${topic.id}`]: true, 'column:topic': topic.id, 'column:stance': stance.id, 'column:crossed_bishop': crossed };
  return {
    ...next,
    flags,
    parish: next.parish ? { ...next.parish, apNextWeek: (next.parish.apNextWeek ?? 0) - PRESS.apCost } : next.parish,
    career: [...next.career, { week: state.clock.week, kind: 'note', text: `Wrote for the diocesan paper on ${topic.label.toLowerCase()}: ${stance.label.toLowerCase()}.` }],
  };
}
