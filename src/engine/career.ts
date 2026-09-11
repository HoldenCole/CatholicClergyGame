import type { Assignment, Decision, GameState, Opening } from '@/types';
import type { Rng } from './rng';
import { decide } from '@/systems/promotion';
import { openingBlurb, playerCandidate, refreshOpenings, rivalsFor } from '@/systems/openings';
import { advanceTrajectories, rollTrajectories } from '@/systems/trajectories';
import { driftRome, successionYear } from '@/systems/succession';
import { handoffProject } from '@/systems/projects';
import { ARC } from './parish';
import { renderText } from './text';
import { deliverLetter, yearInReview } from '@/systems/review';
import { closeTenure } from '@/systems/tenures';
import { seeYear } from './see';

/** Invented. DESIGN 7.3: retirement letters go in at 75 and are often not accepted for years. */
export const CAREER = {
  retirementAge: 75,
  retirementAcceptedPerYear: 0.4,
  forcedRetirementAge: 80,
  deathPerYearOver65: 0.012,
  /** Years ordained before the board considers a man for a pastorate at all. */
  minYearsForPastor: 3,
  /** When the board has nothing better, a pastor is renewed where he is this often; otherwise moved as pastor. Invented. */
  pastorStaysChance: 0.6,
  pastorTermYears: 6,
} as const;

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

export function playerAge(state: GameState): number {
  const c = state.character!;
  return calendarYear(state) - (c.entryYear - c.background.entryAge);
}

export function yearsOrdained(state: GameState): number {
  const at = Number(state.flags.ordination_week ?? state.clock.week);
  return (state.clock.week - at) / 52;
}

function addDigest(state: GameState, lines: string[]): GameState {
  if (lines.length === 0) return state;
  const last = state.digest[state.digest.length - 1];
  if (last && last.week === state.clock.week) return { ...state, digest: [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, ...lines] }] };
  return { ...state, digest: [...state.digest, { week: state.clock.week, lines }] };
}

function note(state: GameState, kind: GameState['career'][number]['kind'], text: string): GameState {
  return { ...state, career: [...state.career, { week: state.clock.week, kind, text }] };
}

/** Whether this week is an anniversary of ordination. */
export function isCareerYear(state: GameState): boolean {
  const at = state.flags.ordination_week;
  if (typeof at !== 'number') return false;
  const weeks = state.clock.week - at;
  return weeks > 0 && weeks % 52 === 0;
}

/**
 * Once a year after ordination: Rome drifts, the see may change hands,
 * classmates move, pastors retire and parishes open, and age catches up.
 */
export function careerYear(state: GameState, rng: Rng): GameState {
  let next = driftRome(state, rng.derive(`rome:${state.clock.week}`));
  const years = Math.round(yearsOrdained(next));

  const succession = next.see ? { state: next, newBishop: null, lines: [] as string[], letter: undefined } : successionYear(next, rng.derive(`succession:${state.clock.week}`));
  next = succession.state;
  if (succession.newBishop) {
    next = addDigest(next, succession.lines);
    next = note(next, 'succession', succession.lines.join(' '));
    next = { ...next, flags: { ...next.flags, new_bishop_pending: true }, beats: [...next.beats, { kind: 'succession', week: next.clock.week, label: 'A new bishop' }] };
    if (succession.letter) next = deliverLetter(next, succession.letter);
  }

  const traj = advanceTrajectories(next, years);
  next = addDigest(traj.state, traj.lines);
  for (const line of traj.lines) next = note(next, 'note', line);

  const openings = refreshOpenings(next, rng.derive(`openings:${state.clock.week}`));
  next = addDigest(openings.state, openings.lines);

  // A pastor's six-year term, renewed without ceremony unless content says otherwise. DESIGN §8.1
  if (next.assignment?.role === 'pastor' && next.parish && next.parish.weeksServed >= CAREER.pastorTermYears * 52 && !next.flags.term_renewed) {
    next = { ...next, flags: { ...next.flags, term_renewed: true } };
    next = addDigest(note(next, 'note', 'Renewed for a second term as pastor.'), ['A letter from the chancery: your term as pastor is renewed for six years. No one asked you.']);
  }
  // The year in review: a letter the man must read before the clock moves on. Not while he is being moved.
  if (next.see) {
    const year = seeYear(next, rng.derive(`see-year:${state.clock.week}`));
    next = deliverLetter(year.state, year.letter);
    next = addDigest(next, [year.state.see!.years[year.state.see!.years.length - 1]!]);
  } else if (next.mode.kind === 'clock' || next.mode.kind === 'letter') {
    const review = yearInReview(next);
    next = deliverLetter({ ...next, reviewBaseline: review.baseline }, review.letter);
  }
  const age = playerAge(next);
  if (age >= CAREER.retirementAge) {
    const accepted = age >= CAREER.forcedRetirementAge || rng.chance(CAREER.retirementAcceptedPerYear);
    if (!next.flags.retirement_letter) {
      next = { ...next, flags: { ...next.flags, retirement_letter: true } };
      next = addDigest(next, ['Your letter of resignation went to the bishop, as canon law requires at seventy-five. He has not answered.']);
    }
    if (accepted) return retire(next);
  }
  if (age >= 65 && rng.chance(CAREER.deathPerYearOver65 * (age - 60) / 5)) return die(next);
  return next;
}

