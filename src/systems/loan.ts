import type { Assignment, GameState, Letter, LoanKind, LoanState, MetropoliaSee, Npc, Parish, Role, SeeLoan, World } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { generateSeeWorld } from '@/engine/seeWorld';
import { moveOut, CAREER, yearsOrdained } from '@/engine/career';
import { assignmentTo } from './choice';
import { dropOffices } from './offices';
import { deliverLetter } from './review';
import { metropoliaOfSee } from '@/content/metropolias';
import { metropoliaSees, metropoliaSeeById, metropolitanOf } from './metropolia';
import { temperamentLine } from '@/generation/bishop';
import { finishNpc, rollBaseStats } from '@/generation/npc';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { clampSigned } from './reputation';

/**
 * E2 R1.3 — loans across diocesan lines (§2.4). A bishop of the province
 * short of priests asks the home bishop for a man; the home bishop says yes
 * or no by his own shortage and his regard; a yes swaps the world as a
 * friar's move does, and the man lives the parish loop under another
 * bishop until the term ends, when he comes home, is kept (incardination,
 * cc. 267–268, custom lengths to verify), or asks to be let go. For a
 * bishop the mirror: a man asked for from his desk, and letters asking for
 * his own. Numbers invented and flagged.
 */
export const LOAN = {
  /** Weeks between the yes and the home bishop's answer. */
  waitWeeks: [2, 4] as [number, number],
  /** The home bishop's release: the appointment's rule, with the ask from a brother bishop worth a little. */
  release: { base: 0.75, criticallyShort: -0.3, stretched: -0.1, coolBishop: -0.2, warmBishop: 0.1, floor: 0.15, ceiling: 0.95 },
  /** Years a loan runs, by what he was asked for; an extension adds two. */
  years: { spanish: 3, canonist: 3, pastor: 5 } as Record<LoanKind, number>,
  extendYears: 2,
  /** What the new chancery thinks of a man its bishop asked for. */
  arrivalChancery: 12,
  /** What home remembers of him when he returns: the file's rule, by whether the same bishop still sits, less each year away. */
  file: { sameBishop: 0.85, newBishop: 0.3, priests: 0.6, perYear: 0.05, floorSame: 0.35, floorNew: 0.1, floorPriests: 0.2 },
  /** The borrowing bishop wants to keep him at the term's end: base, plus his regard. */
  wanted: { base: 0.35, perRegard: 200 },
  /** Excardination asked for: home lets him go by its shortage and its regard for him. */
  excardination: { base: 0.45, criticallyShort: -0.25, stretched: -0.1, coolBishop: 0.2, warmBishop: -0.15, floor: 0.1, ceiling: 0.9 },
  /** A bishop's ask from the desk: a brother bishop lends by his regard; the man stays three years. */
  bishop: { base: 0.45, perRegard: 150, years: 3 },
} as const;

export const LOAN_KIND_LABEL: Record<LoanKind, string> = { spanish: 'a Spanish-speaking priest', canonist: 'a canonist for the tribunal', pastor: 'a pastor' };

