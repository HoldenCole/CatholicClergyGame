import { turnaroundOf } from './trajectory';
import type { Candidate, GameState, Npc, Opening, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from '@/generation/npc';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { fit, maturityModifier, readiness, trust } from './promotion';

/** Invented. */
export const OPENINGS = {
  retirementAge: 75,
  retireChancePerYear: 0.45,
  transferChancePerYear: 0.07,
  deathChancePerYearOver70: 0.03,
  /** Abstract openings elsewhere in the diocese per year, scaled by shortage. */
  elsewherePerYear: [0, 2] as [number, number],
  /** NPC rivals considered for each opening. */
  rivals: [2, 4] as [number, number],
  openingLifeWeeks: 60,
} as const;

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/**
 * Once a year: pastors retire, die, or move, and their parishes open; the
 * wider diocese produces openings the player never sees the inside of.
 */
export function refreshOpenings(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const world = state.world;
  if (!world) return { state, lines: [] };
  const year = calendarYear(state);
  const lines: string[] = [];
  const npcs = { ...state.npcs };
  let openings = state.openings.filter((o) => state.clock.week - o.week < OPENINGS.openingLifeWeeks);
  const shortage = world.diocese.hidden.shortage;

  const parishes = world.parishes.map((p) => {
    if (openings.some((o) => o.parishId === p.id)) return p;
    if (p.id === state.parish?.parishId && state.assignment?.role === 'pastor') return p;
    const pastor = npcs[p.pastorId];
    if (!pastor || pastor.status !== 'active') return p;
    const age = year - pastor.birthYear;
    let why: string | null = null;
    if (age >= OPENINGS.retirementAge && rng.chance(OPENINGS.retireChancePerYear)) why = 'retired';
    else if (age >= 70 && rng.chance(OPENINGS.deathChancePerYearOver70)) why = 'died';
    else if (rng.chance(OPENINGS.transferChancePerYear)) why = 'moved';
    if (!why) return p;
    npcs[pastor.id] = { ...pastor, status: why === 'died' ? 'dead' : why === 'retired' ? 'retired' : 'active', tags: why === 'moved' ? pastor.tags.filter((t) => !t.startsWith('pastor:')) : pastor.tags };
    lines.push(`${pastor.title} ${pastor.name.last} of ${p.name} has ${why === 'moved' ? 'been moved' : why}.`);
    // A priest of the deanery may be said to want it.
    const neighbors = (state.parish?.deanery?.priestIds ?? []).filter((id) => npcs[id]?.status === 'active' && id !== pastor.id);
    const rival = neighbors.length && rng.chance(DEANERY_RIVAL_CHANCE) ? rng.pick([...neighbors].sort()) : undefined;
    openings.push({
      id: `open_${p.id}_${state.clock.week}`,
      kind: 'pastor',
      parishId: p.id,
      ...(rival ? { deaneryRivalId: rival } : {}),
      urgency: Math.min(100, 40 + shortage * 10 + (why === 'died' ? 15 : 0)),
      needsSpanish: p.needsSpanish,
      needsAdmin: p.debt >= 1_000_000 || p.problem === 'staff_theft' || p.problem === 'lawsuit',
      alignment: p.alignment,
      week: state.clock.week,
      label: p.cathedral ? `Rector of ${p.name}` : `Pastor of ${p.name}, ${p.place}`,
    });
    return p;
  });

  const elsewhere = rng.int(OPENINGS.elsewherePerYear[0], Math.min(OPENINGS.elsewherePerYear[1], shortage));
  for (let i = 0; i < elsewhere; i++) {
    openings.push({
      id: `open_else_${state.clock.week}_${i}`,
      kind: rng.chance(0.75) ? 'pastor' : 'administrator',
      parishId: null,
      urgency: Math.min(100, 30 + shortage * 12 + rng.int(0, 20)),
      needsSpanish: rng.chance(['los_angeles', 'houston', 'miami'].includes(world.diocese.presetId) ? 0.6 : 0.3),
      needsAdmin: rng.chance(0.3),
      alignment: rollAlignment(rng, world.diocese.visible.disposition * 0.3, 30),
      week: state.clock.week,
      label: rng.pick(['A parish across the diocese', 'A cluster of three churches', 'A parish with a school', 'A parish nobody asked for']),
    });
  }
  openings = openings.slice(-8);
  return { state: { ...state, npcs, openings, world: { ...world, parishes } }, lines };
}

/** The player as the board sees him. */
export function playerCandidate(state: GameState): Candidate {
  const c = state.character!;
  const year = calendarYear(state);
  const ordinationWeek = Number(state.flags.ordination_week ?? state.clock.week);
  const bishopId = state.world?.diocese.hidden.bishop.npcId;
  const bishop = bishopId ? state.npcs[bishopId] : undefined;
  const vouchers = Object.values(state.npcs).filter((n) => n.status === 'active' && n.tags.includes('chancery') && n.relationship >= 25).length;
  const parish = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  const affiliation = state.flags['affiliation:trad_fraternity'] ? -1 : state.flags['affiliation:prog_caucus'] ? 1 : 0;
  return {
    id: 'player',
    isPlayer: true,
    name: `Fr. ${c.name.last}`,
    stats: c.stats,
    credentials: c.credentials,
    yearsOrdained: (state.clock.week - ordinationWeek) / 52,
    ordinationAge: c.background.entryAge + 7,
    age: year - (c.entryYear - c.background.entryAge),
    alignment: c.alignment,
    outspokenness: c.outspokenness,
    chancery: c.reputation.chancery,
    bishopRelationship: bishop?.relationship ?? 0,
    vouchers,
    results: c.reputation.parishioners,
    speaksSpanish: !!state.flags.speaks_spanish,
    affiliation,
    indispensable: !!parish && c.stats.administration >= 70 && (parish.debt >= 1_000_000 || parish.problem === 'staff_theft'),
    turnaround: turnaroundOf(state),
    currentRole: state.assignment?.role ?? null,
  };
}

/** An NPC priest as a candidate; classmates use their real records, others are rolled. */
export function npcCandidate(npc: Npc, year: number, rng: Rng): Candidate {
  const yearsOrdained = Math.max(1, year - (npc.birthYear + (npc.formation?.entryAge ?? 26) + 7));
  return {
    id: npc.id,
    isPlayer: false,
    name: `${npc.title || 'Fr.'} ${npc.name.last}`,
    stats: npc.stats,
    credentials: npc.tags.includes('rome_alumnus') ? ['STL'] : [],
    yearsOrdained,
    ordinationAge: (npc.formation?.entryAge ?? 26) + 7,
    age: year - npc.birthYear,
    alignment: npc.alignment,
    outspokenness: rng.int(0, 60),
    chancery: Math.round(rng.gaussian() * 25 + npc.ambition * 0.3),
    bishopRelationship: Math.round(rng.gaussian() * 20),
    vouchers: npc.tags.includes('chancery') ? 2 : rng.chance(0.3) ? 1 : 0,
    results: Math.round(rng.gaussian() * 20 + 20),
    speaksSpanish: npc.origin === 'latino_immigrant' || rng.chance(0.3),
    affiliation: 0,
    indispensable: false,
    currentRole: npc.tags.includes('pastor') ? 'pastor' : 'parochial_vicar',
  };
}

/** Rivals for an opening: classmates still in the diocese plus rolled diocesan priests. */
export function rivalsFor(state: GameState, opening: Opening, rng: Rng): Candidate[] {
  const year = calendarYear(state);
  const classmates = Object.values(state.npcs).filter((n) => n.role === 'classmate' && n.status === 'active' && !n.tags.includes('on_leave'));
  const count = rng.int(OPENINGS.rivals[0], OPENINGS.rivals[1]);
  const out: Candidate[] = [];
  const picked = rng.shuffle(classmates).slice(0, Math.min(count, classmates.length, 2));
  for (const n of picked) out.push(npcCandidate(n, year, rng.derive(`cand:${n.id}:${opening.id}`)));
  while (out.length < count) {
    const birthYear = year - rng.int(34, 66);
    const heritage = rollHeritage(rng, CLERGY_HERITAGE);
    const npc = finishNpc(rng, {
      id: `rival_${opening.id}_${out.length}`,
      name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
      role: 'priest',
      title: 'Fr.',
      birthYear,
      origin: 'suburban',
      stats: addStats(rollBaseStats(rng, 30, 60), {}),
      relationship: 0,
    });
    out.push(npcCandidate(npc, year, rng.derive(`cand:${npc.id}`)));
  }
  return out;
}

export function openingParish(state: GameState, opening: Opening): Parish | undefined {
  return opening.parishId ? state.world?.parishes.find((p) => p.id === opening.parishId) : undefined;
}

/** The chance an opening is one a neighbor is said to want. Invented. */
const DEANERY_RIVAL_CHANCE = 0.35;

/** Whether a priest of the deanery is after one of the open parishes. */
export function deaneryRivalStands(state: GameState): boolean {
  return state.openings.some((o) => o.deaneryRivalId && state.npcs[o.deaneryRivalId]?.status === 'active');
}

export function openingBlurb(state: GameState, opening: Opening): string {
  const p = openingParish(state, opening);
  if (!p) return opening.label;
  const rival = opening.deaneryRivalId ? state.npcs[opening.deaneryRivalId] : undefined;
  const said = rival && rival.status === 'active' ? ` ${rival.title} ${rival.name.last}, of the deanery, is said to want it.` : '';
  return `${p.name}, ${p.place}: ${PROBLEM_LABEL[p.problem] ?? p.problem}${said}`;
}

/** Asking costs a little each time past the first in a year: the chancery does not love a man who applies for everything. Invented. */
export const ASKING = { chanceryPerExtra: -2 } as const;

/** Put the player's name forward for an opening. Remembered in the file. */
export function applyForOpening(state: GameState, openingId: string): GameState {
  const opening = state.openings.find((o) => o.id === openingId);
  if (!opening || opening.applied || !state.character) return state;
  const askedThisYear = state.openings.filter((o) => o.applied && state.clock.week - o.week < 52).length;
  const cost = askedThisYear > 0 ? ASKING.chanceryPerExtra : 0;
  const c = state.character;
  return {
    ...state,
    openings: state.openings.map((o) => (o.id === openingId ? { ...o, applied: true } : o)),
    character: cost ? { ...c, reputation: { ...c.reputation, chancery: Math.max(-100, c.reputation.chancery + cost) } } : c,
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Put your name in for ${opening.label}.` }],
  };
}

export interface Chances {
  readiness: string;
  trust: string;
  fit: string;
  /** One line the man can act on. */
  verdict: string;
  reasons: string[];
}

/** How the board would read the player against an opening today, in words. No noise, no rivals. */
export function chancesFor(state: GameState, opening: Opening): Chances {
  const me = playerCandidate(state);
  const bishop = state.world!.diocese.hidden.bishop;
  const r = readiness(me, opening);
  const t = trust(me);
  const f = fit(me, opening, bishop);
  const fitEffective = f.value * (1 + me.outspokenness / 100);
  const maturity = maturityModifier(me.ordinationAge, me.age);
  const total = r.value * 0.3 + t.value * 0.25 + fitEffective * 0.3 + maturity;
  const word = (v: number, lo: number, hi: number, words: [string, string, string]) => (v >= hi ? words[2] : v >= lo ? words[1] : words[0]);
  const verdict =
    opening.kind === 'pastor' && me.yearsOrdained < 3 && me.currentRole !== 'pastor' ? 'Too soon: the board does not make pastors before three years' :
    total >= 40 ? 'A strong name for it' : total >= 22 ? 'A fair chance, against the right rivals' : total >= 8 ? 'A long shot' : 'Not this one, not yet';
  return {
    readiness: word(r.value, 35, 60, ['green', 'ready enough', 'ready']),
    trust: word(t.value, 45, 65, ['an unknown quantity', 'trusted a little', 'trusted']),
    fit: word(fitEffective, -5, 15, ['a poor fit', 'a fair fit', 'a good fit']),
    verdict,
    reasons: [...r.reasons, ...t.reasons, ...f.reasons],
  };
}
