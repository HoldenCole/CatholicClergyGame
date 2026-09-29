import type { GameState, Letter, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import meetings from '@/content/metropolia/meetings.json';
import { metropoliaSees, metropolitanOf } from './metropolia';
import { deliverLetter } from './review';

/**
 * The metropolitan and the provincial meeting (E2 §2.2). The bishops of the
 * province meet twice a year; now and then they adopt something common,
 * which comes to a priest as his own bishop's letter and to a bishop as a
 * scene with an agenda. The province's word (the archbishop's regard and
 * the suffragans') is a term in the nuncio's reading. Tunables invented;
 * the cadence is custom, not law, and flagged to verify.
 */
export const METROPOLITAN = {
  /** Weeks of the year the province's bishops meet. */
  meetingWeeks: [18, 44] as readonly number[],
  /** The chance a meeting adopts a common policy, before the fit of the province's mean reading to it. */
  policyChance: 0.3,
  /** The province's word in the nuncio's reading: the archbishop's regard, and the suffragans' mean, at full scale. */
  provinceWord: { metropolitan: 8, suffragans: 4 },
  /** Weeks a bishop's meeting scene stays open. */
  meetingOpen: 3,
} as const;

export interface ProvincePolicyDef {
  id: string;
  label: string;
  lean: number;
  /** Years before the province adopts it again. */
  years: number;
  letter: string[];
  line: string;
}

export const provincePolicyDefs: ProvincePolicyDef[] = (meetings as { policies: ProvincePolicyDef[] }).policies;

export function provincePolicy(id: string): ProvincePolicyDef | undefined {
  return provincePolicyDefs.find((p) => p.id === id);
}

/** The bishops of the province the game knows, the home see's included. */
export function provinceBishops(state: GameState): Npc[] {
  const out: Npc[] = [];
  for (const see of metropoliaSees(state)) {
    const n = see.bishopId && see.bishopId !== 'player' ? state.npcs[see.bishopId] : undefined;
    if (n && n.status === 'active') out.push(n);
  }
  const home = state.world && !state.see ? state.npcs[state.world.diocese.hidden.bishop.npcId] : undefined;
  if (home && home.status === 'active') out.push(home);
  return out;
}

/** Where the province's bishops read, −100..100. */
export function provinceMeanAlignment(state: GameState): number {
  const men = provinceBishops(state);
  return men.length ? men.reduce((n, b) => n + b.alignment, 0) / men.length : 0;
}

export function isMeetingWeek(state: GameState): boolean {
  return METROPOLITAN.meetingWeeks.includes(state.clock.week % 52);
}

/** The province's word for the nuncio: the archbishop's regard and the suffragans'. */
export function provinceWord(state: GameState): { value: number; good: string[]; bad: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  let v = 0;
  const met = metropolitanOf(state);
  if (met) {
    v += (met.relationship / 100) * METROPOLITAN.provinceWord.metropolitan;
    if (met.relationship >= 30) good.push(`${met.title} ${met.name.last}, the metropolitan, speaks for you`);
    else if (met.relationship <= -20) bad.push(`${met.title} ${met.name.last}, the metropolitan, does not`);
  }
  const others = provinceBishops(state).filter((b) => b.id !== met?.id && b.tags.includes('province_bishop'));
  if (others.length) {
    const mean = others.reduce((n, b) => n + b.relationship, 0) / others.length;
    v += (mean / 100) * METROPOLITAN.provinceWord.suffragans;
    if (mean >= 25) good.push('the bishops of the province know your name for the right reasons');
    else if (mean <= -20) bad.push('the bishops of the province know your name for the wrong ones');
  }
  return { value: Math.round(v * 10) / 10, good, bad };
}

function adoptedWithin(state: GameState, id: string, years: number): boolean {
  const at = state.world?.metropolia?.policies?.find((p) => p.id === id)?.week;
  return at !== undefined && state.clock.week - at < years * 52;
}

/**
 * The week: on a meeting week the province's bishops meet. A priest hears of
 * it when something common comes home, as his bishop's letter; a bishop has
 * a scene of it (the flag metropolia:meeting opens the scenes for three
 * weeks); a metropolitan who called the meeting from his desk has it now.
 */
export function metropolitanWeek(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const world = state.world;
  if (!world?.metropolia) return { state, lines: [] };
  const week = state.clock.week;
  const called = !!state.flags['metropolia:called'];
  if (!isMeetingWeek(state) && !called) return { state, lines: [] };
  const lines: string[] = [];
  let next: GameState = { ...state, world: { ...world, metropolia: { ...world.metropolia, lastMeetingWeek: week } } };
  if (called) { const flags = { ...next.flags }; delete flags['metropolia:called']; next = { ...next, flags }; }
  if (state.see) {
    // A bishop is in the room: the scenes take it from here.
    next = { ...next, flags: { ...next.flags, 'metropolia:meeting': week } };
    lines.push(`The bishops of the ${world.metropolia.name} meet this week.`);
    return { state: next, lines };
  }
  // A priest: the meeting is weather until something common comes home.
  if (!rng.chance(METROPOLITAN.policyChance)) return { state: next, lines };
  const mean = provinceMeanAlignment(next);
  const open = provincePolicyDefs.filter((p) => !adoptedWithin(next, p.id, p.years));
  if (!open.length) return { state: next, lines };
  const policy = rng.weighted(open, (p) => Math.max(0.05, 1 + p.lean * (mean / 100) * 2));
  const bishop = next.npcs[world.diocese.hidden.bishop.npcId];
  const agrees = bishop ? Math.sign(bishop.alignment) === Math.sign(policy.lean) || policy.lean === 0 : true;
  const own = agrees ? 'He expects it kept.' : 'He expects it kept, he writes, in the tone of a man who voted the other way.';
  const letter: Letter = { sort: 'bishop', title: `From the province's bishops: ${policy.label.toLowerCase()}`, body: [...policy.letter, own], week };
  next = deliverLetter({ ...next, world: { ...next.world!, metropolia: { ...next.world!.metropolia!, policies: [...(next.world!.metropolia!.policies ?? []), { id: policy.id, week }] } }, flags: { ...next.flags, [`metropolia:policy:${policy.id}`]: week, 'metropolia:policy:last': policy.id } }, letter);
  next = { ...next, career: [...next.career, { week, kind: 'note', text: `The province's bishops adopted ${policy.line}.` }] };
  lines.push(`The bishops of the province have adopted ${policy.line}; the letter is on the desk.`);
  return { state: next, lines };
}
