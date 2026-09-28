import type { ApostolicVisitation, Condition, GameState, Letter, Npc, VisitationCause, VisitationOutcome, VisitationSceneKind } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { finishNpc, rollBaseStats } from '@/generation/npc';
import { rollMaleName } from '@/generation/names';
import { reigning } from '@/systems/rome/papacy';
import { latestOn } from '@/systems/rome/policy';
import { PLAYER_ID, provinceState } from './electorate';
import { ORIGINS } from './general';
import { closeHouse } from './foundations';
import { vacateOffice } from './vacate';
import { membersOf } from './house';

/**
 * E3 §16D — the apostolic visitation of a province: Rome sends a friar of
 * another province to look at the houses, the books, and the men, and a
 * decree comes two years later. A multi-year arc on the province's record:
 * announced, visiting (the house's three days, the man's own hour), the
 * report, the decree. Rates, weeks, and the findings are invented and flagged.
 */
export const VISITATION = {
  /** A year's chance Rome comes, by what it has heard: a low floor, and what each cause adds. */
  chance: { base: 0.004, document: 0.08, division: 0.05, decline: 0.01, complaint: 0.1 },
  /** How long a document on religious life stays a cause. */
  documentWindow: 104,
  /** Not twice within twelve years. */
  notWithin: 52 * 12,
  /** Weeks: from the announcement to the visitor's arrival; the visit; the report's writing; and a scene's patience for a man away. */
  weeks: { toVisiting: [10, 20] as [number, number], visiting: [40, 60] as [number, number], toDecree: [26, 52] as [number, number], lapse: 26 },
  /** What the report counts against the province. */
  findings: { division: 40, decline: 25, debt: 20, complaint: 15, document: 10, slow: 20, minimal: 10, defiant: 25, plain: 12, plainWhenSound: -5, loyal: -10, provincialPlain: -8, provincialLoyal: 5, noise: 12 },
  /** The decree, by findings: under the first, a clean bill; then norms; then a house closed; then the provincial removed. */
  thresholds: { norms: 35, closure: 55, commissary: 75 },
  /** What imposed norms do to every house's observance. */
  normsObservance: 10,
  /** The commissary governs until the chapter Rome calls, a year on. */
  chapterAfter: 52,
} as const;

export const AXIS = 'religious_life';
const TAG = 'visitor';

const CAUSE_WORD: Record<VisitationCause, string> = {
  document: "the province's answer to Rome's last word on religious life",
  division: 'the division of the province, which has reached Rome',
  decline: 'the state of the province, which Rome has read in the numbers',
  complaint: 'a letter someone in the province wrote to Rome',
};

function orderKey(state: GameState): string | undefined {
  return state.religious?.order;
}

function weeks(rng: Rng, key: 'toVisiting' | 'visiting' | 'toDecree'): number {
  const [lo, hi] = VISITATION.weeks[key];
  return rng.int(lo, hi);
}

/** The document on religious life the province is still answering, if any. */
function liveDocument(state: GameState): { norm?: string; implemented?: string } | null {
  const doc = latestOn(state, AXIS);
  if (!doc || state.clock.week - doc.week > VISITATION.documentWindow) return null;
  return doc;
}

/** Why Rome would come this year, and the year's chance of it: the causes that hold, the largest first. */
export function visitationCauses(state: GameState): { cause: VisitationCause; chance: number }[] {
  const p = state.province;
  if (!p || !state.religious) return [];
  const out: { cause: VisitationCause; chance: number }[] = [];
  if (state.flags['visitation:complaint'] === true) out.push({ cause: 'complaint', chance: VISITATION.chance.complaint });
  const doc = liveDocument(state);
  if (doc && (doc.norm === 'slow' || doc.implemented === 'defiant')) out.push({ cause: 'document', chance: VISITATION.chance.document });
  const need = provinceState(state);
  if (need === 'division') out.push({ cause: 'division', chance: VISITATION.chance.division });
  if (need === 'decline' || need === 'debt') out.push({ cause: 'decline', chance: VISITATION.chance.decline });
  return out.sort((a, b) => b.chance - a.chance);
}

