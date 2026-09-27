import type { Diplomacy, DiplomacySceneKind, DiplomatRank, GameState, Letter, Npc, NunciatureDef, StudyState } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { finishNpc, rollBaseStats, addStats } from '@/generation/npc';
import { rollMaleName } from '@/generation/names';
import { nunciatures } from '@/content/rome';
import { studyProgram } from '@/content/study';
import { reigning, sedeVacante } from './papacy';

/**
 * E1 R1.7 — the Holy See's diplomatic service (§11): the Academy, a year of
 * mission, and then nunciatures abroad, a country every three years or so,
 * up the ladder from secretary to counsellor and, for some, to a nunciature
 * of one's own. It rides on the posting machinery; the service does not end
 * on its own, only by the way home or the letter at seventy-five. Rank and
 * rotation live in `rome.diplomacy`. Tunables are invented and flagged.
 */
export const DIPLOMACY = {
  /** The Academy's missionary year begins after two years of study (since 2020; flagged). */
  missionAfter: 104,
  /** A man recruited at the Gregorian whose degree ends this near the Academy's October goes straight across; earlier, he goes home to wait. Invented. */
  termEarly: 4,
  /** Weeks in a country before the Secretariat moves him; a nuncio stays longer. */
  rotate: [150, 190] as [number, number],
  rotateNuncio: [200, 300] as [number, number],
  /** The rotation is put to him this many weeks before it happens. */
  askBefore: 6,
  /** Years of service for each rung, and the Secretariat's score for the pope's own act. */
  rungs: [
    { key: 'secretary1' as const, years: 3, score: 40 },
    { key: 'counsellor' as const, years: 7, score: 55 },
    { key: 'nuncio' as const, years: 14, score: 72 },
  ],
  /** The local dials a new country starts from: harder posts start colder. */
  coldPerHardship: 10,
  /** How far the service draws his reading toward Rome's by the time he goes home. */
  romePull: 0.3,
  priestHigh: 30,
  clerkLow: -20,
  retirementAge: 75,
} as const;

const LADDER: DiplomatRank[] = ['secretary2', 'secretary1', 'counsellor', 'nuncio'];

export const RANK_WORD: Record<DiplomatRank, string> = { student: 'a student of the Academy', secretary2: 'secretary of nunciature', secretary1: 'first secretary of nunciature', counsellor: 'counsellor of nunciature', nuncio: 'apostolic nuncio' };

function ageOn(state: GameState): number {
  const c = state.character!;
  return fromDayNumber(sundayOf(state.clock)).year - (c.entryYear - c.background.entryAge);
}

export function diplomacyOf(state: GameState): Diplomacy | null {
  return state.rome?.diplomacy ?? null;
}

export function nunciatureDef(country: string | undefined): NunciatureDef | undefined {
  return nunciatures.find((n) => n.country === country);
}

/** What he is, where: "Secretary of nunciature in Kenya", "Apostolic nuncio in Peru". */
export function postLabel(rank: DiplomatRank, country: string): string {
  return `${RANK_WORD[rank].replace(/^./, (c) => c.toUpperCase())} in ${country}`;
}

function withDiplomacy(state: GameState, d: Diplomacy): GameState {
  return { ...state, rome: { ...(state.rome ?? { popes: [] }), diplomacy: d } };
}

function schedule(state: GameState, kind: DiplomacySceneKind, dueWeek: number): GameState {
  const d = diplomacyOf(state)!;
  return withDiplomacy(state, { ...d, scene: { kind, dueWeek } });
}

/** The service's scene due now, if any. */
export function dueDiplomacyScene(state: GameState): DiplomacySceneKind | null {
  const due = diplomacyOf(state)?.scene;
  return due && state.clock.week >= due.dueWeek ? due.kind : null;
}

export function closeDiplomacyScene(state: GameState): GameState {
  const d = diplomacyOf(state);
  if (!d?.scene) return state;
  const { scene: _s, ...rest } = d;
  return withDiplomacy(state, rest);
}

/** The Academy begins: a student, and the missionary year scheduled after two years of study. */
export function beginAcademy(state: GameState): GameState {
  const s = withDiplomacy(state, { rank: 'student', countries: [] });
  return schedule(s, 'mission', state.clock.week + DIPLOMACY.missionAfter);
}

/** A country for the next posting: not one he has served, the hard ones likelier while he is young and when he is first a nuncio. */
export function pickCountry(state: GameState, rng: Rng, nuncio: boolean): NunciatureDef {
  const d = diplomacyOf(state);
  const served = new Set(d?.countries ?? []);
  const young = (d?.countries.length ?? 0) < 2;
  const pool = nunciatures.filter((n) => !served.has(n.country));
  const from = pool.length ? pool : nunciatures;
  const creds = state.character?.credentials ?? [];
  return rng.weighted(from, (n) => (young || nuncio ? n.hardship : 4 - n.hardship) * (n.language && creds.includes(n.language) ? 1.6 : 1));
}

