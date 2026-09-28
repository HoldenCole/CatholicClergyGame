import type { GameState } from '@/types';
import { resolveSelector } from './selectors';
import { pendingAppointment, APPOINTMENT_FLAGS } from './appointment';
import { offerById } from '@/content/offers';
import { studyProgram } from '@/content/study';
import { townTokens } from '@/systems/town';
import { romeTokens } from '@/systems/rome/policy';
import { reversalTokens } from '@/systems/rome/reversal';
import { nuncioTokens } from '@/systems/rome/nuncioText';
import { curiaTokens } from '@/systems/rome/curia';
import { collegeTokens } from '@/systems/rome/college';
import { romanTokens } from '@/systems/religious/mitre';
import { visitationTokens } from '@/systems/religious/visitation';
import { directionTokens } from '@/systems/bishop/directions';
import { visitTokens } from '@/systems/bishop/visits';
import { seminaryTokens } from '@/systems/bishop/seminary';
import { popeTokens } from '@/systems/rome/pontificateText';
import { diplomacyTokens } from '@/systems/rome/diplomacy';

/** Tokens every piece of text can use, derived from state. Later phases add {diocese} and {parish}. */
export function textExtras(state: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.seminary) out.seminary = state.seminary.name;
  if (state.study) {
    out.school = state.study.school;
    out.residence = state.study.residence;
    out.city = state.study.city === 'rome' ? 'Rome' : state.study.city === 'washington' ? 'Washington' : 'the diocese';
    if (state.study.city === 'campus') out.city = 'the campus';
  }
  if (state.world) out.diocese = state.world.diocese.visible.name;
  const pending = pendingAppointment(state);
  const program = pending ? studyProgram(offerById(pending.offerId)?.accept.commitment?.away ?? '') : undefined;
  if (program) {
    out.appointment = program.label.toLowerCase();
    out.appointment_residence = program.residence;
  }
  const from = state.flags[APPOINTMENT_FLAGS.from];
  if (typeof from === 'string') out.appointment_from = from;
  else if (pending && state.assignment) {
    // A letter scheduled before he had a parish (home from Rome to wait for the Academy's October): the one he has now.
    const parish = state.world?.parishes.find((p) => p.id === state.assignment!.parishId);
    if (parish) out.appointment_from = parish.name;
  }
  if (state.world && state.assignment) {
    const parish = state.world.parishes.find((p) => p.id === state.assignment!.parishId);
    if (parish) out.parish = parish.name;
  }
  Object.assign(out, townTokens(state));
  Object.assign(out, romeTokens(state));
  Object.assign(out, reversalTokens(state));
  Object.assign(out, nuncioTokens(state));
  Object.assign(out, curiaTokens(state));
  Object.assign(out, collegeTokens(state));
  Object.assign(out, romanTokens(state));
  Object.assign(out, visitationTokens(state));
  Object.assign(out, directionTokens(state));
  Object.assign(out, visitTokens(state));
  Object.assign(out, seminaryTokens(state));
  Object.assign(out, popeTokens(state));
  Object.assign(out, diplomacyTokens(state));
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
