import type { DocumentKind, GameState, Implementation, IssuedDocument, Letter, Papacy, PolicyStanding, RomeState } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { documentHistory, documentPools, papalHistory, policyAxes } from '@/content/rome';
import { dateWords, recordEndDay, romeOn, walkRome } from './papacy';
import { docLean, initialPolicies, isoDay, readingLine, rollNorm } from './policy';

/**
 * E1 R1.1 — the documents (§4.1) and the cascade (§4.2). The record's
 * documents arrive on their dates; after the record, a generated pope issues
 * his own, a week at a time from the seed, and moves an axis one step toward
 * his own reading. A document on an axis is read by the diocesan bishop and,
 * some weeks later, asks the man what he will do in his parish.
 * Tunables are invented and flagged.
 */
export const DOCUMENTS = {
  /** Generated documents a year, on average. */
  perYear: 1.6,
  /** The most of them that move an axis, reached at a pope's reading of ±60. */
  axisShare: 0.45,
  axisFull: 60,
  /** Weeks from the document to the parish's scene; and how long a scene waits for a man who is away. */
  cascadeAfter: [3, 10] as [number, number],
  cascadeLapse: 26,
} as const;

/** The generated line's weeks, counted from the day the record ends. */
function periodOf(day: number): number {
  return Math.floor((day - recordEndDay()) / 7);
}

function periodDay(period: number): number {
  return recordEndDay() + period * 7 + 3;
}

function popeOnDay(popes: Papacy[], day: number): Papacy | null {
  return popes.find((p) => p.electedDay <= day && (p.endDay === undefined || day < p.endDay)) ?? null;
}

function ordered(axisKey: string): string[] {
  const axis = policyAxes.find((a) => a.key === axisKey)!;
  return [...axis.values].sort((a, b) => a.lean - b.lean).map((v) => v.key);
}

/** A Latin incipit no real document has: an opener and a continuation, drawn until the pair is clean. */
export function incipit(rng: Rng): string {
  const real = new Set([...documentPools.blocked, ...documentHistory.map((d) => d.title)].map((t) => t.toLowerCase()));
  for (let i = 0; i < 12; i++) {
    const t = `${rng.pick(documentPools.openers)} ${rng.pick(documentPools.continuations)}`;
    if (!real.has(t.toLowerCase())) return t;
  }
  return `${documentPools.openers[0]} ${documentPools.continuations[0]}`;
}

type Draft = Omit<IssuedDocument, 'week' | 'norm' | 'bishopId'>;

/** The document a generated pope issues in one week of the line, if any: pure in the seed and the week. */
export function generatedDocument(seed: string, period: number, pope: Papacy, policies: Record<string, PolicyStanding>): Draft | null {
  const rng = createRng(`${seed}:doc:${period}`);
  if (!rng.chance(DOCUMENTS.perYear / 52)) return null;
  const day = periodDay(period);
  const t = pope.temperament;
  const axisChance = DOCUMENTS.axisShare * Math.min(1, Math.abs(t) / DOCUMENTS.axisFull);
  const kinds = Object.keys(documentPools.kinds) as DocumentKind[];
  if (rng.chance(axisChance)) {
    const dir = t >= 0 ? 1 : -1;
    const moves = policyAxes.filter((a) => a.generated).flatMap((a) => {
      const line = ordered(a.key);
      const i = line.indexOf(policies[a.key]?.value ?? a.initial);
      const to = line[i + dir];
      return i >= 0 && to ? [{ axis: a.key, from: line[i]!, to }] : [];
    });
    if (moves.length) {
      const m = rng.pick(moves);
      const kind = rng.weighted(kinds, (k) => documentPools.kinds[k].axisWeight);
      const value = policyAxes.find((a) => a.key === m.axis)!.values.find((v) => v.key === m.to)!;
      return { id: `gen:${period}`, kind, title: incipit(rng), gist: value.gist, day, popeId: pope.id, axis: m.axis, value: m.to, from: m.from };
    }
  }
  const kind = rng.weighted(kinds, (k) => documentPools.kinds[k].topicWeight);
  return { id: `gen:${period}`, kind, title: incipit(rng), gist: rng.pick(documentPools.topics), day, popeId: pope.id };
}

function apply(policies: Record<string, PolicyStanding>, d: Pick<IssuedDocument, 'id' | 'axis' | 'value' | 'title' | 'day'>): Record<string, PolicyStanding> {
  if (!d.axis || !d.value) return policies;
  return { ...policies, [d.axis]: { value: d.value, by: d.title, docId: d.id, from: policies[d.axis]?.value, day: d.day } };
}

