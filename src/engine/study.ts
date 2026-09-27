import type { GameState, OfferDef, StudyState } from '@/types';
import type { Rng } from './rng';
import { studyProgram } from '@/content/study';
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
import { fromDayNumber } from './calendar';
import { sundayOf } from './time';

/** How a place is named in prose. */
export const CITY_WORD: Record<StudyState['city'], string> = { rome: 'Rome', washington: 'Washington', residence: "the bishop's residence", campus: 'the Newman Center', hospital: 'the hospital', seminary: 'the seminary', chancery: 'the chancery', auxiliary: 'the chancery', see: 'the see', prison: 'the penitentiary', mission: 'the missions', deployment: 'the deployment', formation: 'the seminary', schools: 'the schools office', curia: 'the Curia', holy_see: 'the Apostolic Palace', academy: 'the Academy', nunciature: 'the nunciature' };

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
    endWeek: next.clock.week + c.weeks,
    failed,
    routine: {},
    hoursLogged: {},
    taken: [],
    fromParishId: next.parish?.parishId ?? null,
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
    next = note(next, 'offer', (study.city === 'residence' ? `Three years as ${study.label.toLowerCase()}, and the bishop let you go with his blessing.` : post ? `${Math.round((study.endWeek - study.startWeek) / 52)} years as ${study.label.toLowerCase()}; the board has a parish for you again.` : `Came home from ${CITY_WORD[study.city]} with ${study.label.toLowerCase()}.`) + (book ? ` ${book}` : ''));
  }
  const flags: GameState['flags'] = { ...next.flags };
  delete flags[`study:${study.city}`];
  if (studyProgram(study.program)?.kind === 'see') {
    // The letter at seventy-five: a bishop does not come home to a parish.
    return retire({ ...next, flags });
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
  // A friar comes home to the provincial, not to the board: the consultation decides where the degree is used. E3 §3.1.
  if (next.religious) {
    const { consultation: _c, ...rest } = next.religious;
    return { ...consult({ ...next, religious: rest }, rng.derive(`consult:home:${next.clock.week}`), 'term'), mode: { kind: 'consultation' } };
  }
  next = refreshOpenings(next, rng.derive(`openings:home:${next.clock.week}`)).state;
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
  if (!study.failed && (studyProgram(study.program)?.kind === 'study' || study.city === 'curia' || service) && home.assignment) {
    const flagship = flagshipFor(home);
    const experienced = parishYears(home) >= CAREER.minYearsForPastor;
    const fallback = flagship ? assignmentTo(home, flagship, experienced ? 'pastor' : 'parochial_vicar', [study.city === 'curia' ? 'Years in the Curia are meant to be seen' : service ? 'Years in the Holy See\'s service are meant to be seen' : 'A Roman degree is meant to be seen']) : home.assignment;
    return withChoice({ ...home, assignment: fallback, mode: { kind: 'clock' } }, rng.derive('choice'), 'degree', fallback);
  }
  return home;
}
