import type { GameState, Letter, Npc } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { finishNpc, rollBaseStats, addStats } from '@/generation/npc';
import { rollMaleName } from '@/generation/names';
import { dicasteries, type DicasteryDef } from '@/content/rome';
import { seeDefs } from '@/content/sees';
import { isoDay } from './policy';
import { reigning, sedeVacante } from './papacy';
import { nuncioView } from './nuncioView';

/**
 * E1 R1.4 — the Roman Curia (§6, decision C): a diocesan priest lent to a
 * dicastery as an official, and the ladder above him (head of office,
 * undersecretary, secretary, who is made an archbishop). It rides on the
 * posting machinery: the study state, the Curia's week of activities, four
 * dials, and a book. Once a year the superiors look at him; near the end of
 * his years they may ask him to stay. A man comes home changed, or not, by
 * what the years did to the priest in him; a secretary does not come home
 * but goes to a see. Papal appointments wait out a vacancy. Tunables are
 * invented and flagged.
 */
export type CuriaRank = 'official' | 'head' | 'undersecretary' | 'secretary';

export const CURIA = {
  rungs: [
    { key: 'head' as const, label: 'head of office', years: 2, score: 55, stay: 3 },
    { key: 'undersecretary' as const, label: 'undersecretary', years: 4, score: 68, stay: 5 },
    { key: 'secretary' as const, label: 'secretary', years: 6, score: 80, stay: 5 },
  ],
  /** Weeks before the end when the superiors may ask him to stay, and how long a yes keeps him. */
  askBefore: 26,
  stayWeeks: 156,
  askSuperiors: 20,
  /** How far his reading moves toward the pope's over a posting, and what the priest in him decides. */
  romePull: 0.25,
  priestHigh: 30,
  clerkLow: -20,
} as const;

export const RANK_LABEL: Record<CuriaRank, string> = { official: 'an official', head: 'head of office', undersecretary: 'undersecretary', secretary: 'secretary' };

export function rankOf(state: GameState): CuriaRank {
  const r = state.flags['curia:rank'];
  return r === 'head' || r === 'undersecretary' || r === 'secretary' ? r : 'official';
}

export function dicasteryDef(key: string | undefined): DicasteryDef | undefined {
  return dicasteries.find((d) => d.key === key);
}

/** The office's name on a day: the dicasteries were renamed in 2022 (Praedicate Evangelium) and, for the laity, 2016. */
export function dicasteryName(def: DicasteryDef, day: number): string {
  for (const n of def.names) if (!n.until || day < isoDay(n.until)) return n.name;
  return def.names[def.names.length - 1]!.name;
}

/** Where the Holy See would put him: the office his degrees and years fit, a little rolled. Pure in the seed. */
export function dicasteryFor(state: GameState): DicasteryDef {
  const rng = createRng(`${state.seed}:dicastery`);
  const creds = state.character?.credentials ?? [];
  return dicasteries
    .map((d) => {
      let w = 1 + rng.next();
      for (const [k, v] of Object.entries(d.fit.credentials)) if (creds.includes(k)) w += v;
      for (const [k, v] of Object.entries(d.fit.flags)) if (state.flags[k]) w += v;
      return { d, w };
    })
    .sort((a, b) => b.w - a.w)[0]!.d;
}

function curiaNpc(rng: Rng, id: string, title: string, tag: string, year: number, ages: [number, number]): Npc {
  const heritage = rng.weighted(['italian', 'polish', 'german', 'irish', 'mexican', 'filipino', 'indian', 'nigerian', 'lebanese'] as const, (h) => (h === 'italian' ? 5 : 1));
  return finishNpc(rng, {
    id,
    name: rollMaleName(rng, heritage, 'older'),
    role: 'official',
    title,
    birthYear: year - rng.int(ages[0], ages[1]),
    origin: 'urban_ethnic',
    stats: addStats(rollBaseStats(rng, 40, 65), { administration: 12 }),
    tags: [tag],
    alignment: rng.int(-60, 60),
    relationship: 0,
    ambition: rng.int(20, 95),
  });
}

