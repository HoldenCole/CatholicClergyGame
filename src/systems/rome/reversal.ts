import type { Choice, GameState, IssuedDocument } from '@/types';
import { eventById } from '@/content';
import { fromDayNumber } from '@/engine/calendar';
import { policyAxes } from '@/content/rome';
import { docLean } from './policy';

/**
 * E1 R1.2 — reversal (§4.3). A document that turns an axis back against an
 * earlier one the man answered in his parish reverses it, and the record is
 * read back to him: the document, the year and the parish, the words of what
 * he chose, and what it cost. It can happen as often as Rome changes its mind.
 */

/** The earlier document of his lifetime this one turns back, if he answered it. */
export function reversalOf(issued: IssuedDocument[], doc: Pick<IssuedDocument, 'axis' | 'from' | 'value'>): IssuedDocument['reverses'] {
  if (!doc.axis || !doc.value) return undefined;
  const lean = docLean(doc.axis, doc.from, doc.value);
  for (let i = issued.length - 1; i >= 0; i--) {
    const prev = issued[i]!;
    if (prev.axis !== doc.axis || !prev.value) continue;
    if (!prev.implemented) continue;
    if (docLean(prev.axis, prev.from, prev.value) !== -lean) return undefined;
    return { index: i, title: prev.title, value: prev.value, implemented: prev.implemented, week: prev.implementedWeek ?? prev.week };
  }
  return undefined;
}

/** The choice he made in the parish scene that answered a document: found in the history by the week he answered it. */
export function answerOf(state: GameState, doc: IssuedDocument): Choice | undefined {
  const at = doc.implementedWeek;
  if (at === undefined) return undefined;
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i]!;
    if (h.week !== at) continue;
    const ev = eventById(h.eventId);
    const choice = ev?.choices.find((c) => c.id === h.choiceId);
    if (choice?.effects.some((e) => e.target === 'document' && e.key === doc.axis)) return choice;
  }
  return undefined;
}

const LOST: Record<string, string> = {
  parishioners: 'some of the parish', traditional_bloc: 'the traditional families', progressive_bloc: 'the reforming wing', rome: 'Rome', chancery: 'the chancery',
  public: 'the town', brother_priests: 'brother priests', '@bishop': 'the bishop', '@pastor': 'the pastor', '@music_director': 'the music director', '@parishioner': 'an old parishioner',
};

/** What an answer cost and what it won, in a sentence, from its authored effects. */
export function costOf(choice: Choice | undefined): string {
  if (!choice) return 'What it cost, nobody wrote down.';
  const lost: string[] = [];
  const won: string[] = [];
  for (const e of choice.effects) {
    if ((e.target !== 'reputation' && e.target !== 'relationship') || Math.abs(e.delta ?? 0) < 3) continue;
    const who = LOST[e.key];
    if (who) ((e.delta ?? 0) < 0 ? lost : won).push(who);
  }
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  if (!lost.length && !won.length) return 'It cost little that anyone counted.';
  if (!lost.length) return `It cost nothing anyone counted, and it won you ${list(won)}.`;
  if (!won.length) return `It cost you ${list(lost)}, and won you nothing you could name.`;
  return `It cost you ${list(lost)}, and won you ${list(won)}.`;
}

function parishName(state: GameState, id: string | undefined): string {
  const p = id ? state.world?.parishes.find((x) => x.id === id) : undefined;
  return p?.name ?? 'the parish you had then';
}

export interface ReadBack {
  title: string;
  year: number;
  parish: string;
  said: string;
  cost: string;
}

/** The record read back: the earlier document, where and when he answered it, what he chose, and what it cost. */
export function readBack(state: GameState, doc: IssuedDocument): ReadBack | null {
  const r = doc.reverses;
  const earlier = r ? state.rome?.issued?.[r.index] : undefined;
  if (!r || !earlier) return null;
  const choice = answerOf(state, earlier);
  const said = choice ? choice.label.replace(/\.$/, '') : 'Do what the document asked';
  return { title: r.title, year: fromDayNumber(earlier.day).year, parish: parishName(state, earlier.parishId), said, cost: costOf(choice) };
}

/** The paragraph the Rome letter adds when a document turns back one he answered. */
export function readBackLine(state: GameState, doc: IssuedDocument): string | null {
  const b = readBack(state, doc);
  if (!b) return null;
  return `It undoes ${b.title}. You remember what you did with that one, and so does your file: in ${b.year}, at ${b.parish}, "${b.said}." ${b.cost}`;
}

/** {then_doc:<axis>}, {then_year:<axis>}, {then_parish:<axis>}, {then_said:<axis>}, {then_cost:<axis>}: the record read back in a scene. */
export function reversalTokens(state: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  const issued = state.rome?.issued ?? [];
  for (const axis of policyAxes) {
    let doc: IssuedDocument | undefined;
    for (let i = issued.length - 1; i >= 0 && !doc; i--) if (issued[i]!.axis === axis.key) doc = issued[i];
    const b = doc ? readBack(state, doc) : null;
    if (!b) continue;
    out[`then_doc:${axis.key}`] = b.title;
    out[`then_year:${axis.key}`] = String(b.year);
    out[`then_parish:${axis.key}`] = b.parish;
    out[`then_said:${axis.key}`] = b.said;
    out[`then_cost:${axis.key}`] = b.cost;
  }
  return out;
}

/** The later document that turned this one back, if any: for the Profile. */
export function undoneBy(issued: IssuedDocument[], index: number): IssuedDocument | undefined {
  return issued.find((d) => d.reverses?.index === index);
}
