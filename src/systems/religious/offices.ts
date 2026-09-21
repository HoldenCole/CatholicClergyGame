import type { GameState, OrderOfficeDef, OrderCredentialDef } from '@/types';
import { religiousOrder } from '@/content/religious';
import { applyEffects } from '@/engine/effects';
import { priesthoodYear } from '@/engine/time';
import { currentPosting } from './transfer';

/**
 * Appointed offices and the order's own credentials, as data on the order.
 * E3 §6.3–6.4, §7.3–7.4. The provincial appoints against stats and years;
 * elected offices are the chapter engine's.
 */
export interface OfficeOffer {
  def: OrderOfficeDef;
  available: boolean;
  why: string;
}

function yearsOrdained(state: GameState): number {
  const w = state.flags.ordination_week;
  return typeof w === 'number' ? priesthoodYear(state.clock.week, w).year : 0;
}

/** The appointed offices, and whether the provincial would give each to this man now. */
export function officeOffers(state: GameState): OfficeOffer[] {
  const r = state.religious;
  const c = state.character;
  if (!r || !c) return [];
  return religiousOrder(r.order).offices.filter((o) => o.kind === 'appointed').map((def) => {
    if (r.appointment?.id === def.id) return { def, available: false, why: 'Held now' };
    if (r.appointment) return { def, available: false, why: `Already ${religiousOrder(r.order).offices.find((o) => o.id === r.appointment!.id)?.label.toLowerCase() ?? 'in office'}` };
    if (r.office) return { def, available: false, why: 'An elected office is held' };
    if ((def.minYears ?? 0) > yearsOrdained(state)) return { def, available: false, why: `Not before ${def.minYears} years ordained` };
    for (const [k, v] of Object.entries(def.requires ?? {})) if (c.stats[k as keyof typeof c.stats] < (v ?? 0)) return { def, available: false, why: `The provincial wants more ${k}` };
    if ((c.reputation.superiors ?? 0) < -20) return { def, available: false, why: 'The provincial does not trust him' };
    return { def, available: true, why: '' };
  });
}

/** The provincial appoints; the man may be moved to the house the office lives in. */
export function appointOffice(state: GameState, id: string): GameState {
  const r = state.religious;
  const offer = officeOffers(state).find((o) => o.def.id === id);
  if (!r || !offer?.available) return state;
  const def = offer.def;
  const week = state.clock.week;
  let next: GameState = { ...state, religious: { ...r, appointment: { id, startWeek: week, endWeek: week + def.termYears * 52 } }, flags: { ...state.flags, [`office:${id}`]: week } };
  if (def.effects?.length) next = applyEffects(next, def.effects.map((e) => ({ target: e.target as 'reputation', key: e.key, delta: e.delta })), {}, `appointed ${def.label.toLowerCase()}`);
  return { ...next, career: [...next.career, { week, kind: 'promotion', text: `Appointed ${def.label.toLowerCase()}. ${def.line}` }] };
}

/** The term runs out: the office is laid down and the record keeps it. */
export function appointmentYear(state: GameState): GameState {
  const r = state.religious;
  if (!r?.appointment || state.clock.week < r.appointment.endWeek) return state;
  const { appointment, ...rest } = r;
  const flags = { ...state.flags };
  delete flags[`office:${appointment.id}`];
  return { ...state, flags, religious: { ...rest, termsServed: [...r.termsServed, { office: appointment.id, startWeek: appointment.startWeek, endWeek: appointment.endWeek }] } };
}

/** The order's credentials a man has earned by the years at the work named. */
export function dueCredentials(state: GameState): OrderCredentialDef[] {
  const r = state.religious;
  const c = state.character;
  if (!r || !c) return [];
  const yearsAt = (work: string) => r.assignments.filter((a) => a.work === work).reduce((n, a) => n + ((a.endWeek ?? state.clock.week) - a.startWeek) / 52, 0) + r.termsServed.filter((t) => t.office === work).reduce((n, t) => n + (t.endWeek - t.startWeek) / 52, 0);
  return religiousOrder(r.order).credentials.filter((d) => !c.credentials.includes(d.id) && yearsAt(d.work) >= d.afterYears);
}

/** Confer what is due. */
export function conferCredentials(state: GameState): { state: GameState; lines: string[] } {
  const due = dueCredentials(state);
  let next = state;
  const lines: string[] = [];
  for (const d of due) {
    next = { ...next, character: { ...next.character!, credentials: [...next.character!.credentials, d.id] } };
    if (d.effects?.length) next = applyEffects(next, d.effects.map((e) => ({ target: e.target as 'reputation', key: e.key, delta: e.delta })), {}, d.label);
    lines.push(`${d.label}: ${d.line}`);
    next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `${d.label} conferred.` }] };
  }
  const posting = currentPosting(next);
  void posting;
  return { state: next, lines };
}