export function retire(state: GameState): GameState {
  return {
    ...closeTenure(state, 'retired'),
    speed: 'PAUSED',
    mode: { kind: 'ended', ending: 'retired', summary: careerSummary(state, 'retired') },
  };
}

export function die(state: GameState): GameState {
  return {
    ...closeTenure(state, 'died in harness'),
    speed: 'PAUSED',
    mode: { kind: 'ended', ending: 'died', summary: careerSummary(state, 'died') },
  };
}

/** The personnel board considers the player against the openings when his arc ends. DESIGN 7.1 */
export function boardDecision(state: GameState, rng: Rng): { decisions: Decision[]; won: Decision | null } {
  const me = playerCandidate(state);
  const bishop = state.world!.diocese.hidden.bishop;
  const need = Math.min(100, state.world!.diocese.hidden.shortage * 20);
  const eligible = state.openings.filter((o) => o.kind !== 'parochial_vicar' && (o.kind !== 'pastor' || me.yearsOrdained >= CAREER.minYearsForPastor));
  const decisions = eligible.map((opening) => decide(opening, [me, ...rivalsFor(state, opening, rng.derive(`rivals:${opening.id}`))], bishop, Math.max(need, opening.urgency), rng.derive(`decide:${opening.id}`)));
  const wins = decisions.filter((d) => d.winner.isPlayer).sort((a, b) => (b.opening.parishId ? 1 : 0) - (a.opening.parishId ? 1 : 0) || b.opening.urgency - a.opening.urgency);
  return { decisions, won: wins[0] ?? null };
}

function letterFor(state: GameState, opening: Opening, role: Assignment['role']): string {
  const c = state.character!;
  const bishop = state.npcs[state.world!.diocese.hidden.bishop.npcId];
  const parish = opening.parishId ? state.world!.parishes.find((p) => p.id === opening.parishId) : undefined;
  const post = role === 'pastor' ? 'Pastor' : role === 'administrator' ? 'Administrator' : 'Parochial Vicar';
  const where = parish ? `${parish.name} Parish, ${parish.place}` : opening.label;
  return (
    `Dear Father ${c.name.last},\n\n` +
    `Having consulted the Personnel Board, I hereby appoint you ${post} of ${where}, effective the first of the month` +
    (role === 'pastor' ? `, for a term of ${CAREER.pastorTermYears} years, renewable` : '') +
    `. I am grateful for your service and confident of your generosity in this new charge.\n\n` +
    `Assuring you of my prayers, I remain,\n\nSincerely yours in Christ,\n${bishop ? `${bishop.title} ${bishop.name.first} ${bishop.name.last}` : 'The Bishop'}`
  );
}

/**
 * The arc ends. The board decides; the player either wins an opening or is
 * given another vicar posting, and either way can trace the decision.
 */
