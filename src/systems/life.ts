import type { GameState, Npc, Tenure } from '@/types';
import { allTenures } from './tenures';
import { publicRecord, type PublicRecord } from './record';
import { classmateLines, relationshipWord, type ClassmateLine } from './classmates';
import { yearOf } from '@/ui/portraits/spec';
import { bondCounts, bondsPhrase } from './bonds';
import { mourners } from './lastDecade';
import { religiousOrder } from '@/content/religious';
import { formedMenOf, stageWord } from './religious/formedMen';

/**
 * A life, read back at the end: the posts, the bishops, the stands, the
 * people, the letters. DESIGN §15: a summary that reads like a life rather
 * than a score. Everything here comes from records the game already keeps.
 */
export interface LifeBishop {
  npc: Npc;
  /** "the first", "the second" */
  ordinal: string;
  /** How he read you, from the succession record; the first bishop from the relationship alone. */
  reading: string;
  regard: string;
}

export interface LifePerson {
  npc: Npc;
  who: string;
  regard: string;
}

export interface Life {
  years: number;
  age: number;
  posts: (Tenure & { years: string })[];
  bishops: LifeBishop[];
  record: PublicRecord;
  friends: LifePerson[];
  enemies: LifePerson[];
  classmates: ClassmateLine[];
  letters: { week: number; title: string; line: string }[];
  founded: string[];
  decisions: number;
  /** Notes from the file worth reading back. */
  file: string[];
  /** The sacraments, counted across every parish. */
  sacraments: { baptized: number; married: number; buried: number; anointed: number };
  /** The people who carry the most of you. */
  remembered: { npc: Npc; phrase: string }[];
  /** Who came to the funeral, or who would. */
  mourners: Npc[];
  /** A friar's houses, in order, with the years in each and what he was sent to do. */
  houses?: { name: string; kind: string; years: string; work: string; grace: string }[];
  /** The men he formed as novice master or master of students, and where the record last saw them. Friar round D8. */
  formed?: { name: string; as: string; stage: string; year: number }[];
  /** A friar's offices: elected and appointed, with the body and the years. */
  terms?: { label: string; body: string; years: string }[];
  /** A friar's foundations, each in a line. */
  foundations?: string[];
}

function yearsWord(weeks: number): string {
  const y = weeks / 52;
  if (y < 1) return `${Math.max(1, Math.round(weeks / 4))} months`;
  const r = Math.round(y);
  return `${r} year${r === 1 ? '' : 's'}`;
}

export function whoWord(state: GameState, npc: Npc): string {
  if (npc.role === 'classmate') return state.religious ? 'of the novitiate class' : 'classmate';
  if (npc.tags.includes('friar') || npc.role === 'religious') {
    if (npc.tags.includes('provincial')) return 'provincial';
    if (npc.tags.includes('prior')) return 'prior';
    if (npc.tags.includes('novice_master')) return 'novice master';
    if (npc.tags.includes('master_of_students')) return 'master of students';
    if (npc.tags.includes('vows:novice')) return 'novice';
    if (npc.tags.includes('vows:simple')) return 'student brother';
    if (npc.tags.includes('lay_brother')) return 'brother';
    if (npc.tags.includes('directee')) return 'a man you direct';
    return npc.role === 'religious' && !npc.tags.includes('friar') ? 'religious' : 'friar';
  }
  if (npc.tags.includes('directee')) return 'a priest you direct';
  if (npc.role === 'family') return npc.tags.find((t) => ['mother', 'father', 'sibling'].includes(t)) ?? 'family';
  if (npc.role === 'bishop') return 'bishop';
  if (npc.role === 'formator') return npc.tags.find((t) => ['rector', 'vice_rector', 'spiritual_director', 'formation_advisor', 'vocation_director'].includes(t))?.replace(/_/g, ' ') ?? 'formator';
  if (npc.role === 'official') return npc.tags.find((t) => ['vicar_general', 'chancellor', 'vicar_for_clergy'].includes(t))?.replace(/_/g, ' ') ?? 'chancery';
  if (npc.role === 'priest') return npc.tags.some((t) => t.startsWith('pastor:')) ? 'pastor' : state.religious ? 'diocesan priest' : 'brother priest';
  const staff = npc.tags.find((t) => ['secretary', 'dre', 'music_director', 'maintenance'].includes(t));
  if (staff) return staff.replace(/_/g, ' ');
  const led = Object.values(state.groups).find((g) => g.leaderId === npc.id);
  if (led) return 'group leader';
  return 'parishioner';
}

