import type { Condition, GameState, Letter, MailRecord, MailReply, MailSender, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import mailJson from '@/content/mail.json';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { applyEffects } from '@/engine/effects';
import { CLERGY_HERITAGE, eraForBirthYear, rollFemaleName, rollHeritage, rollMaleName } from '@/generation/names';
import { deliverLetter, readLetter } from './review';
import { bondWord, bondsPhrase, parishPeople } from './bonds';
import { castName } from './cast';
import { classmatePost } from './classmates';

/**
 * The mailbag. DESIGN §8.10: letters from someone, a few a year, that tell
 * or ask; answered at the cost of an hour or left in the drawer; the place
 * the past reaches him from. Templates in content/mail.json name the kind
 * of sender; this file finds one, or the letter does not come.
 */
export type MailFrom = 'parishioner' | 'former_parish' | 'buried' | 'classmate' | 'classmate_left' | 'stranger' | 'stranger_column' | 'seminarian_mother' | 'mother' | 'father' | 'sibling' | 'old_pastor';

export const MAIL_FROM: readonly MailFrom[] = ['parishioner', 'former_parish', 'buried', 'classmate', 'classmate_left', 'stranger', 'stranger_column', 'seminarian_mother', 'mother', 'father', 'sibling', 'old_pastor'] as const;

export interface MailDef {
  id: string;
  from: MailFrom;
  weight: number;
  asks: boolean;
  suppressYears: number;
  requires?: Condition[];
  title: string;
  body: string[];
  replies: MailReply[];
}

const content = mailJson as unknown as { chancePerWeek: number; letters: MailDef[] };
export const mailDefs: MailDef[] = content.letters;

export const MAIL = {
  chancePerWeek: content.chancePerWeek,
  /** Weeks between letters, at least. */
  gapWeeks: 4,
  /** A bond old enough for someone to write about it. */
  buriedYears: 5,
} as const;

export function mailDef(id: string): MailDef | undefined {
  return mailDefs.find((d) => d.id === id);
}

/** Who is writing: the sender, the selector binding for effects, and the tokens the body needs. */
export interface FoundSender {
  sender: MailSender;
  bindings: Record<string, string>;
  extra: Record<string, string>;
}

function yearOf(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

function lastBond(npc: Npc): string {
  const b = npc.bonds?.[npc.bonds.length - 1];
  return b ? bondWord(b) : 'the funeral';
}

function person(state: GameState, npc: Npc, who: string, extra: Record<string, string> = {}): FoundSender {
  const name = npc.role === 'lay' ? castName(npc, yearOf(state)) : `${npc.title ? npc.title + ' ' : ''}${npc.name.first} ${npc.name.last}`;
  return { sender: { npcId: npc.id, name, who }, bindings: { '@sender': npc.id }, extra: { sender: name, sender_first: npc.name.first, who, bond: lastBond(npc), ...extra } };
}

function previousParishes(state: GameState): string[] {
  const current = state.assignment?.parishId;
  return [...new Set((state.tenures ?? []).filter((t) => t.kind === 'parish' && t.parishId && t.parishId !== current).map((t) => t.parishId!))];
}

/** Find someone of the kind to write, or null when the man's life holds no such person. */
export function findSender(state: GameState, from: MailFrom, rng: Rng): FoundSender | null {
  const npcs = Object.values(state.npcs);
  const week = state.clock.week;
  switch (from) {
    case 'parishioner': {
      const people = parishPeople(state);
      if (!people.length) return null;
      const npc = rng.weighted(people, (n) => 1 + (n.bonds?.length ?? 0) * 2);
      return person(state, npc, bondsPhrase(npc) || 'of the parish');
    }
    case 'former_parish': {
      const ids = previousParishes(state);
      const pool = npcs.filter((n) => n.role === 'lay' && n.status === 'active' && ids.some((id) => n.tags.includes(`parish:${id}`)));
      if (!pool.length) return null;
      const npc = rng.weighted(pool, (n) => 1 + (n.bonds?.length ?? 0) * 2);
      const pid = ids.find((id) => npc.tags.includes(`parish:${id}`))!;
      const parish = state.world?.parishes.find((p) => p.id === pid)?.name ?? 'the old parish';
      return person(state, npc, `of ${parish}`, { former_parish: parish });
    }
    case 'buried': {
      const pool = npcs.flatMap((n) => (n.bonds ?? []).filter((b) => b.kind === 'buried' && week - b.week >= MAIL.buriedYears * 52).map((b) => ({ n, b })));
      if (!pool.length) return null;
      const { n, b } = rng.pick(pool);
      const years = Math.round((week - b.week) / 52);
      return person(state, n, `whose ${b.who.replace(/^(his|her|their) /, '')} you buried`, { bond: b.who, years: String(years) });
    }
    case 'classmate':
    case 'classmate_left': {
      const pool = npcs.filter((n) => n.role === 'classmate' && (from === 'classmate' ? n.status === 'active' : n.status === 'left'));
      if (!pool.length) return null;
      const npc = rng.weighted(pool, (n) => Math.max(1, 20 + n.relationship));
      const found = person(state, npc, from === 'classmate' ? classmatePost(npc) : 'who left', { post: classmatePost(npc) });
      found.sender.name = from === 'classmate' ? `Fr. ${npc.name.first} ${npc.name.last}` : `${npc.name.first} ${npc.name.last}`;
      found.extra.sender = found.sender.name;
      return found;
    }
    case 'stranger':
    case 'stranger_column': {
      const heritage = rollHeritage(rng, CLERGY_HERITAGE);
      const woman = rng.chance(0.55);
      const name = woman ? rollFemaleName(rng, heritage) : rollMaleName(rng, heritage, eraForBirthYear(yearOf(state) - rng.int(30, 70)));
      const full = `${name.first} ${name.last}`;
      const who = from === 'stranger_column' ? 'who read the column' : 'who heard of you';
      return { sender: { name: full, who }, bindings: {}, extra: { sender: full, sender_first: name.first, who } };
    }
    case 'seminarian_mother': {
      const pool = npcs.filter((n) => n.tags.includes('seminarian') || n.tags.includes('summered'));
      if (!pool.length) return null;
      const npc = rng.pick(pool);
      const name = `Mrs. ${npc.name.last}`;
      return { sender: { npcId: npc.id, name, who: `${npc.name.first}'s mother` }, bindings: { '@sender': npc.id }, extra: { sender: name, sender_first: npc.name.first, who: `${npc.name.first}'s mother`, bond: 'the summer' } };
    }
    case 'mother':
    case 'father':
    case 'sibling': {
      const npc = npcs.find((n) => n.status === 'active' && n.tags.includes(from));
      if (!npc) return null;
      const found = person(state, npc, from === 'sibling' ? 'your sibling' : `your ${from}`);
      found.sender.name = from === 'sibling' ? `${npc.name.first}` : `your ${from}`;
      found.extra.sender = found.sender.name;
      return found;
    }
    case 'old_pastor': {
      const current = state.assignment?.parishId;
      const pool = npcs.filter((n) => n.status !== 'dead' && n.tags.some((t) => t.startsWith('temperament:')) && n.tags.some((t) => t.startsWith('pastor:') && t !== `pastor:${current}`));
      if (!pool.length) return null;
      const npc = rng.pick(pool);
      const found = person(state, npc, 'the pastor you served under');
      found.sender.name = `${npc.title || 'Fr.'} ${npc.name.first} ${npc.name.last}`;
      found.extra.sender = found.sender.name;
      return found;
    }
  }
}

function suppressed(state: GameState, def: MailDef): boolean {
  const last = state.flags[`mail:${def.id}`];
  return typeof last === 'number' && state.clock.week - last < def.suppressYears * 52;
}

/** The letters that could come this week, each with its sender found. */
export function eligibleMail(state: GameState, rng: Rng): { def: MailDef; found: FoundSender }[] {
  const out: { def: MailDef; found: FoundSender }[] = [];
  for (const def of mailDefs) {
    if (suppressed(state, def)) continue;
    if (def.requires && !evaluateAll(def.requires, state)) continue;
    const found = findSender(state, def.from, rng.derive(`sender:${def.id}`));
    if (found) out.push({ def, found });
  }
  return out;
}

/** Build the letter from a template and a sender: the body rendered now, the replies kept for the answer. */
export function composeMail(state: GameState, def: MailDef, found: FoundSender): Letter {
  const render = (t: string) => renderText(t, state, found.bindings, found.extra);
  return {
    sort: 'mail',
    title: render(def.title),
    body: def.body.map(render),
    week: state.clock.week,
    mailId: def.id,
    from: found.sender,
    replies: def.replies.map((r) => ({ ...r, label: render(r.label) })),
  };
}

/** The week: a letter comes now and then, from someone the man's life holds. */
export function mailWeek(state: GameState, rng: Rng): GameState {
  if (!state.character || state.mode.kind !== 'clock') return state;
  const last = state.flags['mail:last'];
  if (typeof last === 'number' && state.clock.week - last < MAIL.gapWeeks) return state;
  if (!rng.chance(MAIL.chancePerWeek)) return state;
  const eligible = eligibleMail(state, rng);
  if (!eligible.length) return state;
  const { def, found } = rng.weighted(eligible, (e) => e.def.weight);
  const letter = composeMail(state, def, found);
  const record: MailRecord = { mailId: def.id, week: state.clock.week, from: found.sender, title: letter.title, asked: def.asks };
  const flags = { ...state.flags, [`mail:${def.id}`]: state.clock.week, 'mail:last': state.clock.week };
  return deliverLetter({ ...state, flags, mail: [...(state.mail ?? []), record] }, letter);
}

function addLine(state: GameState, line: string): GameState {
  const last = state.digest[state.digest.length - 1];
  if (last && last.week === state.clock.week) return { ...state, digest: [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, line] }] };
  return { ...state, digest: [...state.digest, { week: state.clock.week, lines: [line] }] };
}

