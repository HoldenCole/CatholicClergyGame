import type { Beat, GameEvent, GameState, OfferDef, PendingEvent, Role } from '@/types';
import { applyChoice, defaultChoice, drawEvents, fireEvent } from './events';
import { evaluateAll } from './conditions';
import { shouldInterrupt } from './interrupts';
import { offersWeek } from './offers';
import type { Rng } from './rng';
import { formationBeats, markBeatFired, weekPool } from './seminary';
import { isPlayedWeek, parishWeek } from './parish';
import { careerYear, directedTransfer, isCareerYear, nextAssignment } from './career';
import { openMail } from '@/systems/review';
import { projectWeek } from '@/systems/projects';
import { workWeek } from '@/systems/problems';
import { clubsWeek, joinClub, leaveClub } from '@/systems/clubs';
import { spendingWeek } from '@/systems/spending';
import { resolvePermissions } from '@/systems/decor';
import { awayWeek, retreatYearEnd } from '@/systems/away';
import { staffWeek } from '@/systems/staff';
import { deaneryWeek } from '@/systems/deanery';
import { returnOfTheFormed, seminarianWeek, summerSeminarian } from '@/systems/formed';
import { isYearStart } from './time';
import { seminaryWeek } from '@/systems/seminaryWeek';
import { studyWeek } from '@/systems/studyWeek';
import { endStudy } from './study';
import { appointmentStep, APPOINTMENT_FLAGS } from './appointment';
import { careOf, WEEK } from '@/systems/week';
import { renderText } from './text';
import type { WeekHook } from './clock';

export interface EventDeps {
  pool: GameEvent[];
  lookup: (id: string) => GameEvent | undefined;
  offers?: OfferDef[];
  offerLookup?: (id: string) => OfferDef | undefined;
}

/** Offers tick after everything else in the week. */
export function offersStep(state: GameState, rng: Rng, deps: EventDeps): GameState {
  if (!deps.offers || !deps.offerLookup) return state;
  return offersWeek(state, rng, deps.offers, deps.offerLookup);
}

/** Whether a fired event reaches the player or resolves itself at the current speed. */
export function reachesPlayer(state: GameState, pending: PendingEvent): boolean {
  if (state.speed === 'MANUAL' || state.speed === 'PAUSED') return true;
  if (pending.severity === 'CRITICAL') return true;
  if (state.speed === 'SKIP') return false;
  return shouldInterrupt(state.interrupts, pending);
}

function addDigestLine(state: GameState, line: string): GameState {
  const last = state.digest[state.digest.length - 1];
  if (!last || last.week !== state.clock.week) {
    return { ...state, digest: [...state.digest, { week: state.clock.week, lines: [line] }] };
  }
  return { ...state, digest: [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, line] }] };
}

/**
 * Fire an event and either queue it for the player or resolve it with its
 * default choice, following any follow-up chain the same way.
 */
export function fireOrResolve(state: GameState, event: GameEvent, rng: Rng, deps: EventDeps): GameState {
  const fired = fireEvent(state, event, rng);
  let next = markBeatFired(fired.state, event);
  const pending = fired.pending;
  if (reachesPlayer(next, pending)) {
    return { ...next, pending: [...next.pending, pending] };
  }
  const choice = defaultChoice(event, next, pending.bindings);
  if (!choice) return { ...next, pending: [...next.pending, pending] };
  next = { ...next, pending: [...next.pending, pending] };
  const result = applyChoice(next, event, pending, choice.id, deps.lookup, true);
  next = addDigestLine(result.state, `${renderText(event.title, next, pending.bindings)}: ${renderText(choice.label, next, pending.bindings)}.`);
  if (result.followUp) return fireOrResolve(next, result.followUp, rng, deps);
  return next;
}

/** Resolve a pending event with the player's choice; fire its follow-up if any. */
export function resolvePending(state: GameState, pending: PendingEvent, choiceId: string, rng: Rng, deps: EventDeps): GameState {
  const event = deps.lookup(pending.eventId);
  if (!event) throw new Error(`unknown event ${pending.eventId}`);
  const result = applyChoice(state, event, pending, choiceId, deps.lookup);
  const choice = event.choices.find((c) => c.id === choiceId)!;
  let next = addDigestLine(result.state, `${renderText(event.title, state, pending.bindings)}: ${renderText(choice.label, state, pending.bindings)}.`);
  if (result.followUp) {
    const fired = fireEvent(next, result.followUp, rng);
    next = { ...markBeatFired(fired.state, result.followUp), pending: [...fired.state.pending, { ...fired.pending, bindings: { ...pending.bindings, ...fired.pending.bindings } }] };
  }
  return next;
}