function historicalDraft(i: number, from?: string): Draft {
  const h = documentHistory[i]!;
  return { id: `hist:${h.key}`, kind: h.kind, title: h.title, gist: h.gist, day: isoDay(h.date), popeId: `hist:${h.pope}`, ...(h.axis && h.value ? { axis: h.axis, value: h.value, ...(from ? { from } : {}) } : {}) };
}

/** Every document from 1939 to `day`, in order, as the line of popes issued them: the record, then the generated line. */
export function draftsBetween(seed: string, popes: Papacy[], fromDay: number, toDay: number, policies: Record<string, PolicyStanding>): { drafts: Draft[]; policies: Record<string, PolicyStanding> } {
  let now = policies;
  const drafts: Draft[] = [];
  documentHistory.forEach((h, i) => {
    const day = isoDay(h.date);
    if (day <= fromDay || day > toDay) return;
    const d = historicalDraft(i, h.axis ? now[h.axis]?.value : undefined);
    drafts.push(d);
    now = apply(now, d);
  });
  const end = recordEndDay();
  if (toDay > end) {
    for (let k = Math.max(0, periodOf(fromDay)); k <= periodOf(toDay); k++) {
      const day = periodDay(k);
      if (day <= fromDay || day > toDay) continue;
      const pope = popeOnDay(popes, day);
      if (!pope || pope.historical) continue;
      const d = generatedDocument(seed, k, pope, now);
      if (!d) continue;
      drafts.push(d);
      now = apply(now, d);
    }
  }
  return { drafts, policies: now };
}

/** Rome at the start of a life: the pope of the day, and the law as the documents before it left it. */
export function romeAtStart(seed: string, day: number): RomeState {
  const line = walkRome(seed, day);
  const { policies } = draftsBetween(seed, line.popes, -1e9, day, initialPolicies());
  return { ...romeOn(seed, day), policies, issued: [], docsThrough: day };
}

const KIND_A = (label: string): string => (/^[aeiou]/i.test(label) ? 'an' : 'a');

function issueSentence(d: IssuedDocument, popeName: string): string {
  const label = documentPools.kinds[d.kind].label;
  if (d.kind === 'synod') return `${popeName} has opened the synod: ${d.title}, ${d.gist}.`;
  if (d.kind === 'missal') return `The new Missal is here: ${d.title}, ${d.gist}.`;
  if (d.kind === 'council') return `The Council has promulgated ${d.title}, ${d.gist}.`;
  if (d.kind === 'declaration' || d.kind === 'instruction' || d.kind === 'circular_letter' || d.kind === 'responsum') return `Rome has issued ${KIND_A(label)} ${label}, ${d.title}, ${d.gist}, with ${popeName}'s approval.`;
  return `${popeName} has issued ${KIND_A(label)} ${label}, ${d.title}, ${d.gist}.`;
}

function popeName(state: GameState, popeId: string): string {
  const p = state.rome?.popes.find((x) => x.id === popeId);
  if (p) return p.name;
  const h = papalHistory.find((x) => `hist:${x.key}` === popeId);
  return h?.name ?? 'The pope';
}

export interface DocumentsWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/**
 * One week of documents: those whose day has come are issued, the law moves,
 * the bishop reads each, and a document on an axis sets its parish scene due.
 * Nothing is issued while the see is vacant (§9 B): the generated line has no
 * pope then, and the record has no document in a vacancy.
 */
