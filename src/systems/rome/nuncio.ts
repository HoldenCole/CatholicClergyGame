import type { GameState, Letter, Npc, Nuncio, NuncioSceneKind, Terna, TernaCause } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { seeDefs } from '@/content/sees';
import { finishNpc, rollBaseStats, addStats } from '@/generation/npc';
import { rollMaleName } from '@/generation/names';
import type { Heritage } from '@/content/names';
import { reigning, sedeVacante } from './papacy';
import { nuncioView } from './nuncioView';

/**
 * E1 R1.3 — the nuncio (§5). A generated archbishop in Washington, sent by
 * the pope of the day and reading as he does, who serves some years and is
 * recalled (sooner when a new pope wants his own man). When a see of the
 * region falls vacant he consults priests in secret, sends three names to
 * Rome, and a bishop is named some months later. A man may be asked about
 * another before he is ever on a list; his own name goes on one only when the
 * nuncio's reading of him is high enough. Nothing is named in a vacancy of
 * the Holy See. All of it is rolled from the seed and the week. Tunables are
 * invented and flagged.
 */
export const NUNCIO = {
  termYears: [5, 8] as [number, number],
  /** A new pope recalls the nuncio within this many days. */
  newPopeDays: [180, 420] as [number, number],
  newPopeRecalls: 0.5,
  /** Sees of the region falling vacant, a year. */
  vacancyPerYear: 0.6,
  sendAfter: [10, 20] as [number, number],
  nameAfter: [16, 36] as [number, number],
  sceneAfter: [2, 8] as [number, number],
  sceneLapse: 26,
  candidate: { view: 68, years: 16, maxAge: 62 },
  /** At the threshold, the chance his name goes on the terna, and the chance Rome takes it; both rise with the reading (a point per `perView`), to their caps. */
  onList: 0.12,
  chosen: 0.12,
  perView: 40,
  listCap: 0.45,
  chosenCap: 0.45,
  consult: { view: 30, years: 8, chance: 0.55 },
  remembersChance: 0.25,
  /** The chance a new nuncio's first dinner with the clergy is his scene. */
  arrivalChance: 0.6,
  subjectNamedChance: 0.2,
  aux: { view: 60, years: 18, perYear: 0.06 },
} as const;

const ORIGINS: { heritage: Heritage; from: string; weight: number }[] = [
  { heritage: 'italian', from: 'Italy', weight: 5 },
  { heritage: 'polish', from: 'Poland', weight: 1.5 },
  { heritage: 'german', from: 'Germany', weight: 0.8 },
  { heritage: 'irish', from: 'Ireland', weight: 0.6 },
  { heritage: 'lebanese', from: 'Lebanon', weight: 0.5 },
  { heritage: 'filipino', from: 'the Philippines', weight: 0.7 },
  { heritage: 'indian', from: 'India', weight: 0.7 },
  { heritage: 'nigerian', from: 'Nigeria', weight: 0.7 },
  { heritage: 'mexican', from: 'Mexico', weight: 0.5 },
];

function clamp(n: number): number {
  // `|| 0`: a -0 would not survive a save (JSON has no negative zero).
  return Math.max(-100, Math.min(100, Math.round(n) || 0));
}

function yearOf(state: GameState): number {
  return fromDayNumber(sundayOf(state.clock)).year;
}

/** The n-th nuncio of this world: a man the pope of the day would send. */
export function makeNuncio(seed: string, n: number, day: number, popeTemper: number): { nuncio: Nuncio; npc: Npc } {
  const rng = createRng(`${seed}:nuncio:${n}`);
  const origin = rng.weighted(ORIGINS, (o) => o.weight);
  const year = fromDayNumber(day).year;
  const birthYear = year - rng.int(58, 72);
  const temperament = clamp(popeTemper + rng.gaussian() * 20);
  const npc = finishNpc(rng, {
    id: `nuncio_${n}`,
    name: rollMaleName(rng, origin.heritage, 'older'),
    role: 'official',
    title: 'Archbishop',
    birthYear,
    origin: 'urban_ethnic',
    stats: addStats(rollBaseStats(rng, 45, 65), { administration: 10, theology: 10 }),
    tags: ['nuncio'],
    alignment: temperament,
    relationship: 0,
    ambition: rng.int(20, 90),
  });
  const leavesDay = day + rng.int(NUNCIO.termYears[0], NUNCIO.termYears[1]) * 365 + rng.int(0, 200);
  return { nuncio: { npcId: npc.id, temperament, from: origin.from, arrivedDay: day, leavesDay }, npc };
}

