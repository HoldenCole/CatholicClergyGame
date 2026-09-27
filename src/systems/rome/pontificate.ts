import type { GameState, Letter, Npc, Papacy, PopeSceneKind, StudyState } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { careerSummary } from '@/engine/career';
import { studyProgram } from '@/content/study';
import { finishNpc, rollBaseStats, addStats } from '@/generation/npc';
import { closeTenure } from '@/systems/tenures';
import { formerOf } from '@/engine/see';
import { PAPACY, generatePope } from './papacy';
import { collegeElects, electorsOn } from './conclave';
import { deskWeek } from './papalDesk';
import { takeJourney } from './papalActs';
import { dialWord, pontificateEpilogue } from './pontificateText';

/**
 * E1 R1.6 — the pontificate, played (§10): the last posting. The man said
 * accepto; he leaves his see or his office, is no longer a cardinal, and
 * reigns. His week is the posting machinery (sixteen blocks, five dials, a
 * book); his desk, consistories, and journeys are in papalDesk and papalActs.
 * It ends by death (the generated popes' table, eased or hastened by his
 * strength) or by renunciation, and the College he made elects his successor
 * from the gallery. Tunables are invented and flagged.
 */
export const PONTIFICATE = {
  /** Where the dials start: the world curious, the Church hopeful, the Curia waiting to see. */
  start: { church: 15, curia: 0, world: 20 },
  /** Strength at election: a floor, less for every year past sixty. */
  strength: { base: 60, perYearPast60: 2.5 },
  /** Each year: strength lost to age, and more past seventy-five; the other dials drift toward nothing. */
  yearStrength: 3,
  yearStrengthPast75: 0.8,
  drift: 4,
  /** How far strength moves the chance of death: at +100 half, at −100 half again. */
  strengthDeath: 200,
  /** Strength at which the question of laying it down is put to him. */
  layingDown: -40,
  /** A week of the pontificate carries one of its own scenes about this often. */
  sceneChance: 0.12,
  /** Each week the Church, the Curia, and the world forget a little of what he did: this share of each dial fades. */
  fade: 0.04,
  /** Each week an old man's strength drains, more past seventy; and it can never be more than his age allows. */
  weekDrain: 0.15,
  weekDrainPast70: 0.02,
  strengthCap: { from: 60, perYear: 3 },
} as const;

export const POPE_ID = 'player';

function ageOn(state: GameState, day: number): number {
  const c = state.character!;
  return fromDayNumber(day).year - (c.entryYear - c.background.entryAge);
}

function clamp(n: number): number {
  // `|| 0`: a -0 would not survive a save (JSON has no negative zero).
  return Math.max(-100, Math.min(100, Math.round(n) || 0));
}

export function reigningPlayer(state: Pick<GameState, 'rome'>): boolean {
  return !!state.rome?.pontificate;
}

function aide(rng: Rng, id: string, first: string, last: string, title: string, tag: string, born: number, alignment: number): Npc {
  return finishNpc(rng, {
    id,
    name: { first, last },
    role: 'official',
    title,
    birthYear: born,
    origin: 'urban_ethnic',
    stats: addStats(rollBaseStats(rng, 45, 70), { administration: 10 }),
    tags: [tag],
    alignment,
    relationship: 10,
    ambition: rng.int(20, 90),
  });
}

/**
 * Accepto: the man is proclaimed. His see or office is written to the record
 * as served, he stops being a cardinal, he reigns in the line, and the
 * Apostolic Palace becomes his posting. A Secretary of State is taken from the
 * College (a curial man near his reading) and a private secretary is given him.
 */