export function documentsWeek(state: GameState): DocumentsWeek {
  const day = sundayOf(state.clock);
  let rome = state.rome;
  if (!rome) return { state, lines: [], letters: [] };
  if (!rome.policies) {
    // A save from before the documents: the law as it stands this week, and nothing issued yet.
    const line = walkRome(state.seed, day);
    rome = { ...rome, policies: draftsBetween(state.seed, line.popes, -1e9, day, initialPolicies()).policies, issued: rome.issued ?? [], docsThrough: day };
    return { state: { ...state, rome }, lines: [], letters: [] };
  }
  const lines: string[] = [];
  const letters: Letter[] = [];
  let career = state.career;
  const week = state.clock.week;
  const through = rome.docsThrough ?? day;
  const { drafts, policies } = draftsBetween(state.seed, rome.popes, through, day, rome.policies);
  let issued = rome.issued ?? [];
  let cascade = rome.cascade;
  // A scene that has waited too long for a man away from any parish lapses.
  if (cascade && week > cascade.dueWeek + DOCUMENTS.cascadeLapse) cascade = undefined;
  const bishop = state.world?.diocese.hidden.bishop;
  for (const draft of drafts) {
    const lean = draft.axis && draft.value ? docLean(draft.axis, draft.from, draft.value) : 0;
    const read = draft.axis && bishop && !state.see ? { norm: rollNorm(state.seed, draft.id, bishop.npcId, bishop.alignment, lean), bishopId: bishop.npcId } : {};
    const doc: IssuedDocument = { ...draft, week, ...read };
    issued = [...issued, doc];
    const name = popeName(state, doc.popeId);
    const label = documentPools.kinds[doc.kind].label;
    lines.push(`From Rome: the ${label} ${doc.title}, ${doc.gist}.`);
    if (!doc.axis || !doc.value) continue;
    const value = policyAxes.find((a) => a.key === doc.axis)!.values.find((v) => v.key === doc.value)!;
    const reading = readingLine(state, doc);
    letters.push({
      sort: 'rome',
      title: `From Rome: ${doc.title}`,
      body: [
        `${issueSentence(doc, name)} It is in force from ${dateWords(doc.day)}.`,
        `What it changes: ${value.change}`,
        reading ?? (state.see ? 'The reading of it in your own diocese is yours to give.' : 'It is read at table and argued over for a week, and then it is simply the law.'),
        'By Sunday the parish will have read the newspapers, and someone will ask you after Mass what it means before you have finished the text.',
      ],
      week,
    });
    career = [...career, { week, kind: 'note', text: `${doc.title} (${label}, ${name}): ${doc.gist}.` }];
    const rng = createRng(`${state.seed}:cascade:${doc.id}`);
    cascade = { index: issued.length - 1, dueWeek: week + rng.int(DOCUMENTS.cascadeAfter[0], DOCUMENTS.cascadeAfter[1]) };
  }
  rome = { ...rome, policies, issued, docsThrough: day, ...(cascade ? { cascade } : {}) };
  if (!cascade) delete rome.cascade;
  return { state: { ...state, rome, career }, lines, letters };
}

/** The document whose parish scene is due this week, if any. */
export function dueCascade(state: GameState): IssuedDocument | null {
  const c = state.rome?.cascade;
  if (!c || state.clock.week < c.dueWeek) return null;
  return state.rome?.issued?.[c.index] ?? null;
}

/** The scene has been asked (or found no place): the cascade is closed. */
export function closeCascade(state: GameState): GameState {
  if (!state.rome?.cascade) return state;
  const { cascade: _c, ...rome } = state.rome;
  return { ...state, rome };
}

/** What he did in his parish with the latest document on an axis: the record keeps it (§4.2 step 3). */
export function recordImplementation(state: GameState, axis: string, how: Implementation): GameState {
  const issued = state.rome?.issued;
  if (!issued) return state;
  let i = issued.length - 1;
  while (i >= 0 && issued[i]!.axis !== axis) i--;
  if (i < 0) return state;
  const doc: IssuedDocument = { ...issued[i]!, implemented: how, implementedWeek: state.clock.week, ...(state.assignment ? { parishId: state.assignment.parishId } : {}) };
  const words: Record<Implementation, string> = { eager: 'ahead of the diocese', faithful: 'as it was given', minimal: 'to the letter and no further', defiant: 'not at all' };
  return {
    ...state,
    rome: { ...state.rome!, issued: issued.map((d, j) => (j === i ? doc : d)) },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Put ${doc.title} into effect ${words[how]}.` }],
  };
}

const NORM_WORD: Record<string, string> = { enthusiastic: 'the bishop welcomed it', faithful: 'the bishop received it', minimal: 'the bishop gave it the minimum', slow: 'the bishop slow-walked it' };
const DONE_WORD: Record<Implementation, string> = { eager: 'you went ahead of the diocese', faithful: 'you put it into effect as given', minimal: 'you did the least it asked', defiant: 'you would not' };

/** The documents of his lifetime that asked something of the parishes, and what he did with each: for the Profile. */
export function documentsOfHisLife(state: GameState): { title: string; year: number; line: string }[] {
  return (state.rome?.issued ?? []).filter((d) => d.axis).map((d) => {
    const year = fromDayNumber(d.day).year;
    const parts = [d.gist];
    if (d.norm) parts.push(NORM_WORD[d.norm]!);
    parts.push(d.implemented ? DONE_WORD[d.implemented] : 'it never came to your door');
    return { title: d.title, year, line: parts.join('; ') };
  });
}
