import type { GameState, OfferDef } from '@/types';
import type { Rng } from './rng';
import { studyProgram } from '@/content/study';
import { beginStudy } from './study';

/**
 * A post that moves a man is the bishop's to give. Saying yes to the one who
 * asked (the hospital, the Newman Center, the judicial vicar, or the bishop
 * himself) sends the request to the chancery; the letter of appointment, if it
 * comes, does the moving. Requested in playtesting: "the bishop should have to
 * move me, not me just accept a role that moves me."
 */
export const APPOINTMENT = {
  /** Weeks between the yes and the letter. */
  waitWeeks: [2, 4] as const,
  /** The chance the bishop releases a man someone else asked for. Invented; the bishop's own asks and Rome's are certain. */
  release: { base: 0.8, criticallyShort: -0.3, stretched: -0.1, priority: 0.12, coolBishop: -0.2, warmBishop: 0.1, floor: 0.15, ceiling: 0.98 },
} as const;

export const APPOINTMENT_FLAGS = { offer: 'appointment:offer', week: 'appointment:week', failed: 'appointment:failed', from: 'appointment:from', letter: 'appointment:letter' } as const;
export const APPOINTMENT_BEAT = "The bishop's letter";

export interface PendingAppointment {
  offerId: string;
  week: number;
  failed: boolean;
}

export function pendingAppointment(state: GameState): PendingAppointment | null {
  const offerId = state.flags[APPOINTMENT_FLAGS.offer];
  const week = state.flags[APPOINTMENT_FLAGS.week];
  if (typeof offerId !== 'string' || typeof week !== 'number') return null;
  return { offerId, week, failed: state.flags[APPOINTMENT_FLAGS.failed] === true };
}

function clearPending(state: GameState): GameState {
  const flags = { ...state.flags };
  for (const k of [APPOINTMENT_FLAGS.offer, APPOINTMENT_FLAGS.week, APPOINTMENT_FLAGS.failed, APPOINTMENT_FLAGS.from]) delete flags[k];
  return { ...state, flags, beats: state.beats.filter((b) => !(b.kind === 'assignment' && b.label === APPOINTMENT_BEAT)) };
}

/** He said yes. The request goes to the bishop; nothing moves until his letter. */
export function askToGo(state: GameState, def: OfferDef, failed: boolean, rng: Rng): GameState {
  const program = studyProgram(def.accept.commitment?.away ?? '');
  if (!program) throw new Error(`offer ${def.id} does not name a post`);
  const week = state.clock.week + rng.int(APPOINTMENT.waitWeeks[0], APPOINTMENT.waitWeeks[1]);
  const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  const flags: GameState['flags'] = { ...state.flags, [APPOINTMENT_FLAGS.offer]: def.id, [APPOINTMENT_FLAGS.week]: week, [APPOINTMENT_FLAGS.failed]: failed };
  if (parish) flags[APPOINTMENT_FLAGS.from] = parish.name;
  const beats = [...state.beats.filter((b) => !(b.kind === 'assignment' && b.label === APPOINTMENT_BEAT)), { kind: 'assignment' as const, week, label: APPOINTMENT_BEAT }].sort((a, b) => a.week - b.week);
  return { ...state, flags, beats, career: [...state.career, { week: state.clock.week, kind: 'offer', text: `Said yes to ${program.label.toLowerCase()}. The bishop's letter will decide it.` }] };
}

/** One when the bishop himself asked, or Rome did; otherwise what the diocese can spare and how he thinks of you. */
export function releaseChance(state: GameState, def: OfferDef): number {
  const program = studyProgram(def.accept.commitment?.away ?? '');
  if (def.from === '@bishop' || program?.release?.always) return 1;
  const r = APPOINTMENT.release;
  let p: number = r.base;
  const need = state.world?.diocese.visible.clergyNeed;
  if (need === 'critically_short') p += r.criticallyShort;
  else if (need === 'stretched') p += r.stretched;
  const bishop = state.world ? state.npcs[state.world.diocese.hidden.bishop.npcId] : undefined;
  if (bishop && bishop.relationship <= -20) p += r.coolBishop;
  else if (bishop && bishop.relationship >= 30) p += r.warmBishop;
  const priority = program?.release?.priority;
  if (priority && state.world?.diocese.hidden.bishop.priorities.includes(priority)) p += r.priority;
  return Math.min(r.ceiling, Math.max(r.floor, p));
}

/** The letter of appointment: he goes. */
export function grantAppointment(state: GameState, def: OfferDef, rng: Rng): GameState {
  const p = pendingAppointment(state);
  return beginStudy(clearPending(state), def, p?.failed ?? false, rng);
}

/** The bishop keeps him: the one who asked is told, and the yes is noted. */
export function keepAppointment(state: GameState, def: OfferDef): GameState {
  const program = studyProgram(def.accept.commitment?.away ?? '');
  const next = clearPending(state);
  return {
    ...next,
    flags: { ...next.flags, [`kept:${program?.id ?? def.id}`]: true },
    offerHistory: [...next.offerHistory, { offerId: def.id, week: next.clock.week, decision: 'kept' }],
    career: [...next.career, { week: next.clock.week, kind: 'offer', text: `The bishop kept you: ${program?.label.toLowerCase() ?? def.title} went to someone who could be spared.` }],
  };
}

export interface AppointmentResult {
  state: GameState;
  /** Which letter came, if the week has arrived. */
  letter: 'go' | 'kept' | null;
}

/** The week the letter is due: the bishop sends him or keeps him. */
export function appointmentStep(state: GameState, rng: Rng, lookup: (id: string) => OfferDef | undefined): AppointmentResult {
  const p = pendingAppointment(state);
  if (!p || state.clock.week < p.week) return { state, letter: null };
  const def = lookup(p.offerId);
  if (!def) return { state: clearPending(state), letter: null };
  const go = rng.derive(`appointment:${p.offerId}:${p.week}`).chance(releaseChance(state, def));
  return go ? { state: grantAppointment(state, def, rng.derive(`appointed:${p.week}`)), letter: 'go' } : { state: keepAppointment(state, def), letter: 'kept' };
}