function clamp01(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function calendarYear(state: GameState): number {
  return dateOf(state.clock).year;
}

/** A see of the province the game could lend him to: pool-backed, with a bishop of its own who is not the man. */
export function lendableSees(state: GameState): MetropoliaSee[] {
  return metropoliaSees(state).filter((s) => !!s.poolId && !!s.bishopId && s.bishopId !== 'player');
}

/** Whether a loan could be asked of him now. */
export function loanAvailable(state: GameState): boolean {
  if (state.loan || state.religious || state.see || state.study || !state.world || !state.assignment) return false;
  if (state.flags['loan:asked'] !== undefined) return false;
  return lendableSees(state).length > 0;
}

/** The see whose bishop this is, if he is one of the province's. */
function seeOfBishop(state: GameState, npcId: string): MetropoliaSee | undefined {
  const tag = state.npcs[npcId]?.tags.find((t) => t.startsWith('see:'));
  return tag ? metropoliaSeeById(state, tag.slice(4)) : undefined;
}

/**
 * He said yes to a brother bishop's ask: the home bishop's answer is put on
 * the calendar. `bishopId` is the asking bishop (the offer's binding); the
 * see is his, or the province's likeliest when the binding is not one of them.
 */
export function askLoan(state: GameState, kind: LoanKind, bishopId: string | undefined, rng: Rng): GameState {
  // The asking bishop's own see when it can be rolled as a world (a pool city); else the province's likeliest.
  const bound = bishopId ? seeOfBishop(state, bishopId) : undefined;
  const open = lendableSees(state);
  const see = bound && open.some((x) => x.id === bound.id) ? bound : open.length ? rng.pick(open) : undefined;
  if (!see) return state;
  const week = state.clock.week + rng.int(LOAN.waitWeeks[0], LOAN.waitWeeks[1]);
  return {
    ...state,
    flags: { ...state.flags, 'loan:asked': week, 'loan:see': see.id, 'loan:kind': kind },
    career: [...state.career, { week: state.clock.week, kind: 'offer', text: `Said yes to ${see.name}, which asked for ${LOAN_KIND_LABEL[kind]}. The bishop's answer will decide it.` }],
  };
}

/** The home bishop's release: what the diocese can spare, and how he thinks of the man. */
export function loanReleaseChance(state: GameState): number {
  const r = LOAN.release;
  let p: number = r.base;
  const need = state.world?.diocese.visible.clergyNeed;
  if (need === 'critically_short') p += r.criticallyShort;
  else if (need === 'stretched') p += r.stretched;
  const bishop = state.world ? state.npcs[state.world.diocese.hidden.bishop.npcId] : undefined;
  if (bishop && bishop.relationship <= -20) p += r.coolBishop;
  else if (bishop && bishop.relationship >= 30) p += r.warmBishop;
  return clamp01(p, r.floor, r.ceiling);
}

function bishopWord(state: GameState): string {
  const b = state.world ? state.npcs[state.world.diocese.hidden.bishop.npcId] : undefined;
  return b ? `${b.title} ${b.name.last}` : 'The bishop';
}

/** The province as the borrowed world sees it: the home see among the others, the borrowed see gone from them. */
function swapMetropolia(from: World, homeSeeId: string, homeWorld: World, borrowedSeeId: string): World['metropolia'] {
  const m = from.metropolia;
  if (!m) return m;
  const rank = metropoliaOfSee(homeWorld.diocese.visible.see)?.rank ?? 'suffragan';
  const home: MetropoliaSee = { id: homeSeeId, name: homeWorld.diocese.visible.name, see: homeWorld.diocese.visible.see, state: '', region: homeWorld.diocese.visible.region, rank, bishopId: homeWorld.diocese.hidden.bishop.npcId, installedYear: homeWorld.diocese.hidden.bishop.installedYear };
  const sees = [...m.sees.filter((s) => s.id !== borrowedSeeId && s.id !== homeSeeId), home];
  const borrowedRank = m.sees.find((s) => s.id === borrowedSeeId)?.rank ?? 'suffragan';
  return { ...m, rank: borrowedRank, sees };
}

/** The province as home sees it again: the borrowed see back among the others with its bishop, the home see gone from them. */
function restoreMetropolia(from: World, borrowedSeeId: string, borrowedWorld: World, homeSeeId: string): World['metropolia'] {
  const m = from.metropolia;
  if (!m) return m;
  const kept = m.sees.find((s) => s.id === borrowedSeeId);
  const back: MetropoliaSee = kept ?? { id: borrowedSeeId, name: borrowedWorld.diocese.visible.name, see: borrowedWorld.diocese.visible.see, state: '', region: borrowedWorld.diocese.visible.region, rank: 'suffragan', poolId: borrowedSeeId, bishopId: borrowedWorld.diocese.hidden.bishop.npcId, installedYear: borrowedWorld.diocese.hidden.bishop.installedYear };
  const homeRank = m.sees.find((s) => s.id === homeSeeId)?.rank ?? m.rank;
  return { ...m, rank: homeRank, sees: [...m.sees.filter((s) => s.id !== borrowedSeeId && s.id !== homeSeeId), back] };
}

/** The parish the borrowing bishop puts him in, by what he was asked for. */
function parishFor(state: GameState, world: World, kind: LoanKind, rng: Rng): { parish: Parish; role: Role; reasons: string[] } {
  const vacant = (p: Parish) => !state.npcs[p.pastorId] || state.npcs[p.pastorId]!.status !== 'active';
  const experienced = yearsOrdained(state) >= CAREER.minYearsForPastor;
  const leftAs = state.assignment?.role ?? 'parochial_vicar';
  if (kind === 'spanish') {
    const pool = world.parishes.filter((p) => p.needsSpanish && !p.cathedral);
    const parish = rng.pick(pool.length ? pool : world.parishes.filter((p) => !p.cathedral));
    const role: Role = leftAs === 'pastor' && experienced ? (vacant(parish) ? 'pastor' : 'administrator') : 'parochial_vicar';
    return { parish, role, reasons: ['The diocese asked for a priest who could say the Spanish Mass, and this is where the Spanish Mass is'] };
  }
  if (kind === 'canonist') {
    const parish = world.parishes.find((p) => p.cathedral) ?? world.parishes[0]!;
    return { parish, role: 'parochial_vicar', reasons: ['The tribunal is in the cathedral rectory, and so are you'] };
  }
  const pool = world.parishes.filter((p) => !p.cathedral && vacant(p));
  const parish = rng.pick(pool.length ? pool : world.parishes.filter((p) => !p.cathedral));
  return { parish, role: experienced ? 'pastor' : 'administrator', reasons: ['A parish the diocese could not staff from its own men'] };
}

/**
 * The home bishop said yes: the man goes. Home goes into the territory; the
 * borrowing diocese is rolled from its see (or found, if he has been there),
 * its bishop the man the province already knows; the parish loop begins
 * again under him, with the letter of appointment on the desk.
 */
export function moveToDiocese(state: GameState, seeId: string, kind: LoanKind, years: number, rng: Rng): { state: GameState; letter: Letter } {
  const home = state.world!;
  const homeId = home.diocese.presetId;
  const see = metropoliaSeeById(state, seeId)!;
  const week = state.clock.week;
  const year = calendarYear(state);
  const c = state.character!;
  // Leaving home: the tenure closes, the parish remembers, the offices go to other men.
  let next = dropOffices(moveOut(state, rng.derive('leave'), `lent to ${see.name}`));
  const homeFile = { chancery: c.reputation.chancery, brother_priests: c.reputation.brother_priests, bishopId: home.diocese.hidden.bishop.npcId, leftWeek: week };
  // The borrowing diocese: found in the territory, or rolled from its see with its own bishop swapped for the province's man.
  const territory = { ...(next.territory ?? {}) };
  let world = territory[seeId];
  const npcs = { ...next.npcs };
  if (world) {
    delete territory[seeId];
  } else {
    const gen = generateSeeWorld(next, { id: seeId }, rng.derive(`loan-world:${seeId}`));
    for (const n of gen.npcs) npcs[n.id] = n;
    world = gen.world;
    const bishop = see.bishopId ? npcs[see.bishopId] : undefined;
    if (bishop) {
      const generated = world.diocese.hidden.bishop;
      delete npcs[generated.npcId];
      const profile = { ...generated, npcId: bishop.id, alignment: bishop.alignment, ambition: bishop.ambition, installedYear: see.installedYear ?? generated.installedYear };
      const age = year - bishop.birthYear;
      npcs[bishop.id] = { ...bishop, tags: [...bishop.tags.filter((t) => !t.startsWith('diocese:')), `diocese:${gen.presetId}`] };
      world = {
        ...world,
        bishopHistory: [bishop.id],
        diocese: { ...world.diocese, hidden: { ...world.diocese.hidden, bishop: profile }, visible: { ...world.diocese.visible, bishop: { npcId: bishop.id, name: `${bishop.title} ${bishop.name.first} ${bishop.name.last}`, age, yearsInOffice: Math.max(0, year - profile.installedYear), temperamentLine: temperamentLine(rng.derive('line'), profile), priorities: profile.priorities } } },
      };
    }
  }
  territory[homeId] = home;
  const flags: GameState['flags'] = { ...next.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('diocese:') || k.startsWith('parish:') || k.startsWith('role:') || k.startsWith('boss:') || k.startsWith('deanery:') || k.startsWith('loan:')) delete flags[k];
  flags[`diocese:${world.diocese.presetId}`] = true;
  flags['loan:on'] = week;
  const metropolia = swapMetropolia(home, homeId, home, seeId);
  world = { ...world, ...(metropolia ? { metropolia } : {}) };
  const loan: LoanState = { dioceseId: world.diocese.presetId, seeId, homeId, kind, startWeek: week, endWeek: week + years * 52, years, homeFile, leftAs: state.assignment?.role ?? 'parochial_vicar' };
  const ch = next.character!;
  next = {
    ...next,
    world,
    npcs,
    territory,
    flags,
    loan,
    homeDioceseId: state.homeDioceseId ?? homeId,
    character: { ...ch, reputation: { ...ch.reputation, chancery: LOAN.arrivalChancery, brother_priests: 0 } },
    career: [...next.career, { week, kind: 'assignment', text: `Lent to ${see.name} for ${years} years, as ${LOAN_KIND_LABEL[kind]}.` }],
  };
  const placed = parishFor(next, world, kind, rng.derive('parish'));
  const assignment: Assignment = assignmentTo(next, placed.parish, placed.role, placed.reasons);
  const bishop = npcs[world.diocese.hidden.bishop.npcId];
  const letter: Letter = { sort: 'bishop', title: `Lent to ${see.name}`, body: [`${bishopWord(state)} has agreed to lend you to ${see.name} for ${years} years, at the asking of ${bishop ? `${bishop.title} ${bishop.name.last}` : 'its bishop'}, who wanted ${LOAN_KIND_LABEL[kind]} and was told your name.`, `You remain a priest of ${home.diocese.visible.name}; the years there count, and the file stays open. The letter of appointment from your new bishop is on the desk.`], week };
  return { state: { ...next, assignment, phase: placed.role, mode: { kind: 'assignment', assignment } }, letter };
}

/** What home remembers of him when he comes back: the file's rule. */
export function homeCarry(state: GameState, loan: LoanState, home: World): { chancery: number; brother_priests: number; sameBishop: boolean; years: number } {
  const f = LOAN.file;
  const years = Math.max(0, (state.clock.week - loan.homeFile.leftWeek) / 52);
  const sameBishop = home.diocese.hidden.bishop.npcId === loan.homeFile.bishopId;
  const share = sameBishop ? Math.max(f.floorSame, f.sameBishop - f.perYear * years) : Math.max(f.floorNew, f.newBishop - f.perYear * years * 0.5);
  const priests = Math.max(f.floorPriests, f.priests - f.perYear * years);
  return { chancery: Math.round(loan.homeFile.chancery * share) || 0, brother_priests: Math.round(loan.homeFile.brother_priests * priests) || 0, sameBishop, years };
}

/** The term's end, or his own asking: home. The borrowed world waits in the territory; home's file is read back; the board finds him a parish. */
export function returnHome(state: GameState, rng: Rng): { state: GameState; letter: Letter } {
  const loan = state.loan!;
  const borrowed = state.world!;
  const home = state.territory?.[loan.homeId];
  if (!home) throw new Error(`no home ${loan.homeId} in the territory`);
  const week = state.clock.week;
  let next = dropOffices(moveOut(state, rng.derive('leave'), 'the loan ended'));
  const territory = { ...(next.territory ?? {}) };
  delete territory[loan.homeId];
  territory[loan.seeId] = borrowed;
  const flags: GameState['flags'] = { ...next.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('diocese:') || k.startsWith('parish:') || k.startsWith('role:') || k.startsWith('boss:') || k.startsWith('deanery:') || k.startsWith('loan:')) delete flags[k];
  flags[`diocese:${loan.homeId}`] = true;
  flags['loan:returned'] = week;
  const metropolia = restoreMetropolia(borrowed, loan.seeId, borrowed, loan.homeId);
  const world: World = { ...home, ...(metropolia ? { metropolia } : {}) };
  const carry = homeCarry(next, loan, home);
  const ch = next.character!;
  const done: LoanState = { ...loan, decided: 'home' };
  next = {
    ...next,
    world,
    territory,
    flags,
    character: { ...ch, reputation: { ...ch.reputation, chancery: carry.chancery, brother_priests: carry.brother_priests } },
    loanHistory: [...(next.loanHistory ?? []), done],
    career: [...next.career, { week, kind: 'note', text: `Home from ${borrowed.diocese.visible.name} after ${Math.max(1, Math.round(carry.years))} year${Math.round(carry.years) === 1 ? '' : 's'}: ${carry.sameBishop ? 'the same bishop, who remembers you' : 'a new bishop, who has read your file'} ${carry.chancery >= 15 ? 'warmly' : carry.chancery <= -15 ? 'and not kindly' : 'a little'}.` }],
  };
  delete (next as { loan?: LoanState }).loan;
  // The board: a pastor comes home a pastor, to a parish that needs one; a vicar to where a vicar is needed.
  const role: Role = loan.leftAs === 'pastor' || loan.leftAs === 'administrator' ? loan.leftAs : 'parochial_vicar';
  const vacant = (p: Parish) => !next.npcs[p.pastorId] || next.npcs[p.pastorId]!.status !== 'active';
  const pool = world.parishes.filter((p) => !p.cathedral);
  const parish = rng.derive('home-parish').weighted(pool.length ? pool : world.parishes, (p) => 10 + (role !== 'parochial_vicar' && vacant(p) ? 25 : 0) + (p.needsSpanish && next.flags.speaks_spanish ? 10 : 0));
  const assignment = assignmentTo(next, parish, role, ['Home from the loan; the board had this waiting']);
  const letter: Letter = { sort: 'bishop', title: `Home from ${borrowed.diocese.visible.name}`, body: [`The loan is over and ${bishopWord({ ...next, world })} has you back. ${carry.sameBishop ? 'He remembers you, which is a mixed blessing; the years away have softened the file a little either way.' : 'He did not know you, and has read the file, which is what a file is for.'}`, 'The letter of appointment is on the desk.'], week };
  return { state: { ...next, assignment, phase: role, mode: { kind: 'assignment', assignment } }, letter };
}

/** He stays: incardinated into the diocese that borrowed him. Home writes him down. */
export function incardinate(state: GameState): GameState {
  const loan = state.loan!;
  const week = state.clock.week;
  const home = state.territory?.[loan.homeId];
  const npcs = { ...state.npcs };
  const homeBishop = home ? npcs[home.diocese.hidden.bishop.npcId] : undefined;
  if (homeBishop) npcs[homeBishop.id] = { ...homeBishop, relationship: clampSigned(homeBishop.relationship - 8) };
  const done: LoanState = { ...loan, decided: 'stayed' };
  const flags = { ...state.flags, [`incardinated:${loan.dioceseId}`]: week, 'loan:stayed': week };
  for (const k of Object.keys(flags)) if (k === 'loan:on') delete flags[k];
  const next: GameState = { ...state, npcs, flags, homeDioceseId: loan.dioceseId, loanHistory: [...(state.loanHistory ?? []), done], career: [...state.career, { week, kind: 'note', text: `Incardinated into ${state.world!.diocese.visible.name}; ${home?.diocese.visible.name ?? 'home'} let you go, and wrote it down.` }] };
  delete (next as { loan?: LoanState }).loan;
  return next;
}

/** The term runs two years more. */
export function extendLoan(state: GameState): GameState {
  const { wanted: _w, ...loan } = state.loan!;
  return { ...state, loan: { ...loan, endWeek: state.clock.week + LOAN.extendYears * 52, extended: true }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `The loan to ${state.world!.diocese.visible.name} extended by ${LOAN.extendYears} years.` }] };
}

