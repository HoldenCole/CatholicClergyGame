import type { Condition, DiocesanNorm, GameState, IssuedDocument, LiturgicalStance, LiturgicalTopic, PolicyStanding } from '@/types';
import { createRng } from '@/engine/rng';
import { toDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';
import { axisDef, documentHistory, documentPools, policyAxes } from '@/content/rome';

/**
 * E1 R1.1 — where the universal Church stands on each policy axis, and how
 * the diocesan bishop reads the document that put it there (§4.2). The norm
 * is a pure function of the seed, the document, and the bishop, so a new
 * bishop reads the same document his own way. Tunables are invented and flagged.
 */
export const NORM = {
  /** Agreement (the document's lean times the bishop's reading) at or above which he is enthusiastic, faithful, minimal; below the last, he slow-walks it. */
  enthusiastic: 0.3,
  faithful: -0.15,
  minimal: -0.5,
  noise: 0.2,
} as const;

export function isoDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return toDayNumber({ year: y!, month: m!, day: d! });
}

export function valueLean(axis: string, value: string | undefined): number {
  return axisDef(axis)?.values.find((v) => v.key === value)?.lean ?? 0;
}

/** Which way a document moved its axis: −1 toward tradition, +1 toward reform. */
export function docLean(axis: string, from: string | undefined, to: string): number {
  const d = valueLean(axis, to) - (from === undefined ? 0 : valueLean(axis, from));
  return d === 0 ? Math.sign(valueLean(axis, to)) : Math.sign(d);
}

/** Every axis at the law as it stood before the record moves it. */
export function initialPolicies(): Record<string, PolicyStanding> {
  return Object.fromEntries(policyAxes.map((a) => [a.key, { value: a.initial, by: null, day: 0 }]));
}

/** The record's documents alone, applied through `day`: for states that carry no Rome (tests, the oldest saves). */
export function policiesByDate(day: number): Record<string, PolicyStanding> {
  const out = initialPolicies();
  for (const d of documentHistory) {
    if (!d.axis || !d.value || isoDay(d.date) > day) continue;
    out[d.axis] = { value: d.value, by: d.title, docId: `hist:${d.key}`, from: out[d.axis]?.value, day: isoDay(d.date) };
  }
  return out;
}

export function standingOf(state: Pick<GameState, 'rome' | 'clock'>, axis: string): PolicyStanding | undefined {
  return state.rome?.policies?.[axis] ?? policiesByDate(sundayOf(state.clock))[axis];
}

/** Where an axis stands this week: "free", "faculties", "discernment". */
export function policyOf(state: Pick<GameState, 'rome' | 'clock'>, axis: string): string {
  return standingOf(state, axis)?.value ?? axisDef(axis)?.initial ?? '';
}

/** How a bishop of this reading receives a document that leans this way. */
export function rollNorm(seed: string, docId: string, bishopId: string, alignment: number, lean: number): DiocesanNorm {
  const rng = createRng(`${seed}:norm:${docId}:${bishopId}`);
  const a = lean * (alignment / 100) + rng.gaussian() * NORM.noise;
  if (a >= NORM.enthusiastic) return 'enthusiastic';
  if (a >= NORM.faithful) return 'faithful';
  if (a >= NORM.minimal) return 'minimal';
  return 'slow';
}

/** How the diocese's bishop now reads the document that set an axis, or null with no bishop or no document. */
export function normFor(state: GameState, axis: string): DiocesanNorm | null {
  const b = state.world?.diocese.hidden.bishop;
  const s = standingOf(state, axis);
  if (!b || !s?.docId) return null;
  return rollNorm(state.seed, s.docId, b.npcId, b.alignment, docLean(axis, s.from, s.value));
}

const RESTRICT: Record<LiturgicalStance, number> = { free: 0, by_permission: 1, forbidden: 2 };

/**
 * The bishop's stance on a liturgical topic as the law now stands: his own
 * rolled stance, set by his reading of the document where the axis says so,
 * and never looser than the law allows.
 */
export function effectiveStance(state: GameState, topic: LiturgicalTopic, rolled: LiturgicalStance): LiturgicalStance {
  let out = rolled;
  for (const axis of policyAxes) {
    if (!axis.topics?.includes(topic)) continue;
    const value = axis.values.find((v) => v.key === policyOf(state, axis.key));
    if (!value) continue;
    const norm = normFor(state, axis.key);
    const set = norm ? value.stances?.[norm]?.[topic] : undefined;
    if (set) out = set;
    if (value.floor && RESTRICT[out] < RESTRICT[value.floor]) out = value.floor;
  }
  return out;
}

/** The latest document of his lifetime on an axis. */
export function latestOn(state: Pick<GameState, 'rome'>, axis: string): IssuedDocument | undefined {
  const issued = state.rome?.issued ?? [];
  for (let i = issued.length - 1; i >= 0; i--) if (issued[i]!.axis === axis) return issued[i];
  return undefined;
}

function oneOf(actual: string | undefined, want: string | string[]): boolean {
  return actual !== undefined && (Array.isArray(want) ? want.includes(actual) : actual === want);
}

export function policyCondition(state: GameState, cond: Extract<Condition, { type: 'policy' }>): boolean {
  return oneOf(policyOf(state, cond.axis), cond.value);
}

export function documentCondition(state: GameState, cond: Extract<Condition, { type: 'document' }>): boolean {
  const doc = latestOn(state, cond.axis);
  if (!doc) return false;
  if (cond.value !== undefined && !oneOf(doc.value, cond.value)) return false;
  if (cond.within !== undefined && state.clock.week - doc.week > cond.within) return false;
  if (cond.norm !== undefined && !oneOf(doc.norm, cond.norm)) return false;
  if (cond.implemented !== undefined) {
    if (typeof cond.implemented === 'boolean') return !!doc.implemented === cond.implemented;
    return oneOf(doc.implemented, cond.implemented);
  }
  return true;
}

export function bishopName(state: GameState): string {
  const id = state.world?.diocese.hidden.bishop.npcId;
  const b = id ? state.npcs[id] : undefined;
  return b ? `${b.title} ${b.name.last}` : 'The bishop';
}

/** The bishop's reading of a document, in a sentence: authored per axis and norm, or the generic line. */
export function readingLine(state: GameState, doc: Pick<IssuedDocument, 'axis' | 'value' | 'norm' | 'title'>): string | null {
  if (!doc.axis || !doc.value || !doc.norm) return null;
  const axis = axisDef(doc.axis);
  const text = axis?.readings?.[doc.value]?.[doc.norm] ?? documentPools.readings[doc.norm];
  return text.replace(/\{bishop\}/g, bishopName(state)).replace(/\{doc\}/g, doc.title);
}

/** {doc:<axis>}, {doc_kind:<axis>}, {reading:<axis>}, {pope}: the words a cascade scene needs. */
export function romeTokens(state: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  const r = state.rome;
  if (!r) return out;
  const pope = r.vacancy ? undefined : r.popes[r.popes.length - 1];
  out.pope = pope ? pope.name : 'the late pope';
  for (const axis of policyAxes) {
    const doc = latestOn(state, axis.key);
    const standing = r.policies?.[axis.key];
    const title = doc?.title ?? standing?.by ?? axis.label;
    out[`doc:${axis.key}`] = title;
    out[`doc_kind:${axis.key}`] = doc ? documentPools.kinds[doc.kind].label : 'document';
    const reading = doc ? readingLine(state, doc) : null;
    out[`reading:${axis.key}`] = reading ?? `${bishopName(state)} has said nothing about ${title} in particular.`;
  }
  return out;
}
