import type { Choice } from '@/types';

/**
 * What a choice actually says, derived from its effects, so no label can hide
 * a stance. Words only: numbers stay out of the seminary sheets.
 */
export const TOPIC: Record<string, { label: string; neg: string; pos: string }> = {
  liturgy: { label: 'the liturgy', neg: 'the traditional side', pos: 'the progressive side' },
  tlm: { label: 'the Latin Mass', neg: 'for it', pos: 'against it' },
  authority: { label: 'authority', neg: 'obedience and the bishop', pos: "the priest's own judgment" },
  money: { label: 'money', neg: 'thrift and the books', pos: 'spending on the people' },
  social_justice: { label: 'social questions', neg: 'the conservative side', pos: 'the progressive side' },
  immigration: { label: 'immigration', neg: 'the old parish first', pos: 'the newcomers' },
  abuse_handling: { label: 'how abuse is handled', neg: 'the institution', pos: 'the victims and the open record' },
  bishop_conduct: { label: "the bishop's conduct", neg: 'his defence', pos: 'his critics' },
  celibacy_discipline: { label: 'celibacy', neg: 'the discipline as it stands', pos: 'loosening it' },
  academic_freedom: { label: 'academic freedom', neg: 'orthodoxy first', pos: 'open inquiry' },
  synodality: { label: 'synodality', neg: 'the pastor decides', pos: 'the people are consulted' },
  women_roles: { label: "women's roles", neg: 'the tradition', pos: 'widening them' },
  latin_mass: { label: 'the Latin Mass', neg: 'for it', pos: 'against it' },
  altar_rail: { label: 'the altar rail', neg: 'for it', pos: 'against it' },
};

const REP: Record<string, string> = {
  parishioners: 'the people', chancery: 'the chancery', brother_priests: 'brother priests', public: 'the town', rome: 'Rome',
  traditional_bloc: 'the traditional wing', progressive_bloc: 'the progressive wing',
};
const SELECTOR: Record<string, string> = {
  '@bishop': 'the bishop', '@rector': 'the rector', '@pastor': 'the pastor', '@spiritual_director': 'your director', '@formation_advisor': 'your advisor',
  '@vocation_director': 'the vocation director', '@closest_classmate': 'your closest friend', '@random_classmate': 'a classmate', '@rival_classmate': 'your rival',
  '@mother': 'your mother', '@father': 'your father', '@sibling': 'your sibling', '@group_leader': 'the group\'s leader', '@vicar_general': 'the vicar general',
  '@chancellor': 'the chancellor', '@vicar_for_clergy': 'the vicar for clergy', '@brother_priest': 'a brother priest', '@mentor_priest': 'your mentor',
  '@home_pastor': 'your home pastor', '@secretary': 'the secretary', '@dre': 'the DRE', '@music_director': 'the music director', '@parishioner': 'a parishioner',
};
const STAT: Record<string, string> = { piety: 'piety', theology: 'theology', knowledge: 'learning', charisma: 'presence', administration: 'order' };

function volumeWord(v: Choice['volume']): string {
  return v === 'public' ? 'A public stand' : v === 'semi_public' ? 'A stand said aloud' : 'A private view';
}

/** One or two short sentences, or null when the choice carries nothing worth saying. */
export function choiceMeaning(choice: Choice): string | null {
  const parts: string[] = [];
  if (choice.positionTopic !== undefined && choice.positionValue !== undefined) {
    const t = TOPIC[choice.positionTopic];
    const side = choice.positionValue < 0 ? (t?.neg ?? 'the conservative side') : (t?.pos ?? 'the progressive side');
    const strength = Math.abs(choice.positionValue) >= 45 ? 'hard ' : '';
    parts.push(`${volumeWord(choice.volume)} on ${t?.label ?? choice.positionTopic.replace(/_/g, ' ')}, ${strength}${side}.`);
  }
  const effects = choice.effects ?? [];
  const align = effects.filter((e) => e.target === 'alignment').reduce((n, e) => n + (e.delta ?? 0), 0);
  if (align <= -1) parts.push('Leans you toward tradition.');
  else if (align >= 1) parts.push('Leans you toward reform.');
  const loud = effects.filter((e) => e.target === 'outspokenness').reduce((n, e) => n + (e.delta ?? 0), 0);
  if (loud >= 3) parts.push('Makes you a louder man.');
  const warms: string[] = [];
  const cools: string[] = [];
  for (const e of effects) {
    if (e.target === 'reputation' && (e.delta ?? 0) !== 0 && Math.abs(e.delta ?? 0) >= 2) (e.delta! > 0 ? warms : cools).push(REP[e.key] ?? e.key.replace(/_/g, ' '));
    if (e.target === 'relationship' && (e.delta ?? 0) !== 0 && Math.abs(e.delta ?? 0) >= 3) (e.delta! > 0 ? warms : cools).push(SELECTOR[e.key] ?? e.key.replace('@', '').replace(/_/g, ' '));
  }
  const uniq = (xs: string[]) => [...new Set(xs)];
  if (warms.length || cools.length) {
    const w = uniq(warms).slice(0, 3).join(', ');
    const c = uniq(cools).slice(0, 3).join(', ');
    parts.push([w && `${w} ${warms.length === 1 ? 'warms' : 'warm'}`, c && `${c} ${cools.length === 1 ? 'cools' : 'cool'}`].filter(Boolean).join('; ') + '.');
  }
  const stats = effects.filter((e) => e.target === 'stat' && (e.delta ?? 0) >= 1).map((e) => STAT[e.key] ?? e.key);
  if (stats.length) parts.push(`Builds ${uniq(stats).join(', ')}.`);
  const costs = effects.filter((e) => e.target === 'stat' && (e.delta ?? 0) <= -1).map((e) => STAT[e.key] ?? e.key);
  if (costs.length) parts.push(`Costs ${uniq(costs).join(', ')}.`);
  if (effects.some((e) => e.target === 'concern')) parts.push('Goes in the file as a concern.');
  if (effects.some((e) => e.target === 'end')) parts.push('Ends the run.');
  if (effects.some((e) => e.target === 'transfer')) parts.push('You would be moved.');
  const text = parts.join(' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}