/** The posting begins: an office, its superiors, a colleague down the corridor, and the rank of an official. */
export function beginCuria(state: GameState, rng: Rng): GameState {
  const def = dicasteryFor(state);
  const day = sundayOf(state.clock);
  const year = fromDayNumber(day).year;
  const n = state.clock.week;
  const prefect = curiaNpc(rng.derive('prefect'), `curia_prefect_${n}`, 'Cardinal', 'curia_prefect', year, [66, 78]);
  const secretary = curiaNpc(rng.derive('secretary'), `curia_secretary_${n}`, 'Archbishop', 'curia_secretary', year, [55, 68]);
  const colleague = curiaNpc(rng.derive('colleague'), `curia_colleague_${n}`, 'Msgr.', 'curia_colleague', year, [38, 52]);
  // Earlier superiors, from a posting before this one, step aside.
  const npcs: GameState['npcs'] = {};
  for (const [id, npc] of Object.entries(state.npcs)) npcs[id] = npc.tags.some((t) => t.startsWith('curia_')) && npc.status === 'active' ? { ...npc, status: 'retired' } : npc;
  const flags = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('curia:')) delete flags[k];
  return {
    ...state,
    npcs: { ...npcs, [prefect.id]: prefect, [secretary.id]: secretary, [colleague.id]: colleague },
    flags: { ...flags, 'curia:dicastery': def.key, [`curia:in:${def.key}`]: true, 'curia:rank': 'official', 'curia:since': state.clock.week },
    study: state.study ? { ...state.study, school: dicasteryName(def, day), label: `Official of ${dicasteryName(def, day)}` } : state.study,
    career: [...state.career, { week: state.clock.week, kind: 'promotion', text: `Lent by the diocese to the Holy See: an official of ${dicasteryName(def, day)}.` }],
  };
}

/** Keep him longer: the posting's end, and the beat that brings him home, move together. */
function extend(state: GameState, endWeek: number): GameState {
  const study = state.study!;
  if (endWeek <= study.endWeek) return state;
  const beats = state.beats.map((b) => (b.kind === 'assignment' && b.week === study.endWeek ? { ...b, week: endWeek } : b)).sort((a, b) => a.week - b.week);
  return { ...state, study: { ...study, endWeek }, beats };
}

/** How the superiors read him this year: the dials, the nuncio's file, Rome's regard, and a year's luck. */
export function curiaScore(state: GameState, rng: Rng): number {
  const place = state.study?.place ?? {};
  const rome = state.character?.reputation.rome ?? 0;
  return 30 + (place.superiors ?? 0) / 2 + (place.desk ?? 0) / 4 + nuncioView(state).value / 4 + rome / 5 + rng.gaussian() * 8;
}

export interface CuriaWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/** One week of the Curia for a man lent to it: the year's look up the ladder, the ask to stay, and a yes to it. */
export function curiaWeek(state: GameState): CuriaWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  const study = state.study;
  if (!study || study.city !== 'curia') return { state, lines, letters };
  let s = state;
  const week = s.clock.week;
  const served = week - study.startWeek;
  // He said yes to staying: the years move, and he can be asked again later.
  if (s.flags['curia:stays'] === true) {
    s = extend(s, s.study!.endWeek + CURIA.stayWeeks);
    s = { ...s, flags: { ...s.flags, 'curia:stays': false, 'curia:asked_stay': false, 'curia:answered_stay': false, 'curia:stayed': (Number(s.flags['curia:stayed']) || 0) + 1 } };
    lines.push('The secretary signs the letter asking the diocese for you for three more years, and your bishop signs it too.');
  }
  // Once a year the superiors look at him; the rungs above an official are the pope's to give, and wait out a vacancy.
  if (served > 0 && served % 52 === 0) {
    const rank = rankOf(s);
    const i = CURIA.rungs.findIndex((r) => r.key === rank);
    const next = CURIA.rungs[i + 1];
    const rng = createRng(`${s.seed}:curia-year:${week}`);
    const papal = next && next.key !== 'head';
    if (next && served / 52 >= next.years && !(papal && sedeVacante(s)) && curiaScore(s, rng) >= next.score) s = promote(s, next.key, next.stay, lines, letters);
  }
  // Near the end, the superiors may ask him to stay.
  const rank = rankOf(s);
  const left = s.study!.endWeek - week;
  if ((rank === 'official' || rank === 'head') && left > 0 && left <= CURIA.askBefore && !s.flags['curia:asked_stay'] && (s.study!.place?.superiors ?? 0) >= CURIA.askSuperiors) {
    s = { ...s, flags: { ...s.flags, 'curia:asked_stay': true } };
  }
  return { state: s, lines, letters };
}