/** The visitor: a friar of another province, older, named by the Rome of the day. */
export function makeVisitor(state: GameState, week: number): Npc {
  const key = orderKey(state) ?? 'OP';
  const rng = createRng(`${state.seed}:visitor:${week}`);
  const year = dateOf(state.clock).year;
  const origin = rng.weighted(ORIGINS, (o) => o.weight);
  const pope = reigning(state);
  const t = pope ? pope.temperament : 0;
  return finishNpc(rng, {
    id: `visitor_${week}`,
    name: rollMaleName(rng, origin.heritage, 'older'),
    role: 'official',
    title: 'Fr.',
    birthYear: year - rng.int(58, 70),
    origin: 'urban_ethnic',
    stats: rollBaseStats(rng, 55, 80),
    tags: ['religious', `order:${key}`, TAG, 'vows:solemn', `from:${origin.from}`, `region:${origin.region}`],
    alignment: Math.max(-100, Math.min(100, Math.round(t * 0.5 + rng.gaussian() * 25))),
    relationship: 0,
    ambition: rng.int(10, 50),
  });
}

function note(state: GameState, text: string): GameState {
  return { ...state, career: [...state.career, { week: state.clock.week, kind: 'note', text }] };
}

function visitorName(state: GameState, v: ApostolicVisitation | undefined): string {
  const n = v ? state.npcs[v.visitorId] : undefined;
  return n ? `${n.title} ${n.name.last}` : 'the visitor';
}

/** Open the visitation: the visitor comes into the world, the province is told, and the man reads it in a letter. */
export function openVisitation(state: GameState, cause: VisitationCause, rng: Rng): { state: GameState; letter: Letter } {
  const week = state.clock.week;
  const visitor = makeVisitor(state, week);
  const v: ApostolicVisitation = {
    id: `av_${week}`,
    cause,
    visitorId: visitor.id,
    openedWeek: week,
    stage: 'announced',
    nextWeek: week + weeks(rng, 'toVisiting'),
    scenes: [{ kind: 'announced', dueWeek: week + rng.int(1, 2) }],
  };
  const mine = state.province!.provincialId === PLAYER_ID;
  const name = `${visitor.title} ${visitor.name.first} ${visitor.name.last}`;
  const letter: Letter = {
    sort: mine ? 'rome' : 'provincial',
    title: 'An Apostolic Visitation',
    body: mine
      ? [
          `The dicastery for religious writes, over the prefect's signature, that the Holy See has decided on an apostolic visitation of the province, and has named ${name}, of the order's province in ${visitor.tags.find((t) => t.startsWith('from:'))?.slice(5) ?? 'another country'}, as visitor. He will come within the season.`,
          `The reason is not stated. Everyone will know it anyway: ${CAUSE_WORD[cause]}.`,
          'You are asked to place the books, the personnel files, and every house of the province at his disposal, and to tell the houses that each friar may speak to him alone and in confidence.',
        ]
      : [
          `A circular from the provincial's desk, read at chapter in every house the same week: the Holy See has decided on an apostolic visitation of the province, and has named ${name}, of another province of the order, as visitor.`,
          `The circular does not give the reason. The refectory does: ${CAUSE_WORD[cause]}.`,
          'Every friar may ask to see him alone. Whatever is said to him is said under the seal of his office, and goes to Rome and nowhere else.',
        ],
    week,
  };
  let next: GameState = { ...state, npcs: { ...state.npcs, [visitor.id]: visitor }, province: { ...state.province!, visitation: v } };
  next = note(next, `Rome opened an apostolic visitation of the province (${cause}); ${visitor.title} ${visitor.name.last} was named visitor.`);
  return { state: next, letter };
}