/** Home's answer to a man who asks to be let go early: its shortage, and how it thinks of him. */
export function excardinationChance(state: GameState): number {
  const loan = state.loan;
  const home = loan ? state.territory?.[loan.homeId] : undefined;
  const r = LOAN.excardination;
  let p: number = r.base;
  const need = home?.diocese.visible.clergyNeed;
  if (need === 'critically_short') p += r.criticallyShort;
  else if (need === 'stretched') p += r.stretched;
  const bishop = home ? state.npcs[home.diocese.hidden.bishop.npcId] : undefined;
  if (bishop && bishop.relationship <= -20) p += r.coolBishop;
  else if (bishop && bishop.relationship >= 30) p += r.warmBishop;
  return clamp01(p, r.floor, r.ceiling);
}

/** He asks home to let him go now: the answer comes at once, as a letter. */
export function askExcardination(state: GameState, rng: Rng): GameState {
  const loan = state.loan;
  if (!loan) return state;
  const home = state.territory?.[loan.homeId];
  const week = state.clock.week;
  const homeName = home?.diocese.visible.name ?? 'home';
  if (rng.chance(excardinationChance(state))) {
    const next = incardinate(state);
    return deliverLetter(next, { sort: 'bishop', title: `${homeName} lets you go`, body: [`The letter from ${homeName} is short and correct: the bishop consents to your excardination, the decree is enclosed, and he wishes you well in a sentence that took him some time. You are a priest of ${state.world!.diocese.visible.name} now.`], week });
  }
  const npcs = { ...state.npcs };
  const homeBishop = home ? npcs[home.diocese.hidden.bishop.npcId] : undefined;
  if (homeBishop) npcs[homeBishop.id] = { ...homeBishop, relationship: clampSigned(homeBishop.relationship - 5) };
  const next: GameState = { ...state, npcs, flags: { ...state.flags, 'loan:excardination_refused': week }, career: [...state.career, { week, kind: 'note', text: `Asked ${homeName} to let you go; the bishop refused.` }] };
  return deliverLetter(next, { sort: 'bishop', title: `${homeName} keeps you`, body: [`The letter from ${homeName} is short and not warm: the bishop does not consent, the diocese is short, and he expects you home when the loan ends. He adds that he is glad you are wanted.`], week });
}

