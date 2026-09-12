import type { GameState, OfferDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { acceptOffer } from '@/engine/offers';
import { grantAppointment } from '@/engine/appointment';

/** Say yes and have the bishop's letter come at once: the old one-step move, for tests about what follows it. */
export function acceptAndGo(state: GameState, def: OfferDef, rng: Rng): { state: GameState; failed: boolean } {
  const r = acceptOffer(state, def, rng);
  return { state: grantAppointment(r.state, def, rng.derive('letter')), failed: r.failed };
}
