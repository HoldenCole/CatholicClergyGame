import type { Condition, GameState, OfferDef } from '@/types';
import { evaluateCondition } from '@/engine/conditions';
import { isOfferEligible } from '@/engine/offers';
import { resolveSelector } from '@/engine/selectors';

/** DESIGN §7.5 rule 1: offers must be legible. This is the sheet that makes them legible before they arrive. */
export interface Doors {
  /** Offers the man qualifies for today; any of them may arrive. */
  ready: OfferDef[];
  /** Offers in reach this phase that he does not yet qualify for, and the first thing in the way. */
  closed: { def: OfferDef; why: string }[];
}

const STAT_WORD: Record<string, string> = { piety: 'piety', theology: 'theology', knowledge: 'learning', charisma: 'presence', administration: 'order' };
const REP_WORD: Record<string, string> = { parishioners: 'the people', chancery: 'the chancery', brother_priests: 'brother priests', public: 'the town', rome: 'Rome', traditional_bloc: 'the traditional wing', progressive_bloc: 'the progressive wing' };
const CRED_WORD: Record<string, string> = { STL: 'a Roman licentiate', JCL: 'a canon law licentiate', JCD: 'a doctorate in canon law', MBA: 'an MBA', spanish: 'Spanish', latin: 'Latin', italian: 'Italian', cpe_unit: 'a unit of clinical pastoral education' };
const FLAG_WORD: Record<string, string> = {
  rome_alumnus: 'a Roman degree', published: 'something published', speaks_spanish: 'Spanish', rome_track: 'the rector\'s eye for Rome', seminary_faculty: 'a seat on the faculty',
  'summer:chancery': 'a summer in the chancery', 'summer:hospital': 'a hospital summer', 'summer:hard_parish': 'a summer in a hard parish', 'summer:rome': 'a Roman summer',
  took_the_hard_parish: 'having taken the hard parish', tribunal_ready: 'tribunal experience',
  can_celebrate_tlm: 'faculties for the older form of the Mass', built_adoration_chapel: 'an adoration chapel', 'partner:house': 'an arrangement with a religious house', chapel_restored: 'the chapel restored',
};

function personWord(state: GameState, selector: string): string {
  const npc = resolveSelector(state, selector);
  return npc ? `${npc.title ? `${npc.title} ` : ''}${npc.name.last}` : selector.replace('@', '').replace(/_/g, ' ');
}

/** The first unmet requirement, in words. Null when the condition holds or is not worth naming. */
export function describeUnmet(cond: Condition, state: GameState): string | null {
  if (evaluateCondition(cond, state)) return null;
  switch (cond.type) {
    case 'stat': return cond.op === '>=' ? `more ${STAT_WORD[cond.key] ?? cond.key}` : `less ${STAT_WORD[cond.key] ?? cond.key}`;
    case 'reputation': return cond.op === '>=' ? `better standing with ${REP_WORD[cond.key] ?? cond.key}` : `less notice from ${REP_WORD[cond.key] ?? cond.key}`;
    case 'relationship': return cond.op === '>=' ? `a better footing with ${personWord(state, cond.npcId)}` : `a cooler footing with ${personWord(state, cond.npcId)}`;
    case 'credential': return CRED_WORD[cond.key] ?? cond.key.replace(/_/g, ' ');
    case 'flag': return cond.value ? (FLAG_WORD[cond.key] ?? null) : (FLAG_WORD[cond.key] ? `not ${FLAG_WORD[cond.key]}` : null);
    case 'alignment': return cond.op === '>=' ? 'a more progressive record' : 'a more traditional record';
    case 'outspokenness': return cond.op === '>=' ? 'a louder public record' : 'a quieter public record';
    case 'years_ordained': return cond.op === '>=' ? `${cond.value} years ordained` : 'fewer years ordained';
    case 'age': return cond.op === '<=' ? 'to be younger' : 'more years';
    case 'see': return `the see's ${cond.key === 'years' ? 'years' : cond.key}`;
    case 'year': return cond.op === '>=' ? `year ${cond.value} of seminary` : null;
    case 'pillar': return `a stronger ${cond.key} pillar this year`;
    case 'role': return cond.value === 'pastor' ? 'a pastorate' : `to be ${cond.value.replace('_', ' ')}`;
    case 'parish': return 'a different kind of parish';
    case 'house': return cond.value ? `a ${cond.charism === 'active' ? 'house of friars' : cond.charism === 'contemplative' ? 'monastery' : 'religious house'} in the diocese` : null;
    case 'figure': return 'to be a public figure';
    case 'position': return 'a stand on the record';
    case 'any': {
      const parts = cond.inner.map((c) => describeUnmet(c, state)).filter((w): w is string => !!w);
      return parts.length ? parts.slice(0, 2).join(' or ') : null;
    }
    case 'all': {
      for (const c of cond.inner) { const w = describeUnmet(c, state); if (w) return w; }
      return null;
    }
    default: return null;
  }
}

