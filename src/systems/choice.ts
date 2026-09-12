import type { Assignment, AssignmentOption, GameState, Opening, Parish, Role } from '@/types';
import type { Rng } from '@/engine/rng';
import { letterFor } from '@/engine/career';
import { beginStudy } from '@/engine/study';
import { officeDef } from '@/content/parish';
import { offerById } from '@/content/offers';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { formationStanding, parishPrestige } from './standing';
import { parishKindWord } from './placement';
import { hoursOf } from './week';

/**
 * A strong man is given a choice. At ordination for the top of the class,
 * on return from a degree, and at a board for a man the chancery rates,
 * the bishop lays two or three assignments on the desk and each says what
 * it is worth, what it takes, and what is involved. Requested in
 * playtesting; numbers invented.
 */
export const CHOICE = {
  /** Formation standing that earns a choice at ordination. */
  ordinationStanding: 66,
  /** Chancery regard that earns a choice at a board. */
  boardChancery: 55,
} as const;

export type Occasion = 'ordination' | 'degree' | 'board';

function prestigeWord(p: number): string {
  return p >= 0.9 ? 'the diocese watches this one' : p >= 0.65 ? 'a parish people have heard of' : p >= 0.4 ? 'an ordinary parish' : p >= 0.25 ? 'a parish the diocese forgets' : 'a parish nobody asked for';
}

function timeWord(officeId?: string): string {
  const o = officeId ? officeDef(officeId) : undefined;
  return o ? `the parish, and ${hoursOf(o.apPerWeek)} hours a week at ${o.label.toLowerCase()}` : 'the parish, and nothing else';
}

function involvesOf(parish: Parish, role: Role): string[] {
  const out = [`${parishKindWord(parish)}, about ${parish.households.toLocaleString()} households, ${parish.generational}${parish.school === 'none' ? ', no school' : `, a school ${parish.school.replace('_', ' ')}`}`];
  out.push(PROBLEM_LABEL[parish.problem] ?? parish.problem);
  if (parish.needsSpanish) out.push('Spanish is needed');
  if (parish.debt > 0) out.push(`$${parish.debt.toLocaleString()} of debt${role === 'pastor' ? ', yours to carry' : ''}`);
  return out;
}

function assignmentFor(state: GameState, parish: Parish, role: Role, reasons: string[]): Assignment {
  const opening: Opening = { id: `choice_${parish.id}_${state.clock.week}`, kind: role === 'pastor' ? 'pastor' : role === 'administrator' ? 'administrator' : 'parochial_vicar', parishId: parish.id, urgency: 50, needsSpanish: parish.needsSpanish, needsAdmin: false, alignment: parish.alignment, week: state.clock.week, label: `${parish.name}, ${parish.place}` };
  return { parishId: parish.id, role, startWeek: state.clock.week, letter: letterFor(state, opening, role), reasons };
}

function option(state: GameState, id: string, headline: string, blurb: string, parish: Parish, role: Role, reasons: string[], office?: string): AssignmentOption {
  return { id, headline, blurb, assignment: assignmentFor(state, parish, role, reasons), prestige: prestigeWord(parishPrestige(parish)), time: timeWord(office), involves: involvesOf(parish, role), ...(office ? { office } : {}) };
}

function byPrestige(parishes: Parish[]): Parish[] {
  return [...parishes].sort((a, b) => parishPrestige(b) - parishPrestige(a));
}

/** Whether this occasion earns the man a choice at all. */
export function earnsChoice(state: GameState, occasion: Occasion): boolean {
  if (!state.world || !state.character) return false;
  if (occasion === 'ordination') return formationStanding(state).value >= CHOICE.ordinationStanding || !!state.flags.seminary_leader || !!state.flags.rector_recommends;
  if (occasion === 'degree') return true;
  return state.character.reputation.chancery >= CHOICE.boardChancery;
}

