import type { ActiveOffer, Commitment, GameState, OfferDef, OfferRecord } from '@/types';
import { evaluateAll, evaluateCondition } from './conditions';
import { officeDef } from '@/content/parish';
import { applyEffects } from './effects';
import type { Rng } from './rng';
import { resolveSelector, selectorsIn } from './selectors';
import { askToGo } from './appointment';

/** Tunables. Invented. */
export const OFFERS = {
  /** Open offers at once. */
  maxOpen: 2,
  /** Each accepted offer in a cluster multiplies the arrival weight of its siblings by this. DESIGN §7.5 rule 4. */
  clusterMultiplier: 1.8,
  /** Weight is per-mille per week; this scales it. */
  weightScale: 1 / 1000,
  /** A declined or lapsed offer is not made again for this long. Invented. */
  reofferAfterWeeks: 104,
  /** "Not now, but keep my name": sooner, and likelier when it comes. Invented. */
  reofferAfterDeferWeeks: 78,
  deferredWeight: 1.5,
  deferRelationship: -3,
} as const;

/** Where a promised offer's due week is kept. */
export function dueFlag(def: OfferDef): string {
  return `offer_due:${def.id}`;
}

export function offerSelectors(def: OfferDef): string[] {
  const out = new Set(selectorsIn(def.title + ' ' + def.body + ' ' + def.accept.outcome + ' ' + def.decline.outcome));
  if (def.from) out.add(def.from);
  return [...out];
}

export function isOfferEligible(def: OfferDef, state: GameState): boolean {
  if (!def.phase.includes(state.phase)) return false;
  if (def.yearGate && (!state.seminary || !def.yearGate.includes(state.seminary.year))) return false;
  if (state.offers.some((o) => o.offerId === def.id)) return false;
  if (state.commitments.some((c) => c.offerId === def.id)) return false;
  if (def.once && state.offerHistory.some((h) => h.offerId === def.id && h.decision !== 'deferred')) return false;
  const last = [...state.offerHistory].reverse().find((h) => h.offerId === def.id);
  if (last && state.clock.week - last.week < (last.decision === 'deferred' ? OFFERS.reofferAfterDeferWeeks : OFFERS.reofferAfterWeeks)) return false;
  if (!evaluateAll(def.requires, state)) return false;
  for (const sel of offerSelectors(def)) if (!resolveSelector(state, sel)) return false;
  return true;
}

export function offerWeight(def: OfferDef, state: GameState): number {
  let w = def.weight;
  for (const b of def.bias ?? []) if (evaluateCondition(b.when, state)) w *= b.multiplier;
  if (def.cluster) w *= Math.pow(OFFERS.clusterMultiplier, state.clusters[def.cluster] ?? 0);
  if (state.flags[onFileFlag(def)]) w *= OFFERS.deferredWeight;
  return Math.max(0, w);
}

/**
 * One week of the offer engine: expire lapsed offers (a decline, with its
 * consequence), settle commitments that end this week, and maybe let one new
 * offer arrive. DESIGN.md §7.5 and CLAUDE.md rule 7.
 */
export function offersWeek(state: GameState, rng: Rng, defs: OfferDef[], lookup: (id: string) => OfferDef | undefined): GameState {
  let next = state;
  const week = next.clock.week;

  for (const open of next.offers.filter((o) => o.expiresWeek < week)) {
    const def = lookup(open.offerId);
    next = def ? settleDecline(next, def, open, 'expired') : { ...next, offers: next.offers.filter((o) => o !== open) };
  }
  // A job does something to a man every week he holds it.
  for (const c of next.commitments.filter((c) => c.endWeek > week)) {
    const weekly = c.offerId.startsWith('office:') ? officeDef(c.offerId.slice(7))?.weekly : lookup(c.offerId)?.accept.commitment?.weekly;
    if (weekly?.length) next = applyEffects(next, weekly, {}, c.label);
  }
  for (const c of next.commitments.filter((c) => c.endWeek <= week)) {
    next = { ...next, commitments: next.commitments.filter((x) => x !== c) };
    if (c.offerId.startsWith('office:')) {
      // A diocesan office held alongside the parish (parish/offices.json) ends with its own payout.
      const office = officeDef(c.offerId.slice(7));
      if (office?.onComplete?.length) next = applyEffects(next, office.onComplete);
      if (office) next = { ...next, career: [...next.career, { week, kind: 'note', text: `${office.label}: the years ended, and the chancery remembers them.` }] };
      continue;
    }
    const def = lookup(c.offerId);
    if (!def) continue;
    if (c.failed && def.failure) {
      next = applyEffects(next, def.failure.effects);
      next = record(next, def.id, 'failed');
    } else if (def.accept.commitment) {
      next = applyEffects(next, def.accept.commitment.onComplete);
      next = record(next, def.id, 'completed');
    }
  }

  if (next.offers.length >= OFFERS.maxOpen || next.mode.kind !== 'clock') return next;
  const eligible = defs.filter((d) => isOfferEligible(d, next));
  // A promised letter: the week it became due is written down, and it comes by then.
  const promised = eligible.filter((d) => d.guarantee && evaluateAll(d.guarantee.when, next));
  for (const d of promised) {
    if (typeof next.flags[dueFlag(d)] !== 'number') next = { ...next, flags: { ...next.flags, [dueFlag(d)]: week + d.guarantee!.withinWeeks } };
  }
  const due = promised.find((d) => Number(next.flags[dueFlag(d)]) <= week);
  const weights = new Map(eligible.map((d) => [d.id, offerWeight(d, next)]));
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total <= 0 && !due) return next;
  // One roll decides whether anything arrives; a second picks which.
  if (!due && !rng.chance(Math.min(1, total * OFFERS.weightScale))) return next;
  const chosen = due ?? rng.weighted(eligible, (d) => weights.get(d.id) ?? 0);
  if (chosen.guarantee || next.flags[onFileFlag(chosen)]) {
    const flags = { ...next.flags };
    delete flags[dueFlag(chosen)];
    delete flags[onFileFlag(chosen)];
    next = { ...next, flags };
  }
  const bindings: Record<string, string> = {};
  for (const sel of offerSelectors(chosen)) {
    const npc = resolveSelector(next, sel, rng);
    if (npc) bindings[sel] = npc.id;
  }
  const active: ActiveOffer = { offerId: chosen.id, arrivedWeek: week, expiresWeek: week + chosen.windowWeeks, bindings };
  return { ...next, offers: [...next.offers, active] };
}

