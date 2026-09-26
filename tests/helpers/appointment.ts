import type { GameState, OfferDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { acceptOffer } from '@/engine/offers';
import { grantAppointment, pendingAppointment } from '@/engine/appointment';

/** Say yes and have the bishop's letter come at once: the old one-step move, for tests about what follows it. */
export function acceptAndGo(state: GameState, def: OfferDef, rng: Rng): { state: GameState; failed: boolean } {
  const r = acceptOffer(state, def, rng);
  // Rome's letters move him at once (E1 §5): there is no bishop's letter to wait for.
  if (!pendingAppointment(r.state)) return r;
  return { state: grantAppointment(r.state, def, rng.derive('letter')), failed: r.failed };
}
