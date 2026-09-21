import { formationYearEnd, formationYearStart } from '@/systems/religious/formation';
import { consult } from '@/systems/religious/obedience';
import { diocesanClassmatesOrdain, diocesanClassmatesStart } from '@/systems/religious/diocesanClassmates';
import { createRng } from './rng';
import { handOnOffices, isMoveTo, keepOffices, officesHeld } from '@/systems/offices';
import type { Beat, GameEvent, GameState, Pillar, SeminaryState, SummerAssignment } from '@/types';
import { PILLARS } from '@/types';
import { divergeStep, exNoviceStep } from '@/systems/diverge';
import { offerDirectors } from '@/systems/direction';
import { evaluateAll } from './conditions';
import { applyEffects } from './effects';
import type { Rng } from './rng';
import { gameYearOf, yearStartDay } from './time';
import { leaveSeminaryClubs } from '@/systems/clubs';
import { evaluate, formationWeek, nameArchetype, setEmphasis, zeroPillars } from '@/systems/formation';
import { summerOptions } from '@/content/seminary';
import { renderText } from './text';
import { assignFirstParish } from '@/systems/assignment';
import { withChoice } from '@/systems/choice';
import { beginCareer } from './career';
import { driftYear } from '@/systems/drift';
import { fromDayNumber } from './calendar';

/** Absolute week offsets within a formation year. Invented. */
export const YEAR_SHAPE = {
  firstPlayedWeek: 3,
  lastPlayedWeek: 34,
  summerWeek: 38,
  evaluationWeek: 50,
} as const;

/** Beats the flow guarantees each year. DESIGN.md §12.2 */
export const REQUIRED_BEATS: Record<number, string> = {
  4: 'candidacy',
  5: 'lector_acolyte',
  6: 'diaconate',
  7: 'ordination_eve',
};

export function beatFlag(beat: string, year: number): string {
  return `beat_fired:${beat}:${year}`;
}

/** Invented seminary names; presets may override later. */
export const SEMINARY_NAMES = [
  'St. John Vianney Seminary',
  'Sacred Heart Seminary',
  'Holy Apostles Seminary',
  'St. Charles Borromeo Seminary',
  'Immaculate Conception Seminary',
  'Mount St. Mary Seminary',
  'St. Joseph Seminary',
  'Christ the King Seminary',
] as const;

export function freshSeminary(classmateIds: string[], name: string = SEMINARY_NAMES[0]): SeminaryState {
  return {
    name,
    year: 1,
    emphasis: null,
    pillarScores: zeroPillars(),
    zeroStreak: zeroPillars(),
    evaluations: [],
    playedWeeks: [],
    summerAssignment: null,
    summers: {},
    candidacy: false,
    lectorAcolyte: false,
    diaconate: false,
    concerns: [],
    heldBackCount: 0,
    classmateIds,
    yearStartWeek: 0,
  };
}

/** Enter seminary: phase, state, and the first emphasis choice. */
export function startSeminary(state: GameState, classmateIds: string[], name?: string): GameState {
  return {
    ...state,
    phase: 'seminary',
    seminary: freshSeminary(classmateIds, name),
    mode: { kind: 'year_start', year: 1 },
  };
}

/** The absolute week the current or next formation year opens on. */
function upcomingYearStartWeek(state: GameState): number {
  const clock = state.clock;
  const k = gameYearOf(clock);
  const thisStart = (yearStartDay(clock, k) - clock.startDay) / 7;
  // If we are within the closing weeks of a year (after evaluation), the next year is the target.
  if (clock.week - thisStart >= YEAR_SHAPE.evaluationWeek) return (yearStartDay(clock, k + 1) - clock.startDay) / 7;
  return thisStart;
}

/**
 * The player has chosen the year's emphasis. Schedule the played weeks, the
 * summer choice, and the evaluation, then hand control back to the clock.
 */
