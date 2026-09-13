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

/** What is set on a dial: one option, or for a multi dial every option held, in content order. */
export function selectedOf(parish: Parish, dial: string): string[] {
  const raw = parish.liturgy?.[dial] ?? '';
  const def = dialDef(dial);
  if (!def?.multi) return raw ? [raw] : [];
  const held = new Set(raw.split('+').filter(Boolean));
  return def.options.filter((o) => held.has(o.id)).map((o) => o.id);
}

/** Every option chosen on every dial, as defs. */
function chosenOptions(parish: Parish): LiturgyOptionDef[] {
  return liturgyDials.flatMap((d) => selectedOf(parish, d.id).map((id) => optionDef(d.id, id)).filter((o): o is LiturgyOptionDef => !!o));
}

/** Older records kept a community's Mass on the language dial; it moves to the communities' dial. */
export function migrateLiturgy(parish: Parish): Parish {
  if (!parish.liturgy) return parish;
  const lang = parish.liturgy.language;
  const comm = dialDef('communities');
  if (!comm) return parish;
  if (lang && comm.options.some((o) => o.id === lang)) {
    const held = new Set((parish.liturgy.communities ?? '').split('+').filter(Boolean));
    held.add(lang);
    return { ...parish, liturgy: { ...parish.liturgy, language: 'english', communities: comm.options.filter((o) => held.has(o.id)).map((o) => o.id).join('+') } };
  }
  if (parish.liturgy.communities === undefined) return { ...parish, liturgy: { ...parish.liturgy, communities: '' } };
  return parish;
}

/** What the people want, per dial, from the parish's alignment and generation, with noise. */
export function rollTaste(rng: Rng, parish: Parish): Record<string, number> {
  const base = parish.alignment / 100;
  const gen = parish.generational === 'aging' ? 0.15 : parish.generational === 'young' ? -0.1 : 0;
  const out: Record<string, number> = {};
  for (const d of liturgyDials) if (!d.multi) out[d.id] = Math.max(-1, Math.min(1, base + gen + rng.gaussian() * 0.25));
  return out;
}

/** The Mass as the last pastor left it: mostly what the people want, sometimes not. */
export function rollLiturgy(rng: Rng, parish: Parish, taste: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of liturgyDials) {
    const options = d.options.filter((o) => fits(parish, o));
    if (d.multi) {
      // The communities' Masses the last pastor kept: most of those the parish has the people for.
      out[d.id] = options.filter(() => rng.chance(0.75)).map((o) => o.id).join('+');
      continue;
    }
    const want = taste[d.id] ?? 0;
    const nearest = [...options].sort((a, b) => Math.abs(a.lean - want) - Math.abs(b.lean - want));
    out[d.id] = (rng.chance(0.2) && nearest[1] ? nearest[1] : nearest[0]!).id;
  }
  return out;
}

/** Give a parish record its Mass and its taste if it has none yet. */
export function withLiturgy(rng: Rng, parish: Parish): Parish {
  if (parish.liturgy && parish.taste) return migrateLiturgy(parish);
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
    if (d.multi) continue;
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
  const leans = chosenOptions(parish).map((o) => o.lean);
  return leans.reduce((a, b) => a + b, 0) / Math.max(1, leans.length);
}

export function weeklyCost(parish: Parish): number {
  if (!parish.liturgy) return 0;
  return chosenOptions(parish).reduce((n, o) => n + (o.cost ?? 0), 0);
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
  /** Everything held on the dial: one id, or several for a multi dial. */
  selected: string[];
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
  if (state.flags['boss:absent']) return ['language', 'communities', 'music', 'homily', 'incense'];
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
    const selected = selectedOf(parish, def.id);
    const current = def.multi ? (parish.liturgy![def.id] ?? '') : (parish.liturgy![def.id] ?? def.options[0]!.id);
    const want = parish.taste![def.id] ?? 0;
    const cur = def.multi ? undefined : optionDef(def.id, current);
    const dist = cur ? Math.abs(cur.lean - want) / 2 : 0;
    const changed = parish.liturgyChanged?.[def.id];
    const may = mayChangeDial(state, def.id);
    return {
      def,
      current,
      selected,
      options: def.options.map((o) => ({
        def: o,
        available: may.ok && fits(parish, o) && (def.multi || o.id !== current),
        why: !may.ok ? may.why : !fits(parish, o) ? 'Not the people for it here' : def.multi ? (selected.includes(o.id) ? 'Held; click to drop it' : 'Click to add it alongside the rest') : o.id === current ? 'As it is' : null,
      })),
      want: def.multi ? 'as many as the parish has people for' : tasteWord(want),
      fit: def.multi ? 'fits' : dist < 0.15 ? 'fits' : dist < 0.35 ? 'near' : 'far',
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
  if (def.multi) {
    // A community's Mass is added or dropped alongside the rest; the parish feels it, the record does not tilt.
    const held = new Set(selectedOf(parish, dial));
    const adding = !held.has(o.id);
    if (adding) held.add(o.id); else held.delete(o.id);
    const value = def.options.filter((x) => held.has(x.id)).map((x) => x.id).join('+');
    const parishes = state.world!.parishes.map((p) => (p.id === parish.id ? { ...p, liturgy: { ...p.liturgy, [dial]: value }, liturgyChanged: { ...(p.liturgyChanged ?? {}), [dial]: state.clock.week } } : p));
    const c = state.character!;
    const shock = adding ? Math.round(LITURGY.shockSupport / 2) : LITURGY.shockSupport;
    const character = { ...c, reputation: { ...c.reputation, parishioners: Math.max(-100, c.reputation.parishioners + shock) } };
    return { ...state, character, world: { ...state.world!, parishes }, career: [...state.career, { week: state.clock.week, kind: 'project', text: `${adding ? 'Added' : 'Dropped'} a Mass at {parish}: ${o.label.toLowerCase()}.` }] };
  }
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