export function nextAssignment(state: GameState, rng: Rng): { state: GameState; decisions: Decision[] } {
  const { decisions, won } = boardDecision(state, rng);
  let next = closeTenure(state, state.study ? 'the years ended' : won ? (won.opening.kind === 'pastor' ? 'appointed pastor elsewhere' : 'moved by the board') : 'moved by the board');
  next = handoffProject(next, rng.derive(`handoff:${state.clock.week}`)).state;
  next = leaveCollapse(next);
  const c = next.character!;
  const carried = Math.round(c.reputation.parishioners * ARC.parishionersCarryover);
  next = { ...next, character: { ...c, reputation: { ...c.reputation, parishioners: carried } } };

  let assignment: Assignment;
  if (won) {
    const role = won.opening.kind === 'chancery' ? 'administrator' : won.opening.kind;
    const parishId = won.opening.parishId ?? next.parish?.parishId ?? next.world!.parishes[0]!.id;
    assignment = { parishId, role, startWeek: next.clock.week, letter: letterFor(next, won.opening, role), reasons: won.reasons };
    next = { ...next, openings: next.openings.filter((o) => o.id !== won.opening.id) };
    next = note(next, 'promotion', `Appointed ${role.replace('_', ' ')} of ${openingBlurb(next, won.opening).split(':')[0]}. ${won.reasons.slice(0, 2).join('; ')}.`);
  } else if ((state.assignment?.role === 'pastor' || state.assignment?.role === 'administrator') && next.parish) {
    // A pastor is never sent back as a vicar: he is renewed where he is, or moved as pastor.
    const role = state.assignment.role;
    const here = next.world!.parishes.find((p) => p.id === next.parish!.parishId)!;
    const stay = rng.derive(`renew:${next.clock.week}`).chance(CAREER.pastorStaysChance);
    const others = next.world!.parishes.filter((p) => p.id !== here.id);
    const parish = stay || others.length === 0 ? here : rng.derive(`lateral:${next.clock.week}`).weighted(others, (p) => 10 + (p.needsSpanish && next.flags.speaks_spanish ? 20 : 0) + (p.kind === 'difficult' ? 8 : 0));
    const opening: Opening = { id: `${role}_${next.clock.week}`, kind: role === 'pastor' ? 'pastor' : 'administrator', parishId: parish.id, urgency: 50, needsSpanish: parish.needsSpanish, needsAdmin: false, alignment: parish.alignment, week: next.clock.week, label: `${role === 'pastor' ? 'Pastor' : 'Administrator'} of ${parish.name}` };
    const lost = decisions.find((d) => d.opening.parishId) ?? decisions[0];
    const reasons = parish.id === here.id ? ['Renewed where you are; the board saw no reason to move a pastor who is holding a parish'] : (lost ? lost.reasons : ['A pastor is moved as a pastor, and this parish needed one']);
    assignment = { parishId: parish.id, role, startWeek: next.clock.week, letter: letterFor(next, opening, role), reasons };
    if (lost && parish.id !== here.id) {
      next = note(next, 'passed_over', `Passed over for ${openingBlurb(next, lost.opening).split(':')[0]}: ${lost.reasons.slice(0, 2).join('; ')}.`);
      next = { ...next, flags: { ...next.flags, passed_over: true } };
    }
    next = note(next, 'assignment', parish.id === here.id ? `Renewed as ${role} of ${here.name} for another term.` : `Moved as ${role} to ${parish.name}, ${parish.place}.`);
  } else {
    // Another vicar posting: a parish other than the current one, weighted by need.
    // A man who told the chancery he would take the hard parish gets it (offer content sets the flag).
    const others = next.world!.parishes.filter((p) => p.id !== next.parish?.parishId);
    const hard = next.flags.took_the_hard_parish && !next.flags.hard_parish_honored ? others.find((p) => p.kind === 'difficult') : undefined;
    const parish = hard ?? rng.derive(`posting:${next.clock.week}`).weighted(others, (p) => 10 + (p.needsSpanish && next.flags.speaks_spanish ? 20 : 0));
    if (hard) next = { ...next, flags: { ...next.flags, hard_parish_honored: true } };
    const opening: Opening = { id: `vicar_${next.clock.week}`, kind: 'parochial_vicar', parishId: parish.id, urgency: 50, needsSpanish: parish.needsSpanish, needsAdmin: false, alignment: parish.alignment, week: next.clock.week, label: `Parochial Vicar of ${parish.name}` };
    const lost = decisions.find((d) => d.opening.parishId) ?? decisions[0];
    const reasons = lost ? lost.reasons : ['The board had nothing else for you this year'];
    assignment = { parishId: parish.id, role: 'parochial_vicar', startWeek: next.clock.week, letter: letterFor(next, opening, 'parochial_vicar'), reasons };
    if (lost) {
      next = note(next, 'passed_over', `Passed over for ${openingBlurb(next, lost.opening).split(':')[0]}: ${lost.reasons.slice(0, 2).join('; ')}.`);
      next = { ...next, flags: { ...next.flags, passed_over: true } };
    }
    next = note(next, 'assignment', `Sent as parochial vicar to ${parish.name}, ${parish.place}.`);
  }
  return {
    state: { ...next, assignment, parish: null, founding: null, project: null, projects: [], mode: { kind: 'assignment', assignment }, flags: { ...next.flags, transfers: Number(next.flags.transfers ?? 0) + 1 } },
    decisions,
  };
}

