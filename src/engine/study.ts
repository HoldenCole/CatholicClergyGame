import type { GameState, OfferDef, StudyState } from '@/types';
import type { Rng } from './rng';
import { studyProgram } from '@/content/study';
import { offerById } from '@/content/offers';
import { friarNamedBishop } from '@/systems/religious/mitre';
import { applyEffects } from './effects';
import { handoffProject } from '@/systems/projects';
import { refreshOpenings } from '@/systems/openings';
import { closeTenure } from '@/systems/tenures';
import { nextAssignment } from './career';
import { assignmentTo, flagshipFor, parishYears, withChoice } from '@/systems/choice';
import { CAREER } from './career';
import { ARC } from './parish';
import { generateSee } from './see';
import { retire } from './career';
import { bookLine } from '@/systems/studyWeek';
import { dropOffices } from '@/systems/offices';
import { consult } from '@/systems/religious/obedience';
import { beginCuria, homeFromCuria, leaveCuriaForSee } from '@/systems/rome/curia';
import { beginAcademy, beginService, DIPLOMACY, diplomacyOf, homeFromService } from '@/systems/rome/diplomacy';
import { formatDate, fromDayNumber } from './calendar';
import { dateOf, sundayOf, termWeek } from './time';
import { scheduleAppointment } from './appointment';

/** How a place is named in prose. */
export const CITY_WORD: Record<StudyState['city'], string> = { rome: 'Rome', washington: 'Washington', residence: "the bishop's residence", campus: 'the Newman Center', hospital: 'the hospital', seminary: 'the seminary', chancery: 'the chancery', auxiliary: 'the chancery', see: 'the see', prison: 'the penitentiary', mission: 'the missions', deployment: 'the deployment', formation: 'the seminary', schools: 'the schools office', curia: 'the Curia', holy_see: 'the Apostolic Palace', academy: 'the Academy', nunciature: 'the nunciature', generalate: "the order's house in Rome" };

/** Invented: what leaving costs the man's standing with the people he leaves. DESIGN §7.5 rule 3. */
export const STUDY = { leaveParishioners: -8 } as const;

function note(state: GameState, kind: GameState['career'][number]['kind'], text: string): GameState {
  return { ...state, career: [...state.career, { week: state.clock.week, kind, text }] };
}

/**
 * The man leaves for a degree: the parish is handed on, the project with it,
 * and he lives where he studies until the years are up. The offer's
 * commitment carries `away: <program>`.
 */