function popeTemper(state: GameState): number {
  const r = state.rome;
  const p = reigning(state) ?? r?.popes[r.popes.length - 1];
  return p?.temperament ?? 0;
}

function weeksOrdained(state: GameState): number | null {
  const at = state.flags.ordination_week;
  return typeof at === 'number' ? (state.clock.week - at) / 52 : null;
}

function age(state: GameState): number {
  const c = state.character;
  return c ? yearOf(state) - (c.entryYear - c.background.entryAge) : 0;
}

/** Whether the man can be put on a terna at all: a diocesan priest (or an auxiliary) of the years, holding no see, who has not refused one. */
export function mayBeCandidate(state: GameState): boolean {
  const years = weeksOrdained(state);
  const f = state.flags;
  // A friar too (E3 §16B): solemnly professed, at home in the province, not its head in Rome; about one bishop in ten is a religious.
  const friar = !state.religious || (state.religious.vows.solemnWeek !== undefined && !state.study && state.religious.office?.office !== 'general');
  return friar && years !== null && years >= NUNCIO.candidate.years && age(state) <= NUNCIO.candidate.maxAge && !f.bishop_of_a_see && !f.refused_see && !f.refused_mitre && !state.see;
}

/** A priest he might be asked about: a classmate, or a brother priest of the diocese; for a friar, a solemnly professed priest of his own order. */
function subjectFor(state: GameState, rng: Rng): Npc | null {
  const r = state.religious;
  const priests = Object.values(state.npcs)
    .filter((n) => n.status === 'active' && !n.tags.includes('bishop_elsewhere') && !n.tags.includes('diocesan_seminarian') && (r ? n.role === 'religious' && n.tags.includes(`order:${r.order}`) && n.tags.includes('vows:solemn') && n.title === 'Fr.' : n.role === 'classmate' || n.role === 'priest'))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!priests.length) return null;
  const classmates = priests.filter((n) => n.role === 'classmate');
  return classmates.length && rng.chance(0.6) ? rng.pick(classmates) : rng.pick(priests);
}

function schedule(state: GameState, kind: NuncioSceneKind, rng: Rng, ternaId?: string): GameState {
  const due = { kind, dueWeek: state.clock.week + rng.int(NUNCIO.sceneAfter[0], NUNCIO.sceneAfter[1]), ...(ternaId ? { ternaId } : {}) };
  return { ...state, rome: { ...state.rome!, nuncioScene: due } };
}

const CAUSE_LINE: Record<TernaCause, string> = {
  died: 'the bishop has died',
  retired: 'Rome has accepted the bishop\'s letter at seventy-five',
  transferred: 'the bishop has been moved to a larger see',
};