/** At ordination: classmates get futures and the record opens. */
export function beginCareer(state: GameState, rng: Rng): GameState {
  let next = rollTrajectories(state, rng.derive('trajectories'));
  next = { ...next, romeTemperament: Math.round(rng.derive('rome').gaussian() * 30) };
  const age = playerAge(next);
  // DESIGN §7.2: the maturity curve is read by content as well as by the board.
  next = { ...next, flags: { ...next.flags, ...(age >= 32 ? { ordained_late: true } : {}), ...(age < 30 ? { ordained_young: true } : {}) } };
  next = { ...next, reviewBaseline: { week: next.clock.week, reputation: { ...next.character!.reputation }, stats: { ...next.character!.stats }, strain: next.strain ?? 0 } };
  return note(next, 'note', `Ordained at ${age} for ${next.world?.diocese.visible.name ?? 'the diocese'}.`);
}

/** DESIGN §4.3: a parish that depended on a charismatic man personally collapses a little when he leaves. */
export const COLLAPSE = { charisma: 70, support: 40, households: 0.08, collections: 0.1 } as const;

function leaveCollapse(state: GameState): GameState {
  const c = state.character;
  const pid = state.parish?.parishId;
  if (!c || !pid || !state.world) return state;
  if (c.stats.charisma < COLLAPSE.charisma || c.reputation.parishioners < COLLAPSE.support) return state;
  const parishes = state.world.parishes.map((p) =>
    p.id === pid ? { ...p, households: Math.round(p.households * (1 - COLLAPSE.households)), weeklyCollections: Math.round(p.weeklyCollections * (1 - COLLAPSE.collections)) } : p,
  );
  const name = state.world.parishes.find((p) => p.id === pid)?.name ?? 'the parish';
  return note({ ...state, world: { ...state.world, parishes }, flags: { ...state.flags, left_a_collapse: true } }, 'note', `${name} was yours in a way a parish should not be; the pews thin after you go.`);
}