/** What the report finds against the province, 0..100: the state of the province, the cause, the province's answer to Rome, and what the man himself said. */
export function findingsOf(state: GameState, v: ApostolicVisitation): number {
  const f = VISITATION.findings;
  const need = provinceState(state);
  let out = need === 'division' ? f.division : need === 'decline' ? f.decline : need === 'debt' ? f.debt : 0;
  if (v.cause === 'complaint') out += f.complaint;
  if (v.cause === 'document') out += f.document;
  const doc = latestOn(state, AXIS);
  if (doc) {
    if (doc.norm === 'slow') out += f.slow;
    else if (doc.norm === 'minimal') out += f.minimal;
    if (doc.implemented === 'defiant') out += f.defiant;
    else if (doc.implemented === 'minimal') out += f.minimal;
  }
  const spoke = state.flags['visitation:spoke'];
  const provincial = state.province?.provincialId === PLAYER_ID;
  if (spoke === 'plain') out += provincial ? f.provincialPlain : need === 'growth' ? f.plainWhenSound : f.plain;
  if (spoke === 'loyal') out += provincial ? f.provincialLoyal : f.loyal;
  out += createRng(`${state.seed}:visitation:${v.id}:report`).gaussian() * f.noise;
  return Math.max(0, Math.min(100, Math.round(out)));
}

/** The decree, by what the report found. */
export function outcomeOf(findings: number): VisitationOutcome {
  const t = VISITATION.thresholds;
  return findings < t.norms ? 'clean' : findings < t.closure ? 'norms' : findings < t.commissary ? 'closure' : 'commissary';
}

/** The decree's consequences on the province: norms for every house, a house closed, the provincial removed and a commissary named. */
export function applyDecree(state: GameState, v: ApostolicVisitation, rng: Rng): { state: GameState; v: ApostolicVisitation; line: string } {
  const p = state.province!;
  const week = state.clock.week;
  const outcome = v.outcome!;
  let next = state;
  let out = { ...v };
  const lines: string[] = [];
  if (outcome !== 'clean' && next.orderHouses) {
    const houses = { ...next.orderHouses };
    for (const h of Object.values(houses)) if (h.provinceId === p.id) houses[h.id] = { ...h, observance: Math.min(100, h.observance + VISITATION.normsObservance) };
    next = { ...next, orderHouses: houses, flags: { ...next.flags, 'visitation:norms': week } };
    lines.push('norms were imposed on every house');
  }
  if (outcome === 'closure' && next.orderHouses) {
    const candidates = Object.values(next.orderHouses).filter((h) => h.provinceId === p.id && h.id !== p.curiaHouseId).sort((a, b) => membersOf(next, a).length - membersOf(next, b).length || a.id.localeCompare(b.id));
    const doomed = candidates[0];
    if (doomed) {
      const closed = closeHouse(next, doomed.id, rng);
      if (closed.line) {
        next = closed.state;
        out = { ...out, closedHouseId: doomed.id };
        lines.push(`${doomed.name} was closed by decree`);
      }
    }
  }
  if (outcome === 'commissary') {
    const npcs = { ...next.npcs };
    const old = npcs[p.provincialId];
    out = { ...out, removedId: p.provincialId };
    if (p.provincialId === PLAYER_ID) {
      next = vacateOffice(next, 'removed by the decree of the apostolic visitation');
      next = { ...next, flags: { ...next.flags, 'visitation:removed': true } };
    } else if (old) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== 'provincial') };
    const visitor = npcs[v.visitorId];
    if (visitor) npcs[visitor.id] = { ...visitor, tags: [...visitor.tags.filter((t) => t !== 'provincial'), 'provincial', 'commissary'] };
    const year = dateOf(next.clock).year;
    next = { ...next, npcs, province: { ...next.province!, provincialId: v.visitorId, provincialSince: year }, flags: { ...next.flags, 'chapter:provincial:called': week + VISITATION.chapterAfter } };
    lines.push(`the provincial was removed and ${visitorName(next, v)} named commissary until a chapter`);
  }
  const line = outcome === 'clean' ? 'The decree of the visitation came: the province is found in good order.' : `The decree of the visitation came: ${lines.join('; ')}.`;
  next = note(next, line);
  return { state: { ...next, province: { ...next.province!, visitation: out } }, v: out, line };
}

