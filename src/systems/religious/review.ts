import type { GameState } from '@/types';
import { HORARIUM_KEYS } from '@/types';
import { horariumDef, religiousOrder } from '@/content/religious';
import { currentHouse, playerIsPrior, playerIsProvincial } from './house';
import { identitiesOf, reputationDef, reputationWord, topReputations } from './reputations';
import { housesUnderFloor, moneyWord } from './provincialDesk';
import { generalTitle } from './general';
import { bookPhrase } from '@/systems/studyWeek';
import { studyProgram } from '@/content/study';

/**
 * The friar's rows in the year in review (friar round Q10): the common life
 * as he kept it, what he is known for, the house and its men and money, the
 * obedience of the year, and the province's books when they are his. The
 * constituency words saturate at devoted by year fifteen; these rows are
 * what actually moved.
 */
function cohesionWord(c: number): string {
  return c >= 75 ? 'likes itself' : c >= 55 ? 'gets on' : c >= 35 ? 'has two tables at dinner' : 'is silent at supper';
}
function observanceWord(o: number): string {
  return o >= 75 ? 'the Office sung and the silence kept' : o >= 50 ? 'the Office in common most days' : o >= 30 ? 'Vespers when enough men are home' : 'a common address more than a common life';
}
function keptWord(mine: number, house: number): string {
  const gap = mine - house;
  return gap >= 10 ? 'stricter than the house' : gap <= -10 ? 'looser than the house' : 'about as the house keeps it';
}

export function friarReviewRows(state: GameState): { label: string; value: string }[] {
  const r = state.religious;
  const c = state.character;
  if (!r || !c) return [];
  const week = state.clock.week;
  const rows: { label: string; value: string }[] = [];
  const order = religiousOrder(r.order);
  const house = currentHouse(state);
  // The common life, as he kept it.
  if (!state.study) {
    const full = HORARIUM_KEYS.filter((k) => r.horarium[k] === 'invested').map((k) => horariumDef(k).label.toLowerCase());
    const min = HORARIUM_KEYS.filter((k) => r.horarium[k] === 'min').map((k) => horariumDef(k).label.toLowerCase());
    const kept = full.length ? `${full.join(' and ')} in full` : min.length ? 'nothing in full' : 'every line as the house keeps it';
    const cut = min.length ? `; ${min.join(' and ')} at the minimum` : '';
    const dispensed = r.dispensed && r.dispensed.untilWeek > week ? `; dispensed from ${r.dispensed.from.map((k) => horariumDef(k as (typeof HORARIUM_KEYS)[number]).label.toLowerCase()).join(' and ')}` : '';
    const own = r.observance !== undefined && house ? `; your own observance ${keptWord(r.observance, house.observance)}` : '';
    rows.push({ label: 'The common life', value: `${kept}${cut}${dispensed}${own}` });
  }
  // What he is known for.
  const top = topReputations(state).slice(0, 3);
  const ids = identitiesOf(state);
  if (top.length) rows.push({ label: 'Known for', value: `${top.map((t) => `${reputationDef(t.key).label.toLowerCase()}, ${reputationWord(t.value)}`).join('; ')}${ids.length ? `. In the province's mouth, ${ids.map((i) => i.label.toLowerCase()).join(' and ')}` : ''}` });
  // The house: its life, its men this year, its money.
  if (house && !state.study) {
    const notes = state.career.filter((e) => e.kind === 'note' && e.week > week - 52 && e.week <= week).map((e) => e.text);
    const entered = notes.filter((t) => /entered through the house/.test(t)).reduce((n, t) => n + (/^(\d+) men/.exec(t) ? Number(/^(\d+) men/.exec(t)![1]) : 1), 0);
    const left = notes.filter((t) => / left the order/.test(t)).length;
    const died = notes.filter((t) => / died, \d+, in the house/.test(t)).length;
    const men = [entered ? `${entered} entered` : '', left ? `${left} left` : '', died ? `${died} died` : ''].filter(Boolean).join(', ') || 'no one came or went';
    rows.push({ label: 'The house', value: `${house.name} ${cohesionWord(house.cohesion)}, ${observanceWord(house.observance)}; ${men}; the purse ${house.budget < 0 ? 'in the red' : house.budget < 50_000 ? 'thin' : 'sound'}${playerIsPrior(state, house) ? ', and the house is yours to answer for' : ''}` });
  }
  // Under obedience this year.
  const sent = r.assignments.filter((a) => a.startWeek > week - 52 && a.startWeek <= week);
  const office = r.office ? `${r.office.office === 'general' ? generalTitle(state) : r.office.office === 'provincial' ? order.governance.provincialTitle : 'prior'} since ${Math.max(1, Math.round((week - r.office.startWeek) / 52))} year${Math.round((week - r.office.startWeek) / 52) === 1 ? '' : 's'}` : r.appointment ? `appointed ${r.appointment.id.replace(/_/g, ' ')}` : '';
  if (sent.length) {
    const houseName = (id: string) => state.orderHouses?.[id]?.name ?? 'a house';
    rows.push({ label: 'Under obedience', value: `${sent.map((a) => `sent to ${houseName(a.houseId)}, ${a.grace === 'refused' ? 'refused first' : a.grace === 'reluctant' ? 'taken badly' : 'taken well'}`).join('; ')}${office ? `; ${office}` : ''}` });
  } else {
    const letter = r.request && r.request.week > week - 52 ? '; you wrote to ask for a work' : '';
    rows.push({ label: 'Under obedience', value: `no letter moved you this year${office ? `; ${office}` : ''}${letter}` });
  }
  // The province, when its books are his.
  if (state.province && playerIsProvincial(state)) {
    const p = state.province;
    const under = housesUnderFloor(state).length;
    rows.push({ label: 'The province', value: `${moneyWord(p.finances.balance)} ($${p.finances.balance.toLocaleString()}), ${p.trajectory}; ${under ? `${under} house${under === 1 ? '' : 's'} under the floor` : 'every house above its floor'}` });
  }
  // The order, when he is its head: the book of the years in Rome so far.
  if (state.study?.city === 'generalate') {
    const program = studyProgram(state.study.program);
    const book = program?.place?.book ? bookPhrase(state.study.record ?? {}, program.place.book) : '';
    rows.push({ label: 'The order, so far', value: book || 'nothing counted yet: the provinces have not been visited and the letters not written' });
  }
  return rows;
}