function chief(rng: Rng, id: string, year: number): Npc {
  const heritage = rng.weighted(['italian', 'polish', 'german', 'irish', 'mexican', 'filipino', 'indian', 'nigerian', 'lebanese'] as const, (h) => (h === 'italian' ? 4 : 1));
  return finishNpc(rng, {
    id,
    name: rollMaleName(rng, heritage, 'older'),
    role: 'official',
    title: 'Archbishop',
    birthYear: year - rng.int(56, 72),
    origin: 'urban_ethnic',
    stats: addStats(rollBaseStats(rng, 45, 70), { administration: 10 }),
    tags: ['nuncio_chief'],
    alignment: rng.int(-50, 50),
    relationship: 0,
    ambition: rng.int(20, 90),
  });
}

/** Send him to a country: a chief there (unless he is the nuncio himself), the local dials cold again, the book counting it. */
function postTo(state: GameState, def: NunciatureDef, rng: Rng): GameState {
  const d = diplomacyOf(state)!;
  const week = state.clock.week;
  const nuncio = d.rank === 'nuncio';
  const range = nuncio ? DIPLOMACY.rotateNuncio : DIPLOMACY.rotate;
  const npcs: GameState['npcs'] = {};
  for (const [id, npc] of Object.entries(state.npcs)) npcs[id] = npc.tags.includes('nuncio_chief') && npc.status === 'active' ? { ...npc, status: 'retired' } : npc;
  if (!nuncio) {
    const boss = chief(rng.derive('chief'), `nuncio_chief_${week}`, fromDayNumber(sundayOf(state.clock)).year);
    npcs[boss.id] = boss;
  }
  const study = state.study!;
  const cold = -DIPLOMACY.coldPerHardship * (def.hardship - 1);
  const place = { ...(study.place ?? {}), church: cold, state: cold };
  const record = { ...(study.record ?? {}), countries: (study.record?.countries ?? 0) + 1 };
  const { next: _n, ...rest } = d;
  return withDiplomacy({ ...state, npcs, study: { ...study, place, record, school: `the Apostolic Nunciature in ${def.country}`, label: postLabel(d.rank, def.country) } }, { ...rest, country: def.country, arrivedWeek: week, rotateWeek: week + rng.int(range[0], range[1]), countries: [...d.countries, def.country] });
}

/**
 * The Academy's years are done: the service begins, and does not end on its
 * own. A secretary of nunciature, second class, in the first country.
 */
export function beginService(state: GameState, rng: Rng): { state: GameState; letter: Letter } {
  const week = state.clock.week;
  const program = studyProgram('nunciature')!;
  const offerId = state.study?.offerId ?? 'rome_diplomatic_academy';
  const study: StudyState = {
    offerId,
    program: program.id,
    city: 'nunciature',
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
    place: Object.fromEntries(program.place!.dials.map((x) => [x.id, 0])),
    record: {},
  };
  let s = withDiplomacy({ ...state, study, phase: 'study', flags: { ...state.flags, 'study:nunciature': true, diplomat: true } }, { rank: 'secretary2', since: week, countries: [] });
  const def = pickCountry(s, rng.derive('first'), false);
  s = postTo(s, def, rng.derive('post'));
  s = { ...s, career: [...s.career, { week, kind: 'promotion', text: `Entered the diplomatic service of the Holy See: secretary of nunciature in ${def.country}.` }] };
  return {
    state: s,
    letter: {
      sort: 'rome',
      title: `The service: ${def.country}`,
      body: [
        `The Secretariat of State's letter gives you a country: ${def.country}, where the Church is ${def.church}. You are secretary of nunciature, second class, the lowest rank of the service and the one every nuncio began in.`,
        'You will draft what the nuncio signs, carry what he cannot, and learn a country well enough to explain it to Rome in four pages. In three years or so they will move you somewhere else, and then somewhere else again.',
        'Your diocese still has your name in its book. The Secretariat has it in another.',
      ],
      week,
    },
  };
}

/** How the Secretariat reads him this year: the reports, the chief's regard, the local Church, Rome, and a year's luck. */
export function serviceScore(state: GameState, rng: Rng): number {
  const place = state.study?.place ?? {};
  const boss = Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes('nuncio_chief'));
  return 30 + (place.reports ?? 0) / 2 + (place.church ?? 0) / 5 + (boss?.relationship ?? 0) / 4 + (state.character?.reputation.rome ?? 0) / 5 + rng.gaussian() * 8;
}