/**
 * One week of the visitation: Rome may open one; an open one moves through
 * its stages on its weeks, setting the scenes due for the man; the decree's
 * consequences fall when the report is read; the file closes after.
 */
export function visitationWeek(state: GameState, rng: Rng): { state: GameState; line?: string; letter?: Letter } {
  const p = state.province;
  if (!p || !state.religious) return { state };
  const week = state.clock.week;
  if (!p.visitation) {
    if (p.lastVisitationWeek !== undefined && week - p.lastVisitationWeek < VISITATION.notWithin) return { state };
    const causes = visitationCauses(state);
    const yearly = VISITATION.chance.base + causes.reduce((sum, c) => sum + c.chance, 0);
    if (!rng.chance(yearly / 52)) return { state };
    const cause = causes[0]?.cause ?? (rng.chance(0.5) ? 'complaint' : 'decline');
    const opened = openVisitation(state, cause, rng);
    return { state: opened.state, line: 'Rome has sent the province a visitor.', letter: opened.letter };
  }
  let v: ApostolicVisitation = { ...p.visitation, scenes: p.visitation.scenes.filter((s) => week <= s.dueWeek + VISITATION.weeks.lapse) };
  let next: GameState = { ...state, province: { ...p, visitation: v } };
  let line: string | undefined;
  let letter: Letter | undefined;
  if (v.stage === 'announced' && week >= v.nextWeek) {
    const end = week + weeks(rng, 'visiting');
    v = { ...v, stage: 'visiting', nextWeek: end, scenes: [...v.scenes, { kind: 'house', dueWeek: week + rng.int(4, 12) }, { kind: 'interview', dueWeek: week + rng.int(14, 30) }] };
    line = `${visitorName(next, v)} has begun the visitation of the province's houses.`;
    next = note({ ...next, province: { ...next.province!, visitation: v } }, `${visitorName(next, v)} began his visitation of the houses.`);
  } else if (v.stage === 'visiting' && week >= v.nextWeek) {
    v = { ...v, stage: 'report', nextWeek: week + weeks(rng, 'toDecree'), scenes: [...v.scenes, { kind: 'report', dueWeek: week + rng.int(1, 3) }] };
    line = `${visitorName(next, v)} has finished his visitation and gone home to write his report.`;
    next = note({ ...next, province: { ...next.province!, visitation: v } }, `${visitorName(next, v)} left the province to write his report to Rome.`);
  } else if (v.stage === 'report' && week >= v.nextWeek) {
    const findings = findingsOf(next, v);
    v = { ...v, stage: 'decree', findings, outcome: outcomeOf(findings), nextWeek: week + VISITATION.weeks.lapse, scenes: [...v.scenes, { kind: 'decree', dueWeek: week + rng.int(1, 2) }] };
    const applied = applyDecree({ ...next, province: { ...next.province!, visitation: v } }, v, rng.derive('decree'));
    next = applied.state;
    v = applied.v;
    line = applied.line;
    letter = decreeLetter(next, v);
  } else if (v.stage === 'decree' && (v.scenes.length === 0 || week >= v.nextWeek)) {
    // The file closes: the outcome stays on the flags for the scenes that remember it.
    const { visitation: _v, ...rest } = next.province!;
    next = { ...next, province: { ...rest, lastVisitationWeek: week }, flags: { ...next.flags, 'visitation:outcome': v.outcome ?? 'clean', 'visitation:closed': week } };
    delete (next.flags as Record<string, unknown>)['visitation:complaint'];
    delete (next.flags as Record<string, unknown>)['visitation:spoke'];
    return { state: next };
  }
  return { state: next, ...(line ? { line } : {}), ...(letter ? { letter } : {}) };
}

