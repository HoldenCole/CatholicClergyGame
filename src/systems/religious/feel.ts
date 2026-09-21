import type { GameState } from '@/types';
import { religiousOrder } from '@/content/religious';

/**
 * How the order feels, in words the sheets can use: one line per mechanic
 * the order's data switches on. E3 §10. Nothing here tests the key; each
 * line hangs on a flag or a number in OrderDef.mechanics.
 */
export function pietyLabelsOf(state: Pick<GameState, 'religious'>): string[] {
  const r = state.religious;
  if (!r) return [];
  const m = religiousOrder(r.order).mechanics;
  const out: string[] = [];
  if (m.choralOfficeExtraAp) out.push('The Office is sung in choir, and it is heavy.');
  if (m.studyApDiscount) out.push('Study time is protected; the library is the order\'s work.');
  if (m.studyDispensation) out.push('A man may be dispensed from the common life to study, and the brothers will remember it.');
  if (m.preachingReputation) out.push('What you preach travels with you when everything else stays behind.');
  if (m.doctrinalVolumeMultiplier) out.push('People expect you to be right, and being wrong in public costs more.');
  if (m.cohesionModulatesPiety) out.push('The house\'s cohesion is your spiritual life: it holds you up or wears you down.');
  if (m.closeFriendSlots) out.push(`Room for ${m.closeFriendSlots} close friends, and a transfer that splits them is the worst thing that can happen.`);
  if (m.pietyCeilingRaisedByCrisis) out.push('The heart is restless: it falls further and, having come through, rises higher.');
  if (m.annualVowRenewal) out.push('Vows renewed every year, and the house asked every time.');
  if (m.religiousName) out.push('A name taken at clothing.');
  return out;
}