export function chooseEmphasis(state: GameState, emphasis: Record<Pillar, number>, rng: Rng): GameState {
  const withEmphasis = setEmphasis(state, emphasis);
  const sem = withEmphasis.seminary!;
  const start = upcomingYearStartWeek(state);
  const count = rng.int(2, 3);
  const played = new Set<number>();
  while (played.size < count) {
    played.add(start + rng.int(YEAR_SHAPE.firstPlayedWeek, YEAR_SHAPE.lastPlayedWeek));
  }
  const playedWeeks = [...played].sort((a, b) => a - b);
  const beats: Beat[] = [
    ...state.beats.filter((b) => b.kind !== 'assignment' && b.kind !== 'evaluation'),
    { kind: 'assignment' as const, week: start + YEAR_SHAPE.summerWeek, label: `Summer assignment, year ${sem.year}` },
    { kind: 'evaluation' as const, week: start + YEAR_SHAPE.evaluationWeek, label: `Annual evaluation, year ${sem.year}` },
  ].sort((a, b) => a.week - b.week);
  let next = driftAtYearStart(
    {
      ...withEmphasis,
      beats,
      mode: { kind: 'clock' },
      seminary: { ...sem, playedWeeks, yearStartWeek: start, pillarScores: zeroPillars(), summerAssignment: null, hoursGains: {} },
    },
    rng,
  );
  // A man of the class may discern out into an order, and another may arrive from
  // one he left. DESIGN §6.7: they diverge rather than disappear.
  const gone = divergeStep(next, rng.derive(`diverge:${sem.year}`));
  next = gone.state;
  const came = exNoviceStep(next, rng.derive(`ex_novice:${sem.year}`), gameYearOf(next.clock));
  next = came.state;
  for (const line of [gone.line, came.line]) {
    if (line) next = { ...next, digest: [...next.digest.slice(0, -1), withLine(next.digest[next.digest.length - 1], line)] };
  }
  // Year one: the formation office asks who he will see, which is presented as an
  // administrative matter and is one of the most consequential choices in the game.
  if (sem.year === 1 && !next.flags['direction:chosen']) {
    const offered = offerDirectors(next, rng.derive('directors'));
    next = offered.state;
    if (offered.options.length >= 2) return { ...next, mode: { kind: 'director', options: offered.options } };
  }
  return next;
}

/** Whether this week is a played week, and which structural beat (if any) it must carry. */
export function playedWeekBeat(state: GameState): { played: boolean; requiredBeat: string | null } {
  const sem = state.seminary;
  if (!sem || !sem.playedWeeks.includes(state.clock.week)) return { played: false, requiredBeat: null };
  const beat = REQUIRED_BEATS[sem.year];
  if (!beat || state.flags[beatFlag(beat, sem.year)]) return { played: true, requiredBeat: null };
  const last = sem.playedWeeks[sem.playedWeeks.length - 1];
  return { played: true, requiredBeat: state.clock.week === last ? beat : null };
}

/** Candidate pool for this week: the beat events if a beat is due, else the year's pool. */
export function weekPool(pool: GameEvent[], state: GameState): GameEvent[] {
  const { played, requiredBeat } = playedWeekBeat(state);
  if (!played) return [];
  if (requiredBeat) {
    const beatPool = pool.filter((e) => e.beat === requiredBeat);
    if (beatPool.length) return beatPool;
  }
  return pool.filter((e) => !e.beat || e.beat === REQUIRED_BEATS[state.seminary!.year] || e.beat === 'propaedeutic');
}

export function markBeatFired(state: GameState, event: GameEvent): GameState {
  if (!event.beat || !state.seminary) return state;
  return { ...state, flags: { ...state.flags, [beatFlag(event.beat, state.seminary.year)]: true } };
}

/** The formation side of a week: accrual, decay, and the summer/evaluation beats. */
export function formationBeats(state: GameState, reachedBeats: Beat[]): GameState {
  let next = formationWeek(state);
  const sem = next.seminary;
  if (!sem) return next;
  for (const beat of reachedBeats) {
    if (beat.kind === 'assignment' && next.mode.kind === 'clock') {
      next = { ...next, mode: { kind: 'summer', year: sem.year } };
    }
    if (beat.kind === 'evaluation') {
      next = { ...next, mode: { kind: 'evaluation', record: runEvaluation(next) } };
    }
  }
  return next;
}

export function availableSummers(state: GameState) {
  return summerOptions.map((o) => ({ option: o, available: evaluateAll(o.requires, state) }));
}