function decreeLetter(state: GameState, v: ApostolicVisitation): Letter {
  const mine = state.flags['visitation:removed'] === true && state.religious?.termsServed.some((t) => t.office === 'provincial' && t.endWeek === state.clock.week);
  const closed = v.closedHouseId ? state.orderHouses?.[v.closedHouseId]?.name ?? 'a house' : 'a house';
  const bodies: Record<VisitationOutcome, string[]> = {
    clean: [
      'The decree of the dicastery, read in every house: the visitation has found the province in good order, faithful to its constitutions and to its work. Three recommendations follow, none of them a surprise, and a line of thanks to the visitor.',
      'The refectory takes a week to believe it.',
    ],
    norms: [
      'The decree of the dicastery, read in every house: the visitation has found the province faithful in its work and uneven in its common life. Norms follow, binding on every house: the hours in common, the habit at the work as the constitutions ask, a formation reviewed by the general curia, and a report from the provincial each year for three years.',
      'The older men read it as a vindication and the younger as a rebuke, and both are right.',
    ],
    closure: [
      `The decree of the dicastery, read in every house: norms for the common life, binding on every house; and ${closed} is to be closed by the end of the year, its men reassigned by the provincial with the visitor's agreement.`,
      'Nobody in the province had expected Rome to close a house. The men of it are given a month.',
    ],
    commissary: mine
      ? [
          `The decree of the dicastery, addressed to you: the Holy See thanks you for your service and relieves you of the office of provincial with immediate effect. ${visitorName(state, v)} is named commissary of the province, with the powers of a provincial, until a chapter is held within the year. Norms follow for every house.`,
          'You are to hand him the seal and the files this week. The letter does not say why, because it does not need to.',
        ]
      : [
          `The decree of the dicastery, read in every house: the provincial is relieved of his office with immediate effect, and ${visitorName(state, v)} is named commissary of the province, with the powers of a provincial, until a chapter is held within the year. Norms follow for every house.`,
          'The province has not been governed from outside itself in living memory. The commissary arrives with one suitcase.',
        ],
  };
  return { sort: 'rome', title: 'The Decree of the Visitation', body: bodies[v.outcome ?? 'clean'], week: state.clock.week };
}

/** The visitation's scene that is due this week, if any. */
export function dueVisitationScene(state: GameState): VisitationSceneKind | null {
  const v = state.province?.visitation;
  if (!v) return null;
  const due = v.scenes.filter((s) => state.clock.week >= s.dueWeek).sort((a, b) => a.dueWeek - b.dueWeek)[0];
  return due?.kind ?? null;
}

/** The due scene has been asked (or found no place): it is taken off the file. */
export function closeVisitationScene(state: GameState): GameState {
  const v = state.province?.visitation;
  const kind = dueVisitationScene(state);
  if (!v || !kind) return state;
  const i = v.scenes.findIndex((s) => s.kind === kind && state.clock.week >= s.dueWeek);
  return { ...state, province: { ...state.province!, visitation: { ...v, scenes: v.scenes.filter((_, j) => j !== i) } } };
}

export function visitationCondition(state: GameState, cond: Extract<Condition, { type: 'visitation' }>): boolean {
  const v = state.province?.visitation;
  switch (cond.key) {
    case 'scene':
      return dueVisitationScene(state) === cond.value;
    case 'stage':
      return v?.stage === cond.value;
    case 'cause':
      return v?.cause === cond.value;
    case 'outcome':
      return (v?.outcome ?? state.flags['visitation:outcome']) === cond.value;
  }
}

/** {visitor}, {visitor_first}, {visitation_cause}, {closed_house}: the words the visitation's scenes need. */
export function visitationTokens(state: GameState): Record<string, string> {
  const v = state.province?.visitation;
  if (!v) return {};
  const n = state.npcs[v.visitorId];
  const out: Record<string, string> = {
    visitor: visitorName(state, v),
    visitor_first: n ? n.name.first : 'the visitor',
    visitation_cause: CAUSE_WORD[v.cause],
  };
  if (v.closedHouseId) out.closed_house = state.orderHouses?.[v.closedHouseId]?.name ?? 'the house';
  const removed = v.removedId ? state.npcs[v.removedId] : undefined;
  out.removed_provincial = v.removedId === PLAYER_ID ? 'you' : removed ? `${removed.title} ${removed.name.last}` : 'the provincial';
  return out;
}