export interface DiplomacyWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/**
 * One week of the service: the rotation put to him and then carried out (or
 * his way home), the Secretariat's yearly look up the ladder, the nuncio's
 * yearly terna, and the letter at seventy-five.
 */
export function diplomacyWeek(state: GameState): DiplomacyWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  const d = diplomacyOf(state);
  const study = state.study;
  if (!d || !study || study.city !== 'nunciature' || d.since === undefined) return { state, lines, letters };
  const week = state.clock.week;
  let s = state;
  // The letter at seventy-five: a nuncio's service ends in retirement.
  if (ageOn(s) >= DIPLOMACY.retirementAge && !s.flags['diplomat:seventy_five']) {
    s = { ...s, flags: { ...s.flags, 'diplomat:seventy_five': true } };
    s = schedule(s, 'seventy_five', week);
    return { state: { ...s, study: { ...s.study!, endWeek: week + 2 } }, lines, letters };
  }
  // He asked to go home at the rotation: the service lets him go.
  if (s.flags['diplomat:go_home']) return { state: { ...s, study: { ...s.study!, endWeek: week } }, lines, letters };
  const cur = diplomacyOf(s)!;
  // The rotation is put to him a few weeks ahead, with the next country named.
  if (cur.rotateWeek !== undefined && !cur.next && week >= cur.rotateWeek - DIPLOMACY.askBefore && !cur.scene) {
    const next = pickCountry(s, createRng(`${s.seed}:rotation:${week}`), cur.rank === 'nuncio');
    s = schedule(withDiplomacy(s, { ...cur, next: next.country }), 'rotation', week);
  }
  const now = diplomacyOf(s)!;
  if (now.rotateWeek !== undefined && week >= now.rotateWeek && now.next) {
    const def = nunciatureDef(now.next)!;
    const from = now.country;
    s = postTo(s, def, createRng(`${s.seed}:post:${week}`));
    lines.push(`Posted from ${from} to ${def.country}.`);
    s = { ...s, career: [...s.career, { week, kind: 'note', text: `Moved by the Secretariat of State from ${from} to ${def.country}, as ${RANK_WORD[now.rank]}.` }] };
    letters.push({ sort: 'rome', title: `A new country: ${def.country}`, body: [`The packing is done in a week; it always is. ${def.country}: the Church there is ${def.church}.`, now.rank === 'nuncio' ? 'You present your credentials to the head of state within the month, in the old formula, and become, in the protocol, the dean of the diplomatic corps. The bishops come to see what kind of nuncio you are.' : 'A new nuncio to learn, a new language on the street, and the same cipher traffic in the morning.'], week });
  }
  // Once a year the Secretariat looks at him; the nunciature is the pope's to give, and waits out a vacancy.
  const served = week - now.since!;
  if (served > 0 && served % 52 === 0) {
    const r = diplomacyOf(s)!;
    const rung = DIPLOMACY.rungs.find((x) => x.key === LADDER[LADDER.indexOf(r.rank) + 1]);
    const papal = rung?.key === 'nuncio';
    if (rung && served / 52 >= rung.years && !(papal && sedeVacante(s)) && serviceScore(s, createRng(`${s.seed}:service-year:${week}`)) >= rung.score) {
      const out = promote(s, rung.key);
      s = out.state;
      lines.push(out.line);
      letters.push(out.letter);
    }
    // A nuncio's year: a see falls vacant and the terna is his to prepare.
    if (diplomacyOf(s)!.rank === 'nuncio' && !diplomacyOf(s)!.scene) s = schedule(s, 'terna', week + createRng(`${s.seed}:terna:${week}`).int(4, 20));
  }
  return { state: s, lines, letters };
}

