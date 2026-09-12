import type { GameState, OfferDef, StudyState } from '@/types';
import type { Rng } from './rng';
import { studyProgram } from '@/content/study';
import { applyEffects } from './effects';
import { handoffProject } from '@/systems/projects';
import { refreshOpenings } from '@/systems/openings';
import { closeTenure } from '@/systems/tenures';
import { nextAssignment } from './career';
import { withChoice } from '@/systems/choice';
import { ARC } from './parish';
import { generateSee } from './see';
import { retire } from './career';

/** How a place is named in prose. */
export const CITY_WORD: Record<StudyState['city'], string> = { rome: 'Rome', washington: 'Washington', residence: "the bishop's residence", campus: 'the Newman Center', hospital: 'the hospital', seminary: 'the seminary', chancery: 'the chancery', auxiliary: 'the chancery', see: 'the see' };

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
  let next = closeTenure(state, program.kind === 'post' ? `left for ${program.label.toLowerCase()}` : `sent to ${CITY_WORD[program.city]}`);
  next = next.parish ? handoffProject(next, rng.derive(`handoff:${state.clock.week}`)).state : next;
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
  const beats = [...next.beats.filter((b) => b.kind !== 'assignment'), { kind: 'assignment' as const, week: study.endWeek, label: program.kind === 'post' ? (program.city === 'residence' ? 'The bishop lets you go' : `The years at ${CITY_WORD[program.city]} end`) : `Home from ${CITY_WORD[program.city]}` }].sort((a, b) => a.week - b.week);
  next = { ...next, phase: program.kind === 'see' ? 'bishop' : 'study', study, parish: null, assignment: null, founding: null, project: null, projects: [], flags, beats, mode: { kind: 'clock' } };
  if (program.kind === 'see') {
    // The last act: a see of his own, held until the letter at seventy-five.
    const see = generateSee(next, rng.derive(`see:${next.clock.week}`));
    const year = new Date((next.clock.startDay + next.clock.week * 7) * 86_400_000).getUTCFullYear();
    const age = year - (next.character!.entryYear - next.character!.background.entryAge);
    const endWeek = next.clock.week + Math.max(52, (75 - age) * 52);
    next = { ...next, see, study: { ...study, endWeek, school: see.name, residence: `the bishop's house in ${see.see}` }, beats: [...next.beats.filter((b) => b.kind !== 'assignment'), { kind: 'assignment' as const, week: endWeek, label: 'The letter at seventy-five' }].sort((a, b) => a.week - b.week), flags: { ...next.flags, [`see:${see.id}`]: true } };
    return note(next, 'promotion', `Named Bishop of ${see.see}, ${see.region}: ${see.name}, ${program.label.toLowerCase()} of forty priests and more parishes than that.`);
  }
  const years = Math.round(c.weeks / 52);
  return note(next, 'offer', program.kind === 'post' ? `Moved into ${program.residence} as ${program.label.toLowerCase()}, ${years} years.` : `Left for ${CITY_WORD[program.city]}: ${program.label.toLowerCase()} at ${program.school}, ${years} years.`);
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
  if (study.failed && def.failure) {
    next = applyEffects(next, def.failure.effects);
    next = { ...next, offerHistory: [...next.offerHistory, { offerId: def.id, week: next.clock.week, decision: 'failed' }] };
    next = note(next, 'offer', `Came home from ${CITY_WORD[study.city]} without the degree.`);
  } else {
    next = applyEffects(next, c.onComplete);
    next = { ...next, offerHistory: [...next.offerHistory, { offerId: def.id, week: next.clock.week, decision: 'completed' }] };
    const post = studyProgram(study.program)?.kind === 'post';
    next = note(next, 'offer', study.city === 'residence' ? `Three years as ${study.label.toLowerCase()}, and the bishop let you go with his blessing.` : post ? `${Math.round((study.endWeek - study.startWeek) / 52)} years as ${study.label.toLowerCase()}; the board has a parish for you again.` : `Came home from ${CITY_WORD[study.city]} with ${study.label.toLowerCase()}.`);
  }
  const flags: GameState['flags'] = { ...next.flags };
  delete flags[`study:${study.city}`];
  if (studyProgram(study.program)?.kind === 'see') {
    // The letter at seventy-five: a bishop does not come home to a parish.
    return retire({ ...next, flags });
  }
  next = { ...next, flags, study: null, phase: 'parochial_vicar', beats: next.beats.filter((b) => b.kind !== 'assignment') };
  next = refreshOpenings(next, rng.derive(`openings:home:${next.clock.week}`)).state;
  const home = nextAssignment(next, rng).state;
  // A degree earned buys a choice; a posting ended, or a washout, takes what the board gives.
  if (!study.failed && studyProgram(study.program)?.kind === 'study' && home.mode.kind === 'assignment') return withChoice(home, rng.derive('choice'), 'degree', home.mode.assignment);
  return home;
}