/** DESIGN 15: a career summary that reads like a life rather than a score. */
export function careerSummary(state: GameState, ending: 'retired' | 'died' | 'left_priesthood'): string {
  const c = state.character!;
  const age = playerAge(state);
  const years = Math.floor(yearsOrdained(state));
  const entries = state.career;
  const promotions = entries.filter((e) => e.kind === 'promotion').length;
  const passed = entries.filter((e) => e.kind === 'passed_over').length;
  const successions = entries.filter((e) => e.kind === 'succession').length;
  const founded = Object.values(state.groups).filter((g) => g.foundedByPlayer).length;
  const publicPositions = c.positions.filter((p) => p.volume === 'public').length;
  const classmates = Object.values(state.npcs).filter((n) => n.role === 'classmate');
  const opening =
    ending === 'retired' ? `You retired at ${age}, ${years} years a priest.` :
    ending === 'died' ? `You died at ${age}, ${years} years a priest, ${state.assignment?.role === 'pastor' ? 'still pastor' : 'still in harness'}.` :
    `You left the priesthood at ${age}, after ${years} years.`;
  const see = state.see;
  const arc =
    see ? `You were named Bishop of ${see.see} and held ${see.name} for ${Math.max(1, Math.round((state.clock.week - see.installedWeek) / 52))} years: ${see.ordinations} ordained, ${see.closings} parish${see.closings === 1 ? '' : 'es'} closed, the priests ${see.presbyterate >= 20 ? 'with you' : see.presbyterate <= -20 ? 'against you' : 'watching'} at the end.` :
    promotions === 0 ? 'You were never made a pastor.' :
    `You were appointed ${promotions === 1 ? 'once' : `${promotions} times`}${passed ? ` and passed over ${passed === 1 ? 'once' : `${passed} times`}` : ''}.`;
  const bishops = successions === 0 ? 'You served one bishop.' : `You served ${successions + 1} bishops, and each read you differently.`;
  const record = publicPositions === 0 ? 'Nothing you said is on the record.' : `${publicPositions} things you said are on the record, and will stay there.`;
  const legacy = founded === 0 ? '' : ` You founded ${founded === 1 ? 'a group' : `${founded} groups`}; some of them outlived your leaving.`;
  const cohort = classmates.length
    ? ` Of the ${classmates.length} men you entered with, ${classmates.filter((n) => n.status === 'left').length} left, ${classmates.filter((n) => n.status === 'dead').length} died, and ${classmates.filter((n) => n.tags.includes('chancery')).length} ended in the chancery.`
    : '';
  const lines = entries.filter((e) => e.kind !== 'note').slice(-6).map((e) => renderText(e.text, state));
  return [opening, arc, bishops, record + legacy + cohort, '', ...lines].join('\n');
}

/**
 * A transfer the man said yes to (an offer's `transfer` effect): the bishop
 * moves him now, to a parish of the kind named, other than his own.
 */
export function directedTransfer(state: GameState, rng: Rng, kind: string, role: Assignment['role']): { state: GameState; moved: boolean } {
  if (!state.world) return { state, moved: false };
  let next = closeTenure(state, "moved at the bishop's asking");
  next = handoffProject(next, rng.derive(`handoff:${state.clock.week}`)).state;
  next = leaveCollapse(next);
  const c = next.character!;
  const carried = Math.round(c.reputation.parishioners * ARC.parishionersCarryover);
  next = { ...next, character: { ...c, reputation: { ...c.reputation, parishioners: carried } } };
  const others = next.world!.parishes.filter((p) => p.id !== next.parish?.parishId);
  const parish = others.find((p) => p.kind === kind) ?? rng.derive(`directed:${next.clock.week}`).pick(others);
  const opening: Opening = { id: `directed_${next.clock.week}`, kind: role === 'pastor' ? 'pastor' : role === 'administrator' ? 'administrator' : 'parochial_vicar', parishId: parish.id, urgency: 70, needsSpanish: parish.needsSpanish, needsAdmin: false, alignment: parish.alignment, week: next.clock.week, label: `${parish.name}, ${parish.place}` };
  const assignment: Assignment = { parishId: parish.id, role, startWeek: next.clock.week, letter: letterFor(next, opening, role), reasons: ['You said yes when the vicar for clergy asked', 'Nobody else had'] };
  next = note(next, 'assignment', `Sent as ${role.replace('_', ' ')} to ${parish.name}, ${parish.place}, at the bishop's asking.`);
  const flags: GameState['flags'] = { ...next.flags, transfers: Number(next.flags.transfers ?? 0) + 1, hard_parish_honored: true };
  delete flags.transfer_pending;
  return {
    state: { ...next, assignment, parish: null, founding: null, project: null, projects: [], mode: { kind: 'assignment', assignment }, flags },
    moved: true,
  };
}