export function beginStudy(state: GameState, def: OfferDef, failed: boolean, rng: Rng): GameState {
  const c = def.accept.commitment;
  const program = c?.away ? studyProgram(c.away) : undefined;
  if (!c || !program) throw new Error(`offer ${def.id} is not a course of study`);
  // A translation closes the first see's file: its letter was answered, and the years were served.
  const leavingSee = program.kind === 'see' && state.study && studyProgram(state.study.program)?.kind === 'see' ? state.study.offerId : null;
  // Rome sends a man from its own offices to a see: the Curia's years are served. E1 §6.
  const fromCuria = program.kind === 'see' ? leaveCuriaForSee(state) : state;
  let next = closeTenure(fromCuria, program.kind === 'post' ? `left for ${program.label.toLowerCase()}` : `sent to ${CITY_WORD[program.city]}`);
  if (leavingSee) next = { ...next, offerHistory: [...next.offerHistory, { offerId: leavingSee, week: next.clock.week, decision: 'completed' }] };
  next = next.parish ? handoffProject(next, rng.derive(`handoff:${state.clock.week}`)).state : next;
  next = dropOffices(next);
  const ch = next.character!;
  const carried = Math.round(ch.reputation.parishioners * ARC.parishionersCarryover);
  next = { ...next, character: { ...ch, reputation: { ...ch.reputation, parishioners: carried } } };
  next = applyEffects(next, [{ target: 'reputation', key: 'parishioners', delta: STUDY.leaveParishioners }]);
  const study: StudyState = {
    offerId: def.id,
    program: program.id,
    city: program.city,
    label: program.label,
    school: program.school,
    residence: program.residence,
    startWeek: next.clock.week,
    // A school with a year of its own runs its weeks from the week it opens, if he comes a little early.
    endWeek: (program.term ? termWeek(next.clock, program.term, next.clock.week) : next.clock.week) + c.weeks,
    failed,
    routine: {},
    hoursLogged: {},
    taken: [],
    fromParishId: next.parish?.parishId ?? null,
    leftAs: state.assignment?.role ?? null,
    ...(program.place ? { place: Object.fromEntries(program.place.dials.map((d) => [d.id, 0])) } : {}),
  };
  const flags: GameState['flags'] = { ...next.flags, [`study:${program.city}`]: true };
  for (const k of Object.keys(flags)) if (k.startsWith('parish:') || k.startsWith('role:')) delete flags[k];
  // A friar sent away lays down the house's office, the local work, and the asks on his table; the house keeps his place. E3.
  if (next.religious) {
    const { houseOffice: _ho, apostolate: _ap, pastorTask: _pt, pastorAsk: _pa, confrereTask: _ct, confrereAsk: _ca, ...rest } = next.religious;
    next = { ...next, religious: rest };
  }
  const beats = [...next.beats.filter((b) => b.kind !== 'assignment'), { kind: 'assignment' as const, week: study.endWeek, label: program.kind === 'post' ? (program.city === 'residence' ? 'The bishop lets you go' : `The years at ${CITY_WORD[program.city]} end`) : `Home from ${CITY_WORD[program.city]}` }].sort((a, b) => a.week - b.week);
  next = { ...next, phase: program.kind === 'see' ? 'bishop' : 'study', study, parish: null, assignment: null, founding: null, project: null, projects: [], flags, beats, mode: { kind: 'clock' } };
  // Lent to the Holy See: an office, its superiors, and the rank of an official. E1 §6.
  if (program.city === 'curia') next = beginCuria(next, rng.derive(`curia:${next.clock.week}`));
  // The Academy: a student of the Holy See's diplomatic service, the missionary year ahead. E1 §11.
  if (program.city === 'academy') next = beginAcademy(next);
  // A friar named bishop leaves the order's governance as the posting begins. E3 §16B.
  if (next.religious && (program.city === 'auxiliary' || program.city === 'see')) next = friarNamedBishop(next);
  if (program.kind === 'see') {
    // The last act: a see of his own, held until the letter at seventy-five.
    const see = generateSee(next, rng.derive(`see:${next.clock.week}`));
    const year = new Date((next.clock.startDay + next.clock.week * 7) * 86_400_000).getUTCFullYear();
    const age = year - (next.character!.entryYear - next.character!.background.entryAge);
    const endWeek = next.clock.week + Math.max(52, (75 - age) * 52);
    next = { ...next, see, study: { ...study, endWeek, school: see.name, residence: `the bishop's house in ${see.see}` }, beats: [...next.beats.filter((b) => b.kind !== 'assignment'), { kind: 'assignment' as const, week: endWeek, label: 'The letter at seventy-five' }].sort((a, b) => a.week - b.week), flags: { ...next.flags, [`see:${see.id}`]: true } };
    const moved = see.former?.at(-1);
    return note(next, 'promotion', moved ? `Translated from ${moved.see} to ${see.see}, ${see.region}: ${see.name}, after ${moved.years} year${moved.years === 1 ? '' : 's'} in the first chair.` : `Named Bishop of ${see.see}, ${see.region}: ${see.name}, ${program.label.toLowerCase()} of forty priests and more parishes than that.`);
  }
  const years = Math.round(c.weeks / 52);
  return note(next, 'offer', program.kind === 'post' ? `Moved into ${program.residence} as ${program.label.toLowerCase()}, ${years} years.` : `${next.religious ? 'Sent by the provincial to' : 'Left for'} ${CITY_WORD[program.city]}: ${program.label.toLowerCase()} at ${program.school}, ${years} years.`);
}

/** The week the Academy's year next opens. */
function academyOpens(state: GameState, academy: OfferDef): number {
  const term = studyProgram(academy.accept.commitment?.away ?? '')?.term;
  return term ? termWeek(state.clock, term, state.clock.week) : state.clock.week;
}

/** Whether a man recruited at the Gregorian goes straight across the city: the Academy's year opens within a few weeks. */
function academyWithin(state: GameState): boolean {
  const academy = offerById('rome_diplomatic_academy');
  return !!academy && academyOpens(state, academy) - state.clock.week <= DIPLOMACY.termEarly;
}

/**
 * Home without the degree: he comes back at the rank he left with. A vicar is
 * not made pastor on a degree he did not finish, so the board's pastorates and
 * chancery posts are not open to him this year; a pastor is not sent back as a
 * vicar (DESIGN §8.1), so if the board has only a vicar's post, he is pastor there.
 */
