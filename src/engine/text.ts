import type { GameState } from '@/types';
import { resolveSelector } from './selectors';

/** Tokens every piece of text can use, derived from state. Later phases add {diocese} and {parish}. */
export function textExtras(state: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.seminary) out.seminary = state.seminary.name;
  return out;
}

/**
 * Replace {tokens} in authored text.
 *   {name} {first_name} {surname}       the player
 *   {@rector} {@closest_classmate} ...  a bound or resolved NPC's short name
 *   {@rector.full} {@rector.first}     full name / first name only
 *   {diocese} {parish}                 filled in by later phases via `extra`
 * Unknown tokens are left visible so they show up in review.
 */
export function renderText(
  text: string,
  state: GameState,
  bindings: Record<string, string> = {},
  extra: Record<string, string> = {},
): string {
  return text.replace(/\{(@?[a-z_:0-9]+)(?:\.(full|first|last))?\}/g, (whole, token: string, form?: string) => {
    if (token.startsWith('@')) {
      const npc = resolveSelector(state, bindings[token] ?? token);
      if (!npc) return whole;
      const title = npc.title ? `${npc.title} ` : '';
      if (form === 'first') return npc.name.first;
      if (form === 'last') return `${title}${npc.name.last}`.trim();
      if (form === 'full') return `${title}${npc.name.first} ${npc.name.last}`.trim();
      // Short form: clergy by title and surname, everyone else by first name.
      return npc.title ? `${title}${npc.name.last}` : npc.name.first;
    }
    const c = state.character;
    switch (token) {
      case 'name':
        return c ? `${c.name.first} ${c.name.last}` : whole;
      case 'first_name':
        return c ? c.name.first : whole;
      case 'surname':
        return c ? c.name.last : whole;
      default:
        return extra[token] ?? textExtras(state)[token] ?? whole;
    }
  });
}
