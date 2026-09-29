import { applyEffects } from '@/engine/effects';
import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { relationshipWord } from './classmates';
import { mark, touch } from './regard';
import { FILE, revealFile } from './file';

/**
 * The men you were ordained with. DESIGN.md §9.5.
 *
 * A diocesan priest has no community and no rule: what he has instead is
 * twenty men who were in the same building at twenty-four, and whichever of
 * them he has bothered to keep up with. Keeping up costs hours; not keeping up
 * costs nothing at all until the year a man needs something and finds that the
 * people who would once have answered have not heard from him since 2009.
 */
export const BROTHERS = {
  /** What a classmate bishop's word is worth with the bishops beyond the diocese. E2 §2.5. Invented. */
  bishopsBeyond: 5,
  /** What an hour a week with brother priests is worth to the man it is spent on. */
  perHour: 1.4,
  /** Where a classmate's regard settles with no history: nobody forgets the seminary entirely (REGARD.base.classmate). */
  floor: 8,
  /** Weeks without contact before the sheet says so. */
  coldWeeks: 156,
  /** Regard a favour costs the man who grants it. */
  favourCost: 12,
} as const;

export interface FavourDef {
  id: string;
  label: string;
  /** What he would do. */
  blurb: string;
  /** What kind of man can do it. */
  needs?: 'pastor' | 'chancery' | 'bishop' | 'any';
  /** The relationship it takes. */
  bar: number;
}

export const BROTHER_FAVOURS: FavourDef[] = [
  { id: 'cover', label: 'Ask him to cover a weekend', blurb: "He says your Sunday Masses and you owe him one, which is the whole currency of a presbyterate.", bar: 25 },
  { id: 'word', label: 'Ask him for a word at the chancery', blurb: 'He mentions your name to somebody at the right moment, without being asked twice.', needs: 'chancery', bar: 40 },
  { id: 'warning', label: 'Ask him what he is hearing', blurb: 'What the board is actually thinking, three months before the letter comes.', needs: 'chancery', bar: 30 },
  { id: 'name', label: 'Ask him for a name', blurb: 'A bookkeeper, a roofer, a music director, a lawyer who will not charge a parish: he knows one.', bar: 20 },
  { id: 'ear', label: 'Ask him to listen', blurb: 'A telephone call at eleven at night from a man who has had the same week for thirty years.', bar: 15 },
  { id: 'speak', label: 'Ask him to speak for you', blurb: 'A bishop of your own class says your name to the nuncio, once, which is what a classmate bishop is for.', needs: 'bishop', bar: 40 },
];

/** Every priest of this run he actually knows: classmates, the men of the deanery, the ones he formed. */
export function brothersOf(state: GameState): Npc[] {
  return Object.values(state.npcs)
    .filter((n) => n.status === 'active' && (n.role === 'classmate' || n.role === 'priest' || n.role === 'formator') && !n.tags.includes('religious'))
    .filter((n) => n.relationship >= -20 || n.role === 'classmate')
    .sort((a, b) => b.relationship - a.relationship || a.id.localeCompare(b.id));
}

function lastSeen(state: GameState, id: string): number | null {
  const week = state.flags[`kept:${id}`];
  return typeof week === 'number' ? week : null;
}

/** How long since he did anything about this man, in words. */
export function keptWord(state: GameState, npc: Npc): string {
  const seen = lastSeen(state, npc.id);
  if (seen === null) return 'not since the seminary';
  const weeks = state.clock.week - seen;
  return weeks <= 26 ? 'this year' : weeks <= 78 ? 'a year or so ago' : weeks <= BROTHERS.coldWeeks ? 'two or three years ago' : 'a long time ago';
}

/**
 * The hours with brother priests, spent on one man at a time: the one he has
 * left longest, unless a scene has just put somebody in front of him.
 */
export function brothersWeek(state: GameState, hours: number, rng: Rng): GameState {
  const pool = brothersOf(state);
  if (!pool.length) return state;
  // The drift back toward civil when nobody telephones is regard's now (systems/regard.ts): every relationship settles.
  const next = state;
  if (hours <= 0) return next;
  // The hour goes to the man he has left longest among those he is not cold on.
  const ranked = [...pool].sort((a, b) => (lastSeen(next, a.id) ?? -1) - (lastSeen(next, b.id) ?? -1) || b.relationship - a.relationship);
  const pick = ranked[0] ?? rng.pick(pool);
  const npc = next.npcs[pick.id]!;
  return {
    ...next,
    npcs: { ...next.npcs, [pick.id]: touch({ ...npc, relationship: Math.min(100, npc.relationship + BROTHERS.perHour * hours * 4) }, next.clock.week) },
    flags: { ...next.flags, [`kept:${pick.id}`]: next.clock.week },
  };
}

export interface BrotherFavour {
  npc: Npc;
  def: FavourDef;
  available: boolean;
  why: string;
}