export function chooseSummer(state: GameState, id: SummerAssignment): GameState {
  const option = summerOptions.find((o) => o.id === id);
  if (!option || !evaluateAll(option.requires, state)) throw new Error(`summer ${id} unavailable`);
  const sem = state.seminary!;
  const next = applyEffects(state, option.effects);
  return {
    ...next,
    mode: { kind: 'clock' },
    seminary: { ...next.seminary!, summerAssignment: id, summers: { ...sem.summers, [sem.year]: id } },
    digest: [...next.digest.slice(0, -1), withLine(next.digest[next.digest.length - 1], renderText(option.outcome, next))],
    career: [...next.career, { week: next.clock.week, kind: 'note', text: `Summer of year ${sem.year}: ${option.label.toLowerCase()}.` }],
  };
}

function withLine(entry: GameState['digest'][number] | undefined, line: string) {
  return entry ? { ...entry, lines: [...entry.lines, line] } : { week: 0, lines: [line] };
}

function runEvaluation(state: GameState) {
  const sem = state.seminary!;
  const concernsBefore = Number(state.flags.concerns_at_year_start ?? 0);
  return evaluate({
    seminary: sem,
    newConcerns: sem.concerns.slice(concernsBefore),
    flags: state.flags,
  });
}

/**
 * The player has read the evaluation. Apply its consequences and move to the
 * next year, ordination, or the end of the run.
 */
export function acknowledgeEvaluation(state: GameState): GameState {
  if (state.mode.kind !== 'evaluation') return state;
  const record = state.mode.record;
  const sem = state.seminary!;
  const emphasis = sem.emphasis ?? zeroPillars();
  const zeroStreak = { ...sem.zeroStreak };
  for (const p of PILLARS) zeroStreak[p] = emphasis[p] === 0 ? zeroStreak[p] + 1 : 0;

  let next: GameState = {
    ...state,
    seminary: { ...sem, evaluations: [...sem.evaluations, record], zeroStreak },
    flags: { ...state.flags, concerns_at_year_start: sem.concerns.length },
  };

  switch (record.result) {
    case 'DISMISSED':
      return {
        ...next,
        speed: 'PAUSED',
        mode: {
          kind: 'ended',
          ending: 'dismissed',
          summary: `In the ${ordinal(sem.year)} year the rector informed you that the seminary would not recommend you for continued formation. ${record.notes.join(' ')}`,
        },
      };
    case 'HELD_BACK':
      next = applyEffects(next, [
        { target: 'relationship', key: '@rector', delta: -10 },
        { target: 'concern', key: `Repeated year ${sem.year}.` },
      ]);
      next = { ...next, seminary: { ...next.seminary!, heldBackCount: sem.heldBackCount + 1 } };
      return { ...next, mode: { kind: 'year_start', year: sem.year }, seminary: { ...next.seminary!, emphasis: null } };
    case 'ADVANCED_WITH_CONCERNS':
      next = applyEffects(next, [{ target: 'relationship', key: '@rector', delta: -4 }]);
      break;
    case 'ADVANCED':
      next = applyEffects(next, [
        { target: 'relationship', key: '@formation_advisor', delta: 5 },
        { target: 'reputation', key: 'chancery', delta: 2 },
      ]);
      break;
  }
  return advanceYear(next);
}

function advanceYear(state: GameState): GameState {
  // A religious year ends on the order's milestone: a profession the house votes on, a renewal, the solemn vows. E3 §5.
  if (state.religious) {
    const ended = formationYearEnd(state, createRng(`${state.seed}:formation:${state.clock.week}`));
    state = ended.line ? addCareerNote(ended.state, ended.line) : ended.state;
    if (ended.heldBack) {
      const held = { ...state, seminary: { ...state.seminary!, heldBackCount: state.seminary!.heldBackCount + 1, emphasis: null } };
      return { ...held, mode: { kind: 'year_start', year: held.seminary!.year } };
    }
  }
  const sem = state.seminary!;
  const milestones: Partial<SeminaryState> = {};
  if (sem.year === 4) milestones.candidacy = true;
  if (sem.year === 5) milestones.lectorAcolyte = true;
  if (sem.year === 6) milestones.diaconate = true;
  if (sem.year >= 7) {
    return { ...state, seminary: { ...sem, ...milestones }, mode: { kind: 'ordination' } };
  }
  const opened: GameState = {
    ...state,
    seminary: { ...sem, ...milestones, year: sem.year + 1, emphasis: null, playedWeeks: [] },
    mode: { kind: 'year_start', year: sem.year + 1 },
  };
  // The studium's first year brings the diocesan seminary's men to the same lectures. E3 §3.13.
  return opened.religious ? diocesanClassmatesStart(formationYearStart(opened), createRng(`${state.seed}:dcm:${state.clock.week}`)) : opened;
}