const HOUSE_KIND: Record<string, string> = { priory: 'the priory', studium: 'the house of studies', novitiate: 'the novitiate', parish: 'the parish house', school: 'the school', mission: 'the mission', curia: 'the curia' };
const WORK_WORD: Record<string, string> = { parish: 'for the parish', school: 'for the school', teaching: 'to teach', formation: 'for the formation house', mission: 'for the mission', curia: 'for the curia', priory_church: 'for the priory church', preaching: 'to preach', chaplaincy: 'for the chaplaincy' };

/** What a friar's shelf adds: the houses he lived in, the offices he held, the houses he founded. Friar round Q2. */
function friarLife(state: GameState): Pick<Life, 'houses' | 'terms' | 'foundations' | 'formed'> {
  const r = state.religious;
  if (!r) return {};
  const week = state.clock.week;
  const houses = r.assignments.map((a) => {
    const house = state.orderHouses?.[a.houseId];
    return { name: house?.name ?? 'a house since closed', kind: HOUSE_KIND[house?.kind ?? ''] ?? house?.kind ?? '', years: yearsWord((a.endWeek ?? week) - a.startWeek), work: WORK_WORD[a.work] ?? a.work.replace(/_/g, ' '), grace: a.grace === 'reluctant' ? 'taken badly' : a.grace === 'refused' ? 'refused' : '' };
  });
  const order = religiousOrder(r.order);
  const officeLabel = (id: string) => id === 'prior' ? order.governance.priorTitle : id === 'provincial' ? order.governance.provincialTitle : id === 'general' ? order.governance.generalTitle : order.offices.find((o) => o.id === id)?.label.toLowerCase() ?? id.replace(/_/g, ' ');
  const bodyOf = (id: string, t: { office: string; startWeek: number }) => id === 'general' ? order.name : id === 'provincial' ? (state.province?.name ?? 'the province') : id === 'prior' ? (r.assignments.find((a) => a.startWeek <= t.startWeek && (a.endWeek ?? week) >= t.startWeek)?.houseId ? state.orderHouses?.[r.assignments.find((a) => a.startWeek <= t.startWeek && (a.endWeek ?? week) >= t.startWeek)!.houseId]?.name ?? 'a house' : 'a house') : (state.province?.name ?? 'the province');
  const held = [...r.termsServed, ...(r.office ? [{ office: r.office.office, startWeek: r.office.startWeek, endWeek: week }] : []), ...(r.appointment ? [{ office: r.appointment.id, startWeek: r.appointment.startWeek, endWeek: week }] : [])];
  const terms = held.sort((a, b) => a.startWeek - b.startWeek).map((t) => ({ label: officeLabel(t.office), body: bodyOf(t.office, t), years: yearsWord(t.endWeek - t.startWeek) }));
  const foundations = (r.foundations ?? []).map((f) => {
    const name = state.orderHouses?.[f.houseId]?.name ?? 'the house';
    const years = yearsWord((f.failedWeek ?? week) - f.foundedWeek);
    return f.status === 'failed' ? `${name}, founded ${yearOf(state.clock.startDay, f.foundedWeek)}, failed after ${years}: ${f.failedWhy ?? 'the men were needed elsewhere'}.` : `${name}, founded ${yearOf(state.clock.startDay, f.foundedWeek)}, ${years} on and standing.`;
  });
  const formed = formedMenOf(state).map((f) => ({ name: `${f.npc.title} ${f.npc.name.first} ${f.npc.name.last}`, as: f.as === 'novice' ? 'clothed' : 'taught', stage: stageWord(f.stage), year: yearOf(state.clock.startDay, f.week) }));
  return { houses, terms, foundations, ...(formed.length ? { formed } : {}) };
}