export function beginPontificate(state: GameState, name: string): GameState {
  const week = state.clock.week;
  const day = sundayOf(state.clock);
  const c = state.character!;
  const age = ageOn(state, day);
  const program = studyProgram('papacy')!;
  const from = state.see ? `Bishop of ${state.see.see}` : state.study?.city === 'curia' ? `of ${state.study.school}` : 'of the College';
  let s = closeTenure(state, 'elected Bishop of Rome');
  if (s.study) s = { ...s, offerHistory: [...s.offerHistory, { offerId: s.study.offerId, week, decision: 'completed' }] };
  const formerSee = s.see ? formerOf(s, s.see) : null;
  const rome = s.rome!;
  const { vacancy: _v, conclave: _c, collegeScene: _cs, ...open } = rome;
  const pope: Papacy = { id: POPE_ID, name, born: c.entryYear - c.background.entryAge, electedDay: day, from: 'the United States', temperament: c.alignment, historical: false, line: `Elected at ${age}: ${from.startsWith('of') ? 'a cardinal ' + from : `the ${from}`}.` };
  const college = rome.college ?? [];
  const rng = createRng(`${state.seed}:pontificate`);
  // The Secretary of State: a curial cardinal whose reading is near his own, and whom the College rates.
  const fit = (x: { temperament: number; papabile: number }) => Math.abs(x.temperament - c.alignment) - x.papabile * 40;
  const sos = electorsOn(college, day).filter((x) => x.curial).sort((a, b) => fit(a) - fit(b))[0];
  const npcs = { ...s.npcs };
  if (sos) {
    const [first, ...rest] = sos.name.split(' ');
    npcs[`sos_${sos.id}`] = aide(rng.derive('sos'), `sos_${sos.id}`, first!, rest.join(' ') || first!, 'Cardinal', 'secretary_of_state', sos.born, sos.temperament);
  }
  const secretary = aide(rng.derive('secretary'), 'pope_secretary', rng.pick(['Leonardo', 'Tomasz', 'Georg', 'Fabio', 'Michael', 'Juan Carlos', 'Paolo', 'Brian']), rng.pick(['Moretti', 'Kowalczyk', 'Brandt', 'Rinaldi', 'Flanagan', 'Ortega', 'Sarno', 'Kiely']), 'Msgr.', 'pope_secretary', fromDayNumber(day).year - rng.int(40, 52), clamp(c.alignment + rng.gaussian() * 20));
  npcs[secretary.id] = secretary;
  const strength = clamp(PONTIFICATE.strength.base - Math.max(0, age - 60) * PONTIFICATE.strength.perYearPast60);
  const study: StudyState = {
    offerId: 'papacy',
    program: program.id,
    city: 'holy_see',
    label: program.label,
    school: program.school,
    residence: program.residence,
    startWeek: week,
    endWeek: week + 52 * 60,
    failed: false,
    routine: {},
    hoursLogged: {},
    taken: [],
    fromParishId: null,
    place: { ...PONTIFICATE.start, soul: clamp((c.stats.piety - 50) * 1.2), strength },
    record: {},
  };
  const flags: GameState['flags'] = { ...s.flags, pope: true, 'pope:name': name, 'pope:elected_week': week, 'pope:from': from, was_cardinal: !!s.flags.cardinal, ordained_bishop: true };
  for (const k of ['cardinal', 'cardinal:emeritus', 'conclave:eve']) delete flags[k];
  for (const k of Object.keys(flags)) if (k.startsWith('study:') || k.startsWith('curia:')) delete flags[k];
  const electors = electorsOn(college, day).length;
  s = {
    ...s,
    see: null,
    study,
    phase: 'bishop',
    parish: null,
    assignment: null,
    npcs,
    flags: { ...flags, ...(formerSee ? { 'pope:former_see': formerSee.see } : {}) },
    beats: s.beats.filter((b) => b.kind !== 'assignment'),
    rome: { ...open, popes: [...open.popes, pope], pontificate: { name, electedWeek: week, electedDay: day, from, written: [], journeys: [], consistories: [], electorsAtElection: electors, scene: { kind: 'first', dueWeek: week + 1 } } },
    mode: { kind: 'clock' },
    career: [...s.career, { week, kind: 'promotion', text: `Elected Bishop of Rome by the College of Cardinals at ${age}; took the name ${name}.` }],
  };
  return s;
}

/** The pontificate's scene due this week, if any. */
export function duePopeScene(state: GameState): PopeSceneKind | null {
  const due = state.rome?.pontificate?.scene;
  return due && state.clock.week >= due.dueWeek ? due.kind : null;
}

export function closePopeScene(state: GameState): GameState {
  const p = state.rome?.pontificate;
  if (!p?.scene) return state;
  const { scene: _s, ...rest } = p;
  return { ...state, rome: { ...state.rome!, pontificate: rest as typeof p } };
}

function schedule(state: GameState, kind: PopeSceneKind, dueWeek: number): GameState {
  const p = state.rome!.pontificate!;
  return { ...state, rome: { ...state.rome!, pontificate: { ...p, scene: { kind, dueWeek } } } };
}

export interface PontificateWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/** The week's fading: what the Church and the world heard last month grows faint, and the body is a week older. */
function fadeWeek(state: GameState): GameState {
  const place = state.study?.place;
  if (!place) return state;
  const age = ageOn(state, sundayOf(state.clock));
  const cap = 100 - Math.max(0, age - PONTIFICATE.strengthCap.from) * PONTIFICATE.strengthCap.perYear;
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(place)) {
    next[k] = k === 'strength' ? Math.min(cap, v - PONTIFICATE.weekDrain - Math.max(0, age - 70) * PONTIFICATE.weekDrainPast70) : v - v * PONTIFICATE.fade;
  }
  return { ...state, study: { ...state.study!, place: next } };
}