function addCareerNote(state: GameState, text: string): GameState {
  return { ...state, career: [...state.career, { week: state.clock.week, kind: 'note', text }] };
}

/** DESIGN.md §6.4: voluntary departure, always available, always respected. */
export function leaveSeminary(state: GameState, reason?: string): GameState {
  const year = state.seminary?.year ?? 1;
  return {
    ...state,
    speed: 'PAUSED',
    mode: {
      kind: 'ended',
      ending: 'left_seminary',
      summary:
        reason ??
        `In the ${ordinal(year)} year you told the rector you were leaving. He did not argue. You packed in an afternoon, and the men you were closest to carried your boxes to the car.`,
    },
  };
}

/** DESIGN.md §6.6: the exit payload. Names the archetype, then the bishop assigns. */
export function ordain(state: GameState, rng: Rng): GameState {
  state = leaveSeminaryClubs(state);
  if (!state.character || !state.seminary) return state;
  const archetype = nameArchetype(state);
  const ordained: GameState = {
    ...state,
    character: { ...state.character, archetype },
    phase: 'parochial_vicar',
    flags: { ...state.flags, ordained: true, ordination_week: state.clock.week },
  };
  if (!ordained.world) return { ...ordained, mode: { kind: 'clock' } };
  const withCareer = beginCareer(ordained, rng);
  // A friar is not assigned by the bishop: the provincial consults him, and the letter follows. E3 §3.1.
  if (withCareer.religious) return { ...consult(diocesanClassmatesOrdain(withCareer, rng.derive('dcm-ordain')), rng.derive('consultation'), 'first'), mode: { kind: 'clock' } };
  const assignment = assignFirstParish(withCareer, rng.derive('assignment'));
  const noted: GameState = {
    ...withCareer,
    career: [...withCareer.career, { week: withCareer.clock.week, kind: 'assignment', text: `First assignment: parochial vicar of ${withCareer.world!.parishes.find((p) => p.id === assignment.parishId)?.name ?? 'a parish'}.` }],
  };
  // The top of the class is given a choice.
  return withChoice(noted, rng.derive('choice'), 'ordination', assignment);
}

/** The player has read the letter of assignment. */
/**
 * The letter is answered. A man moved within the diocese who holds a chancery office is asked whether he keeps
 * it alongside the new parish or hands it on; a man staying put, or with no office, is not asked.
 */
export function acceptAssignment(state: GameState, keepOffice = true): GameState {
  if (state.mode.kind !== 'assignment') return state;
  const letter = state.mode.assignment;
  const moving = isMoveTo(state, letter.parishId);
  let next: GameState = state;
  if (moving && officesHeld(state).length > 0) next = keepOffice ? keepOffices(next) : handOnOffices(next);
  if (!next.assignment || next.assignment.parishId !== letter.parishId || next.assignment.role !== letter.role) return { ...next, assignment: letter, mode: { kind: 'clock' } };
  return { ...next, mode: { kind: 'clock' } };
}

/** Calendar year of the current week. */
export function calendarYear(state: GameState): number {
  return fromDayNumber(state.clock.startDay + state.clock.week * 7).year;
}

/**
 * Between the preview and ordination the diocese drifts (DESIGN.md §3.1a).
 * Called once per formation year after the emphasis is chosen.
 */
export function driftAtYearStart(state: GameState, rng: Rng): GameState {
  const sem = state.seminary;
  if (!sem || !state.world || sem.year < 2) return state;
  const year = calendarYear(state);
  if (state.flags[`drifted:${year}`]) return state;
  const { state: drifted, newBishop } = driftYear(state, rng.derive(`drift:${year}`), year);
  let next: GameState = { ...drifted, flags: { ...drifted.flags, [`drifted:${year}`]: true } };
  if (newBishop) {
    next = {
      ...next,
      flags: { ...next.flags, new_bishop_during_seminary: true, [`new_bishop:${year}`]: true },
      digest: [...next.digest, { week: next.clock.week, lines: [`Rome has named ${newBishop.title} ${newBishop.name.first} ${newBishop.name.last} to the see of ${next.world!.diocese.visible.see}.`] }],
    };
  }
  return next;
}

function ordinal(n: number): string {
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n - 1] ?? `${n}th`;
}
