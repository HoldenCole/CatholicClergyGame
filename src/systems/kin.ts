import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { eraForBirthYear, rollFemaleName, rollHeritage, rollMaleName, CLERGY_HERITAGE } from '@/generation/names';
import { finishNpc, rollBaseStats } from '@/generation/npc';
import { deliverLetter } from './review';
import { composeMail, findSender, mailDef } from './mail';
import { dateOf } from '@/engine/time';
import { relationshipWord } from './classmates';

/**
 * The family across the life (D9). Siblings have children, who are
 * baptized, grow up, marry, and once in a while think of the seminary; when
 * the mother dies there is the house; and every Christmas there is the
 * table, with whoever is left at it. Numbers invented.
 */
export const KIN = {
  /** A sibling this age, with fewer than three children, has one this often a year. */
  childAges: [26, 40] as const,
  childChance: 0.25,
  maxChildren: 3,
  /** A niece or nephew this age asks for the wedding this often a year. */
  weddingAges: [24, 34] as const,
  weddingChance: 0.15,
  /** A nephew this age thinks of the seminary this often a year. */
  seminaryAges: [17, 22] as const,
  seminaryChance: 0.05,
  /** What a baptism asked and done is worth with the family. */
  baptism: 6,
} as const;

function yearOf(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

export function siblingsOf(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => n.role === 'family' && n.tags.includes('sibling') && n.status === 'active');
}

export function kinOf(state: GameState, sibling?: Npc): Npc[] {
  return Object.values(state.npcs).filter((n) => n.role === 'family' && n.tags.includes('kin') && (!sibling || n.tags.includes(`child_of:${sibling.id}`)));
}

function mail(state: GameState, id: string, from: 'kin' | 'sibling', rng: Rng, flags: Record<string, string | number | boolean> = {}): GameState {
  const def = mailDef(id);
  const withFlags = { ...state, flags: { ...state.flags, ...flags } };
  const found = def ? findSender(withFlags, from, rng) : null;
  if (!def || !found) return state;
  const letter = composeMail(withFlags, def, found);
  return deliverLetter({ ...withFlags, mail: [...(withFlags.mail ?? []), { mailId: def.id, week: state.clock.week, from: found.sender, title: letter.title, asked: def.asks }] }, letter);
}

/** Once a year. */
export function familyYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (!state.character) return { state, lines: [] };
  const year = yearOf(state);
  const lines: string[] = [];
  let next = state;
  const surname = state.character.name.last;
  // Children born to the siblings.
  for (const sib of siblingsOf(next)) {
    const age = year - sib.birthYear;
    const children = kinOf(next, sib);
    if (age < KIN.childAges[0] || age > KIN.childAges[1] || children.length >= KIN.maxChildren) continue;
    const r = rng.derive(`child:${sib.id}:${year}`);
    if (!r.chance(KIN.childChance)) continue;
    const girl = r.chance(0.5);
    const heritage = rollHeritage(r, CLERGY_HERITAGE);
    const name = girl ? rollFemaleName(r, heritage, surname) : { ...rollMaleName(r, heritage, eraForBirthYear(year)), last: surname };
    const id = `kin_${sib.id}_${children.length + 1}`;
    const child = finishNpc(r, { id, name, role: 'family', title: '', birthYear: year, origin: sib.origin, stats: rollBaseStats(r, 20, 50), tags: ['kin', girl ? 'niece' : 'nephew', `child_of:${sib.id}`], relationship: 10 });
    const ordained = !!next.flags.ordained;
    const baptized = ordained ? { ...child, bonds: [{ kind: 'baptized' as const, week: next.clock.week, who: girl ? 'her' : 'him' }], relationship: 10 + KIN.baptism } : child;
    next = { ...next, npcs: { ...next.npcs, [id]: baptized, [sib.id]: { ...sib, relationship: Math.min(100, sib.relationship + (ordained ? KIN.baptism : 2)) } } };
    lines.push(`${sib.name.first} had a ${girl ? 'girl' : 'boy'}, ${name.first}${ordained ? ', and you baptized ' + (girl ? 'her' : 'him') + ' on a Sunday afternoon with the family in the front pews' : ''}.`);
  }
  // Weddings asked, and the seminary thought of.
  for (const k of kinOf(next)) {
    if (k.status !== 'active') continue;
    const age = year - k.birthYear;
    const r = rng.derive(`kin:${k.id}:${year}`);
    if (age >= KIN.weddingAges[0] && age <= KIN.weddingAges[1] && !k.tags.includes('married') && !next.flags[`kin:asked:${k.id}`] && r.chance(KIN.weddingChance)) {
      next = mail({ ...next, flags: { ...next.flags, [`kin:asked:${k.id}`]: true } }, 'ml_kin_wedding', 'kin', r, { 'kin:asking': k.id });
      continue;
    }
    if (k.tags.includes('nephew') && age >= KIN.seminaryAges[0] && age <= KIN.seminaryAges[1] && !next.flags[`kin:seminary:${k.id}`] && r.chance(KIN.seminaryChance)) {
      next = { ...next, flags: { ...next.flags, [`kin:seminary:${k.id}`]: year } };
      lines.push(`Your nephew ${k.name.first} telephoned to ask what the seminary is like, and did not say why, and you did not ask.`);
    }
  }
  // The house, when the mother dies and there is a sibling to ask.
  const mother = Object.values(next.npcs).find((n) => n.role === 'family' && n.tags.includes('mother'));
  if (mother && mother.status === 'dead' && !next.flags['family:house'] && siblingsOf(next).length) {
    next = mail({ ...next, flags: { ...next.flags, 'family:house': next.clock.week } }, 'ml_sibling_house', 'sibling', rng.derive('house'));
  }
  return { state: next, lines };
}

/** The Christmas line: who was at the table, and who was not. */
export function christmasLine(state: GameState): string | null {
  const d = dateOf(state.clock);
  if (d.month !== 12 || d.day < 22 || d.day > 28) return null;
  const family = Object.values(state.npcs).filter((n) => n.role === 'family');
  if (!family.length) return null;
  const alive = family.filter((n) => n.status === 'active');
  const gone = family.filter((n) => n.status === 'dead');
  const who = (n: Npc) => (n.tags.includes('mother') ? 'your mother' : n.tags.includes('father') ? 'your father' : n.tags.includes('sibling') ? `your ${n.name.first}` : n.name.first);
  if (!alive.length) return `Christmas, and nobody left of the family to have it with; ${gone.length === 1 ? `${who(gone[0]!)} is` : 'they are'} in the cemetery, and you said the Mass and ate at the rectory.`;
  const at = alive.slice(0, 5).map((n) => `${who(n)} (${relationshipWord(n.relationship)})`).join(', ');
  return `Christmas at the family's after the last Mass: ${at}${gone.length ? `; ${gone.length === 1 ? `${who(gone[0]!)} was` : `${gone.length} were`} missed aloud` : ''}.`;
}
