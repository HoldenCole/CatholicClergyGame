import type { GameState, Npc, SeminaryState } from '@/types';
import type { Rng } from '@/engine/rng';
import { fromDayNumber } from '@/engine/calendar';
import { generateFormators } from '@/generation/formators';
import { generateClassmate } from '@/generation/classmates';
import { romeCollege, type RomeUniversityDef } from '@/content/seminary';
import { renderText } from '@/engine/text';

/**
 * The Pontifical North American College (DESIGN §6.8): a bishop sends a man
 * to Rome for theology, and the years that follow are lived on the Janiculum.
 * The house changes under him: a new rector and vice-rector, the men of the
 * College beside the class he entered with, lectures in Italian across the
 * river, and the diaconate at St. Peter's. Ordination is at home. Everything
 * here is data from content/seminary/rome.json; the numbers are invented.
 */
export const NAC = {
  /** The year of formation the College takes a man for: first theology. */
  fromYear: 4,
  /** The men of the College he lives beside, generated from other dioceses. */
  classmates: 4,
  /** The College's rule is a seminary's; the city gives an hour back a week and the lectures take it. Net nothing, by design. */
  freeHourShift: 0,
  /** A traditional man is likelier to be sent to the Dominicans' or the prelature's university: the pull is (lean × alignment / 100) × this. */
  leanPerPoint: 1 / 20,
} as const;

/** Whether the man's seminary years are being lived in Rome. */
export function atRome(sem: Pick<SeminaryState, 'place'> | null | undefined): boolean {
  return sem?.place === 'rome';
}

export function romeUniversity(sem: Pick<SeminaryState, 'university'> | null | undefined): RomeUniversityDef | undefined {
  return romeCollege.universities.find((u) => u.id === sem?.university) ?? romeCollege.universities[0];
}

/** The posted day of the house he is in. */
export function postedDay(sem: Pick<SeminaryState, 'place'> | null | undefined, homeDay: { time: string; label: string }[]): { time: string; label: string }[] {
  return atRome(sem) ? romeCollege.day : homeDay;
}

/** The year's classes, in a line for the digest. */
export function romeClassLine(sem: Pick<SeminaryState, 'year' | 'university'>): string {
  const line = romeCollege.classes[String(sem.year)] ?? 'Theology, in Italian';
  return line.replace('{university}', romeUniversity(sem)?.label ?? 'the Gregorian');
}

/** Which university the College sends him to: by share, leaned by his alignment. Deterministic from the rng. */
export function rollUniversity(rng: Rng, alignment: number): RomeUniversityDef {
  // A university that leans the man's way draws him: both signed like alignment, traditional below zero, so the product is the pull.
  return rng.weighted(romeCollege.universities, (u) => Math.max(0.05, u.share * (1 + Math.max(-0.8, Math.min(2, (u.lean * alignment) / 100 * NAC.leanPerPoint)))));
}

/** The tags the house writes as flags (rector:style, vice_rector:temper), from the formators now in place. */
function houseStyleFlags(npcs: Record<string, Npc>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const n of Object.values(npcs)) {
    if (n.role !== 'formator') continue;
    for (const t of n.tags) if (t.startsWith('rector:') || t.startsWith('vice_rector:')) out[t] = true;
  }
  return out;
}

const SWAPPED = ['rector', 'vice_rector', 'formation_advisor'] as const;

/**
 * Send him: the College becomes his house. The diocese's rector, vice-rector,
 * and advisor keep their places at home (retagged home_*, still active, still
 * his diocese's priests); the College's own take the tags the scenes read.
 * The spiritual director stays his: direction goes on by letter and at Christmas.
 */
export function sendToRome(state: GameState, rng: Rng): { state: GameState; line: string } {
  const sem = state.seminary;
  const c = state.character;
  if (!sem || !c || atRome(sem)) return { state, line: '' };
  const year = fromDayNumber(state.clock.startDay + state.clock.week * 7).year;
  const npcs: Record<string, Npc> = { ...state.npcs };
  // The house at home keeps its men, under other tags.
  for (const n of Object.values(npcs)) {
    if (n.role !== 'formator') continue;
    const swapped = SWAPPED.find((t) => n.tags.includes(t));
    if (!swapped) continue;
    npcs[n.id] = { ...n, tags: n.tags.map((t) => (t === swapped || t.startsWith(`${swapped}:`) ? `home_${t}` : t)) };
  }
  // The College's own.
  for (const f of generateFormators(rng.derive('nac:formators'), year, { includeBishop: false })) {
    if (!(SWAPPED as readonly string[]).includes(f.id)) continue;
    npcs[`nac_${f.id}`] = { ...f, id: `nac_${f.id}`, tags: [...f.tags, 'nac'] };
  }
  // The men of the College: from forty dioceses, four of them at his table.
  const romeClassmateIds: string[] = [];
  for (let i = 0; i < NAC.classmates; i++) {
    const m = generateClassmate(rng.derive(`nac:class:${i}`), i, year - (NAC.fromYear - 1));
    const id = `nac_cm_${i + 1}`;
    npcs[id] = { ...m, id, tags: [...m.tags, 'nac_classmate', 'nac'] };
    romeClassmateIds.push(id);
  }
  const university = rollUniversity(rng.derive('nac:university'), c.alignment);
  const flags = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('rector:') || k.startsWith('vice_rector:')) delete flags[k];
  Object.assign(flags, houseStyleFlags(npcs), { 'seminary:rome': true, [`nac:university:${university.id}`]: true });
  const next: GameState = {
    ...state,
    npcs,
    flags,
    seminary: { ...sem, place: 'rome', name: romeCollege.name, university: university.id, romeSince: sem.year, romeClassmateIds },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Sent to Rome: the North American College, and ${university.label}.` }],
  };
  const line = renderText(romeCollege.arrival.replace('{count}', String(NAC.classmates * 10)).replace('{university}', university.label), next, {});
  return { state: next, line };
}

/** What the College's years leave on a man at ordination: the flag the chancery reads, and the line. */
export function ordainedFromRome(state: GameState): GameState {
  if (!atRome(state.seminary)) return state;
  return { ...state, flags: { ...state.flags, nac_alumnus: true }, career: [...state.career, { week: state.clock.week, kind: 'note', text: romeCollege.lines.ordination ?? 'Ordained at home, from the College.' }] };
}

/** The College gives a man Italian in his first year; the credential is his after it. */
export function italianAfterFirstYear(state: GameState): GameState {
  const sem = state.seminary;
  const c = state.character;
  if (!sem || !c || !atRome(sem) || c.credentials.includes('italian')) return state;
  if (sem.year < NAC.fromYear) return state;
  return {
    ...state,
    character: { ...c, credentials: [...c.credentials, 'italian'] },
    flags: { ...state.flags, study_italian_earned: true },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: romeCollege.lines.italian ?? 'The Italian came.' }],
  };
}
