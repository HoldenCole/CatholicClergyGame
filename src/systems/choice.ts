import type { Assignment, AssignmentOption, GameState, Opening, Parish, Role } from '@/types';
import type { Rng } from '@/engine/rng';
import { CAREER, letterFor } from '@/engine/career';
import { holdsOrHeld } from './offices';
import { beginStudy } from '@/engine/study';
import { officeDef } from '@/content/parish';
import { offerById } from '@/content/offers';
import { studyProgram } from '@/content/study';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { scoreParish } from './assignment';
import { hasInterest, INTERESTS, parishInterest } from './interests';
import { formationStanding, parishPrestige } from './standing';
import { parishKindWord } from './placement';
import { clearRequestAnswer, closeRequest, refuseRequestedMove, requestOf, roleForRequest } from './request';
import { moveOut } from '@/engine/career';

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
  return o ? `the parish, and ${o.label.toLowerCase()} beside it` : 'the parish, and nothing else';
}

function involvesOf(parish: Parish, role: Role): string[] {
  const out = [`${parishKindWord(parish)}, about ${parish.households.toLocaleString()} households, ${parish.generational}${parish.school === 'none' ? ', no school' : `, a school ${parish.school.replace('_', ' ')}`}`];
  out.push(PROBLEM_LABEL[parish.problem] ?? parish.problem);
  if (parish.needsSpanish) out.push('Spanish is needed');
  if (parish.debt > 0) out.push(`$${parish.debt.toLocaleString()} of debt${role === 'pastor' ? ', yours to carry' : ''}`);
  return out;
}

