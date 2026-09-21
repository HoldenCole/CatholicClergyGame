import type { GameState, PermissionDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { permissionDefs } from '@/content/religious';
import { currentHouse, priorOf, setHouse } from './house';

/**
 * Poverty: the player has no money, and every personal expense is a
 * permission from the prior, granted or refused on his regard for the man,
 * the house budget, his own temperament, and precedent. E3 §3.4. Tunables
 * are invented.
 */
export const POVERTY = {
  /** The prior's regard moves the chance by this much across −100..100. */
  regardSwing: 0.35,
  /** A cost above this share of the house budget is hard to grant. */
  budgetStrain: 0.05,
  /** Temperament, as a bias on the chance. */
  temperament: { brisk: 0.05, contemplative: 0, scholarly: 0.05, warm: 0.12, severe: -0.18 } as Record<string, number>,
  /** Each earlier grant of the same thing to this man makes the next a little easier; each refusal a little harder. */
  precedent: 0.06,
  /** Asking is not free of standing: the brothers hear. */
  askCommunity: -0.5,
} as const;

export interface PermissionOffer {
  def: PermissionDef;
  available: boolean;
  why: string;
  /** What the man can guess of his chances, in words. */
  odds: string;
}

function lastAsked(state: GameState, id: string): number | undefined {
  return state.religious?.permissions.filter((p) => p.id === id).at(-1)?.week;
}

/** The chance the prior says yes, 0..1. Pure. */
export function permissionChance(state: GameState, def: PermissionDef): number {
  const house = currentHouse(state);
  const prior = priorOf(state, house);
  if (!house || !prior) return 0;
  let p = def.ease;
  p += (prior.relationship / 100) * POVERTY.regardSwing;
  if (def.cost > house.budget * POVERTY.budgetStrain) p -= 0.25;
  if (def.cost > house.budget * POVERTY.budgetStrain * 3) p -= 0.25;
  p += POVERTY.temperament[prior.temperament ?? 'contemplative'] ?? 0;
  const history = state.religious?.permissions.filter((r) => r.id === def.id) ?? [];
  for (const h of history) p += h.granted ? POVERTY.precedent : -POVERTY.precedent;
  return Math.max(0.02, Math.min(0.98, p));
}

function oddsWord(p: number): string {
  if (p >= 0.8) return 'He will say yes.';
  if (p >= 0.55) return 'He will probably say yes.';
  if (p >= 0.3) return 'It could go either way.';
  return 'He will probably say no.';
}

export function permissionOffers(state: GameState): PermissionOffer[] {
  const r = state.religious;
  if (!r || !currentHouse(state)) return [];
  return permissionDefs.map((def) => {
    const last = lastAsked(state, def.id);
    const wait = last !== undefined ? last + def.cooldown - state.clock.week : 0;
    const available = wait <= 0;
    return { def, available, why: available ? '' : `Asked already; not again for ${Math.ceil(wait / 4)} months`, odds: oddsWord(permissionChance(state, def)) };
  });
}

/** Ask the prior. The answer is rolled once, recorded, and remembered as precedent. */
export function askPermission(state: GameState, id: string, rng: Rng): { state: GameState; granted: boolean; line: string } {
  const r = state.religious;
  const def = permissionDefs.find((d) => d.id === id);
  const house = currentHouse(state);
  if (!r || !def || !house) throw new Error(`cannot ask for ${id}`);
  const offer = permissionOffers(state).find((o) => o.def.id === id)!;
  if (!offer.available) return { state, granted: false, line: offer.why };
  const granted = rng.chance(permissionChance(state, def));
  let next: GameState = { ...state, religious: { ...r, permissions: [...r.permissions, { id, week: state.clock.week, granted }] } };
  if (granted) {
    next = setHouse(next, { ...house, budget: house.budget - def.cost });
    if (def.flag) next = { ...next, flags: { ...next.flags, [`permission:${def.flag}`]: next.clock.week } };
  }
  const c = next.character;
  if (c) next = { ...next, character: { ...c, reputation: { ...c.reputation, community: Math.max(-100, (c.reputation.community ?? 0) + POVERTY.askCommunity) } } };
  return { state: next, granted, line: granted ? def.line.granted : def.line.refused };
}
