import type { Cardinal, GameState, Letter } from '@/types';
import { createRng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { collegePools } from '@/content/rome';
import { makeCardinal } from './college';
import { electorsOn } from './conclave';

/**
 * E1 R1.6 — what a pope does beyond his week (§10.4, §10.5): the consistory,
 * where he chooses the men who will elect his successor, and the apostolic
 * journey. Candidates are generated independently of his own reading, so the
 * College he leaves is his choice and not the roll's. Tunables are invented
 * and flagged (the cap of 120 electors is Paul VI's; popes have exceeded it).
 */
export const ACTS = {
  consistoryEvery: 52,
  candidates: 16,
  /** How far the reading of the men offered spreads, independent of his. */
  candidateSpread: 55,
  cap: 120,
  overCap: 5,
  curial: 2,
  overCapCuria: -4,
  church: 3,
  journey: { prepare: [8, 14] as [number, number], perYear: 3, world: 8, church: 4, strength: 4, strengthPast70: 0.5 },
} as const;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];

function bump(v: number | undefined, d: number): number {
  return Math.max(-100, Math.min(100, Math.round((v ?? 0) + d) || 0));
}

function age(state: GameState): number {
  const c = state.character!;
  return fromDayNumber(sundayOf(state.clock)).year - (c.entryYear - c.background.entryAge);
}

/** How many more electors the College can take, the five over the cap included. */
function roomIn(state: GameState): number {
  return Math.max(0, ACTS.cap + ACTS.overCap - electorsOn(state.rome!.college ?? [], sundayOf(state.clock)).length);
}

/** Whether a consistory may be called: a year since his election or the last one, and room in the College. */
export function consistoryOpen(state: GameState): { open: boolean; why: string | null; room: number } {
  const p = state.rome?.pontificate;
  if (!p) return { open: false, why: 'not pope', room: 0 };
  const last = p.consistories[p.consistories.length - 1]?.week ?? p.electedWeek;
  const room = roomIn(state);
  if (state.clock.week - last < ACTS.consistoryEvery) return { open: false, why: `a year since the last (${ACTS.consistoryEvery - (state.clock.week - last)} weeks more)`, room };
  if (room <= 0) return { open: false, why: 'the College is full', room };
  return { open: true, why: null, room };
}

/** Call the consistory: sixteen men put before him, their readings their own. */
export function callConsistory(state: GameState): GameState {
  const p = state.rome?.pontificate;
  if (!p || p.candidates || !consistoryOpen(state).open) return state;
  const day = sundayOf(state.clock);
  const rng = createRng(`${state.seed}:papal-consistory:${p.consistories.length}`);
  const made = state.rome!.cardinalsMade ?? (state.rome!.college ?? []).length;
  const candidates: Cardinal[] = [];
  for (let i = 1; i <= ACTS.candidates; i++) {
    const t = Math.max(-100, Math.min(100, Math.round(rng.gaussian() * ACTS.candidateSpread) || 0));
    candidates.push({ ...makeCardinal(state.seed, made + i, day, { id: 'player', temperament: t }), temperament: t });
  }
  return { ...state, rome: { ...state.rome!, cardinalsMade: made + ACTS.candidates, pontificate: { ...p, candidates } } };
}

/** Create the men he chose: they join the College, and the next conclave is theirs as much as anyone's. */
export function holdPapalConsistory(state: GameState, ids: string[]): { state: GameState; letter: Letter | null } {
  const p = state.rome?.pontificate;
  if (!p?.candidates) return { state, letter: null };
  const room = roomIn(state);
  const chosen = p.candidates.filter((c) => ids.includes(c.id)).slice(0, Math.max(0, room));
  const { candidates: _c, ...rest } = p;
  if (!chosen.length) return { state: { ...state, rome: { ...state.rome!, pontificate: rest } }, letter: null };
  const day = sundayOf(state.clock);
  const electors = electorsOn(state.rome!.college ?? [], day).length;
  const over = Math.max(0, electors + chosen.length - ACTS.cap);
  const curial = chosen.filter((c) => c.curial).length;
  const study = state.study!;
  const place = { ...(study.place ?? {}), curia: bump(study.place?.curia, curial * ACTS.curial + over * ACTS.overCapCuria), church: bump(study.place?.church, ACTS.church + (chosen.length - curial) * 0.5) };
  const record = { ...(study.record ?? {}), cardinals: (study.record?.cardinals ?? 0) + chosen.length };
  const week = state.clock.week;
  const next: GameState = {
    ...state,
    study: { ...study, place, record },
    rome: { ...state.rome!, college: [...(state.rome!.college ?? []), ...chosen.map((c) => ({ ...c, createdDay: day, createdBy: 'player' }))], pontificate: { ...rest, consistories: [...p.consistories, { week, created: chosen.map((c) => c.id) }] } },
    career: [...state.career, { week, kind: 'note', text: `Held a consistory and created ${chosen.length} cardinal${chosen.length === 1 ? '' : 's'}.` }],
  };
  const lines = chosen.map((c) => `${c.name} of ${c.from}${c.curial ? ' (of the Curia)' : ''}`);
  return {
    state: next,
    letter: {
      sort: 'rome',
      title: 'The consistory',
      body: [
        `In St. Peter's you put the red biretta on ${chosen.length === 1 ? 'one man' : `${WORDS[chosen.length] ?? chosen.length} men`} and give each a ring and a titular church: ${lines.join('; ')}.`,
        over > 0 ? `It takes the electors past a hundred and twenty. Popes have done it before; the Secretariat reminds you so, in a tone.` : 'The electors stand at or under the hundred and twenty Paul VI set.',
        'They are the men who will elect your successor. Some of them know it, and all of them will be asked by journalists tonight whether they could be pope, and all of them will say no.',
      ],
      week,
    },
  };
}