/**
 * Answer the letter on the desk, or leave it: the reply's effects land with
 * the sender bound, the hours come off next week, and the mailbag records
 * which it was. The letter closes either way.
 */
export function answerMail(state: GameState, replyId: string | null): GameState {
  if (state.mode.kind !== 'letter' || state.mode.letter.sort !== 'mail') return state;
  const letter = state.mode.letter;
  const reply = replyId ? letter.replies?.find((r) => r.id === replyId) : undefined;
  let next = state;
  const bindings = letter.from?.npcId ? { '@sender': letter.from.npcId } : {};
  if (reply) {
    next = applyEffects(next, reply.effects, bindings, `a letter from ${letter.from?.name ?? 'someone'}`);
    if (reply.hours && next.parish) next = { ...next, parish: { ...next.parish, apNextWeek: next.parish.apNextWeek - reply.hours / 4 } };
    const outcome = reply.outcome ? renderText(reply.outcome, next, bindings, { sender: letter.from?.name ?? 'someone', sender_first: letter.from?.name.split(' ')[0] ?? 'someone' }) : null;
    if (outcome) next = addLine(next, `${letter.title}: ${outcome}`);
    next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `Answered ${letter.from?.name ?? 'a letter'}: ${reply.label.toLowerCase()}.` }] };
  } else {
    next = addLine(next, `${letter.title}, from ${letter.from?.name ?? 'someone'}: left in the drawer.`);
  }
  const mail = (next.mail ?? []).map((m) => (m.mailId === letter.mailId && m.week === letter.week ? { ...m, ...(reply ? { replied: reply.id, repliedLabel: reply.label } : {}) } : m));
  return readLetter({ ...next, mail });
}

/** The mailbag, newest first. */
export function mailbag(state: GameState): MailRecord[] {
  return [...(state.mail ?? [])].reverse();
}
