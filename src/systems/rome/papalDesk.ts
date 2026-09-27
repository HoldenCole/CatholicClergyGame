import type { DocumentKind, GameState, IssuedDocument, Letter, PapalDraft } from '@/types';
import { createRng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { documentPools, policyAxes } from '@/content/rome';
import { closeCascade, incipit, issueDocument, type Draft } from './documents';
import { docLean, rollNorm } from './policy';
import { readBackLine } from './reversal';
import { electorsOn } from './conclave';
import { dateWords } from './papacy';

/**
 * E1 R1.6 — the pope's desk (§10.3): one document at a time, the kind and the
 * subject his, the writing done in the week's hours, and the promulgation
 * through the same `issueDocument` the whole Church lives under. The College's
 * electors read it as the bishops of the world would; his old diocese's
 * bishop reads it by name. Weights are invented and flagged.
 */
export const DESK = {
  /** Blocks of writing each kind takes. */
  kinds: { encyclical: 90, apostolic_exhortation: 60, apostolic_letter: 30, motu_proprio: 15 } as Partial<Record<DocumentKind, number>>,
  /** The Church dial by the share of the episcopate that welcomes or receives it, against the share that resists. */
  church: 14,
  curia: 10,
  /** A document that moves no law: the Church and the world hear it. */
  topicChurch: 3,
  topicWorld: 2,
  encyclicalWorld: 4,
  /** Turning back a predecessor's document costs the Church more than moving new ground. */
  reverseCost: 6,
  /** The Church tires of its law moving: each document that moved it in the year before costs this much more. */
  paceCost: 4,
} as const;

export const DESK_KINDS = Object.keys(DESK.kinds) as DocumentKind[];

export interface DraftSubject {
  /** 'axis:<key>:<value>' or 'topic:<n>'. */
  id: string;
  label: string;
  gist: string;
  axis?: string;
  value?: string;
  from?: string;
  /** Toward the traditional end (-1) or the progressive (+1); 0 for a topic. */
  lean: number;
}

function ordered(axisKey: string): string[] {
  const axis = policyAxes.find((a) => a.key === axisKey)!;
  return [...axis.values].sort((a, b) => a.lean - b.lean).map((v) => v.key);
}

/** What he could write: one step either way along every axis a pope may move, and three teaching topics. */
export function draftSubjects(state: GameState): DraftSubject[] {
  const policies = state.rome?.policies ?? {};
  const out: DraftSubject[] = [];
  for (const a of policyAxes.filter((x) => x.generated)) {
    const line = ordered(a.key);
    const now = policies[a.key]?.value ?? a.initial;
    const i = line.indexOf(now);
    for (const step of [-1, 1]) {
      const to = line[i + step];
      if (i < 0 || !to) continue;
      const v = a.values.find((x) => x.key === to)!;
      out.push({ id: `axis:${a.key}:${to}`, label: `${a.label}: ${v.label}`, gist: v.gist, axis: a.key, value: to, from: now, lean: step });
    }
  }
  const p = state.rome?.pontificate;
  const rng = createRng(`${state.seed}:pope-topics:${p?.written.length ?? 0}`);
  const topics = rng.shuffle([...documentPools.topics]).slice(0, 3);
  topics.forEach((t, n) => out.push({ id: `topic:${n}`, label: t.charAt(0).toUpperCase() + t.slice(1), gist: t, lean: 0 }));
  return out;
}

/** Put a document on the desk: its kind, its subject, a generated incipit, and the writing it will take. */
export function beginDraft(state: GameState, kind: DocumentKind, subjectId: string): GameState {
  const p = state.rome?.pontificate;
  const need = DESK.kinds[kind];
  if (!p || p.draft || !need) return state;
  const subject = draftSubjects(state).find((s) => s.id === subjectId);
  if (!subject) return state;
  const rng = createRng(`${state.seed}:pope-draft:${p.written.length}:${state.clock.week}`);
  const draft: PapalDraft = { kind, title: incipit(rng), gist: subject.gist, need, done: 0, startedWeek: state.clock.week, ...(subject.axis ? { axis: subject.axis, value: subject.value!, from: subject.from! } : {}) };
  return { ...state, rome: { ...state.rome!, pontificate: { ...p, draft } } };
}

/** Take the document off the desk unwritten. */
export function abandonDraft(state: GameState): GameState {
  const p = state.rome?.pontificate;
  if (!p?.draft) return state;
  const { draft: _d, ...rest } = p;
  return { ...state, rome: { ...state.rome!, pontificate: { ...rest, written: p.written } } };
}

function share(norms: string[]): { welcome: number; faithful: number; minimal: number; slow: number } {
  const n = Math.max(1, norms.length);
  const c = (k: string) => norms.filter((x) => x === k).length / n;
  return { welcome: c('enthusiastic'), faithful: c('faithful'), minimal: c('minimal'), slow: c('slow') };
}

function score(s: ReturnType<typeof share>): number {
  return s.welcome + s.faithful * 0.5 - s.minimal * 0.5 - s.slow;
}

function bump(v: number | undefined, d: number): number {
  return Math.max(-100, Math.min(100, Math.round((v ?? 0) + d) || 0));
}

/** The writing is done: the document is signed, the law moves, and the bishops of the world read it. */
export function promulgate(state: GameState): { state: GameState; letter: Letter } {
  const p = state.rome!.pontificate!;
  const d = p.draft!;
  const day = sundayOf(state.clock);
  const n = p.written.length + 1;
  const now = d.axis ? state.rome!.policies?.[d.axis]?.value : undefined;
  const draft: Draft = { id: `pope:${n}`, kind: d.kind, title: d.title, gist: d.gist, day, popeId: 'player', ...(d.axis && d.value && now !== d.value ? { axis: d.axis, value: d.value, ...(now ? { from: now } : {}) } : {}) };
  const prior = d.axis ? state.rome!.policies?.[d.axis] : undefined;
  let next = closeCascade(issueDocument(state, draft).state);
  const doc = next.rome!.issued![next.rome!.issued!.length - 1] as IssuedDocument;
  const label = documentPools.kinds[d.kind].label;
  const college = next.rome!.college ?? [];
  const electors = electorsOn(college, day);
  const body: string[] = [`You sign ${d.title}, ${label === 'encyclical' ? 'an encyclical' : `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`}, ${d.gist}. It is published at noon in six languages and in Latin, and it is in force from ${dateWords(day)}.`];
  let church = 0;
  let curia = 0;
  let world = d.kind === 'encyclical' ? DESK.encyclicalWorld : 0;
  if (doc.axis && doc.value) {
    const v = policyAxes.find((a) => a.key === doc.axis)!.values.find((x) => x.key === doc.value)!;
    body.push(`What it changes: ${v.change}`);
    const lean = docLean(doc.axis, doc.from, doc.value);
    const norms = electors.map((c) => rollNorm(state.seed, doc.id, c.id, c.temperament, lean));
    const s = share(norms);
    const cs = share(electors.filter((c) => c.curial).map((c) => rollNorm(state.seed, doc.id, c.id, c.temperament, lean)));
    church += Math.round(DESK.church * score(s));
    curia += Math.round(DESK.curia * score(cs));
    const pct = (x: number) => Math.round(x * electors.length);
    body.push(`Of the ${electors.length} cardinal electors, who are as good a reading of the bishops as the Secretariat has, ${pct(s.welcome)} welcomed it, ${pct(s.faithful)} received it, ${pct(s.minimal)} gave it the minimum, and ${pct(s.slow)} will slow-walk it in their own dioceses.`);
    // The law moved again, and so soon: the Church tires of change it has not yet absorbed.
    const recent = p.written.map((id) => next.rome!.issued!.find((x) => x.id === id)).filter((x) => x?.axis && x.week > state.clock.week - 52).length;
    if (recent > 0) {
      church -= DESK.paceCost * recent;
      body.push(recent === 1 ? 'It is the second time this year the law has moved under the parishes. The bishops say so, some of them in writing.' : `The law has moved ${recent + 1} times this year. Pastors are reading their diocese's norms aloud on Sunday before the last ones have been printed.`);
    }
    // Turning back what another pope did: the men who put it into effect remember.
    if (prior?.docId && prior.docId !== 'player' && !prior.docId.startsWith('pope:')) {
      church -= DESK.reverseCost;
      body.push(`It turns back ${prior.by ?? 'what your predecessor settled'}. Somewhere a pastor who spent two years putting that into effect, and lost families over it, is reading this at his kitchen table.`);
    }
    const bishop = state.world?.diocese.hidden.bishop;
    if (bishop) {
      const npc = state.npcs[bishop.npcId];
      const norm = rollNorm(state.seed, doc.id, bishop.npcId, bishop.alignment, lean);
      const who = npc ? `${npc.title} ${npc.name.last}` : 'the bishop';
      const words: Record<string, string> = { enthusiastic: 'welcomed it from the cathedral pulpit on Sunday', faithful: 'received it in a letter to his priests', minimal: 'gave it the minimum, in a paragraph', slow: 'has said nothing yet, which is also a reading' };
      body.push(`At home, ${who} ${words[norm]}. The parishes you knew will hear it through him, the way you once heard every pope.`);
    }
  } else {
    church += DESK.topicChurch;
    world += DESK.topicWorld;
    body.push('It moves no law. It is read in seminaries and argued over in the journals, and a few sentences of it are quoted from pulpits for years; nobody has to change anything on Monday.');
  }
  const back = doc.reverses ? readBackLine(next, doc) : null;
  if (back) body.push(back, 'You read that on the page of your own record and understand, from this side of the desk, what it costs the men in the parishes.');
  const study = next.study!;
  const place = { ...(study.place ?? {}), church: bump(study.place?.church, church), curia: bump(study.place?.curia, curia), world: bump(study.place?.world, world) };
  const record = { ...(study.record ?? {}), documents: (study.record?.documents ?? 0) + 1 };
  const { draft: _d, ...rest } = next.rome!.pontificate!;
  next = { ...next, study: { ...study, place, record }, rome: { ...next.rome!, pontificate: { ...rest, written: [...p.written, doc.id] } } };
  return { state: next, letter: { sort: 'rome', title: `Promulgated: ${d.title}`, body, week: state.clock.week } };
}

/** A week at the desk: the writing hours go into the document, and a finished one is promulgated. */
export function deskWeek(state: GameState): { state: GameState; lines: string[]; letters: Letter[] } {
  const p = state.rome?.pontificate;
  const hours = state.study?.routine.pope_writing ?? 0;
  if (!p?.draft || hours <= 0) return { state, lines: [], letters: [] };
  const done = p.draft.done + hours;
  const s: GameState = { ...state, rome: { ...state.rome!, pontificate: { ...p, draft: { ...p.draft, done } } } };
  if (done < p.draft.need) return { state: s, lines: [], letters: [] };
  const out = promulgate(s);
  return { state: out.state, lines: [`${p.draft.title} is promulgated.`], letters: [out.letter] };
}