export interface NuncioWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/** One week of the nunciature: the nuncio comes and goes, sees fall vacant, the three names go to Rome, and a bishop is named. */
export function nuncioWeek(state: GameState): NuncioWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  if (!state.rome || !state.world) return { state, lines, letters };
  const day = sundayOf(state.clock);
  const week = state.clock.week;
  let s = state;
  // The first nuncio of a life is already in Washington; the ones after arrive.
  if (!s.rome!.nuncio) {
    const rng = createRng(`${s.seed}:nuncio-start`);
    const made = makeNuncio(s.seed, 1, day - rng.int(0, 3 * 365), popeTemper(s));
    s = { ...s, npcs: { ...s.npcs, [made.npc.id]: made.npc }, rome: { ...s.rome!, nuncio: made.nuncio, nuncios: 1, ternas: s.rome!.ternas ?? [] } };
  }
  let nuncio = s.rome!.nuncio!;
  // A new pope wants his own man in Washington.
  const pope = reigning(s);
  const recall = pope ? createRng(`${s.seed}:nuncio-recall:${pope.id}`) : null;
  if (pope && recall && pope.electedDay > nuncio.arrivedDay && nuncio.leavesDay > pope.electedDay + NUNCIO.newPopeDays[1] && recall.chance(NUNCIO.newPopeRecalls)) {
    const rng = recall;
    nuncio = { ...nuncio, leavesDay: pope.electedDay + rng.int(NUNCIO.newPopeDays[0], NUNCIO.newPopeDays[1]) };
    s = { ...s, rome: { ...s.rome!, nuncio } };
  }
  if (day >= nuncio.leavesDay && !sedeVacante(s)) {
    const n = (s.rome!.nuncios ?? 1) + 1;
    const made = makeNuncio(s.seed, n, day, popeTemper(s));
    const old = s.npcs[nuncio.npcId];
    const npcs = { ...s.npcs, [made.npc.id]: made.npc, ...(old ? { [old.id]: { ...old, status: 'retired' as const } } : {}) };
    s = { ...s, npcs, rome: { ...s.rome!, nuncio: made.nuncio, nuncios: n } };
    const name = `Archbishop ${made.npc.name.first} ${made.npc.name.last}`;
    lines.push(`The Holy See has a new nuncio in Washington: ${name}, from ${made.nuncio.from}.`);
    s = { ...s, career: [...s.career, { week, kind: 'note', text: `${name} came to Washington as nuncio.` }] };
    const arrival = createRng(`${s.seed}:nuncio-arrival:${n}`);
    if (weeksOrdained(s) !== null && arrival.chance(NUNCIO.arrivalChance)) s = schedule(s, 'arrival', arrival);
  }
  // A scene that waited too long for a man away from any parish lapses.
  const waiting = s.rome!.nuncioScene;
  if (waiting && week > waiting.dueWeek + NUNCIO.sceneLapse) {
    const { nuncioScene: _n, ...rest } = s.rome!;
    s = { ...s, rome: rest };
  }
  // Sede vacante: the nuncio names no one until Rome can (§9 B).
  if (sedeVacante(s)) return { state: s, lines, letters };
  s = nameBishops(s, lines);
  s = openTerna(s, lines);
  s = auxRequest(s);
  return { state: s, lines, letters };
}

function openTerna(state: GameState, lines: string[]): GameState {
  const week = state.clock.week;
  const ternas = state.rome!.ternas ?? [];
  if (ternas.some((t) => !t.done)) return state;
  const rng = createRng(`${state.seed}:terna:${week}`);
  if (!rng.chance(NUNCIO.vacancyPerYear / 52)) return state;
  const home = state.world?.diocese.presetId;
  const pool = seeDefs.filter((d) => d.id !== home && d.id !== state.see?.id);
  if (!pool.length) return state;
  const see = rng.weighted(pool, (d) => (d.great ? 1 : 4));
  const cause = rng.weighted(['retired', 'died', 'transferred'] as const, (c) => ({ retired: 5, died: 2, transferred: 2 })[c]);
  const sendWeek = week + rng.int(NUNCIO.sendAfter[0], NUNCIO.sendAfter[1]);
  const terna: Terna = { id: `terna:${ternas.length + 1}`, seeId: see.id, seeName: see.name, cause, openedWeek: week, sendWeek, nameWeek: sendWeek + rng.int(NUNCIO.nameAfter[0], NUNCIO.nameAfter[1]), player: false };
  let s = state;
  lines.push(`${see.see}: ${CAUSE_LINE[cause]}, and the see is vacant. The nuncio begins his consultations.`);
  const view = nuncioView(s).value;
  const years = weeksOrdained(s);
  if (mayBeCandidate(s) && view >= NUNCIO.candidate.view && rng.chance(Math.min(NUNCIO.listCap, NUNCIO.onList + (view - NUNCIO.candidate.view) / NUNCIO.perView))) {
    terna.player = true;
    s = { ...s, flags: { ...s.flags, terna_named: true } };
    s = { ...s, rome: { ...s.rome!, ternas: [...ternas, terna] } };
    return schedule(s, 'about_you', rng, terna.id);
  }
  if (years !== null && years >= NUNCIO.consult.years && view >= NUNCIO.consult.view && rng.chance(NUNCIO.consult.chance)) {
    const subject = subjectFor(s, rng);
    if (subject) {
      terna.consultedAbout = subject.id;
      s = { ...s, rome: { ...s.rome!, ternas: [...ternas, terna] } };
      return schedule(s, 'consulted', rng, terna.id);
    }
  }
  return { ...s, rome: { ...s.rome!, ternas: [...ternas, terna] } };
}

