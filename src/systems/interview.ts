import type { GameState, InterviewAnswer, InterviewQuestion } from '@/types';
import { interviewContent } from '@/content/seminary';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { renderText } from '@/engine/text';
import { resolveSelector } from '@/engine/selectors';
import { recordPosition } from './reputation';
import { positionWeight } from './religious/study';

/**
 * The vocations director's interview at the start of formation (DESIGN §6.1a).
 * Requested in playtesting: a conversation before the first year that shapes
 * the record, the first summer, the opinions on file, and the tracks the
 * chancery hears a man wants. Every answer is authored content; nothing is
 * rolled. A friar's entry is the novice master's and has no interview yet.
 */
export const INTERVIEW = {
  /** Taking the summer he asked for in the room: the director remembers. */
  summerAsAskedRelationship: 4,
  /** ...and writes it down. */
  summerAsAskedNote: 1,
} as const;

/** The flag an answer sets to say which summer he asked for. */
export const SUMMER_WANTED = 'summer_wanted:';

export function interviewer(state: GameState) {
  return resolveSelector(state, '@vocation_director');
}

/** The questions this man is asked, in order: a man with a past is asked about it, a man without is not. */
export function interviewQuestions(state: GameState): InterviewQuestion[] {
  return interviewContent.questions.filter((q) => evaluateAll(q.when, state));
}

/** The answers open to him on a question. */
export function interviewAnswers(state: GameState, q: InterviewQuestion): { answer: InterviewAnswer; available: boolean }[] {
  return q.answers.map((answer) => ({ answer, available: evaluateAll(answer.requires, state) }));
}

/** The interview begins, when there is a director to give it and a question to ask; otherwise the year begins. */
export function beginInterview(state: GameState): GameState {
  if (state.religious || !state.seminary || state.flags['interview:done'] || !interviewer(state) || interviewQuestions(state).length === 0) return state;
  return { ...state, mode: { kind: 'interview', index: 0 } };
}

function bindings(state: GameState): Record<string, string> {
  const d = interviewer(state);
  return d ? { '@vocation_director': d.id } : {};
}

/** One answer given: its effects, its opinion if it was one, its note, and the next question or the year. */
export function answerInterview(state: GameState, answerId: string): GameState {
  if (state.mode.kind !== 'interview') return state;
  const questions = interviewQuestions(state);
  const q = questions[state.mode.index];
  if (!q) return closeInterview(state, questions);
  const answer = q.answers.find((a) => a.id === answerId);
  if (!answer) throw new Error(`interview question ${q.id} has no answer ${answerId}`);
  if (!evaluateAll(answer.requires, state)) throw new Error(`interview answer ${answerId} of ${q.id} is not open to him`);
  const b = bindings(state);
  let next = applyEffects(state, answer.effects, b, 'the vocations director');
  if (answer.volume && answer.positionTopic !== undefined && answer.positionValue !== undefined && next.character) {
    next = { ...next, character: recordPosition(next.character, { topic: answer.positionTopic, value: answer.positionValue, volume: answer.volume, week: state.clock.week }, positionWeight(next, answer.positionTopic)) };
  }
  next = { ...next, flags: { ...next.flags, [`interview:${q.id}`]: answer.id } };
  const said = renderText(answer.outcome, next, b);
  const index = state.mode.index + 1;
  if (index >= questions.length) return closeInterview({ ...next, mode: { kind: 'interview', index, said } }, questions);
  return { ...next, mode: { kind: 'interview', index, said } };
}

function closeInterview(state: GameState, questions: InterviewQuestion[]): GameState {
  const answered = questions.map((q) => state.flags[`interview:${q.id}`]).filter((a): a is string => typeof a === 'string');
  const d = interviewer(state);
  const who = d ? `${d.title ? `${d.title} ` : ''}${d.name.last}, the vocations director` : 'the vocations director';
  return {
    ...state,
    flags: { ...state.flags, 'interview:done': true },
    mode: { kind: 'year_start', year: state.seminary!.year },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Interviewed by ${who} before the first year: ${answered.length} questions, and a page of notes you will not see.` }],
  };
}

/** Whether he asked the director for this summer in the room. */
export function summerWanted(state: GameState, summerId: string): boolean {
  return !!state.flags[`${SUMMER_WANTED}${summerId}`];
}

/** The summer he asked for, taken: the director remembers, and the ask is spent. */
export function summerAsAsked(state: GameState, summerId: string): GameState {
  if (!summerWanted(state, summerId)) return state;
  const flags = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith(SUMMER_WANTED)) delete flags[k];
  const d = interviewer(state);
  let next: GameState = { ...state, flags: { ...flags, 'summer:as_asked': true } };
  if (d) {
    next = applyEffects(next, [
      { target: 'relationship', key: d.id, delta: INTERVIEW.summerAsAskedRelationship },
      { target: 'file', key: d.id, value: 'Took the summer he asked for at the interview, and went without being pushed.', delta: INTERVIEW.summerAsAskedNote },
    ]);
  }
  return next;
}
