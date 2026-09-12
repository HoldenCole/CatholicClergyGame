import type { Assignment, AssignmentOption, GameState, Opening, Parish, Role } from '@/types';
import type { Rng } from '@/engine/rng';
import { letterFor } from '@/engine/career';
import { beginStudy } from '@/engine/study';
import { officeDef } from '@/content/parish';
import { offerById } from '@/content/offers';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { scoreParish } from './assignment';
import { formationStanding, parishPrestige } from './standing';
import { parishKindWord } from './placement';
import { hoursOf } from './week';

/**
 * A strong man is given a choice. At ordination for the top of the class,
 * on return from a degree, and at a board for a man the chancery rates,
 * the bishop lays the assignments on the desk and each says what it is
 * worth, what it takes, and what is involved: the board's own choice, and
 * then one parish of every kind, and every parish that is open, not only
 * the kind the man asked for. Requested in playtesting; numbers invented.
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

/** What each kind of parish is, for a man deciding between them. */
const KIND_BLURB: Record<Parish['kind'], string> = {
  flagship_suburban: 'The parish people have heard of: a big staff, a school, and a pastor who will decide what you are for. The diocese watches who is sent here.',
  struggling_urban: 'Old stone, old families, and a budget that does not close. Nobody is watching, which is its own kind of freedom.',
  immigrant_growing: 'Full at noon in Spanish, thin at eight in English, and a pastor who needs a second priest more than he needs a good one.',
  rural: 'Two churches forty miles apart and a truck. The deanery meets once a quarter and nobody from the chancery has visited in years.',
  difficult: "The parish nobody asked for. Two years there are worth five anywhere else in the board's memory, and it will cost you.",
};

const KIND_REASON: Record<Parish['kind'], string> = {
  flagship_suburban: 'The board sends its strong men where the diocese can see them',
  struggling_urban: 'A city parish needed a priest, and the board had one to spare',
  immigrant_growing: 'The parish is growing faster than its priests',
  rural: 'The country parishes are always short',
  difficult: 'The chancery remembers the men who go where they are needed',
};

const KINDS: Parish['kind'][] = ['flagship_suburban', 'struggling_urban', 'immigrant_growing', 'rural', 'difficult'];

/** The parish of each kind that fits the man best, by the board's own scoring. */
function bestOfEachKind(state: GameState, parishes: Parish[], taken: Set<string>): Parish[] {
  const world = state.world!;
  const out: Parish[] = [];
  for (const kind of KINDS) {
    const pool = parishes.filter((p) => p.kind === kind && !p.cathedral && !taken.has(p.id));
    if (pool.length === 0) continue;
    const best = pool.map((p) => scoreParish(state, world, p)).sort((a, b) => b.score - a.score)[0]!.parish;
    out.push(best);
    taken.add(best.id);
  }
  return out;
}

function kindOption(state: GameState, parish: Parish, role: Role, taken: Set<string>): AssignmentOption {
  const score = scoreParish(state, state.world!, parish);
  const reasons = score.reasons.length ? score.reasons : [KIND_REASON[parish.kind]];
  const spanish = parish.needsSpanish && !!state.flags.speaks_spanish;
  const blurb = spanish ? 'The parish that needs your Spanish and has nobody. The chancery remembers the men who go where they are needed.' : KIND_BLURB[parish.kind];
  taken.add(parish.id);
  const title = role === 'pastor' ? 'Pastor' : role === 'administrator' ? 'Administrator' : 'Parochial vicar';
  return option(state, `kind_${parish.kind}`, `${title} of ${parish.name}`, blurb, parish, role, reasons);
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
    // Then one parish of every kind, not only the kind the seminary said he was for.
    const taken = new Set(options.map((o) => o.assignment.parishId));
    for (const parish of bestOfEachKind(state, parishes, taken)) options.push(kindOption(state, parish, 'parochial_vicar', taken));
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
    // A man home with a degree may still choose an ordinary parish of any kind, as pastor.
    const taken = new Set(options.map((o) => o.assignment.parishId));
    for (const parish of bestOfEachKind(state, parishes, taken)) options.push(kindOption(state, parish, 'pastor', taken));
  }

  if (occasion === 'board') {
    if (here) {
      options.push(option(state, 'won', `${fallback.role === 'pastor' ? 'Pastor' : fallback.role === 'administrator' ? 'Administrator' : 'Parochial vicar'} of ${here.name}`, 'What the board decided, on its own.', here, fallback.role, fallback.reasons));
      const office = fallback.role === 'pastor' ? 'vocations' : 'tribunal';
      options.push(option(state, 'won_office', `${fallback.role === 'pastor' ? 'Pastor' : 'Administrator'} of ${here.name}, and ${officeDef(office)!.label.toLowerCase()}`, `${officeDef(office)!.blurb} The bishop asks because the chancery thinks well of you.`, here, fallback.role, [...fallback.reasons, 'The chancery asked for more of you'], office));
    }
    const taken = new Set(options.map((o) => o.assignment.parishId));
    if (fallback.role !== 'parochial_vicar') {
      // Every parish that is open, not only the one the board would have picked for him.
      const open = byPrestige(parishes.filter((p) => !taken.has(p.id) && !p.cathedral && state.openings.some((o) => o.parishId === p.id && (o.kind === 'pastor' || o.kind === 'administrator'))));
      for (const other of open) {
        taken.add(other.id);
        options.push(option(state, `open_${other.id}`, `${fallback.role === 'pastor' ? 'Pastor' : 'Administrator'} of ${other.name}`, `${KIND_BLURB[other.kind]} Open, and the board would take you for it.`, other, fallback.role, ['Open, and the board would take you for it too', KIND_REASON[other.kind]]));
      }
    } else {
      for (const parish of bestOfEachKind(state, parishes, taken)) options.push(kindOption(state, parish, 'parochial_vicar', taken));
    }
  }

  if (options.length < 2) return null;
  const why = occasion === 'ordination' ? 'The rector\'s letter was strong enough that the bishop has let you choose, and he has laid out one parish of every kind.' : occasion === 'degree' ? 'A man comes home from a degree with a choice; the bishop lays the diocese on the desk.' : 'The chancery thinks well enough of you that the bishop asks which you would rather, of everything that is open.';
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