function nameBishops(state: GameState, lines: string[]): GameState {
  const week = state.clock.week;
  let s = state;
  for (const t of s.rome!.ternas ?? []) {
    if (t.done || week < t.nameWeek) continue;
    const rng = createRng(`${s.seed}:named:${t.id}`);
    const view = nuncioView(s).value;
    let winner: string;
    let winnerName: string;
    const subject = t.consultedAbout ? s.npcs[t.consultedAbout] : undefined;
    if (t.player && rng.chance(Math.max(0.1, Math.min(NUNCIO.chosenCap, NUNCIO.chosen + (view - NUNCIO.candidate.view) / NUNCIO.perView)))) {
      winner = 'player';
      winnerName = s.character ? `${s.character.name.first} ${s.character.name.last}` : 'you';
      s = { ...s, flags: { ...s.flags, 'nuncio:named_see': t.seeId } };
    } else if (subject && subject.status === 'active' && rng.chance(NUNCIO.subjectNamedChance)) {
      winner = subject.id;
      winnerName = `${subject.name.first} ${subject.name.last}`;
      s = { ...s, npcs: { ...s.npcs, [subject.id]: { ...subject, title: 'Bishop', tags: [...subject.tags, 'bishop_elsewhere'] } } };
    } else {
      const name = rollMaleName(rng, rng.pick(['irish', 'italian', 'polish', 'german', 'mexican', 'anglo'] as const), 'older');
      winner = `stranger:${t.id}`;
      winnerName = `${name.first} ${name.last}`;
    }
    const done: Terna = { ...t, winner, winnerName, done: true };
    s = { ...s, rome: { ...s.rome!, ternas: (s.rome!.ternas ?? []).map((x) => (x.id === t.id ? done : x)) } };
    if (winner !== 'player') lines.push(`Rome names ${winner.startsWith('stranger:') ? 'Msgr.' : 'Fr.'} ${winnerName} bishop of ${seeCity(t.seeId)}.`);
    if (t.player && winner !== 'player') s = schedule(s, 'passed', rng, t.id);
    else if (winner === t.consultedAbout) s = schedule(s, 'subject_named', rng, t.id);
    else if (!t.player && (weeksOrdained(s) ?? 0) >= 10 && rng.chance(NUNCIO.remembersChance)) s = schedule(s, 'remembers', rng, t.id);
  }
  return s;
}

/** Now and then the bishop asks Rome for an auxiliary, and asks the man whether he may put his name forward. */
function auxRequest(state: GameState): GameState {
  const years = weeksOrdained(state);
  if (years === null || years < NUNCIO.aux.years || state.flags.terna_named || !mayBeCandidate(state) || state.rome!.nuncioScene) return state;
  const rng = createRng(`${state.seed}:aux:${state.clock.week}`);
  if (!rng.chance(NUNCIO.aux.perYear / 52) || nuncioView(state).value < NUNCIO.aux.view) return state;
  return schedule(state, 'aux_request', rng);
}

/** The see's city: "Gaylord". */
export function seeCity(seeId: string): string {
  return seeDefs.find((d) => d.id === seeId)?.see ?? 'a see of the region';
}

/** The nuncio's scene due this week, if any. */
export function dueNuncioScene(state: GameState): NuncioSceneKind | null {
  const due = state.rome?.nuncioScene;
  return due && state.clock.week >= due.dueWeek ? due.kind : null;
}

export function closeNuncioScene(state: GameState): GameState {
  if (!state.rome?.nuncioScene) return state;
  const { nuncioScene: _n, ...rome } = state.rome;
  return { ...state, rome };
}

/** The terna the waiting (or last) scene is about. */
export function sceneTerna(state: GameState): Terna | undefined {
  const ternas = state.rome?.ternas ?? [];
  const id = state.rome?.nuncioScene?.ternaId;
  return (id ? ternas.find((t) => t.id === id) : undefined) ?? ternas[ternas.length - 1];
}

/** The nuncio of the day, as a person. */
export function nuncioNpc(state: GameState): Npc | undefined {
  const id = state.rome?.nuncio?.npcId;
  return id ? state.npcs[id] : undefined;
}