function isChancery(npc: Npc): boolean {
  return npc.tags.includes('chancery') || npc.tags.includes('vicar_general') || npc.tags.includes('chancellor');
}

function isPastor(npc: Npc): boolean {
  return npc.tags.includes('pastor');
}

/** What each man he knows would actually do for him, and what stands in the way. */
export function favoursFrom(state: GameState, npc: Npc): BrotherFavour[] {
  return BROTHER_FAVOURS.map((def) => {
    const why =
      npc.relationship < def.bar ? `He would have to be ${relationshipWord(def.bar)} first` :
      def.needs === 'chancery' && !isChancery(npc) ? 'He is not where the decisions are' :
      def.needs === 'pastor' && !isPastor(npc) ? 'He has no parish of his own' :
      def.needs === 'bishop' && !npc.tags.includes('bishop_elsewhere') ? 'He is not a bishop' :
      state.flags[`favour:${def.id}:${npc.id}`] ? 'Asked already' :
      !state.parish ? 'Not from where you are' :
      '';
    return { npc, def, available: !why, why };
  });
}

export interface FavourResult {
  state: GameState;
  line: string;
}

/** Call it in. It costs him something with the man, because favours do. */
export function askBrother(state: GameState, npcId: string, favourId: string): FavourResult {
  const npc = state.npcs[npcId];
  const def = BROTHER_FAVOURS.find((f) => f.id === favourId);
  if (!npc || !def) throw new Error('no such man or favour');
  const offer = favoursFrom(state, npc).find((f) => f.def.id === favourId);
  if (!offer?.available) throw new Error(offer?.why || 'he would not');
  const name = `${npc.title || 'Fr.'} ${npc.name.last}`;
  let next: GameState = {
    ...state,
    npcs: { ...state.npcs, [npcId]: mark({ ...npc, relationship: Math.max(-100, npc.relationship - BROTHERS.favourCost) }, { week: state.clock.week, delta: -BROTHERS.favourCost, why: `asked him: ${def.label.toLowerCase()}` }) },
    flags: { ...state.flags, [`favour:${def.id}:${npcId}`]: true, [`kept:${npcId}`]: state.clock.week },
  };
  let line: string;
  switch (def.id) {
    case 'cover': {
      next = { ...next, parish: next.parish ? { ...next.parish, apNextWeek: next.parish.apNextWeek + 3 } : next.parish };
      line = `${name} will take your Masses on Sunday and does not want to be thanked about it. You have a weekend, and you owe him one, and both of those are the point.`;
      break;
    }
    case 'word': {
      const c = next.character!;
      next = { ...next, character: { ...c, reputation: { ...c.reputation, chancery: Math.min(100, c.reputation.chancery + 6) } } };
      line = `${name} says your name to the right man in a corridor, at the right moment, without making a production of it. That is what he is for and he knows it.`;
      break;
    }
    case 'warning': {
      next = { ...next, flags: { ...next.flags, 'brother:warned': true } };
      const read = revealFile(next, FILE.revealPerFavour);
      next = read.state;
      line = `${name} tells you what the board is actually thinking, three months before anything is in writing, and asks you not to repeat where it came from.${read.revealed.length ? ` He has seen your file, too: ${read.revealed.map((e) => `"${e.text}" (${e.byLabel})`).join('; ')}.` : ''}`;
      break;
    }
    case 'speak': {
      next = { ...next, flags: { ...next.flags, 'brother:bishop_spoke': state.clock.week } };
      // A bishop of his own class saying his name: the bishops beyond the diocese hear it. E2 §2.5.
      if (!next.religious) next = applyEffects(next, [{ target: 'reputation', key: 'bishops', delta: BROTHERS.bishopsBeyond }], {}, `${name} spoke for you`);
      line = `${name} says he will, and does, at the next meeting of the bishops, to the nuncio's secretary over the coffee, which is where these things are said. It will be remembered for a few years, and it cost him something to say it.`;
      break;
    }
    case 'name': {
      next = { ...next, flags: { ...next.flags, 'brother:name_given': true } };
      line = `${name} gives you a name and telephones the man himself first, which is the difference between a name and a name that works.`;
      break;
    }
    default: {
      const c = next.character!;
      next = { ...next, character: { ...c, stats: { ...c.stats, piety: Math.min(100, c.stats.piety + 2) } }, strain: Math.max(0, (next.strain ?? 0) - 5) };
      line = `Ninety minutes on the telephone with ${name}, most of it about nothing. You sleep better than you have in a fortnight.`;
      break;
    }
  }
  return {
    state: { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Asked ${name}: ${def.label.toLowerCase()}.` }] },
    line,
  };
}

/** Who he could telephone tonight, for the sheet. */
export function brotherLines(state: GameState): { npc: Npc; regard: string; kept: string }[] {
  return brothersOf(state)
    .slice(0, 10)
    .map((npc) => ({ npc, regard: relationshipWord(npc.relationship), kept: keptWord(state, npc) }));
}
