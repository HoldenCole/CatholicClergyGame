import type { GameState, Letter, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { deliverLetter } from './review';
import { composeMail, findSender, mailDef } from './mail';
import { mark } from './regard';

/**
 * Bishops who remember (D3). A bishop who retires stays a person: he writes
 * (the mailbag), his word reaches the nuncio (nuncioView), he dies and the
 * chancellor writes about the funeral, and the bishop who ordained the man
 * is at his silver jubilee. Numbers invented.
 */
export const EMERITI = {
  /** Chance a year an emeritus past seventy dies, per year past it. */
  deathBase: 0.04,
  deathPerYear: 0.012,
  /** Regard at which the family asks him to preach. */
  preachAt: 40,
  /** What the nuncio makes of an emeritus's word, either way. */
  nuncio: 5,
  nuncioAt: 40,
  nuncioAgainstAt: -30,
} as const;

/** The bishops emeriti of his life, living. */
export function emeritiOf(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => n.tags.includes('bishop_emeritus') && n.status !== 'dead');
}

function yearOf(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/** Once a year: an emeritus may die; the chancellor writes about the funeral, and the family may ask him to preach. */
export function emeritiYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  const year = yearOf(state);
  for (const e of emeritiOf(state)) {
    const age = year - e.birthYear;
    if (age < 70) continue;
    if (!rng.derive(`emeritus:${e.id}:${year}`).chance(EMERITI.deathBase + EMERITI.deathPerYear * (age - 70))) continue;
    const asked = e.relationship >= EMERITI.preachAt;
    next = { ...next, npcs: { ...next.npcs, [e.id]: { ...e, status: 'dead' } }, flags: { ...next.flags, 'emeritus:died': e.id, 'emeritus:asked_to_preach': asked } };
    lines.push(`${e.title} ${e.name.last}, bishop emeritus, has died at ${age}.`);
    next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `${e.title} ${e.name.first} ${e.name.last}, bishop emeritus, died at ${age}.` }] };
    const def = mailDef('ml_emeritus_funeral');
    const found = def ? findSender(next, 'emeritus_funeral', rng.derive(`funeral:${e.id}`)) : null;
    if (def && found) {
      const letter: Letter = composeMail(next, def, found);
      next = deliverLetter({ ...next, mail: [...(next.mail ?? []), { mailId: def.id, week: next.clock.week, from: found.sender, title: letter.title, asked: def.asks }] }, letter);
    }
  }
  return { state: next, lines };
}

/** The bishop in office when he was ordained, if the game still has him. */
export function ordainingBishop(state: GameState): Npc | undefined {
  const ordained = state.flags.ordination_week;
  if (typeof ordained !== 'number') return undefined;
  const ids = state.world?.bishopHistory ?? [];
  const successions = state.career.filter((e) => e.kind === 'succession');
  const idx = ids.findIndex((_id, i) => {
    const after = ids[i + 1] ? state.npcs[ids[i + 1]!] : undefined;
    const came = after ? successions.find((e) => e.text.includes(`named ${after.title} ${after.name.first} ${after.name.last}`)) : undefined;
    return !came || came.week > ordained;
  });
  return idx >= 0 ? state.npcs[ids[idx]!] : undefined;
}

/** The silver jubilee: the bishop who ordained him is there, if he is anywhere. */
export function jubileeWithOrdainer(state: GameState): { state: GameState; line: string | null } {
  const b = ordainingBishop(state);
  if (!b || b.status === 'dead' || b.id === state.world?.diocese.hidden.bishop.npcId) return { state, line: null };
  const warm = b.relationship >= 15;
  const npc = mark(b, { week: state.clock.week, delta: warm ? 8 : 3, why: 'the silver jubilee' });
  return {
    state: { ...state, npcs: { ...state.npcs, [b.id]: { ...npc, relationship: Math.min(100, b.relationship + (warm ? 8 : 3)) } } },
    line: warm ? `${b.title} ${b.name.last}, who ordained you, came, and said the thing at the end that the bishop who ordains you is the only man entitled to say.` : `${b.title} ${b.name.last}, who ordained you, sent a card with a line in his own hand, which is more than he sends most.`,
  };
}
