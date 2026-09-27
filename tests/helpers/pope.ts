import { sundayOf } from '@/engine/time';
import { seedCollege } from '@/systems/rome/college';
import { beginPontificate } from '@/systems/rome/pontificate';
import { parishState } from '../systems/week.test';
import type { GameState, Papacy } from '@/types';

const late: Papacy = { id: 'gen:9', name: 'Gregory XVII', born: 1950, electedDay: 0, endDay: 1, end: 'died', from: 'Italy', temperament: 0, historical: false };

/** A cardinal elected in a conclave this week, who has said accepto (E1 R1.6). */
export function elected(seed: string, alignment = 20): GameState {
  const base = parishState(seed);
  const day = sundayOf(base.clock);
  const c = base.character!;
  const s: GameState = {
    ...base,
    character: { ...c, alignment, entryYear: 1990, background: { ...c.background, entryAge: 22 }, reputation: { ...c.reputation, rome: 60 } },
    flags: { ...base.flags, cardinal: true, ordination_week: base.clock.week - 30 * 52 },
    rome: { ...base.rome!, popes: [{ ...late, endDay: day - 20 }], vacancy: { sinceDay: day - 20, electionDay: day - 2, cause: 'died', priorId: late.id }, college: seedCollege(seed, day).college },
  };
  return beginPontificate(s, 'Innocent XIV');
}
