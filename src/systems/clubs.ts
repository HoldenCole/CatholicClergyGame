import type { ClubDef, ClubMembership, ClubsState, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { clubDefs, clubDef } from '@/content/clubs';
import { applyEffects } from '@/engine/effects';
import { describeUnmet } from './doors';

/** Invented. */
export const CLUBS = {
  /** Warmth a week with each fellow member. */
  fellowWarmth: 0.25,
  /** A club left is not rejoined for this long. */
  rejoinAfterWeeks: 52,
  /** Seminary clubs open from the second year. */
  seminaryFromYear: 2,
} as const;

export function clubsOf(state: GameState): ClubsState {
  return state.clubs ?? { memberships: {}, left: {} };
}

export function isMember(state: GameState, id: string): boolean {
  return !!clubsOf(state).memberships[id];
}

/** The clubs of the man's phase: seminary clubs for a seminarian, priests' circles for a priest with a parish. */
export function clubsForPhase(state: GameState): ClubDef[] {
  const phase = state.phase === 'seminary' ? 'seminary' : state.parish ? 'priest' : null;
  return phase ? clubDefs.filter((c) => c.phase === phase) : [];
}

/** Hours (seminary) or blocks (parish) the memberships take each week. */
export function clubHours(state: GameState): number {
  return Object.keys(clubsOf(state).memberships).reduce((n, id) => n + (clubDef(id)?.hours ?? 0), 0);
}

/** Strain eased a week by the memberships that keep the body in order. */
export function staminaOf(state: GameState): number {
  return Object.keys(clubsOf(state).memberships).reduce((n, id) => n + (clubDef(id)?.stamina ?? 0), 0);
}

export interface ClubAvailability {
  def: ClubDef;
  member: boolean;
  /** May join from the sheet now. */
  open: boolean;
  /** What is in the way, in words; for invite-only clubs, that they are by invitation. */
  why: string | null;
}

export function clubAvailability(state: GameState): ClubAvailability[] {
  const clubs = clubsOf(state);
  return clubsForPhase(state).map((def) => {
    const member = !!clubs.memberships[def.id];
    if (member) return { def, member, open: false, why: null };
    if (state.phase === 'seminary' && (state.seminary?.year ?? 1) < CLUBS.seminaryFromYear) return { def, member, open: false, why: 'not in the propaedeutic year' };
    const leftAt = clubs.left[def.id];
    if (leftAt !== undefined && state.clock.week - leftAt < CLUBS.rejoinAfterWeeks) return { def, member, open: false, why: 'you left; they remember' };
    if (def.inviteOnly) return { def, member, open: false, why: 'by invitation' };
    const unmet = def.requires?.map((c) => describeUnmet(c, state)).find((w): w is string => !!w);
    if (unmet) return { def, member, open: false, why: unmet };
    return { def, member, open: true, why: null };
  });
}

function pickFellows(state: GameState, def: ClubDef, rng: Rng): string[] {
  const pool = Object.values(state.npcs).filter((n) =>
    n.status === 'active' && (def.phase === 'seminary' ? n.role === 'classmate' : n.role === 'priest' || (n.role === 'classmate' && !n.tags.includes('on_leave'))),
  );
  const out: string[] = [];
  let rest = pool;
  while (out.length < def.fellows && rest.length) {
    const n = rng.pick(rest);
    out.push(n.id);
    rest = rest.filter((x) => x.id !== n.id);
  }
  return out;
}

/** Join, from the sheet or an invitation. Invitation-only clubs may be joined only through the `club` effect. */
export function joinClub(state: GameState, id: string, rng: Rng, byInvitation = false): GameState {
  const def = clubDef(id);
  if (!def) throw new Error(`no such club ${id}`);
  if (isMember(state, id)) return state;
  if (!byInvitation) {
    const a = clubAvailability(state).find((x) => x.def.id === id);
    if (!a?.open) throw new Error(a?.why ?? 'not open to you');
  }
  const membership: ClubMembership = { joinedWeek: state.clock.week, weeks: 0, fellows: pickFellows(state, def, rng) };
  const clubs = clubsOf(state);
  let next: GameState = { ...state, clubs: { ...clubs, memberships: { ...clubs.memberships, [id]: membership } } };
  if (def.onJoin) next = applyEffects(next, def.onJoin);
  return { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Joined ${def.label}.` }] };
}

export function leaveClub(state: GameState, id: string, quiet = false): GameState {
  const def = clubDef(id);
  if (!def || !isMember(state, id)) return state;
  const clubs = clubsOf(state);
  const memberships = { ...clubs.memberships };
  delete memberships[id];
  let next: GameState = { ...state, clubs: { memberships, left: { ...clubs.left, [id]: state.clock.week } } };
  if (def.onLeave && !quiet) next = applyEffects(next, def.onLeave);
  return quiet ? next : { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Left ${def.label}.` }] };
}

/** At ordination the seminary's societies end; the priests' circles begin. */
export function leaveSeminaryClubs(state: GameState): GameState {
  let next = state;
  for (const id of Object.keys(clubsOf(state).memberships)) if (clubDef(id)?.phase === 'seminary') next = leaveClub(next, id, true);
  return next;
}

/** One week of belonging: the weekly effects, the fellows warming, and the thing earned in time. */
export function clubsWeek(state: GameState): { state: GameState; lines: string[] } {
  const clubs = clubsOf(state);
  const lines: string[] = [];
  let next = state;
  const memberships: Record<string, ClubMembership> = {};
  for (const [id, m] of Object.entries(clubs.memberships)) {
    const def = clubDef(id);
    if (!def) continue;
    // Seminary clubs only meet in seminary; a priest's circles only while he has a parish.
    const meets = def.phase === 'seminary' ? state.phase === 'seminary' : !!state.parish;
    if (!meets) {
      memberships[id] = m;
      continue;
    }
    next = applyEffects(next, def.weekly.filter((e) => e.target !== 'pillar' || !!next.seminary));
    const npcs = { ...next.npcs };
    for (const fid of m.fellows) {
      const n = npcs[fid];
      if (n) npcs[fid] = { ...n, relationship: Math.min(100, n.relationship + CLUBS.fellowWarmth) };
    }
    next = { ...next, npcs };
    const weeks = m.weeks + 1;
    let earned = m.earned ?? false;
    if (def.credentialAfter && !earned && weeks >= def.credentialAfter.weeks) {
      earned = true;
      const effects = [
        ...(def.credentialAfter.credential ? [{ target: 'credential' as const, key: def.credentialAfter.credential }] : []),
        ...(def.credentialAfter.flag ? [{ target: 'flag' as const, key: def.credentialAfter.flag, value: true }] : []),
      ];
      next = applyEffects(next, effects);
      lines.push(def.credentialAfter.line);
    }
    memberships[id] = { ...m, weeks, earned };
  }
  return { state: { ...next, clubs: { ...clubs, memberships } }, lines };
}