export function dueLoanScene(state: GameState): 'end' | null {
  const s = state.loan?.scene;
  return s && state.clock.week >= s.dueWeek ? s.kind : null;
}

export function closeLoanScene(state: GameState): GameState {
  if (!state.loan?.scene) return state;
  const { scene: _s, ...loan } = state.loan;
  return { ...state, loan };
}

export interface LoanWeek { state: GameState; lines: string[]; letters: Letter[] }

/** The week for a priest: the home bishop's answer to a loan asked for; the term's end. */
export function loanWeek(state: GameState, rng: Rng): LoanWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  let next = state;
  const week = state.clock.week;
  const asked = state.flags['loan:asked'];
  if (typeof asked === 'number' && week >= asked && !state.loan) {
    const seeId = String(state.flags['loan:see']);
    const kind = String(state.flags['loan:kind']) as LoanKind;
    const flags = { ...next.flags };
    delete flags['loan:asked']; delete flags['loan:see']; delete flags['loan:kind'];
    next = { ...next, flags };
    const see = metropoliaSeeById(next, seeId);
    if (see && see.poolId && next.assignment && rng.chance(loanReleaseChance(next))) {
      const moved = moveToDiocese(next, seeId, kind, LOAN.years[kind], rng.derive('move'));
      next = moved.state;
      letters.push(moved.letter);
      lines.push(`The bishop's answer came: you go to ${see.name} on loan.`);
      return { state: next, lines, letters };
    }
    const bishop = see?.bishopId ? next.npcs[see.bishopId] : undefined;
    const npcs = { ...next.npcs };
    if (bishop) npcs[bishop.id] = { ...bishop, relationship: clampSigned(bishop.relationship - 2) };
    next = { ...next, npcs, flags: { ...next.flags, 'loan:refused': week }, career: [...next.career, { week, kind: 'note', text: `${bishopWord(next)} would not lend you to ${see?.name ?? 'the diocese that asked'}.` }] };
    lines.push(`The bishop's answer came: he keeps you; ${see?.name ?? 'the diocese that asked'} will look elsewhere.`);
    letters.push({ sort: 'bishop', title: 'The bishop keeps you', body: [`${bishopWord(next)} writes that he has told ${see?.name ?? 'the diocese that asked'} the diocese cannot spare you, and that he means it as a compliment, and that you are to take it as one.`], week });
    return { state: next, lines, letters };
  }
  const loan = next.loan;
  if (loan && !loan.decided && !loan.scene && week >= loan.endWeek) {
    const bishop = next.npcs[next.world!.diocese.hidden.bishop.npcId];
    const wanted = !!bishop && rng.chance(LOAN.wanted.base + bishop.relationship / LOAN.wanted.perRegard);
    next = { ...next, loan: { ...loan, wanted, scene: { kind: 'end', dueWeek: week } } };
    lines.push(`The loan's term is up${wanted ? ', and the bishop would keep you' : ''}.`);
  }
  return { state: next, lines, letters };
}