/** The first thing in the way of an offer, or null when nothing worth naming is. */
export function whyNot(def: OfferDef, state: GameState): string | null {
  for (const cond of def.requires) {
    const w = describeUnmet(cond, state);
    if (w) return w;
  }
  return null;
}

export function offerDoors(state: GameState, defs: OfferDef[]): Doors {
  const ready: OfferDef[] = [];
  const closed: { def: OfferDef; why: string }[] = [];
  for (const def of defs) {
    if (!def.phase.includes(state.phase)) continue;
    if (state.offers.some((o) => o.offerId === def.id)) continue;
    if (state.commitments.some((c) => c.offerId === def.id)) continue;
    if (def.once && state.offerHistory.some((h) => h.offerId === def.id)) continue;
    if (def.yearGate && (!state.seminary || !def.yearGate.includes(state.seminary.year))) {
      const first = Math.min(...def.yearGate);
      if (state.seminary && first > state.seminary.year) closed.push({ def, why: `year ${first} of seminary` });
      continue;
    }
    if (isOfferEligible(def, state)) ready.push(def);
    else {
      const why = whyNot(def, state);
      if (why) closed.push({ def, why });
    }
  }
  return { ready, closed };
}

export const CATEGORY_WORD: Record<OfferDef['category'], string> = { academic: 'study', chancery: 'the chancery', patronage: 'a patron', social: 'a group', seminary: 'the seminary' };

/** A condition that holds, in words the letter can use; null when it is not worth saying. */
export function describeMet(cond: Condition, state: GameState): string | null {
  if (!evaluateCondition(cond, state)) return null;
  switch (cond.type) {
    case 'stat': return cond.op === '>=' ? `your ${STAT_WORD[cond.key] ?? cond.key}` : null;
    case 'reputation': return cond.op === '>=' ? `your standing with ${REP_WORD[cond.key] ?? cond.key}` : null;
    case 'relationship': return cond.op === '>=' ? `${personWord(state, cond.npcId)}'s regard` : null;
    case 'credential': return CRED_WORD[cond.key] ?? cond.key.replace(/_/g, ' ');
    case 'flag': return cond.value ? (FLAG_WORD[cond.key] ?? null) : null;
    case 'years_ordained': return cond.op === '>=' && cond.value >= 2 ? 'the years you have in' : null;
    case 'alignment': return cond.op === '>=' ? 'your progressive record' : 'your traditional record';
    case 'outspokenness': return cond.op === '>=' ? 'your public record' : null;
    case 'figure': return 'being a figure';
    case 'position': return 'a stand you took';
    case 'role': return cond.value === 'pastor' ? 'your pastorate' : null;
    case 'any': {
      for (const c of cond.inner) { const w = describeMet(c, state); if (w) return w; }
      return null;
    }
    case 'all': {
      const parts = cond.inner.map((c) => describeMet(c, state)).filter((w): w is string => !!w);
      return parts.length ? parts.slice(0, 2).join(' and ') : null;
    }
    default: return null;
  }
}

/** Why this offer came: the requirements and biases that hold, in words. DESIGN §7.5 rule 1. */
export function whyOffered(def: OfferDef, state: GameState): string | null {
  const parts: string[] = [];
  for (const cond of def.requires) { const w = describeMet(cond, state); if (w) parts.push(w); }
  for (const b of def.bias ?? []) { if (b.multiplier > 1) { const w = describeMet(b.when, state); if (w) parts.push(w); } }
  const uniq = [...new Set(parts)];
  if (!uniq.length) return null;
  return `It came because of ${uniq.slice(0, 3).join(', ')}.`;
}