export function lifeOf(state: GameState): Life {
  const c = state.character!;
  const week = state.clock.week;
  const year = yearOf(state.clock.startDay, week);
  const age = year - (c.entryYear - c.background.entryAge);
  const ordained = typeof state.flags.ordination_week === 'number' ? state.flags.ordination_week : null;
  const years = ordained === null ? 0 : Math.floor((week - ordained) / 52);

  const posts = allTenures(state).map((t) => ({ ...t, years: yearsWord(t.endWeek - t.startWeek) }));

  const successions = state.career.filter((e) => e.kind === 'succession');
  const ids = state.world?.bishopHistory ?? [];
  // The bishop who ordained him: the one in office at ordination, whoever came before or after.
  const ordainedBy = ordained === null ? -1 : ids.findIndex((_id, i) => { const next = successions.find((e) => ids[i + 1] && e.text.includes(`named ${state.npcs[ids[i + 1]!]?.title} ${state.npcs[ids[i + 1]!]?.name.first} ${state.npcs[ids[i + 1]!]?.name.last}`)); return !next || next.week > ordained; });
  const bishops: LifeBishop[] = ids.map((id) => state.npcs[id]).filter((n): n is Npc => !!n).map((npc, i) => {
    const entry = successions.find((e) => e.text.includes(`named ${npc.title} ${npc.name.first} ${npc.name.last}`));
    const read = entry ? (entry.text.split('. ').slice(1).join('. ') || entry.text) : i === 0 ? 'The bishop of your seminary years.' : 'He came; the record does not say what he made of you.';
    const reading = i === ordainedBy ? `The bishop who ordained you.${entry ? ` ${read}` : ''}` : read;
    return { npc, ordinal: ['the first', 'the second', 'the third', 'the fourth', 'the fifth', 'the sixth', 'the seventh', 'the eighth'][i] ?? `the ${i + 1}th`, reading, regard: relationshipWord(npc.relationship) };
  });

  const people = Object.values(state.npcs).filter((n) => n.id !== 'player' && n.role !== 'bishop');
  const friends = people.filter((n) => n.relationship >= 40).sort((a, b) => b.relationship - a.relationship).slice(0, 8).map((npc) => ({ npc, who: whoWord(state, npc), regard: relationshipWord(npc.relationship) }));
  const enemies = people.filter((n) => n.relationship <= -30).sort((a, b) => a.relationship - b.relationship).slice(0, 5).map((npc) => ({ npc, who: whoWord(state, npc), regard: relationshipWord(npc.relationship) }));

  const letters = (state.letters ?? []).map((l) => ({ week: l.week, title: l.title, line: l.body[l.body.length - 1] ?? '' }));
  const founded = Object.values(state.groups).filter((g) => g.foundedByPlayer).map((g) => g.type.replace(/_/g, ' '));
  // The file, without the letters he declined: those are the drawer's, not the life's.
  const file = state.career.filter((e) => e.kind !== 'note' && !(e.kind === 'offer' && /^Declined: /.test(e.text))).map((e) => e.text).slice(-10);

  const counts = bondCounts(state);
  const remembered = Object.values(state.npcs).filter((n) => (n.bonds?.length ?? 0) >= 2).sort((a, b) => (b.bonds!.length - a.bonds!.length) || b.relationship - a.relationship).slice(0, 6).map((npc) => ({ npc, phrase: bondsPhrase(npc) }));
  const friar = friarLife(state);
  return { years, age, posts, bishops, record: publicRecord(state), friends, enemies, classmates: classmateLines(state), letters, founded, decisions: state.history.length, file, sacraments: { baptized: counts.baptized, married: counts.married, buried: counts.buried, anointed: counts.anointed }, remembered, mourners: mourners(state), ...friar };
}