/** The tokens: {loan_diocese}, {loan_home}, {loan_bishop}, {loan_years}, {loan_kind}. */
export function loanTokens(state: GameState): Record<string, string> {
  const loan = state.loan ?? state.loanHistory?.at(-1);
  if (!loan) return {};
  const here = state.world?.diocese.presetId === loan.dioceseId ? state.world : state.territory?.[loan.dioceseId];
  const home = state.world?.diocese.presetId === loan.homeId ? state.world : state.territory?.[loan.homeId];
  const bishop = here ? state.npcs[here.diocese.hidden.bishop.npcId] : undefined;
  return {
    loan_diocese: here?.diocese.visible.name ?? 'the diocese',
    loan_home: home?.diocese.visible.name ?? 'home',
    loan_bishop: bishop ? `${bishop.title} ${bishop.name.last}` : 'the bishop',
    loan_years: String(loan.years + (loan.extended ? LOAN.extendYears : 0)),
    loan_kind: LOAN_KIND_LABEL[loan.kind],
  };
}

// ---- the bishop's mirror ----

/** A brother bishop of the province to ask: the one who thinks best of him. */
function lendingBishop(state: GameState, rng: Rng): { npc: Npc; see: MetropoliaSee } | null {
  const pairs = metropoliaSees(state).flatMap((see) => { const n = see.bishopId && see.bishopId !== 'player' ? state.npcs[see.bishopId] : undefined; return n && n.status === 'active' ? [{ npc: n, see }] : []; });
  if (!pairs.length) return null;
  const met = metropolitanOf(state);
  return rng.weighted(pairs, (p) => 10 + Math.max(0, p.npc.relationship) + (met && p.npc.id === met.id ? 5 : 0));
}