function washoutHome(state: GameState, study: StudyState, rng: Rng): GameState {
  const wasPastor = study.leftAs === 'pastor' || study.leftAs === 'administrator';
  if (!wasPastor) {
    const home = nextAssignment({ ...state, openings: state.openings.filter((o) => o.kind === 'parochial_vicar') }, rng).state;
    if (!home.assignment) return { ...home, openings: state.openings };
    const assignment = { ...home.assignment, reasons: ['Home without the degree: the board gives you a vicar\'s post and will look at you again in a few years'] };
    return { ...home, openings: state.openings, assignment, mode: { kind: 'assignment', assignment } };
  }
  const home = nextAssignment(state, rng).state;
  if (!home.assignment || home.assignment.role !== 'parochial_vicar') return home;
  const parish = home.world!.parishes.find((p) => p.id === home.assignment!.parishId)!;
  const assignment = assignmentTo(home, parish, study.leftAs!, ['A pastor is not sent back as a vicar, degree or no degree']);
  const career = home.career.filter((e) => !(e.week === home.clock.week && e.kind === 'assignment' && e.text.startsWith('Sent as parochial vicar')));
  return note({ ...home, career, assignment, mode: { kind: 'assignment', assignment } }, 'assignment', `Moved as ${study.leftAs} to ${parish.name}, ${parish.place}.`);
}

/**
 * The years are up. He graduates or washes out, the offer is recorded, the
 * diocese's openings are refreshed, and the board finds him a post.
 */
