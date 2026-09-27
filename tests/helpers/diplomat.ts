import { offerById } from '@/content/offers';
import { createRng } from '@/engine/rng';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { acceptAndGo } from './appointment';
import { parishState } from '../systems/week.test';
import type { GameState } from '@/types';

/** A young priest, three years ordained, back from Rome with Italian, whom Rome and the nuncio read well. */
export function young(seed: string): GameState {
  const base = nuncioWeek(parishState(seed)).state;
  const c = base.character!;
  return {
    ...base,
    flags: { ...base.flags, ordination_week: base.clock.week - 3 * 52, rome_alumnus: true, worked_at_the_holy_see: true },
    character: { ...c, entryYear: 2005, background: { ...c.background, entryAge: 22 }, credentials: [...c.credentials, 'italian', 'STL'], reputation: { ...c.reputation, rome: 60, chancery: 50 } },
  };
}

export function atAcademy(seed: string): GameState {
  const s = young(seed);
  const def = offerById('rome_diplomatic_academy')!;
  const open: GameState = { ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 4, bindings: {} }] };
  return acceptAndGo(open, def, createRng(`${seed}:go`)).state;
}