/** Whether a journey can be planned: none already planned, and fewer than three in the last year. */
export function journeyOpen(state: GameState): { open: boolean; why: string | null } {
  const p = state.rome?.pontificate;
  if (!p) return { open: false, why: 'not pope' };
  if (p.journey) return { open: false, why: `the journey to ${p.journey.where} is being prepared` };
  const recent = p.journeys.filter((j) => state.clock.week - j.week < 52).length;
  if (recent >= ACTS.journey.perYear) return { open: false, why: 'three journeys this year already' };
  return { open: true, why: null };
}

/** The places a pope may go: the countries the College comes from. */
export function journeyPlaces(): { where: string; region: string }[] {
  return collegePools.origins.map((o) => ({ where: o.from, region: o.region }));
}

/** Plan an apostolic journey: the Secretariat and the nunciature prepare it for two or three months. */
export function planJourney(state: GameState, where: string): GameState {
  const p = state.rome?.pontificate;
  const place = journeyPlaces().find((x) => x.where === where);
  if (!p || !place || !journeyOpen(state).open) return state;
  const rng = createRng(`${state.seed}:journey:${state.clock.week}:${where}`);
  const dueWeek = state.clock.week + rng.int(ACTS.journey.prepare[0], ACTS.journey.prepare[1]);
  return { ...state, rome: { ...state.rome!, pontificate: { ...p, journey: { where: place.where, region: place.region, dueWeek } } } };
}

/** The journey itself, when its week comes: the world hears, the Church is seen, and the man is tired. */
export function takeJourney(state: GameState): { state: GameState; letter: Letter | null } {
  const p = state.rome?.pontificate;
  if (!p?.journey || state.clock.week < p.journey.dueWeek) return { state, letter: null };
  const j = p.journey;
  const J = ACTS.journey;
  const cost = J.strength + Math.max(0, age(state) - 70) * J.strengthPast70;
  const study = state.study!;
  const place = { ...(study.place ?? {}), world: bump(study.place?.world, J.world), church: bump(study.place?.church, J.church), strength: bump(study.place?.strength, -cost) };
  const record = { ...(study.record ?? {}), journeys: (study.record?.journeys ?? 0) + 1 };
  const { journey: _j, ...rest } = p;
  const week = state.clock.week;
  const next: GameState = {
    ...state,
    study: { ...study, place, record },
    rome: { ...state.rome!, pontificate: { ...rest, journeys: [...p.journeys, { week, where: j.where }] }, },
    flags: { ...state.flags, 'pope:journey': j.where },
    career: [...state.career, { week, kind: 'note', text: `Apostolic journey to ${j.where}.` }],
  };
  return {
    state: next,
    letter: {
      sort: 'rome',
      title: `The journey to ${j.where}`,
      body: [
        `The plane leaves Fiumicino at seven. In ${j.where} there is the tarmac and the president and the children with flowers, and then four days of it: the cathedral, the clergy in a stadium, a Mass for more people than you can see the end of, a visit nobody on the protocol wanted, and the youth, who are the same everywhere.`,
        'On the plane home the journalists come down the aisle one by one with their questions, and you answer more of them than the press office would like.',
        cost >= 8 ? 'You sleep for most of the next day, which the physician notes, and the Secretary of State does not mention.' : 'You are tired in the way a man is after a good week of work.',
      ],
      week,
    },
  };
}
