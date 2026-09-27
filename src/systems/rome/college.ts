import type { Cardinal, CollegeSceneKind, GameState, Letter, Papacy } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { collegePools } from '@/content/rome';
import { seeDefs } from '@/content/sees';
import { rollMaleName } from '@/generation/names';
import type { Heritage } from '@/content/names';
import { reigning, walkRome } from './papacy';
import { ELECTOR, electorsOn } from './conclave';
import { nuncioOfLongService } from './diplomacy';

/**
 * E1 R1.5 — the College of Cardinals (§7): about a hundred and twenty
 * electors, generated, each created by a pope of the line and reading much as
 * he did. They age out of the electorate at eighty and die in their time.
 * The reigning pope holds a consistory every year and a half to two and a
 * half, refilling the electors toward a hundred and twenty with men of his
 * own reading; an archbishop of a great see or a secretary of a dicastery
 * whom Rome regards may be among them. All of it from the seed. Tunables are
 * invented and flagged (the cap of 120 electors is Paul VI's, and popes have
 * exceeded it).
 */
export const COLLEGE = {
  electors: 120,
  maxPerConsistory: 25,
  consistoryDays: [540, 900] as [number, number],
  createdAge: [58, 76] as [number, number],
  /** How far a new cardinal's reading follows his creator's, and his own variance. */
  follow: 0.7,
  temperamentSd: 25,
  death: { base: 0.015, perYearPast70: 0.012 },
  player: { rome: 30, seeYears: 2, curiaWeeks: 104, nuncioYears: 8, gap: 90, chance: 0.5 },
  sceneAfter: [2, 6] as [number, number],
  sceneLapse: 26,
} as const;

function clamp(n: number): number {
  // `|| 0`: a -0 would not survive a save (JSON has no negative zero).
  return Math.max(-100, Math.min(100, Math.round(n) || 0));
}

/** The n-th cardinal of this world, created on a day by a pope: where he comes from, his name, his reading, and when he will die. */
export function makeCardinal(seed: string, n: number, day: number, creator: Pick<Papacy, 'id' | 'temperament'>): Cardinal {
  const rng = createRng(`${seed}:cardinal:${n}`);
  const origin = rng.weighted(collegePools.origins, (o) => o.weight);
  const year = fromDayNumber(day).year;
  const age = rng.int(COLLEGE.createdAge[0], COLLEGE.createdAge[1]);
  const name = rollMaleName(rng, origin.heritage as Heritage, 'older');
  const papabile = Math.min(1, Math.pow(rng.next(), 2.2) + (rng.chance(0.08) ? 0.3 : 0));
  let diesDay = day + 40 * 365;
  for (let y = 0; y < 40; y++) {
    const at = age + y;
    if (rng.chance(COLLEGE.death.base + Math.max(0, at - 70) * COLLEGE.death.perYearPast70)) {
      diesDay = day + y * 365 + rng.int(10, 360);
      break;
    }
  }
  return {
    id: `card:${n}`,
    name: `${name.first} ${name.last}`,
    born: year - age,
    from: origin.from,
    region: origin.region,
    temperament: clamp(creator.temperament * COLLEGE.follow + rng.gaussian() * COLLEGE.temperamentSd),
    createdDay: day,
    createdBy: creator.id,
    curial: rng.chance(0.3),
    papabile,
    diesDay,
  };
}

function popeOn(popes: Papacy[], day: number): Papacy {
  return popes.find((p) => p.electedDay <= day && (p.endDay === undefined || day < p.endDay)) ?? popes[popes.length - 1]!;
}

/** The College as it stands on a day: the cardinals the last popes created, still living, until a hundred and twenty are electors. */
export function seedCollege(seed: string, day: number): { college: Cardinal[]; made: number } {
  const line = walkRome(seed, day).popes;
  const rng = createRng(`${seed}:college-seed`);
  const college: Cardinal[] = [];
  let n = 0;
  for (let guard = 0; guard < 400 && electorsOn(college, day).length < COLLEGE.electors; guard++) {
    n++;
    const created = day - rng.int(0, 20 * 365);
    const c = makeCardinal(seed, n, created, popeOn(line, created));
    if (c.diesDay > day) college.push(c);
  }
  return { college, made: n };
}

function playerAge(state: GameState, day: number): number {
  const c = state.character!;
  return fromDayNumber(day).year - (c.entryYear - c.background.entryAge);
}

/** Whether the man is a man the pope might create: the archbishop of a great see, a secretary of a dicastery, or a nuncio of long service, whom Rome regards. */
export function mayBeCreated(state: GameState, day: number): boolean {
  const c = state.character;
  if (!c || state.flags.cardinal || state.religious || playerAge(state, day) >= ELECTOR.age) return false;
  if ((c.reputation.rome ?? 0) < COLLEGE.player.rome) return false;
  const great = !!state.see && !!seeDefs.find((d) => d.id === state.see!.id)?.great && state.see.years.length >= COLLEGE.player.seeYears;
  const since = state.flags['curia:since'];
  const secretary = !!state.flags['curia:secretary'] && typeof since === 'number' && state.clock.week - since >= COLLEGE.player.curiaWeeks;
  // A nuncio of long service may be created too (E1 §11.3).
  return great || secretary || nuncioOfLongService(state, COLLEGE.player.nuncioYears);
}

function schedule(state: GameState, kind: CollegeSceneKind, rng: Rng): GameState {
  return { ...state, rome: { ...state.rome!, collegeScene: { kind, dueWeek: state.clock.week + rng.int(COLLEGE.sceneAfter[0], COLLEGE.sceneAfter[1]) } } };
}