/** The seminary week: formation accrual and beats, then any played-week event. */
export function seminaryWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng, reachedBeats: Beat[]) => {
    let next = formationBeats(state, reachedBeats);
    if (next.mode.kind !== 'clock' || !next.seminary) return next;
    // What he did with the week, whether or not anything else happens in it.
    const week = seminaryWeek(next, rng.derive(`seminary-week:${next.clock.week}`));
    next = week.line ? addDigestLine(week.state, week.line) : week.state;
    next = clubsStep(next, rng);
    const pool = weekPool(deps.pool, next);
    if (pool.length === 0) return next;
    const [event] = drawEvents(pool, next, rng, 1);
    if (!event) return next;
    return fireOrResolve(next, event, rng, deps);
  };
}

/** A well-tended parish has fewer fires: finance, admin, and group problems draw less often at high care. */
export function careRelief(state: GameState): (e: GameEvent) => number {
  const relief = WEEK.careProblemRelief * careOf(state);
  return (e) => (FIRE_CATEGORIES.has(e.category) ? 1 - relief : 1);
}
const FIRE_CATEGORIES = new Set<GameEvent['category']>(['finance', 'admin', 'group']);

/** Invitations accepted and clubs left through effects resolve here; then the week of belonging. */
function clubsStep(state: GameState, rng: Rng): GameState {
  let next = state;
  for (const [key, verb] of Object.entries(state.flags)) {
    if (!key.startsWith('club_pending:')) continue;
    const id = key.slice('club_pending:'.length);
    const flags = { ...next.flags };
    delete flags[key];
    next = { ...next, flags };
    try {
      next = verb === 'leave' ? leaveClub(next, id) : joinClub(next, id, rng.derive(`club:${id}:${next.clock.week}`), true);
    } catch {
      // A club that cannot be joined is simply not joined.
    }
  }
  const week = clubsWeek(next);
  next = week.state;
  for (const line of week.lines) next = addDigestLine(next, line);
  return next;
}

/** The bishop's letter, when it is due: it moves the man or keeps him, and says so over the scene. */
function letterStep(state: GameState, rng: Rng, deps: EventDeps): { state: GameState; moved: boolean } {
  const res = appointmentStep(state, rng, (id) => deps.offerLookup?.(id));
  if (!res.letter) return { state: res.state, moved: false };
  let next = res.state;
  const def = deps.offerLookup?.(state.flags[APPOINTMENT_FLAGS.offer] as string);
  next = addDigestLine(next, res.letter === 'go' ? (def ? renderText(def.accept.outcome, next) : 'The letter of appointment came.') : "The bishop's answer came: he keeps you where you are.");
  const letter = deps.lookup(`ap_letter_${res.letter}`);
  if (letter) {
    next = { ...next, flags: { ...next.flags, [`${APPOINTMENT_FLAGS.letter}:${res.letter}`]: true } };
    next = fireOrResolve(next, letter, rng.derive(`letter:${next.clock.week}`), deps);
    const flags = { ...next.flags };
    delete flags[`${APPOINTMENT_FLAGS.letter}:${res.letter}`];
    next = { ...next, flags };
  }
  return { state: next, moved: res.letter === 'go' };
}

/** Roughly how often a week away carries a scene. Invented. */
const STUDY_EVENT_CHANCE = 0.1;

/** The week away: the hours resolve, a scene may come, the years end with the board. */
export function studyWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng) => {
    if (!state.study) return state;
    // A post he said yes to from this one: the letter comes, or does not.
    const letter = letterStep(state, rng, deps);
    if (letter.moved || letter.state.pending.length > 0) return letter.state;
    const week = studyWeek(letter.state, rng.derive(`study-week:${state.clock.week}`));
    let next = week.line ? addDigestLine(week.state, week.line) : week.state;
    if (isCareerYear(next)) next = careerYear(next, rng);
    if (next.mode.kind !== 'clock') return next;
    if (next.study && next.clock.week >= next.study.endWeek) {
      const def = deps.offerLookup?.(next.study.offerId);
      if (def) return addDigestLine(endStudy(next, def, rng.derive(`study-end:${next.clock.week}`)), next.study.city === 'see' ? 'The letter went to Rome on your seventy-fifth birthday, as the canon requires, and Rome, for once, answered quickly.' : next.study.city === 'residence' ? 'The bishop thanks you at dinner, in front of the sisters, and names your successor before dessert. The board has a parish for you.' : next.study.city === 'rome' || next.study.city === 'washington' ? 'The degree is defended, the room is packed, and the plane home is full of people going somewhere else.' : 'The appointment ends the way they do: a dinner, a card signed by everyone, and a letter from the personnel board that was in the mail before the dinner.');
    }
    if (rng.derive(`study-scene:${next.clock.week}`).chance(STUDY_EVENT_CHANCE)) {
      const [event] = drawEvents(deps.pool.filter((e) => !e.beat), next, rng, 1);
      if (event) next = fireOrResolve(next, event, rng, deps);
    }
    if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    return openMail(offersStep(next, rng, deps));
  };
}