/** A priest borrowed from a brother bishop's presbyterate: rolled into the see's, tagged as on loan. */
function borrowedPriest(state: GameState, from: MetropoliaSee, rng: Rng): Npc {
  const year = calendarYear(state);
  const age = rng.int(34, 58);
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  return finishNpc(rng, {
    id: `${state.see!.dioceseId}:loan_${from.id}_${state.clock.week}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(year - age)),
    role: 'priest',
    title: 'Fr.',
    birthYear: year - age,
    origin: rng.pick(['urban_ethnic', 'rural', 'suburban', 'latino_immigrant'] as const),
    stats: rollBaseStats(rng, 30, 55),
    tags: ['priest', `diocese:${state.see!.dioceseId}`, 'on_loan', `from:${from.id}`],
    alignment: clampSigned(Math.round(rng.gaussian() * 35)),
    relationship: 10,
  });
}

/** The week for a bishop: the answer to a man asked for from the desk, and the borrowed men whose terms end. */
export function loanWeekForSee(state: GameState, rng: Rng): LoanWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  let next = state;
  const see = state.see;
  if (!see) return { state, lines, letters };
  const week = state.clock.week;
  if (state.flags['loan:bishop_asked'] === true) {
    const flags = { ...next.flags };
    delete flags['loan:bishop_asked'];
    next = { ...next, flags };
    const lender = lendingBishop(next, rng.derive('lender'));
    if (lender) {
      const yes = rng.chance(LOAN.bishop.base + lender.npc.relationship / LOAN.bishop.perRegard);
      const npcs = { ...next.npcs };
      if (yes) {
        const priest = borrowedPriest(next, lender.see, rng.derive('priest'));
        npcs[priest.id] = priest;
        npcs[lender.npc.id] = { ...lender.npc, relationship: clampSigned(lender.npc.relationship + 3) };
        const loan: SeeLoan = { npcId: priest.id, name: `Fr. ${priest.name.first} ${priest.name.last}`, see: lender.see.see, sinceWeek: week, untilWeek: week + LOAN.bishop.years * 52 };
        next = { ...next, npcs, see: { ...next.see!, shortage: Math.max(1, next.see!.shortage - 1), borrowed: [...(next.see!.borrowed ?? []), loan] }, flags: { ...next.flags, 'loan:borrowed': week, 'loan:borrowed_name': loan.name }, career: [...next.career, { week, kind: 'note', text: `${lender.npc.title} ${lender.npc.name.last} lends the diocese ${loan.name} for ${LOAN.bishop.years} years.` }] };
        lines.push(`${lender.npc.title} ${lender.npc.name.last} of ${lender.see.see} lends you ${loan.name} for ${LOAN.bishop.years} years.`);
        letters.push({ sort: 'bishop', title: `A priest from ${lender.see.see}`, body: [`${lender.npc.title} ${lender.npc.name.last} writes that he can spare ${loan.name}, ${calendarYear(next) - priest.birthYear}, for ${LOAN.bishop.years} years, and that he expects him back better than he sent him. The man arrives in a month with a car full of books.`], week });
      } else {
        npcs[lender.npc.id] = { ...lender.npc, relationship: clampSigned(lender.npc.relationship - 2) };
        next = { ...next, npcs, flags: { ...next.flags, 'loan:bishop_refused': week }, career: [...next.career, { week, kind: 'note', text: `Asked ${lender.npc.title} ${lender.npc.name.last} for a priest; he had none to spare.` }] };
        lines.push(`${lender.npc.title} ${lender.npc.name.last} of ${lender.see.see} has no priest to spare.`);
        letters.push({ sort: 'bishop', title: `No priest from ${lender.see.see}`, body: [`${lender.npc.title} ${lender.npc.name.last} writes, kindly and at length, that he is shorter than you are and that the diocese that lends a man this year borrows two the next. He encloses the name of a religious order's provincial who might.`], week });
      }
    }
  }
  const borrowed = next.see!.borrowed ?? [];
  const ending = borrowed.filter((l) => week >= l.untilWeek);
  if (ending.length) {
    const npcs = { ...next.npcs };
    for (const l of ending) { const n = npcs[l.npcId]; if (n) npcs[l.npcId] = { ...n, status: 'left', tags: n.tags.filter((t) => t !== 'on_loan') }; lines.push(`${l.name} goes home to ${l.see}; the loan is over.`); }
    next = { ...next, npcs, see: { ...next.see!, shortage: Math.min(5, next.see!.shortage + ending.length), borrowed: borrowed.filter((l) => week < l.untilWeek) } };
  }
  return { state: next, lines, letters };
}