function promote(state: GameState, rank: DiplomatRank): { state: GameState; line: string; letter: Letter } {
  const week = state.clock.week;
  const d = diplomacyOf(state)!;
  if (rank !== 'nuncio') {
    const line = `Made ${RANK_WORD[rank]} in ${d.country}.`;
    const s = withDiplomacy({ ...state, study: { ...state.study!, label: postLabel(rank, d.country ?? 'the service') }, career: [...state.career, { week, kind: 'promotion', text: line }] }, { ...d, rank });
    return { state: s, line, letter: { sort: 'rome', title: RANK_WORD[rank].replace(/^./, (c) => c.toUpperCase()), body: [`The Secretariat's letter is two lines long: you are ${RANK_WORD[rank]}, with effect from the first of the month.`, rank === 'counsellor' ? 'A counsellor runs the nunciature when the nuncio is away, and more of it than he admits when he is not.' : 'It changes the order in which you walk into receptions, and not much else, and in the service that is not nothing.'], week } };
  }
  // A nunciature of his own: titular archbishop, and a country the pope gives him.
  const pope = reigning(state)?.name ?? 'The Holy Father';
  let s = withDiplomacy({ ...state, flags: { ...state.flags, ordained_bishop: true, 'diplomat:nuncio': true } }, { ...d, rank: 'nuncio', nuncioSince: week });
  const def = pickCountry(s, createRng(`${state.seed}:nuncio-post:${week}`), true);
  s = postTo(s, def, createRng(`${state.seed}:nuncio:${week}`));
  const line = `${pope} named you apostolic nuncio in ${def.country}, with the dignity of archbishop.`;
  s = { ...s, career: [...s.career, { week, kind: 'promotion', text: line }] };
  return {
    state: s,
    line,
    letter: {
      sort: 'rome',
      title: `Apostolic nuncio: ${def.country}`,
      body: [
        `${pope} has named you apostolic nuncio in ${def.country}, and titular archbishop of a see in North Africa that has had no bishop for twelve hundred years. You are ordained in St. Peter's by the Secretary of State.`,
        `The Church there is ${def.church}. You will be the pope's man to its government and to its bishops, and the ternas for its vacant sees will be yours to prepare: the other side of the letter a nuncio once sent you, sub secreto.`,
        'You will not be a pastor again. The service ends at seventy-five, with a letter, or earlier, with a red hat.',
      ],
      week,
    },
  };
}

/**
 * Home from the service: his reading drawn toward Rome's, and the priest in
 * him as the years left him. A nuncio does not come home; this is for a
 * secretary or counsellor who asked.
 */
export function homeFromService(state: GameState): { state: GameState; letter: Letter } {
  const week = state.clock.week;
  const place = state.study?.place ?? {};
  const d = diplomacyOf(state);
  const pope = reigning(state) ?? state.rome?.popes[state.rome.popes.length - 1];
  const c = state.character!;
  const pull = pope ? Math.round((pope.temperament - c.alignment) * DIPLOMACY.romePull) : 0;
  const priest = place.priesthood ?? 0;
  let s: GameState = { ...state, character: { ...c, alignment: Math.max(-100, Math.min(100, c.alignment + pull)) }, flags: { ...state.flags, diplomat_served: true } };
  const body: string[] = [`The Secretariat lets you go with a letter of thanks and a medal nobody will see. ${d?.countries.length ? `${d.countries.length === 1 ? 'One country' : `${d.countries.length} countries`}: ${d.countries.join(', ')}.` : ''}`];
  if (priest >= DIPLOMACY.priestHigh) {
    s = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, piety: Math.min(100, s.character!.stats.piety + 3) } }, flags: { ...s.flags, 'diplomat:came_home_a_priest': true } };
    body.push('The Sunday parishes kept you a priest through all of it. You come home knowing how to say Mass in four languages and still wanting to.');
  } else if (priest <= DIPLOMACY.clerkLow) {
    s = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, piety: Math.max(0, s.character!.stats.piety - 3), administration: Math.min(100, s.character!.stats.administration + 3) } }, flags: { ...s.flags, 'diplomat:came_home_a_clerk': true } };
    body.push('On the plane you realize you have not baptized anyone in years. The embassies are behind you. The priest will have to be found again.');
  } else body.push('You come home quieter than you left, and better at reading a room than any man in the presbyterate, which they will notice at the first deanery meeting.');
  const { diplomacy: _d, ...rome } = s.rome!;
  s = { ...s, rome };
  return { state: s, letter: { sort: 'rome', title: 'Home from the service', body, week } };
}

/** {country}, {country_next}, {country_church}, {diplomat_rank}, {nunciature}: the words the service's scenes need. */
export function diplomacyTokens(state: GameState): Record<string, string> {
  const d = diplomacyOf(state);
  if (!d) return {};
  const def = nunciatureDef(d.country);
  return {
    country: d.country ?? 'the mission',
    country_next: d.next ?? 'the next country',
    country_church: def?.church ?? 'a Church you have yet to learn',
    diplomat_rank: RANK_WORD[d.rank],
    nunciature: d.country ? `the Apostolic Nunciature in ${d.country}` : 'the Academy',
  };
}

/** Whether a nuncio of long service is a man the pope might create a cardinal (§11.3). */
export function nuncioOfLongService(state: GameState, years: number): boolean {
  const d = diplomacyOf(state);
  return d?.rank === 'nuncio' && d.nuncioSince !== undefined && state.clock.week - d.nuncioSince >= years * 52;
}