/** The parish week: the routine resolves, a played week may fire an event, the arc may end, offers tick. */
export function parishWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng, reachedBeats: Beat[]) => {
    if (!state.parish) return state;
    // A move he said yes to last week: the letter arrives, and the week is spent packing.
    const pending = state.flags.transfer_pending;
    if (typeof pending === 'string') {
      const [kind, role] = pending.split(':');
      const asRole: Role = role === 'pastor' || role === 'administrator' ? role : 'parochial_vicar';
      const moved = directedTransfer(state, rng, kind ?? 'difficult', asRole);
      if (moved.moved) return addDigestLine(moved.state, 'The letter of appointment came, as the vicar for clergy said it would. You packed.');
    }
    // A post he said yes to: the bishop's letter moves him, or keeps him.
    const letter = letterStep(state, rng, deps);
    if (letter.moved || letter.state.pending.length > 0) return letter.state;
    state = letter.state;
    // A week away: the retreat or the vacation, with one scene the first week.
    if (state.away) {
      const gone = awayWeek(state, rng, deps.pool);
      let away = addDigestLine(gone.state, gone.line);
      if (gone.event) away = fireOrResolve(away, gone.event, rng, deps);
      if (away.mode.kind !== 'clock' || away.pending.length > 0) return away;
      return openMail(offersStep(away, rng, deps));
    }
    let next = parishWeek(state, rng);
    if (isYearStart(next.clock)) {
      const owed = retreatYearEnd(next);
      next = owed.state;
      if (owed.line) next = addDigestLine(next, owed.line);
    }
    const staffed = staffWeek(next, rng.derive(`staff:${next.clock.week}`));
    next = staffed.state;
    for (const line of staffed.lines) next = addDigestLine(next, line);
    next = deaneryWeek(next);
    const summer = summerSeminarian(next, rng.derive(`seminarian:${next.clock.week}`));
    next = summer.state;
    if (summer.line) next = addDigestLine(next, summer.line);
    const sem = seminarianWeek(next);
    next = sem.state;
    if (sem.line) next = addDigestLine(next, sem.line);
    if (isYearStart(next.clock)) {
      const back = returnOfTheFormed(next, rng.derive(`returned:${next.clock.week}`));
      next = back.state;
      if (back.line) next = addDigestLine(next, back.line);
    }
    const project = projectWeek(next);
    next = project.state;
    if (project.line) next = addDigestLine(next, project.line);
    const work = workWeek(next);
    next = work.state;
    if (work.line) next = addDigestLine(next, work.line);
    next = clubsStep(next, rng);
    const spent = spendingWeek(next, rng);
    next = spent.state;
    for (const line of spent.lines) next = addDigestLine(next, line);
    const letters = resolvePermissions(next, rng.derive(`permissions:${next.clock.week}`));
    next = letters.state;
    for (const line of letters.lines) next = addDigestLine(next, line);
    if (isCareerYear(next)) next = careerYear(next, rng);
    if (next.mode.kind !== 'clock') return next;
    if (next.flags.new_bishop_pending) {
      // A succession always gets its scene, played week or not. DESIGN 5.3
      let [event] = drawEvents(deps.pool.filter((e) => e.beat === 'succession'), next, rng, 1);
      if (!event) {
        // Suppression must not swallow a beat: any succession scene whose conditions hold will do.
        const any = deps.pool.filter((e) => e.beat === 'succession' && evaluateAll(e.requires ?? [], next));
        if (any.length) event = rng.derive(`succession-any:${next.clock.week}`).pick(any);
      }
      next = { ...next, flags: { ...next.flags, new_bishop_pending: false } };
      if (event) next = fireOrResolve(next, event, rng, deps);
      if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    }
    if (isPlayedWeek(next)) {
      // Beat events (a succession) fire only through their beat, never on an ordinary played week.
      const [event] = drawEvents(deps.pool.filter((e) => !e.beat), next, rng, 1, careRelief(next));
      if (event) next = fireOrResolve(next, event, rng, deps);
    }
    if (reachedBeats.some((b) => b.kind === 'assignment') && next.mode.kind === 'clock') {
      next = nextAssignment(next, rng).state;
    }
    if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    return openMail(offersStep(next, rng, deps));
  };
}