function record(state: GameState, offerId: string, decision: OfferRecord['decision']): GameState {
  return { ...state, offerHistory: [...state.offerHistory, { offerId, week: state.clock.week, decision }] };
}

function settleDecline(state: GameState, def: OfferDef, open: ActiveOffer, decision: 'declined' | 'expired'): GameState {
  let next = applyEffects(state, def.decline.effects, open.bindings);
  if (def.from) {
    next = applyEffects(next, [{ target: 'relationship', key: def.from, delta: decision === 'expired' ? -12 : -8 }], open.bindings);
  }
  next = { ...next, offers: next.offers.filter((o) => o !== open) };
  return record(next, def.id, decision);
}

/** The flag that says a man asked to be kept on file for this. */
export function onFileFlag(def: OfferDef): string {
  return `on_file:${def.id}`;
}

/** Whether an offer takes "not now": someone other than the bishop asking for a man's years. */
export function canDefer(def: OfferDef): boolean {
  return !!def.accept.commitment?.away && def.from !== '@bishop';
}

/** Not now, but keep my name: a smaller cost than a no, and the letter comes again, sooner and likelier. */
export function deferOffer(state: GameState, def: OfferDef): GameState {
  const open = state.offers.find((o) => o.offerId === def.id);
  if (!open) throw new Error(`offer ${def.id} is not open`);
  if (!canDefer(def)) throw new Error(`offer ${def.id} does not take not now`);
  let next: GameState = { ...state, offers: state.offers.filter((o) => o !== open), flags: { ...state.flags, [onFileFlag(def)]: true } };
  if (def.from) next = applyEffects(next, [{ target: 'relationship', key: def.from, delta: OFFERS.deferRelationship }], open.bindings);
  return record(next, def.id, 'deferred');
}

export function declineOffer(state: GameState, def: OfferDef): GameState {
  const open = state.offers.find((o) => o.offerId === def.id);
  if (!open) throw new Error(`offer ${def.id} is not open`);
  return settleDecline(state, def, open, 'declined');
}

export interface AcceptResult {
  state: GameState;
  /** True when the failure roll went against an underqualified player. */
  failed: boolean;
}

export function acceptOffer(state: GameState, def: OfferDef, rng: Rng): AcceptResult {
  const open = state.offers.find((o) => o.offerId === def.id);
  if (!open) throw new Error(`offer ${def.id} is not open`);
  if (!evaluateAll(def.requires, state, open.bindings)) throw new Error(`offer ${def.id} no longer meets its requirements`);

  let failed = false;
  if (def.failure && !evaluateAll(def.failure.unless, state, open.bindings)) {
    failed = rng.chance(def.failure.chance);
  }
  let next: GameState = { ...state, offers: state.offers.filter((o) => o !== open) };
  next = applyEffects(next, def.accept.effects, open.bindings);
  if (def.cluster) next = { ...next, clusters: { ...next.clusters, [def.cluster]: (next.clusters[def.cluster] ?? 0) + 1 } };
  next = record(next, def.id, 'accepted');

  const c = def.accept.commitment;
  if (c?.away) {
    // Years away are not a background commitment, and not his to take: the bishop's letter moves him.
    return { state: askToGo(next, def, failed, rng), failed };
  }
  if (c) {
    const commitment: Commitment = {
      offerId: def.id,
      label: c.label,
      startWeek: state.clock.week,
      endWeek: state.clock.week + c.weeks,
      apPerWeek: c.apPerWeek,
      failed,
    };
    next = { ...next, commitments: [...next.commitments, commitment] };
  } else if (failed && def.failure) {
    next = applyEffects(next, def.failure.effects, open.bindings);
    next = record(next, def.id, 'failed');
  }
  return { state: next, failed };
}

/** AP consumed each week by background commitments. Read by the parish loop. */
export function commitmentAp(state: GameState): number {
  return state.commitments.reduce((n, c) => n + c.apPerWeek, 0);
}
