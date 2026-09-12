import type { GameState, LiturgyDialDef, LiturgyOptionDef, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { liturgyDials } from '@/content/parish';
import { recordPosition } from './reputation';
import { noteMover } from './movers';

/** Requested in playtesting; numbers invented. */
export const LITURGY = {
  /** Weeks a change stays fresh, and the shock to lay support when it lands. */
  shockWeeks: 26,
  shockSupport: -4,
  /** Lay support drifts each week by friction above this tolerance, and grows a little below it. */
  tolerance: 0.25,
  supportPerFriction: -0.35,
  supportWhenFitting: 0.04,
  /** Attendance target: what a fitting Mass adds, what a fighting one costs. */
  pullWhenFitting: 0.03,
  pullPerFriction: -0.08,
  /** Bloc reputation a week per unit of lean, and the record a change writes. */
  blocPerWeek: 0.12,
  positionValue: 45,
} as const;

export function dialDef(id: string): LiturgyDialDef | undefined {
  return liturgyDials.find((d) => d.id === id);
}
export function optionDef(dial: string, option: string): LiturgyOptionDef | undefined {
  return dialDef(dial)?.options.find((o) => o.id === option);
}

function fits(parish: Parish, o: LiturgyOptionDef): boolean {
  return !o.needs || (parish.ethnic[o.needs.ethnic] ?? 0) >= o.needs.share;
}

/** What the people want, per dial, from the parish's alignment and generation, with noise. */
export function rollTaste(rng: Rng, parish: Parish): Record<string, number> {
  const base = parish.alignment / 100;
  const gen = parish.generational === 'aging' ? 0.15 : parish.generational === 'young' ? -0.1 : 0;
  const out: Record<string, number> = {};
  for (const d of liturgyDials) out[d.id] = Math.max(-1, Math.min(1, base + gen + rng.gaussian() * 0.25));
  return out;
}

/** The Mass as the last pastor left it: mostly what the people want, sometimes not. */
export function rollLiturgy(rng: Rng, parish: Parish, taste: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of liturgyDials) {
    const options = d.options.filter((o) => fits(parish, o));
    const want = taste[d.id] ?? 0;
    const nearest = [...options].sort((a, b) => Math.abs(a.lean - want) - Math.abs(b.lean - want));
    out[d.id] = (rng.chance(0.2) && nearest[1] ? nearest[1] : nearest[0]!).id;
  }
  return out;
}

/** Give a parish record its Mass and its taste if it has none yet. */
export function withLiturgy(rng: Rng, parish: Parish): Parish {
  if (parish.liturgy && parish.taste) return parish;
  const taste = parish.taste ?? rollTaste(rng.derive('taste'), parish);
  return { ...parish, taste, liturgy: parish.liturgy ?? rollLiturgy(rng.derive('mass'), parish, taste) };
}

export function currentParish(state: GameState): Parish | undefined {
  return state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
}

/** 0..1: how far the Mass as set is from what the people want, averaged over the dials. */
export function frictionOf(parish: Parish): number {
  if (!parish.liturgy || !parish.taste) return 0;
  let sum = 0;
  let n = 0;
  for (const d of liturgyDials) {
    const o = optionDef(d.id, parish.liturgy[d.id] ?? '');
    if (!o) continue;
    sum += Math.abs(o.lean - (parish.taste[d.id] ?? 0)) / 2;
    n += 1;
  }
  return n ? sum / n : 0;
}

/** The lean of the Mass as set, −1..1. */
export function leanOf(parish: Parish): number {
  if (!parish.liturgy) return 0;
  const leans = liturgyDials.map((d) => optionDef(d.id, parish.liturgy![d.id] ?? '')?.lean ?? 0);
  return leans.reduce((a, b) => a + b, 0) / Math.max(1, leans.length);
}

export function weeklyCost(parish: Parish): number {
  if (!parish.liturgy) return 0;
  return liturgyDials.reduce((n, d) => n + (optionDef(d.id, parish.liturgy![d.id] ?? '')?.cost ?? 0), 0);
}

export function frictionWord(f: number): string {
  return f < 0.12 ? 'the Mass the people wanted' : f < 0.25 ? 'about what the people expect' : f < 0.4 ? 'not quite their Mass' : f < 0.6 ? 'a Mass they argue about in the parking lot' : 'a Mass they did not ask for';
}

export function tasteWord(v: number): string {
  return v <= -0.5 ? 'the old ways' : v <= -0.15 ? 'a little tradition' : v < 0.15 ? 'no strong feeling' : v < 0.5 ? 'the way it has been since the council' : 'the newer way';
}

/** Whether each dial's options are open here, and who may turn them. */
export interface DialAvailability {
  def: LiturgyDialDef;
  current: string;
  options: { def: LiturgyOptionDef; available: boolean; why: string | null }[];
  /** Word for what the people want. */
  want: string;
  /** Distance of the current setting from the taste, in words. */
  fit: 'fits' | 'near' | 'far';
  changedWeeksAgo: number | null;
}

export function mayChangeMass(state: GameState): { ok: boolean; why: string | null } {
  if (!state.parish || !state.assignment) return { ok: false, why: 'No parish' };
  if (state.assignment.role === 'parochial_vicar') {
    const given = delegatedDials(state);
    return { ok: false, why: given.length ? `The pastor's Mass; he has left you ${given.map((d) => dialDef(d)?.label.toLowerCase() ?? d).join(' and ')}.` : "The pastor's Mass. A vicar says it as he finds it." };
  }
  if (state.mode.kind !== 'clock') return { ok: false, why: 'Not now' };
  return { ok: true, why: null };
}