function promote(state: GameState, key: CuriaRank, stayYears: number, lines: string[], letters: Letter[]): GameState {
  const week = state.clock.week;
  const def = dicasteryDef(String(state.flags['curia:dicastery']));
  const office = def ? dicasteryName(def, sundayOf(state.clock)) : 'the dicastery';
  const pope = reigning(state)?.name ?? 'The Holy Father';
  const rankTitle = key === 'head' || key === 'official' ? `Head of office at ${office}` : `${(def?.ranks?.[key] ?? key).replace(/^./, (ch: string) => ch.toUpperCase())} of ${office}`;
  let s: GameState = { ...state, flags: { ...state.flags, 'curia:rank': key, [`curia:${key}`]: true }, study: state.study ? { ...state.study, label: rankTitle } : state.study };
  s = extend(s, week + stayYears * 52);
  const title = (k: 'undersecretary' | 'secretary') => def?.ranks?.[k] ?? k;
  const text = key === 'head' ? `Made head of office at ${office}.` : key === 'undersecretary' ? `${pope} named you ${title('undersecretary')} of ${office}.` : `${pope} named you ${title('secretary')} of ${office}, with the dignity of archbishop.`;
  s = { ...s, career: [...s.career, { week, kind: 'promotion', text }] };
  lines.push(text);
  if (key === 'secretary') {
    // The secretary of a dicastery is ordained an archbishop, titular of a see that no longer exists.
    s = { ...s, flags: { ...s.flags, ordained_bishop: true, 'office:curia_secretary': true } };
  }
  const body =
    key === 'head'
      ? [`The secretary calls you in after the congresso and tells you, without sitting down, that you are to be head of office at ${office} from the first of the month. It is not a papal appointment, and it is how papal appointments begin.`, 'You will have three officials under you, one of whom has been here eleven years and expected it. The years in Rome are longer now: three more at least.']
      : key === 'undersecretary'
        ? [`A letter on the letterhead of the Secretariat of State: ${pope} has named you ${title('undersecretary')} of ${office}. It is published in the Bollettino at noon, and by one o'clock your bishop has called, and your mother, and a journalist you have never spoken to.`, 'The undersecretary sits at the congresso at the prefect\'s left hand and signs what the officials draft. You will not be going home for five years at the least.']
        : [`${pope} has named you ${title('secretary')} of ${office}, and titular archbishop of a see in North Africa that has had no Christians for thirteen centuries. You will be ordained in St. Peter's.`, 'A secretary runs a dicastery in all but name. He also, in the ordinary way of things, does not go home: when his years here are done, he is given a see.'];
  letters.push({ sort: 'rome', title: key === 'head' ? 'Head of office' : key === 'undersecretary' ? title('undersecretary').replace(/^./, (c) => c.toUpperCase()) : `${title('secretary').replace(/^./, (c) => c.toUpperCase())}, and archbishop`, body, week });
  return s;
}

/**
 * Home from the Curia, changed or not: his reading drawn toward the pope's,
 * and the priest in him as the years left him. A secretary is not sent home
 * but named to a see.
 */
