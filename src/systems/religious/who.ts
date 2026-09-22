import type { GameState } from '@/types';
import { religiousOrder } from '@/content/religious';
import { formationStage } from './formation';
import { currentHouse } from './house';
import { currentPosting } from './transfer';

/**
 * What a friar is, in a word and in a line: the stage of formation, the
 * office held, the posting. One place, so the plate, the profile, the
 * briefing, and the model's context never disagree about him. E3.
 */

const WORK_WORD: Record<string, string> = {
  parish: 'at the parish',
  school: 'at the school',
  teaching: 'teaching',
  formation: 'in formation work',
  mission: 'at the mission',
  curia: 'at the curia',
  priory_church: 'at the priory church',
  preaching: 'preaching',
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The word on the plate: Novice, Student brother, Prior, Friar, at the parish. */
export function friarWord(state: GameState): string | null {
  const r = state.religious;
  if (!r) return null;
  if (!state.flags.ordained) {
    const stage = formationStage(state);
    return stage ? (stage.house === 'novitiate' ? 'Novice' : stage.house === 'priory' ? 'Pre-novice' : 'Student brother') : 'Novice';
  }
  const order = religiousOrder(r.order);
  if (r.office) return cap(r.office.office === 'prior' ? order.governance.priorTitle : order.governance.provincialTitle);
  if (r.appointment) return order.offices.find((o) => o.id === r.appointment!.id)?.label ?? 'Friar';
  const work = currentPosting(state)?.work;
  const word = work ? WORK_WORD[work] : undefined;
  return word ? `Friar, ${word}` : 'Friar';
}

/** The line on the profile: what he is doing now, and where. */
export function friarPost(state: GameState): string | null {
  const r = state.religious;
  if (!r) return null;
  const order = religiousOrder(r.order);
  const house = currentHouse(state);
  const at = house ? house.name : 'the house';
  if (!state.flags.ordained) {
    const stage = formationStage(state);
    const year = state.seminary?.year ?? 1;
    return `${stage?.label ?? 'In formation'}, year ${year}, at ${at}`;
  }
  if (r.office) return r.office.office === 'prior' ? `${cap(order.governance.priorTitle)} of ${at}` : `${cap(order.governance.provincialTitle)}, ${state.province?.name ?? 'the province'}`;
  if (r.appointment) {
    const label = order.offices.find((o) => o.id === r.appointment!.id)?.label ?? 'In office';
    return `${label}, ${state.province?.name ?? 'the province'}`;
  }
  if (r.apostolate) return `${r.apostolate.label}, from ${at}`;
  const work = currentPosting(state)?.work;
  const word = work ? WORK_WORD[work] : undefined;
  return word ? `Friar of ${at}, ${word}` : `Friar of ${at}`;
}

/** For the model's context: a short role, never the save. */
export function friarRole(state: GameState): string | null {
  const w = friarWord(state);
  return w ? w.toLowerCase() : null;
}