export function endStudy(state: GameState, def: OfferDef, rng: Rng): GameState {
  const study = state.study;
  if (!study) return state;
  let next: GameState = state;
  const c = def.accept.commitment!;
  // The service does not complete an offer: the Academy's was completed when the service began. E1 §11.
  const service = study.city === 'nunciature';
  if (service) {
    const d = diplomacyOf(next);
    const ch = next.character!;
    const age = fromDayNumber(sundayOf(next.clock)).year - (ch.entryYear - ch.background.entryAge);
    const flags0: GameState['flags'] = { ...next.flags };
    delete flags0['study:nunciature'];
    // A nuncio does not come home to a parish, and the letter at seventy-five ends any man's service.
    if (d?.rank === 'nuncio' || age >= DIPLOMACY.retirementAge) return retire({ ...next, flags: flags0 });
    next = note(next, 'offer', `Left the diplomatic service after ${Math.max(1, Math.round((next.clock.week - study.startWeek) / 52))} years, at his own asking.`);
  } else if (study.failed && def.failure) {
    next = applyEffects(next, def.failure.effects);
    next = { ...next, offerHistory: [...next.offerHistory, { offerId: def.id, week: next.clock.week, decision: 'failed' }] };
    next = note(next, 'offer', `Came home from ${CITY_WORD[study.city]} without the degree.`);
  } else {
    next = applyEffects(next, c.onComplete);
    next = { ...next, offerHistory: [...next.offerHistory, { offerId: def.id, week: next.clock.week, decision: 'completed' }] };
    const post = studyProgram(study.program)?.kind === 'post';
    const book = bookLine(next);
    next = note(next, 'offer', (study.city === 'generalate' ? `${Math.round((study.endWeek - study.startWeek) / 52)} years at the head of the order; the province gives you a cell.` : study.city === 'residence' ? `Three years as ${study.label.toLowerCase()}, and the bishop let you go with his blessing.` : post ? `${Math.round((study.endWeek - study.startWeek) / 52)} years as ${study.label.toLowerCase()}; the board has a parish for you again.` : next.flags['academy:recruited'] && study.city === 'rome' && academyWithin(next) ? `Finished ${study.label.toLowerCase()} at ${study.school}, and stayed in Rome for the Academy.` : `Came home from ${CITY_WORD[study.city]} with ${study.label.toLowerCase()}.`) + (book ? ` ${book}` : ''));
  }
  const flags: GameState['flags'] = { ...next.flags };
  delete flags[`study:${study.city}`];
  if (studyProgram(study.program)?.kind === 'see') {
    // The letter at seventy-five: a bishop does not come home to a parish.
    return retire({ ...next, flags });
  }
  // Recruited at the Gregorian: the degree done, he goes across the city to the Academy instead of home. E1 §11.
  // Its year opens in October: a degree that ends near it goes straight across; one that ends earlier goes home to wait.
  let later: { def: OfferDef; week: number } | null = null;
  if (flags['academy:recruited'] && study.city === 'rome' && !next.religious) {
    delete flags['academy:recruited'];
    const academy = offerById('rome_diplomatic_academy');
    if (study.failed || !academy) next = note(next, 'offer', 'Without the degree the Academy does not take you; its president writes a kind letter.');
    else {
      const recruited: GameState = { ...next, flags, offerHistory: [...next.offerHistory, { offerId: academy.id, week: next.clock.week, decision: 'accepted' }] };
      const opens = academyOpens(next, academy);
      if (academyWithin(next)) return beginStudy(recruited, academy, false, rng.derive(`academy:${next.clock.week}`));
      later = { def: academy, week: opens };
      next = note(recruited, 'offer', `The Academy's year opens on ${formatDate(dateOf(next.clock, opens))}: home to the diocese until then.`);
    }
  }
  // The Academy's years are done: the service begins, and he does not go home. E1 §11.
  if (study.city === 'academy') {
    const out = beginService({ ...next, flags }, rng.derive(`service:${next.clock.week}`));
    return { ...out.state, letters: [...(out.state.letters ?? []), out.letter], letterQueue: [...(out.state.letterQueue ?? []), out.letter] };
  }
  // Home from the Curia, changed or not; a secretary's years end in a see. E1 §6.
  if (study.city === 'curia' || service) {
    const home = service ? homeFromService(next) : homeFromCuria(next);
    next = { ...home.state, letters: [...(home.state.letters ?? []), home.letter], letterQueue: [...(home.state.letterQueue ?? []), home.letter] };
    Object.assign(flags, home.state.flags);
    delete flags[`study:${study.city}`];
  }
  next = { ...next, flags, study: null, phase: 'parochial_vicar', beats: next.beats.filter((b) => b.kind !== 'assignment') };
  if (later) next = scheduleAppointment(next, later.def, later.week);
  // A friar comes home to the provincial, not to the board: the consultation decides where the degree is used. E3 §3.1.
  if (next.religious) {
    const { consultation: _c, ...rest } = next.religious;
    return { ...consult({ ...next, religious: rest }, rng.derive(`consult:home:${next.clock.week}`), 'term'), mode: { kind: 'consultation' } };
  }
  next = refreshOpenings(next, rng.derive(`openings:home:${next.clock.week}`)).state;
  if (study.failed) return washoutHome(next, study, rng);
  const home = nextAssignment(next, rng).state;
  // A degree earned buys a choice among the top of the diocese, whatever the board rolled; the letter behind the
  // choice is the flagship. A posting ended, or a washout, takes what the board gives.
  // A bishop does not come home to a vicar's post: the auxiliary's years end at the head of the flagship, as the letter promised.
  if (next.flags.ordained_bishop && home.assignment) {
    const flagship = flagshipFor(home);
    const seat = flagship ? assignmentTo(home, flagship, 'pastor', ['An auxiliary bishop is given a great parish']) : { ...home.assignment, role: 'pastor' as const };
    // The board's own letter never reaches him: its lines are not his record, and the flagship's letter is the one he opens.
    return { ...home, career: next.career, assignment: seat, mode: { kind: 'assignment', assignment: seat } };
  }
  // A man going back to Rome in October is not given the diocese's great parish for a summer.
  if (!study.failed && !later && (studyProgram(study.program)?.kind === 'study' || study.city === 'curia' || service) && home.assignment) {
    const flagship = flagshipFor(home);
    const experienced = parishYears(home) >= CAREER.minYearsForPastor;
    const fallback = flagship ? assignmentTo(home, flagship, experienced ? 'pastor' : 'parochial_vicar', [study.city === 'curia' ? 'Years in the Curia are meant to be seen' : service ? 'Years in the Holy See\'s service are meant to be seen' : 'A Roman degree is meant to be seen']) : home.assignment;
    // The choice's words say where he is coming home from: a degree, the Curia, or the service.
    const from = study.city === 'curia' ? 'curia' : service ? 'service' : 'degree';
    return withChoice({ ...home, assignment: fallback, flags: { ...home.flags, home_from: from }, mode: { kind: 'clock' } }, rng.derive('choice'), 'degree', fallback);
  }
  return home;
}