export function homeFromCuria(state: GameState): { state: GameState; letter: Letter } {
  const week = state.clock.week;
  const place = state.study?.place ?? {};
  const pope = reigning(state) ?? state.rome?.popes[state.rome.popes.length - 1];
  const c = state.character!;
  const pull = pope ? Math.round((pope.temperament - c.alignment) * CURIA.romePull) : 0;
  const priest = place.priesthood ?? 0;
  let s: GameState = { ...state, character: { ...c, alignment: Math.max(-100, Math.min(100, c.alignment + pull)) }, flags: { ...state.flags, curia_served: true } };
  const body: string[] = [];
  const rank = rankOf(state);
  body.push(`Your years at ${state.study?.school ?? 'the Curia'} are over. ${rank === 'official' ? 'You came as an official and leave as one, with a file of letters that went out under other men\'s names.' : `You leave as ${RANK_LABEL[rank]}, which is further than most men lent to Rome ever go.`}`);
  if (priest >= CURIA.priestHigh) {
    s = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, piety: Math.min(100, s.character!.stats.piety + 3) } }, flags: { ...s.flags, 'curia:came_home_a_priest': true } };
    body.push('The Roman parish on Sundays kept you a priest through all of it. The pastor there sends you off with a stole and a speech in dialect you mostly follow.');
  } else if (priest <= CURIA.clerkLow) {
    s = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, piety: Math.max(0, s.character!.stats.piety - 3), administration: Math.min(100, s.character!.stats.administration + 3) } }, flags: { ...s.flags, 'curia:came_home_a_clerk': true } };
    body.push('You notice on the plane that you have not heard a confession in two years, and that you have forgotten how the rite of baptism begins. The files are closed. The priest will have to be found again.');
  } else {
    body.push('You go home a little more Roman than you came: slower to answer, quicker to read a room, and fond of lunch.');
  }
  if (Math.abs(pull) >= 5) body.push(pull > 0 ? 'Rome has made you, without your noticing, a little more of a reformer than the man who left.' : 'Rome has made you, without your noticing, a little more of a traditionalist than the man who left.');
  if (rank === 'secretary') {
    // A secretary's years end in a see: the terna is a formality, and the nuncio's letter follows.
    const great = seeDefs.filter((d) => d.great && d.id !== state.world?.diocese.presetId);
    const pick = great.length ? createRng(`${state.seed}:secretary-see:${week}`).pick(great) : undefined;
    if (pick) s = { ...s, flags: { ...s.flags, 'nuncio:named_see': pick.id } };
    body.push('The Secretariat of State lets it be known that the Holy Father has a see in mind for you, and that the nuncio will call.');
  }
  return { state: s, letter: { sort: 'rome', title: 'Home from Rome', body, week } };
}

/** {curia_offer}, {dicastery}, {dicastery_short}, {dicastery_work}, {curia_rank}: the words the Curia's scenes and letters need. */
export function curiaTokens(state: GameState): Record<string, string> {
  if (!state.world) return {};
  const day = sundayOf(state.clock);
  const offer = dicasteryFor(state);
  const here = dicasteryDef(typeof state.flags['curia:dicastery'] === 'string' ? state.flags['curia:dicastery'] : undefined) ?? offer;
  const name = dicasteryName(here, day);
  return {
    curia_offer: dicasteryName(offer, day).replace(/^the /, 'The '),
    dicastery: name,
    dicastery_short: here.short,
    dicastery_work: here.work,
    curia_rank: (() => { const r = rankOf(state); return r === 'undersecretary' || r === 'secretary' ? here.ranks?.[r] ?? RANK_LABEL[r] : RANK_LABEL[r]; })(),
  };
}

/** He leaves the Curia for a see before his years are up: the posting is on the record as served. */
export function leaveCuriaForSee(state: GameState): GameState {
  const study = state.study;
  if (!study || study.city !== 'curia') return state;
  const rank = rankOf(state);
  return {
    ...state,
    flags: { ...state.flags, curia_served: true },
    offerHistory: [...state.offerHistory, { offerId: study.offerId, week: state.clock.week, decision: 'completed' }],
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Left ${study.school} as ${RANK_LABEL[rank]} for a see of his own.` }],
  };
}