export function assignmentTo(state: GameState, parish: Parish, role: Role, reasons: string[]): Assignment {
  return assignmentFor(state, parish, role, reasons);
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

/** The postings an interest can turn into an ordination option. The seminary faculty is not one: it wants a degree first. */
export const ORDINATION_POSTINGS: { id: string; interest: string; offer: string; needsFlag?: string; headline: string; blurb: string; prestige: string; time: string; involves: string[] }[] = [
  { id: 'hospital', interest: 'hospital', offer: 'pv_hospital_chaplain', headline: 'The hospital, as its chaplain', blurb: 'The director of pastoral care asked the bishop for a priest by name, and the name was yours. Unusual for a man just ordained; the pager does not know that. No parish: the chaplains\' quarters, the wards, and the room where families are told things.', prestige: 'the diocese trusts the man it sends to the dying', time: 'the hospital, all of it', involves: ['The pager, every night it rings', 'The wards, the chapel, and the confessions nobody else hears', 'A parish when the years end, with the book in your file'] },
  { id: 'newman', interest: 'newman', offer: 'pv_university_chaplain', headline: 'The Newman Center', blurb: 'Campus ministry asked for a young priest and you asked for campus ministry. Sunday night Mass, the discussion series, and a door that is never locked. No parish; the students are the parish.', prestige: 'the vocations of the next ten years come through that chapel', time: 'the campus, all of it', involves: ['Ninety students and a guitar', 'Every question, and the ones who leave the Church leave from your chapel', 'A parish when the years end'] },
  { id: 'canon_law', interest: 'canon_law', offer: 'pv_canon_law_licentiate', headline: 'Washington, for canon law', blurb: 'The judicial vicar keeps a list and you were on it before you were ordained. Two years at the Catholic University for the licentiate, and the tribunal after. No parish yet; the parish comes home with the degree.', prestige: 'a canonist is the chancery\'s to use, and it uses him', time: 'Washington, all of it', involves: ['Seminars in canon law', 'The tribunal internship, every marriage in the city in paper', 'A parish when you come home, chosen with the degree in hand'] },
  { id: 'secretary', interest: 'secretary', offer: 'pv_bishops_secretary', needsFlag: 'noticed_by_bishop', headline: 'The bishop\'s secretary', blurb: 'He noticed you in the seminary and you told the chancery you would do it. The calendar, the car, the phone, and the bishop\'s mind from the next chair. No parish; the residence, for three years.', prestige: 'every priest of the diocese learns your name in a month', time: 'the residence, all of it', involves: ['The calendar, and who gets ten minutes', 'The car, and what he says in it', 'A parish when he lets you go, and the chancery\'s regard with it'] },
];

/** Years in a parish before the years away: the board counts them toward a pastorate, not the years at a desk in Rome. */
export function parishYears(state: GameState): number {
  const ordained = Math.max(0, state.clock.week - Number(state.flags.ordination_week ?? state.clock.week));
  const away = (state.tenures ?? []).filter((t) => t.kind === 'away').reduce((n, t) => n + Math.max(0, t.endWeek - t.startWeek), 0);
  return Math.max(0, ordained - away) / 52;
}

/** The parish the diocese watches: where a man home with a degree is sent when nothing else is chosen. */
export function flagshipFor(state: GameState): Parish | undefined {
  return byPrestige((state.world?.parishes ?? []).filter((p) => !p.cathedral))[0];
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
    // The parish he asked for, when his record earns a hearing or nobody else wants it.
    const asked = parishInterest(state);
    const askedParish = asked ? parishes.find((p) => p.id === asked && p.id !== here?.id && !p.cathedral) : undefined;
    if (askedParish && (formationStanding(state).value >= CHOICE.ordinationStanding - INTERESTS.parishSlack || askedParish.kind === 'difficult' || askedParish.kind === 'rural')) {
      options.push(option(state, 'asked', `Parochial vicar of ${askedParish.name}`, 'The parish you told the chancery you wanted. The board heard, and would rather send a man where he asked to go than argue with him about it.', askedParish, 'parochial_vicar', ['You asked for it, and the record was good enough to be heard']));
    }
    // Rome straight from ordination, for the top of the class who asked for it.
    if (hasInterest(state, 'rome') && (formationStanding(state).value >= CHOICE.ordinationStanding || !!state.flags.rome_track) && offerById('pv_rome_study')) {
      options.push({ id: 'rome', headline: 'Rome, for the licentiate', blurb: 'The Gregorian, three years, and the North American College. You asked, the rector agreed, and the bishop would rather send a man who wants it than one who does not. No parish yet; the parish comes home with you.', assignment: fallback, prestige: 'the diocese watches who is sent to Rome', time: 'Rome, all of it', involves: ['Lectures in Italian', 'A thesis, and the Curia across the river', 'A parish when you come home, chosen with the degree in hand'], posting: 'pv_rome_study' });
    }
    // The posts he asked for, straight from ordination, for a man whose record earned the choice: the hospital,
    // the Newman Center, canon law in Washington, and the bishop's own desk when the bishop already knows him.
    for (const post of ORDINATION_POSTINGS) {
      if (!hasInterest(state, post.interest) || !offerById(post.offer)) continue;
      if (post.needsFlag && !state.flags[post.needsFlag]) continue;
      options.push({ id: post.id, headline: post.headline, blurb: post.blurb, assignment: fallback, prestige: post.prestige, time: post.time, involves: post.involves, posting: post.offer });
    }
    // Then one parish of every kind, not only the kind the seminary said he was for.
    const taken = new Set(options.map((o) => o.assignment.parishId));
    for (const parish of bestOfEachKind(state, parishes, taken)) options.push(kindOption(state, parish, 'parochial_vicar', taken));
  }

  if (occasion === 'degree') {
    // Home from Rome or Washington: the top of the diocese, and nothing below it. A man with the years is made
    // pastor of the parish the diocese watches; a man sent straight from the seminary is its vicar for a term, or the
    // cathedral's; either may take a good parish with a chancery office, the seminary's chair with a licentiate in
    // theology, the tribunal with one in canon law, or the bishop's own desk. Requested in playtesting.
    const stl = c.credentials.includes('STL');
    const jcl = c.credentials.includes('JCL');
    const experienced = parishYears(state) >= CAREER.minYearsForPastor;
    const ranked = byPrestige(parishes.filter((p) => !p.cathedral));
    const top = ranked[0];
    const cathedral = parishes.find((p) => p.cathedral);
    if (top) {
      if (experienced) options.push(option(state, 'flagship', `Pastor of ${top.name}`, 'The parish the diocese watches. Its pastor is being moved to make room, and everyone will know why.', top, 'pastor', ['A Roman degree is meant to be seen', 'The bishop wants the diocese to know what it has']));
      else options.push(option(state, 'flagship', `Parochial vicar of ${top.name}, for a term`, 'The parish the diocese watches, and a pastor who has been told to show you everything. A vicar for a few years, because the canons want the years; a pastorate after, because the degree wants it.', top, 'parochial_vicar', ['A Roman degree is meant to be seen', 'The years for a pastorate are not there yet; the board will not wait long']));
    }
    if (cathedral && !experienced) options.push(option(state, 'cathedral', `Parochial vicar at ${cathedral.name}, and the bishop's Masses`, 'The cathedral: the bishop sees you every month, the chancery is across the street, and the rector runs a tight house. Master of ceremonies for the pontifical Masses on top of the parish.', cathedral, 'parochial_vicar', ['The rector asked for the man home from Rome', 'The bishop wants him where the diocese can see him'], 'cathedral_calendar'));
    const goodOnes = ranked.slice(1, 5).filter((p) => p.kind !== 'rural' && p.kind !== 'difficult' && p.id !== top?.id);
    const good = goodOnes.length ? rng.pick(goodOnes) : undefined;
    const office = jcl ? 'tribunal' : 'worship';
    if (good && !holdsOrHeld(state, office)) options.push(option(state, 'office', `${experienced ? 'Pastor' : 'Parochial vicar'} of ${good.name}, and ${officeDef(office)!.label.toLowerCase()}`, `${officeDef(office)!.blurb} A good parish, so the office has your afternoons.`, good, experienced ? 'pastor' : 'parochial_vicar', ['The degree is for the diocese\'s use, not the parish\'s', 'The chancery has a chair with your name on it'], office));
    if (stl && offerById('pv_seminary_faculty')) options.push({ id: 'faculty', headline: 'A chair at the seminary', blurb: 'Two courses a semester, the seminar, the formation reports. No parish; every future priest of the diocese through your classroom.', assignment: fallback, prestige: 'the presbyterate of the next forty years', time: 'the seminary, all of it', involves: ['The faculty wing, not a rectory', 'Forty men a year who decide what they think of you from the way you walk in', 'The rector, who asked for you'], posting: 'pv_seminary_faculty' });
    if (offerById('pv_bishops_secretary') && !state.flags['office:bishops_secretary'] && !state.flags['held:office:bishops_secretary']) options.push({ id: 'secretary', headline: 'The bishop\'s secretary', blurb: 'He wants the man with the degree at the next desk: the calendar, the car, the phone, and his mind from the next chair. No parish; the residence, for three years, and the chancery\'s regard after.', assignment: fallback, prestige: 'every priest of the diocese learns your name in a month', time: 'the residence, all of it', involves: ['The calendar, and who gets ten minutes', 'The car, and what he says in it', 'A parish when he lets you go, and the chancery\'s regard with it'], posting: 'pv_bishops_secretary' });
    if (jcl && experienced) {
      const deanParish = ranked.slice(1, 8).find((p) => p.kind !== 'rural' && p.kind !== 'difficult' && !options.some((o) => o.assignment.parishId === p.id));
      if (deanParish && !holdsOrHeld(state, 'dean')) options.push(option(state, 'dean', `Pastor of ${deanParish.name}, and dean`, 'A good parish and the deanery: the pastors of a dozen parishes look to you first, and the chancery hears what you tell it.', deanParish, 'pastor', ['The vicar for clergy wants a canonist in that deanery', 'A dean is the chancery\'s face at the table'], 'dean'));
    }
  }

  if (occasion === 'board') {
    if (here) {
      options.push(option(state, 'won', `${fallback.role === 'pastor' ? 'Pastor' : fallback.role === 'administrator' ? 'Administrator' : 'Parochial vicar'} of ${here.name}`, 'What the board decided, on its own.', here, fallback.role, fallback.reasons));
      const office = ['vocations', 'tribunal', 'worship'].filter((o) => !holdsOrHeld(state, o))[fallback.role === 'pastor' ? 0 : 1] ?? ['vocations', 'tribunal', 'worship'].find((o) => !holdsOrHeld(state, o));
      if (office) options.push(option(state, 'won_office', `${fallback.role === 'pastor' ? 'Pastor' : 'Administrator'} of ${here.name}, and ${officeDef(office)!.label.toLowerCase()}`, `${officeDef(office)!.blurb} The bishop asks because the chancery thinks well of you.`, here, fallback.role, [...fallback.reasons, 'The chancery asked for more of you'], office));
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


/**
 * The answer to a letter. DESIGN §7.6: the vicar for clergy has acted on the
 * request, and the post the man asked for is laid on the desk beside the post
 * he holds. He may stay, and staying costs, because he asked.
 */
export function requestedChoice(state: GameState): { options: AssignmentOption[]; why: string } | null {
  const r = requestOf(state);
  const world = state.world;
  const here = world?.parishes.find((p) => p.id === state.parish?.parishId);
  if (!r || !world || !here || !state.assignment) return null;
  const options: AssignmentOption[] = [];

  if (r.target.kind === 'parish') {
    const wanted = r.target.parishId;
    const parish = world.parishes.find((p) => p.id === wanted);
    if (!parish || parish.id === here.id) return null;
    const role = roleForRequest(state, parish);
    const title = role === 'pastor' ? 'Pastor' : role === 'administrator' ? 'Administrator' : 'Parochial vicar';
    const opt = option(
      state,
      'requested',
      `${title} of ${parish.name}`,
      `The parish you wrote about. The vicar for clergy found a way, which means somebody else was moved to make the room, and both of you know it.`,
      parish,
      role,
      ['You asked for this one by name', role === 'parochial_vicar' ? 'The canons want the years before a pastorate; the parish is yours as its vicar until they are there' : 'The board would rather send a man where he asked to go'],
    );
    options.push({ ...opt, requested: 'go' });
  } else {
    const def = offerById(r.target.offerId);
    const program = def?.accept.commitment?.away ? studyProgram(def.accept.commitment.away) : undefined;
    if (!def || !program) return null;
    const years = Math.round((def.accept.commitment?.weeks ?? 156) / 52);
    options.push({
      id: 'requested',
      headline: program.label,
      blurb: `The posting you wrote about, and the bishop has agreed to it. ${program.residence.charAt(0).toUpperCase()}${program.residence.slice(1)}, ${years} year${years === 1 ? '' : 's'}, and no parish of your own until it ends.`,
      assignment: state.assignment,
      prestige: 'the diocese reads a man by what it lets him leave a parish for',
      time: `${program.residence}, all of it`,
      involves: [program.classes, `You asked for it, which the chancery has written down`, 'A parish again when the years end'],
      posting: def.id,
      requested: 'go',
    });
  }

  options.push({
    id: 'stay',
    headline: `Stay at ${here.name}`,
    blurb: 'Write back and say that on reflection you are needed here. It is allowed, it is done, and it is remembered: you asked, the chancery moved, and you said no.',
    assignment: state.assignment,
    prestige: 'nothing changes, which is its own answer',
    time: 'the parish, as before',
    involves: ['The work you are in the middle of stays yours', 'The chancery marks the file', 'You may write again, and the next letter is read more slowly'],
    requested: 'stay',
  });
  return { options, why: `You wrote to the vicar for clergy about ${r.label}, and he has answered. The bishop will sign either letter.` };
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
  // The answer to his own letter: staying is a refusal, and going closes the post he is in. DESIGN §7.6.
  if (opt.requested === 'stay') return { ...refuseRequestedMove(state), mode: { kind: 'clock' } };
  let next: GameState = { ...state, career: [...state.career, { week: state.clock.week, kind: 'assignment', text: `Chose, when the bishop asked: ${opt.headline.toLowerCase()}.` }] };
  if (opt.requested === 'go') next = closeRequest(clearRequestAnswer(next), 'granted');
  if (opt.posting) {
    const def = offerById(opt.posting)!;
    next = { ...next, mode: { kind: 'clock' } };
    // A man still in a parish keeps his letter until beginStudy closes the tenure with it; at a
    // board or at ordination the post is already closed and the assignment is only in the way.
    return beginStudy({ ...next, assignment: next.parish ? next.assignment : null }, def, false, rng);
  }
  // A move he asked for happens in the middle of an arc: the post he holds must be closed first.
  if (opt.requested === 'go' && next.parish) {
    next = moveOut(next, rng, 'moved at your own asking');
    next = { ...next, parish: null, founding: null, project: null, projects: [], flags: { ...next.flags, transfers: Number(next.flags.transfers ?? 0) + 1 } };
  }
  if (opt.office && !holdsOrHeld(next, opt.office)) {
    const o = officeDef(opt.office)!;
    next = { ...next, commitments: [...next.commitments, { offerId: `office:${o.id}`, label: o.label, startWeek: state.clock.week, endWeek: state.clock.week + o.weeks, apPerWeek: o.apPerWeek, failed: false }], flags: { ...next.flags, [o.flag]: true } };
  }
  return { ...next, assignment: opt.assignment, mode: { kind: 'assignment', assignment: opt.assignment } };
}