/** One week of the pontificate beyond its hours: the desk, the journey, the anniversary, and the question of laying it down. */
export function pontificateWeek(state: GameState): PontificateWeek {
  const p = state.rome?.pontificate;
  if (!p) return { state, lines: [], letters: [] };
  // He signed the declaratio in a scene last week: it takes effect now.
  if (state.flags['pope:renounce']) return { state: endPontificate(state, 'resigned'), lines: [], letters: [] };
  const lines: string[] = [];
  const letters: Letter[] = [];
  let s = fadeWeek(state);
  const desk = deskWeek(s);
  s = desk.state;
  lines.push(...desk.lines);
  letters.push(...desk.letters);
  const journey = takeJourney(s);
  if (journey.letter) {
    s = schedule(journey.state, 'journey', s.clock.week);
    letters.push(journey.letter);
  }
  const served = s.clock.week - p.electedWeek;
  if (served > 0 && served % 52 === 0 && !s.rome!.pontificate!.scene) s = schedule(s, 'anniversary', s.clock.week + 1);
  if ((s.study?.place?.strength ?? 0) <= PONTIFICATE.layingDown && !s.flags['pope:asked_laying_down'] && !s.rome!.pontificate!.scene) {
    s = schedule({ ...s, flags: { ...s.flags, 'pope:asked_laying_down': true } }, 'laying_down', s.clock.week + 1);
  }
  return { state: s, lines, letters };
}

/** Once a year: strength spent, the dials drifting, the year's letter, and the chance that it ends. */
export function pontificateYear(state: GameState, rng: Rng): GameState {
  const p = state.rome?.pontificate;
  const study = state.study;
  if (!p || !study?.place) return state;
  const day = sundayOf(state.clock);
  const age = ageOn(state, day);
  const drift = (v: number) => (Math.abs(v) <= PONTIFICATE.drift ? 0 : v > 0 ? v - PONTIFICATE.drift : v + PONTIFICATE.drift);
  const lost = PONTIFICATE.yearStrength + Math.max(0, age - 75) * PONTIFICATE.yearStrengthPast75;
  const place: Record<string, number> = {};
  for (const [k, v] of Object.entries(study.place)) place[k] = k === 'strength' ? clamp(v - lost) : k === 'soul' ? v : drift(v);
  let s: GameState = { ...state, study: { ...study, place } };
  const years = Math.max(1, Math.round((state.clock.week - p.electedWeek) / 52));
  const letter: Letter = {
    sort: 'review',
    title: `${p.name}: year ${years}`,
    body: [
      `${years === 1 ? 'A year' : `${years} years`} in the chair of Peter. The Church is ${dialWord('church', place.church ?? 0)}; the Curia is ${dialWord('curia', place.curia ?? 0)}; the world is ${dialWord('world', place.world ?? 0)}.`,
      `The priest in you is ${dialWord('soul', place.soul ?? 0)}. Your strength is ${dialWord('strength', place.strength ?? 0)}, and you are ${age}.`,
      p.written.length ? `You have promulgated ${p.written.length} document${p.written.length === 1 ? '' : 's'}${p.journeys.length ? ` and made ${p.journeys.length} journey${p.journeys.length === 1 ? '' : 's'}` : ''}.` : 'Nothing has yet gone out over your name but the Angelus and the audiences, and the Church is waiting to hear you.',
    ],
    week: state.clock.week,
  };
  s = { ...s, letters: [...(s.letters ?? []), letter], letterQueue: [...(s.letterQueue ?? []), letter] };
  const die = (PAPACY.death.base + Math.max(0, age - 70) * PAPACY.death.perYearPast70) * (1 - (place.strength ?? 0) / PONTIFICATE.strengthDeath);
  if (rng.chance(die)) return endPontificate(s, 'died');
  return s;
}

/**
 * The end: death or renunciation. His record in the line is closed, and the
 * College he made elects his successor from the gallery; the shelf page says
 * what that conclave read.
 */
export function endPontificate(state: GameState, cause: 'died' | 'resigned'): GameState {
  const day = sundayOf(state.clock);
  const rome = state.rome!;
  const popes = rome.popes.map((p) => (p.id === POPE_ID ? { ...p, endDay: day, end: cause } : p));
  const college = rome.college ?? [];
  const after = day + 18;
  const successor = collegeElects({ ...state, rome: { ...rome, popes } }, college, day);
  const named = successor ? generatePope(state.seed, (rome.generated ?? 0) + 1, after, popes, rome.ordinals ?? {}, { born: successor.born, from: successor.from, temperament: successor.temperament }).pope.name : null;
  const next: GameState = { ...state, rome: { ...rome, popes }, flags: { ...state.flags, 'pope:end': cause } };
  const ending = cause === 'died' ? 'pope_died' : 'pope_renounced';
  const epilogue = pontificateEpilogue(next, successor, named, day);
  const closed = closeTenure(next, cause === 'died' ? 'died in the chair of Peter' : 'renounced the see of Peter');
  return { ...closed, speed: 'PAUSED', mode: { kind: 'ended', ending, summary: `${careerSummary(next, ending)}\n\n${epilogue}` } };
}
