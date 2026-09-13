import type { GameState } from '@/types';
import languages from '@/content/languages.json';
import { hoursOf } from './week';

export interface LanguageDef {
  id: string;
  label: string;
  credential: string;
  flag?: string;
  /** Hours of study to hold it. */
  hours: number;
  line: string;
}

export const languageDefs = (languages as { languages: LanguageDef[] }).languages;

export function languageDef(id: string): LanguageDef | undefined {
  return languageDefs.find((l) => l.id === id);
}

export function speaks(state: GameState, id: string): boolean {
  const def = languageDef(id);
  return !!def && !!state.character?.credentials.includes(def.credential);
}

/** What a priest is studying in the routine's study hours, if anything. */
export function learningOf(state: GameState): LanguageDef | undefined {
  const id = state.flags.learning;
  return typeof id === 'string' ? languageDef(id) : undefined;
}

export function hoursLearned(state: GameState, id: string): number {
  const v = state.flags[`language_hours:${id}`];
  return typeof v === 'number' ? v : 0;
}

/** The languages a priest could take up: not held, and not the one already in hand. */
export function learnable(state: GameState): LanguageDef[] {
  return languageDefs.filter((l) => !speaks(state, l.id));
}

/** Take up a language, or put it down. */
export function setLearning(state: GameState, id: string | null): GameState {
  const flags: GameState['flags'] = { ...state.flags };
  if (id === null) {
    delete flags.learning;
    return { ...state, flags };
  }
  const def = languageDef(id);
  if (!def) throw new Error('no such language');
  if (speaks(state, id)) throw new Error(`You have ${def.label} already.`);
  flags.learning = id;
  return { ...state, flags, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Took up ${def.label}, an hour of study at a time.` }] };
}

/** Study blocks spent this week go to the language in hand; the credential comes when the hours are in. */
export function learnWeek(state: GameState, blocks: number): { state: GameState; line: string | null } {
  const def = learningOf(state);
  if (!def || blocks <= 0 || !state.character) return { state, line: null };
  const hours = hoursLearned(state, def.id) + hoursOf(blocks);
  const flags: GameState['flags'] = { ...state.flags, [`language_hours:${def.id}`]: hours };
  if (hours < def.hours) return { state: { ...state, flags }, line: null };
  delete flags.learning;
  if (def.flag) flags[def.flag] = true;
  const c = state.character;
  return {
    state: { ...state, flags, character: { ...c, credentials: c.credentials.includes(def.credential) ? c.credentials : [...c.credentials, def.credential] }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `${def.label}, learned an hour at a time.` }] },
    line: def.line,
  };
}