/** A priest of the see lent to a brother bishop: he is away for the years, and the see is a man shorter. */
export function lendPriest(state: GameState, npcId: string, toSee: string, years: number): GameState {
  const see = state.see;
  const n = state.npcs[npcId];
  if (!see || !n) return state;
  const week = state.clock.week;
  const loan: SeeLoan = { npcId, name: `${n.title ?? 'Fr.'} ${n.name.first} ${n.name.last}`, see: toSee, sinceWeek: week, untilWeek: week + years * 52 };
  return { ...state, npcs: { ...state.npcs, [npcId]: { ...n, tags: [...n.tags, 'lent'] } }, see: { ...see, shortage: Math.min(5, see.shortage + 1), lent: [...(see.lent ?? []), loan] }, career: [...state.career, { week, kind: 'note', text: `Lent ${loan.name} to ${toSee} for ${years} years.` }] };
}

/** The lent men who come home this week. */
export function lentReturns(state: GameState): GameState {
  const see = state.see;
  if (!see?.lent?.length) return state;
  const week = state.clock.week;
  const back = see.lent.filter((l) => week >= l.untilWeek);
  if (!back.length) return state;
  const npcs = { ...state.npcs };
  for (const l of back) { const n = npcs[l.npcId]; if (n) npcs[l.npcId] = { ...n, tags: n.tags.filter((t) => t !== 'lent') }; }
  return { ...state, npcs, see: { ...see, shortage: Math.max(1, see.shortage - back.length), lent: see.lent.filter((l) => week < l.untilWeek) } };
}

/** For a scene: the rng a loan effect rolls with. */
export function loanRng(state: GameState, key: string): Rng {
  return createRng(`${state.seed}:loan:${key}:${state.clock.week}`);
}