export interface CollegeWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/** One week of the College: the dead are mourned, the pope holds his consistory, and the man, one day, turns eighty. */
export function collegeWeek(state: GameState): CollegeWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  if (!state.rome) return { state, lines, letters };
  const day = sundayOf(state.clock);
  const week = state.clock.week;
  let s = state;
  if (!s.rome!.college) {
    const seeded = seedCollege(s.seed, day);
    const rng = createRng(`${s.seed}:consistory-first`);
    s = { ...s, rome: { ...s.rome!, college: seeded.college, cardinalsMade: seeded.made, nextConsistoryDay: day + rng.int(0, COLLEGE.consistoryDays[1]) } };
  }
  // The dead leave the College.
  const living = s.rome!.college!.filter((c) => c.diesDay > day);
  if (living.length !== s.rome!.college!.length) s = { ...s, rome: { ...s.rome!, college: living } };
  // A scene that waited too long lapses.
  const waiting = s.rome!.collegeScene;
  if (waiting && week > waiting.dueWeek + COLLEGE.sceneLapse) {
    const { collegeScene: _c, ...rest } = s.rome!;
    s = { ...s, rome: rest };
  }
  // The man turns eighty: a cardinal still, an elector no longer.
  if (s.flags.cardinal && !s.flags['cardinal:emeritus'] && s.character && playerAge(s, day) >= ELECTOR.age) {
    s = { ...s, flags: { ...s.flags, 'cardinal:emeritus': true } };
    s = schedule(s, 'eighty', createRng(`${s.seed}:eighty`));
  }
  // The see falls vacant: a cardinal is called to Rome for the congregations, and, under eighty, to the conclave.
  const v = s.rome!.vacancy;
  if (v && s.flags.cardinal && s.flags['conclave:eve'] !== v.sinceDay) {
    s = { ...s, flags: { ...s.flags, 'conclave:eve': v.sinceDay } };
    s = { ...s, rome: { ...s.rome!, collegeScene: { kind: 'eve', dueWeek: week } } };
  }
  const pope = reigning(s);
  // The man's own pontificate calls its consistories itself (R1.6).
  if (pope && !s.rome!.pontificate && day >= (s.rome!.nextConsistoryDay ?? Infinity)) s = consistory(s, pope, day, lines, letters);
  return { state: s, lines, letters };
}

function consistory(state: GameState, pope: Papacy, day: number, lines: string[], letters: Letter[]): GameState {
  const rng = createRng(`${state.seed}:consistory:${day}`);
  const college = state.rome!.college!;
  const need = Math.max(3, Math.min(COLLEGE.maxPerConsistory, COLLEGE.electors - electorsOn(college, day).length + rng.int(0, 4)));
  let made = state.rome!.cardinalsMade ?? college.length;
  const fresh: Cardinal[] = [];
  for (let i = 0; i < need; i++) fresh.push(makeCardinal(state.seed, ++made, day, pope));
  let s: GameState = { ...state, rome: { ...state.rome!, college: [...college, ...fresh], cardinalsMade: made, nextConsistoryDay: day + rng.int(COLLEGE.consistoryDays[0], COLLEGE.consistoryDays[1]) } };
  lines.push(`${pope.name} holds a consistory and creates ${need} new cardinals.`);
  const c = s.character;
  if (c && mayBeCreated(s, day) && Math.abs(pope.temperament - c.alignment) < COLLEGE.player.gap && rng.chance(COLLEGE.player.chance + ((c.reputation.rome ?? 0) - COLLEGE.player.rome) / 100)) {
    const district = rng.pick(collegePools.districts);
    s = { ...s, flags: { ...s.flags, cardinal: true, 'cardinal:week': s.clock.week, 'cardinal:district': district }, career: [...s.career, { week: s.clock.week, kind: 'promotion', text: `${pope.name} created you a cardinal, with a titular church in ${district}.` }] };
    letters.push({
      sort: 'rome',
      title: 'The biglietto',
      body: [
        `The Secretariat of State's letter, the biglietto, arrives by hand: ${pope.name} will create you a cardinal at the consistory in six weeks, and assign you a titular church in ${district}.`,
        'It is not an offer. A man may ask to be excused, and a few have, and the Church remembers them for it without always meaning it kindly. You will be a cardinal of the Holy Roman Church, and, until your eightieth birthday, one of the men who elect the next pope.',
      ],
      week: s.clock.week,
    });
    s = schedule(s, 'created', rng);
  } else if (s.flags.cardinal && !s.flags['cardinal:emeritus']) {
    s = schedule(s, 'consistory', rng);
  }
  return s;
}

/** The College's scene due this week, if any. */
export function dueCollegeScene(state: GameState): CollegeSceneKind | null {
  const due = state.rome?.collegeScene;
  return due && state.clock.week >= due.dueWeek ? due.kind : null;
}

export function closeCollegeScene(state: GameState): GameState {
  if (!state.rome?.collegeScene) return state;
  const { collegeScene: _c, ...rome } = state.rome;
  return { ...state, rome };
}

export function scheduleCollegeScene(state: GameState, kind: CollegeSceneKind): GameState {
  return schedule(state, kind, createRng(`${state.seed}:college-scene:${kind}:${state.clock.week}`));
}

/** {titular}, {college_electors}: the words the College's scenes need. */
export function collegeTokens(state: GameState): Record<string, string> {
  const r = state.rome;
  if (!r?.college) return {};
  const district = state.flags['cardinal:district'];
  return {
    titular: typeof district === 'string' ? district : 'Trastevere',
    college_electors: String(electorsOn(r.college, sundayOf(state.clock)).length),
  };
}
