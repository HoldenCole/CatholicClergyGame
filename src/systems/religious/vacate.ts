import type { GameState } from '@/types';
import { PLAYER_ID } from './electorate';
import { installSuperior } from './chapter';

/**
 * The office he holds ends before its term: elected to another, or the house
 * he governs closed under him. The flag goes, the term is written down, and
 * the chair does not stay his: the house is held by its eldest solemnly
 * professed priest (the provincial's usual man until it elects), the province
 * by no one until its chapter.
 */
export function vacateOffice(state: GameState, why: string): GameState {
  const r = state.religious;
  if (!r?.office) return state;
  const week = state.clock.week;
  const held = r.office;
  const { office: _o, ...rest } = r;
  let next: GameState = { ...state, religious: { ...rest, termsServed: [...r.termsServed, { office: held.office, startWeek: held.startWeek, endWeek: week }] }, flags: { ...state.flags } };
  delete next.flags[`office:${held.office}`];
  if (held.office === 'prior') {
    const house = next.orderHouses?.[held.bodyId];
    if (house?.priorId === PLAYER_ID) {
      const man = Object.values(next.npcs).filter((n) => n.status === 'active' && n.tags.includes(`house:${held.bodyId}`) && n.tags.includes('vows:solemn') && n.title === 'Fr.').sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
      next = man ? installSuperior(next, 'prior', held.bodyId, man.id) : { ...next, orderHouses: { ...next.orderHouses, [held.bodyId]: { ...house, priorId: '' } } };
    }
  }
  if (held.office === 'provincial' && next.province?.provincialId === PLAYER_ID) next = { ...next, province: { ...next.province, provincialId: '' } };
  return { ...next, career: [...next.career, { week, kind: 'note', text: `He left the office of ${held.office} before its term, ${why}.` }] };
}
