import type { GameState, Letter } from '@/types';
import { religiousOrder } from '@/content/religious';
import { createRng } from '@/engine/rng';
import { collegePools } from '@/content/rome';
import { reigning } from '@/systems/rome/papacy';
import { deliverLetter } from '@/systems/review';
import { vacateOffice } from './vacate';

/**
 * E3 §16B — the friar and the mitre, and a pope of his order. A friar named
 * bishop leaves the order's governance for good (can. 705, flagged for
 * verification): his office is laid down, he votes in no chapter and stands
 * in none, and the province writes it as a loss. A pope of the player's
 * order raises every friar's Roman standing and multiplies the order's
 * letters (§7.5); a pope who was a friar of his own province is the rarest
 * event in the game. Tunables are invented and flagged.
 */
export const MITRE = {
  /** What the province feels when Rome takes one of its men: standing with it, and the order's pride. */
  loss: { province: -6, order: 6 },
} as const;

export const POPE_OF_ORDER = {
  /** Rome's regard for every friar of the order, once, when one of its own is elected. */
  rome: 8,
  /** The order's letters come likelier while he reigns: the provincial's offers weigh this much more. */
  offerBoost: 1.5,
} as const;

/** The bishop's own flag: set with the mitre, never cleared. A bishop remains a friar, and remains a bishop. */
export const BISHOP_FLAG = 'bishop:friar';

/** Named a bishop: the office laid down, the record written, the provincial's letter. Called when the posting begins (engine/study.ts). */
export function friarNamedBishop(state: GameState): GameState {
  const r = state.religious;
  if (!r || BISHOP_FLAG in state.flags) return state;
  const week = state.clock.week;
  let next = r.office ? vacateOffice(state, 'named a bishop by the Holy Father') : state;
  const order = religiousOrder(r.order);
  const c = next.character!;
  next = {
    ...next,
    flags: { ...next.flags, [BISHOP_FLAG]: week },
    character: { ...c, reputation: { ...c.reputation, province: Math.max(-100, (c.reputation.province ?? 0) + MITRE.loss.province), order: Math.min(100, (c.reputation.order ?? 0) + MITRE.loss.order) } },
    career: [...next.career, { week, kind: 'note', text: `Named a bishop: the ${order.short} lose him to the Church, as the constitutions say they must, and keep him as a brother.` }],
  };
  const letter: Letter = {
    sort: 'provincial',
    title: 'From the provincial, on the mitre',
    body: [
      `Dear Father, or I should say Your Excellency, and will not, yet. The nuncio's office told me before it told you, which is the custom, and asked me to say nothing, which I have managed for eleven days. The province is proud of you in the way a family is proud of a son who has been given to someone else.`,
      `You know the constitutions as well as I do. From the day of your ordination as bishop you are released from the obedience you promised us and from any office you hold among us; you will not vote in our chapters again, and we may not elect you to anything. You remain our brother, and the habit is yours for life. The house will want to give you a dinner. Let them.`,
      `The Prior Provincial`,
    ],
    week,
  };
  return deliverLetter(next, letter);
}

/**
 * Lent to the Holy See, or sent to teach at the order's faculty in Rome: the
 * office he holds is laid down (a man in Rome governs nothing at home), the
 * house and the faculty are the order's own, and the record says who sent him.
 * E3 §16C.
 */
export function friarLentToRome(state: GameState, city: 'curia' | 'faculty'): GameState {
  const r = state.religious;
  if (!r) return state;
  const order = religiousOrder(r.order);
  let next = r.office ? vacateOffice(state, city === 'curia' ? 'lent by the order to the Holy See' : "sent to teach at the order's faculty in Rome") : state;
  if (next.study) next = { ...next, study: { ...next.study, residence: order.roman.residence, ...(city === 'faculty' ? { school: order.roman.faculty, label: `Professor at ${order.roman.faculty}` } : {}) } };
  if (city === 'faculty') next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'promotion', text: `Sent by the province to teach at ${order.roman.faculty}.` }] };
  return next;
}

/** {roman_faculty}, {roman_chair}: the order's house of studies in Rome and the chair it asks him to hold, the same for the whole of one life. E3 §16C. */
export function romanTokens(state: GameState): Record<string, string> {
  const r = state.religious;
  if (!r) return {};
  const order = religiousOrder(r.order);
  const chair = createRng(`${state.seed}:roman-chair`).pick(order.roman.chairs);
  return { roman_faculty: order.roman.faculty, roman_chair: chair };
}

/** Whether the reigning pope is a man of the player's order. */
export function popeOfHisOrder(state: GameState): boolean {
  const r = state.religious;
  const pope = reigning(state);
  return !!r && !!pope?.order && pope.order === r.order;
}

/** The label for a pope's order, from the College's pool: "a Dominican". */
export function orderLabel(key: string): string {
  return collegePools.orders.find((o) => o.key === key)?.label ?? 'a religious';
}

/**
 * One week of the friar's Rome: a pope of his order newly elected sets the
 * flag, writes the letter, and lifts his Roman standing once; a pope who was
 * a friar of his own province sets the rarer flag too. The scenes hang on the flags.
 */
export function popeOfTheOrderWeek(state: GameState): GameState {
  const r = state.religious;
  const pope = reigning(state);
  if (!r || !pope?.order || pope.order !== r.order || state.flags['pope:own_order'] === pope.id) return state;
  const week = state.clock.week;
  const order = religiousOrder(r.order);
  const c = state.character!;
  const confrere = pope.confrereId ? state.npcs[pope.confrereId] : undefined;
  let next: GameState = {
    ...state,
    flags: { ...state.flags, 'pope:own_order': pope.id, ...(confrere ? { 'pope:confrere': pope.id } : {}) },
    character: { ...c, reputation: { ...c.reputation, rome: Math.min(100, (c.reputation.rome ?? 0) + POPE_OF_ORDER.rome) } },
    career: [...state.career, { week, kind: 'note', text: confrere ? `${pope.name}, who was Fr. ${confrere.name.first} ${confrere.name.last} of your own province, was elected pope.` : `${pope.name}, ${orderLabel(pope.order)}, was elected pope: one of the ${order.short}.` }],
  };
  if (confrere) next = { ...next, npcs: { ...next.npcs, [confrere.id]: { ...confrere, title: 'Pope', status: 'retired', tags: [...confrere.tags, 'pope'] } } };
  const letter: Letter = {
    sort: 'provincial',
    title: confrere ? 'One of ours, from this province' : 'One of ours',
    body: confrere
      ? [
          `The provincial writes to every house the same evening, by hand, and the letter is short because he could not make it longer. ${pope.name} was Fr. ${confrere.name.first} ${confrere.name.last}, professed in this province, a man you have eaten beside and voted for or against. The house did not go to bed.`,
          `What it means for the province no one can say yet. What it means for the order the older men say at once: every friar of the ${order.short} will be looked at differently for the rest of this pontificate, and looked at is not always liked.`,
        ]
      : [
          `The provincial writes to every house: ${pope.name} is ${orderLabel(pope.order)}, and the ${order.short} have a brother in the chair of Peter. The refectory is louder than the Rule allows and the prior lets it go.`,
          `The head of the order will be received before the ambassadors. The dicastery for religious will read the order's letters first. Rome will think a little better of every friar in the habit for the length of this pontificate, and expect a little more.`,
        ],
    week,
  };
  return deliverLetter(next, letter);
}