/** The dials a pastor has left to his vicar, by his temperament: a mentor gives him something, an absent pastor gives him most of it. */
export function delegatedDials(state: GameState): string[] {
  if (state.assignment?.role !== 'parochial_vicar') return [];
  if (state.flags['boss:mentor']) return ['music', 'homily'];
  if (state.flags['boss:absent']) return ['language', 'music', 'homily', 'incense'];
  return [];
}

/** Whether this dial is the man's to set: the pastor's all, a vicar's what he was given. */
export function mayChangeDial(state: GameState, dial: string): { ok: boolean; why: string | null } {
  const may = mayChangeMass(state);
  if (may.ok) return may;
  if (state.assignment?.role === 'parochial_vicar' && state.mode.kind === 'clock' && delegatedDials(state).includes(dial)) return { ok: true, why: null };
  return may;
}

export function dialAvailability(state: GameState): DialAvailability[] {
  const parish = currentParish(state);
  if (!parish?.liturgy || !parish.taste) return [];
  return liturgyDials.map((def) => {
    const current = parish.liturgy![def.id] ?? def.options[0]!.id;
    const want = parish.taste![def.id] ?? 0;
    const cur = optionDef(def.id, current);
    const dist = cur ? Math.abs(cur.lean - want) / 2 : 0;
    const changed = parish.liturgyChanged?.[def.id];
    return {
      def,
      current,
      options: def.options.map((o) => ({ def: o, available: mayChangeDial(state, def.id).ok && fits(parish, o) && o.id !== current, why: !mayChangeDial(state, def.id).ok ? mayChangeDial(state, def.id).why : !fits(parish, o) ? 'Not the people for it here' : o.id === current ? 'As it is' : null })),
      want: tasteWord(want),
      fit: dist < 0.15 ? 'fits' : dist < 0.35 ? 'near' : 'far',
      changedWeeksAgo: changed === undefined ? null : state.clock.week - changed,
    };
  });
}

/**
 * Turn a dial. The parish feels it at once (the shock), the record notes it
 * (a semi-public stand on the liturgy in the direction turned), and the
 * weeks after decide whether the people come round.
 */
export function setDial(state: GameState, dial: string, option: string): GameState {
  const may = mayChangeDial(state, dial);
  if (!may.ok) throw new Error(may.why ?? 'not now');
  const parish = currentParish(state);
  const def = dialDef(dial);
  const o = optionDef(dial, option);
  if (!parish?.liturgy || !def || !o) throw new Error('no such dial');
  if (!fits(parish, o)) throw new Error('Not the people for it here');
  const before = optionDef(dial, parish.liturgy[dial] ?? '');
  if (before?.id === o.id) return state;
  const parishes = state.world!.parishes.map((p) => (p.id === parish.id ? { ...p, liturgy: { ...p.liturgy, [dial]: option }, liturgyChanged: { ...(p.liturgyChanged ?? {}), [dial]: state.clock.week } } : p));
  const direction = Math.sign(o.lean - (before?.lean ?? 0));
  let c = state.character!;
  c = { ...c, reputation: { ...c.reputation, parishioners: Math.max(-100, c.reputation.parishioners + LITURGY.shockSupport) } };
  if (direction !== 0 && Math.abs(o.lean - (before?.lean ?? 0)) >= 0.5) c = recordPosition(c, { topic: 'liturgy', value: direction * LITURGY.positionValue, volume: 'semi_public', week: state.clock.week });
  const line = `${def.label}: ${o.label.toLowerCase()}.`;
  return { ...state, character: c, world: { ...state.world!, parishes }, career: [...state.career, { week: state.clock.week, kind: 'project', text: `Changed the Mass at {parish}. ${line}` }] };
}

/** The week: what the Mass as set does to lay support, the blocs, and where attendance is heading. */
export function liturgyWeek(state: GameState): { state: GameState; pull: number; line: string | null } {
  const parish = currentParish(state);
  if (!parish?.liturgy || !parish.taste || !state.parish) return { state, pull: 0, line: null };
  const friction = frictionOf(parish);
  const lean = leanOf(parish);
  const fresh = Object.values(parish.liturgyChanged ?? {}).some((w) => state.clock.week - w < LITURGY.shockWeeks);
  const support = friction > LITURGY.tolerance ? LITURGY.supportPerFriction * (friction - LITURGY.tolerance) * (fresh ? 2 : 1) : LITURGY.supportWhenFitting;
  const c = state.character!;
  const rep = { ...c.reputation };
  rep.parishioners = Math.max(-100, Math.min(100, rep.parishioners + support));
  rep.traditional_bloc = Math.max(-100, Math.min(100, rep.traditional_bloc - lean * LITURGY.blocPerWeek));
  rep.progressive_bloc = Math.max(-100, Math.min(100, rep.progressive_bloc + lean * LITURGY.blocPerWeek));
  const pull = friction < LITURGY.tolerance ? LITURGY.pullWhenFitting * (1 - friction / LITURGY.tolerance) : LITURGY.pullPerFriction * (friction - LITURGY.tolerance);
  const cost = weeklyCost(parish);
  let next: GameState = { ...state, character: { ...c, reputation: rep } };
  next = noteMover(next, 'parishioners', support, 'the Mass as set');
  next = noteMover(next, 'traditional_bloc', -lean * LITURGY.blocPerWeek, 'the Mass as set');
  next = noteMover(next, 'progressive_bloc', lean * LITURGY.blocPerWeek, 'the Mass as set');
  if (cost > 0) next = { ...next, parish: { ...next.parish!, finance: { ...next.parish!.finance, cash: next.parish!.finance.cash - cost } } };
  const line = fresh && friction > 0.4 && state.clock.week % 4 === 0 ? 'There are letters about the Mass, and one of them went to the chancery.' : null;
  return { state: next, pull, line };
}