/** The options the bishop lays out, or null when there is nothing to choose between. */
export function buildChoice(state: GameState, rng: Rng, occasion: Occasion, fallback: Assignment): { options: AssignmentOption[]; why: string } | null {
  const world = state.world;
  if (!world || !earnsChoice(state, occasion)) return null;
  const parishes = world.parishes;
  const here = parishes.find((p) => p.id === fallback.parishId);
  const options: AssignmentOption[] = [];
  const c = state.character!;

  if (occasion === 'ordination') {
    if (here) options.push(option(state, 'first', `Parochial vicar of ${here.name}`, 'The board\'s own choice for you: the parish that fits what the seminary said you were for.', here, 'parochial_vicar', fallback.reasons));
    const cathedral = parishes.find((p) => p.cathedral && p.id !== here?.id);
    if (cathedral) options.push(option(state, 'cathedral', `Parochial vicar at ${cathedral.name}, and the bishop's Masses`, 'The cathedral: the bishop sees you every month, the chancery is across the street, and the rector runs a tight house. Master of ceremonies for the pontifical Masses on top of the parish.', cathedral, 'parochial_vicar', ['The rector asked for a man who can be trusted with the bishop\'s calendar', 'The top of the class is sent where the diocese can see him'], 'cathedral_calendar'));
    const hard = byPrestige(parishes.filter((p) => p.id !== here?.id && !p.cathedral && (p.kind === 'difficult' || (p.needsSpanish && !!state.flags.speaks_spanish)))).reverse()[0];
    if (hard) options.push(option(state, 'hard', `Parochial vicar of ${hard.name}`, hard.needsSpanish && state.flags.speaks_spanish ? 'The parish that needs your Spanish and has nobody. The chancery remembers the men who go where they are needed.' : 'The parish nobody asked for. Two years there are worth five anywhere else in the board\'s memory, and it will cost you.', hard, 'parochial_vicar', ['The vicar for clergy said you could take it', 'The chancery remembers the men who go where they are needed']));
  }

  if (occasion === 'degree') {
    const stl = c.credentials.includes('STL');
    const jcl = c.credentials.includes('JCL');
    const top = byPrestige(parishes.filter((p) => !p.cathedral))[0];
    if (top) options.push(option(state, 'flagship', `Pastor of ${top.name}`, 'The parish the diocese watches. Its pastor is being moved to make room, and everyone will know why.', top, 'pastor', ['A Roman degree is meant to be seen', 'The bishop wants the diocese to know what it has']));
    const middle = byPrestige(parishes.filter((p) => !p.cathedral && p.id !== top?.id)).slice(2, 6);
    const mid = middle.length ? rng.pick(middle) : undefined;
    const office = jcl ? 'tribunal' : 'worship';
    if (mid) options.push(option(state, 'office', `Pastor of ${mid.name}, and ${officeDef(office)!.label.toLowerCase()}`, `${officeDef(office)!.blurb} A smaller parish, so the office has your afternoons.`, mid, 'pastor', ['The degree is for the diocese\'s use, not the parish\'s', 'The chancery has a chair with your name on it'], office));
    if (stl && offerById('pv_seminary_faculty')) options.push({ id: 'faculty', headline: 'A chair at the seminary', blurb: 'Two courses a semester, the seminar, the formation reports. No parish; every future priest of the diocese through your classroom.', assignment: fallback, prestige: 'the presbyterate of the next forty years', time: 'the seminary, all of it', involves: ['The faculty wing, not a rectory', 'Forty men a year who decide what they think of you from the way you walk in', 'The rector, who asked for you'], posting: 'pv_seminary_faculty' });
    else if (jcl) {
      const rural = byPrestige(parishes.filter((p) => p.kind === 'rural' && p.id !== top?.id && p.id !== mid?.id)).reverse()[0];
      if (rural) options.push(option(state, 'dean', `Pastor of ${rural.name}, and dean`, 'A quiet parish and the deanery: the pastors of a dozen parishes look to you first, and the chancery hears what you tell it.', rural, 'pastor', ['The vicar for clergy wants a canonist in that deanery', 'A dean is the chancery\'s face at the table'], 'dean'));
    }
  }

  if (occasion === 'board') {
    if (here) {
      options.push(option(state, 'won', `${fallback.role === 'pastor' ? 'Pastor' : fallback.role === 'administrator' ? 'Administrator' : 'Parochial vicar'} of ${here.name}`, 'What the board decided, on its own.', here, fallback.role, fallback.reasons));
      const office = fallback.role === 'pastor' ? 'vocations' : 'tribunal';
      options.push(option(state, 'won_office', `${fallback.role === 'pastor' ? 'Pastor' : 'Administrator'} of ${here.name}, and ${officeDef(office)!.label.toLowerCase()}`, `${officeDef(office)!.blurb} The bishop asks because the chancery thinks well of you.`, here, fallback.role, [...fallback.reasons, 'The chancery asked for more of you'], office));
    }
    const other = byPrestige(parishes.filter((p) => p.id !== here?.id && !p.cathedral && state.openings.some((o) => o.parishId === p.id && (o.kind === 'pastor' || o.kind === 'administrator'))))[0];
    if (other && fallback.role !== 'parochial_vicar') options.push(option(state, 'other', `${fallback.role === 'pastor' ? 'Pastor' : 'Administrator'} of ${other.name}`, 'The other opening the board would have given you. A different parish, a different problem.', other, fallback.role, ['Open, and the board would take you for it too']));
  }

  if (options.length < 2) return null;
  const why = occasion === 'ordination' ? 'The rector\'s letter was strong enough that the bishop has let you choose.' : occasion === 'degree' ? 'A man comes home from a degree with a choice; the bishop lays three on the desk.' : 'The chancery thinks well enough of you that the bishop asks which you would rather.';
  return { options, why };
}

/** Put the choice in front of the man, or fall back to the single letter. */
export function withChoice(state: GameState, rng: Rng, occasion: Occasion, fallback: Assignment): GameState {
  const choice = buildChoice(state, rng, occasion, fallback);
  if (!choice) return { ...state, assignment: fallback, mode: { kind: 'assignment', assignment: fallback } };
  return { ...state, assignment: fallback, mode: { kind: 'assignment_choice', options: choice.options, why: choice.why } };
}

/** The man chooses: the letter for that post, the office alongside it, or the posting instead. */
export function chooseAssignment(state: GameState, id: string, rng: Rng): GameState {
  if (state.mode.kind !== 'assignment_choice') return state;
  const opt = state.mode.options.find((o) => o.id === id);
  if (!opt) throw new Error('no such option');
  let next: GameState = { ...state, career: [...state.career, { week: state.clock.week, kind: 'assignment', text: `Chose, when the bishop asked: ${opt.headline.toLowerCase()}.` }] };
  if (opt.posting) {
    const def = offerById(opt.posting)!;
    next = { ...next, mode: { kind: 'clock' } };
    return beginStudy({ ...next, assignment: null }, def, false, rng);
  }
  if (opt.office) {
    const o = officeDef(opt.office)!;
    next = { ...next, commitments: [...next.commitments, { offerId: `office:${o.id}`, label: o.label, startWeek: state.clock.week, endWeek: state.clock.week + o.weeks, apPerWeek: o.apPerWeek, failed: false }], flags: { ...next.flags, [o.flag]: true } };
  }
  return { ...next, assignment: opt.assignment, mode: { kind: 'assignment', assignment: opt.assignment } };
}
