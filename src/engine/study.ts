import type { GameState, OfferDef, StudyState } from '@/types';
import type { Rng } from './rng';
import { studyProgram } from '@/content/study';
import { applyEffects } from './effects';
import { handoffProject } from '@/systems/projects';
import { refreshOpenings } from '@/systems/openings';
import { nextAssignment } from './career';
import { ARC } from './parish';

/** How a place is named in prose. */
export const CITY_WORD: Record<StudyState['city'], string> = { rome: 'Rome', washington: 'Washington', residence: "the bishop's residence", campus: 'the Newman Center', hospital: 'the hospital', seminary: 'the seminary', chancery: 'the chancery' };

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
  let next = state.parish ? handoffProject(state, rng.derive(`handoff:${state.clock.week}`)).state : state;
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
  };
  const flags: GameState['flags'] = { ...next.flags, [`study:${program.city}`]: true };
  for (const k of Object.keys(flags)) if (k.startsWith('parish:') || k.startsWith('role:')) delete flags[k];
  const beats = [...next.beats.filter((b) => b.kind !== 'assignment'), { kind: 'assignment' as const, week: study.endWeek, label: program.kind === 'post' ? (program.city === 'residence' ? 'The bishop lets you go' : `The years at ${CITY_WORD[program.city]} end`) : `Home from ${CITY_WORD[program.city]}` }].sort((a, b) => a.week - b.week);
  next = { ...next, phase: 'study', study, parish: null, assignment: null, founding: null, project: null, flags, beats, mode: { kind: 'clock' } };
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
  next = { ...next, flags, study: null, phase: 'parochial_vicar', beats: next.beats.filter((b) => b.kind !== 'assignment') };
  next = refreshOpenings(next, rng.derive(`openings:home:${next.clock.week}`)).state;
  return nextAssignment(next, rng).state;
}
