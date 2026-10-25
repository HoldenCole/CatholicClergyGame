import type { DevotionDef, GameState, Quality, RecreationDef, SeminaryHorariumDef, SeminaryState } from '@/types';
import type { Rng } from '@/engine/rng';
import { devotionDefs, horariumDay, recreationDefs, seminaryHorariumDefs } from '@/content/seminary';
import { evaluateAll } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import { applyStat } from './stats';
import type { Mover } from './movers';

/**
 * The seminary as a house with a rule. DESIGN §6.1a. The horarium is the
 * house's and is kept at a level; the rule of prayer is the man's own, in his
 * own time; the evening is a habit. The vice-rector keeps a notebook. Numbers
 * invented; the lines and their effects are content/seminary/rule.json.
 */
export const RULE = {
  /** Devotions a man keeps at once: a rule, not a list. */
  maxDevotions: 3,
  /** Mornings late to the Office in a year before the notebook becomes a concern. */
  latesForConcern: 4,
  /** The chance a week has a late morning: the base, per point of strain over the floor, and the evening's own. */
  lateBase: 0.03,
  latePerStrain: 1 / 600,
  lateStrainFloor: 20,
  /** A rule kept in the morning gets a man up; the Office at the minimum lets him lie. */
  morningDevotion: -0.02,
  officeMin: 0.12,
  silenceMin: 0.05,
  /** Whether a late morning is seen: the vice-rector's temper. */
  noticedBase: 0.6,
  noticedEnforcer: 1.5,
  noticedConfidant: 0.6,
  /** Observance: where it settles for a standard house, what each line and devotion moves it, and how fast it follows. */
  observanceBase: 60,
  observancePerLevel: 8,
  observancePerDevotion: 4,
  observanceFollow: 0.08,
  observancePerLate: -3,
  /** Strain eased a week by rest, scaled by the recreation's rest. */
  restPerUnit: 1,
  /** The pillar a devotion's week moves, through its own effects. */
  concern: 'Late to the Office, and the vice-rector keeps a notebook',
} as const;

export function horariumDef(key: string): SeminaryHorariumDef | undefined {
  return seminaryHorariumDefs.find((d) => d.key === key);
}
export function devotionDef(id: string): DevotionDef | undefined {
  return devotionDefs.find((d) => d.id === id);
}
export function recreationDef(id: string): RecreationDef | undefined {
  return recreationDefs.find((d) => d.id === id);
}
export { horariumDay };

export function horariumOf(sem: SeminaryState): Record<string, Quality> {
  const out: Record<string, Quality> = {};
  for (const d of seminaryHorariumDefs) out[d.key] = sem.horarium?.[d.key] ?? 'standard';
  return out;
}

/** Free hours the week gains or loses from how the horarium is kept: the minimum frees, the invested level costs. */
export function horariumHourShift(sem: SeminaryState): number {
  const h = horariumOf(sem);
  return seminaryHorariumDefs.reduce((n, d) => n + d.hours[h[d.key]!], 0);
}

export function ruleOf(sem: SeminaryState): string[] {
  return (sem.rule ?? []).filter((id) => !!devotionDef(id));
}

export function recreationOf(sem: SeminaryState): RecreationDef | undefined {
  return sem.recreation ? recreationDef(sem.recreation) : undefined;
}

export function recreationOffered(state: GameState, def: RecreationDef): boolean {
  return !def.requires || evaluateAll(def.requires, state);
}

function withFlags(state: GameState, set: Record<string, boolean>, clearPrefix?: string): GameState {
  const flags = { ...state.flags };
  if (clearPrefix) for (const k of Object.keys(flags)) if (k.startsWith(clearPrefix)) delete flags[k];
  for (const [k, v] of Object.entries(set)) if (v) flags[k] = true;
  return { ...state, flags };
}

export function setSeminaryHorarium(state: GameState, key: string, quality: Quality): GameState {
  const sem = state.seminary;
  const def = horariumDef(key);
  if (!sem || !def) throw new Error(`no such line ${key}`);
  const horarium = { ...horariumOf(sem), [key]: quality };
  const next = { ...state, seminary: { ...sem, horarium } };
  return withFlags(next, { [`horarium:${key}:${quality}`]: true }, `horarium:${key}:`);
}

export function toggleDevotion(state: GameState, id: string): GameState {
  const sem = state.seminary;
  const def = devotionDef(id);
  if (!sem || !def) throw new Error(`no such devotion ${id}`);
  const rule = ruleOf(sem);
  let next: string[];
  if (rule.includes(id)) next = rule.filter((x) => x !== id);
  else {
    if (rule.length >= RULE.maxDevotions) throw new Error(`a rule is ${RULE.maxDevotions} things kept, not a list; let one go first`);
    next = [...rule, id];
  }
  const flags = Object.fromEntries(next.map((d) => [`rule:${d}`, true]));
  return withFlags({ ...state, seminary: { ...sem, rule: next } }, flags, 'rule:');
}

export function setRecreation(state: GameState, id: string | null): GameState {
  const sem = state.seminary;
  if (!sem) throw new Error('not in seminary');
  if (id) {
    const def = recreationDef(id);
    if (!def) throw new Error(`no such recreation ${id}`);
    if (!recreationOffered(state, def)) throw new Error(`${def.label}: not yet`);
  }
  const { recreation: _r, ...rest } = sem;
  void _r;
  const next: GameState = { ...state, seminary: id ? { ...rest, recreation: id } : rest };
  return withFlags(next, id ? { [`recreation:${id}`]: true } : {}, 'recreation:');
}

/** Where the house's view of his observance is heading, from what he keeps. */
export function observanceTarget(sem: SeminaryState): number {
  const h = horariumOf(sem);
  const level = (q: Quality) => (q === 'min' ? -1 : q === 'invested' ? 1 : 0);
  const lines = seminaryHorariumDefs.reduce((n, d) => n + level(h[d.key]!), 0);
  return Math.max(0, Math.min(100, RULE.observanceBase + lines * RULE.observancePerLevel + ruleOf(sem).length * RULE.observancePerDevotion));
}

export function observanceOf(sem: SeminaryState): number {
  return sem.observance ?? RULE.observanceBase;
}

export function observanceWord(v: number): string {
  return v >= 80 ? 'a man of the rule' : v >= 65 ? 'regular' : v >= 45 ? 'ordinary' : v >= 30 ? 'loose' : 'a problem';
}

export interface RuleWeekResult {
  state: GameState;
  lines: string[];
}

/**
 * One week of the rule: the horarium as kept moves piety, the pillars, and the
 * house's regard; the devotions move piety and cost rest; the evening eases
 * strain and warms a classmate; a late morning may be seen and written down.
 */
export function ruleWeek(state: GameState, rng: Rng): RuleWeekResult {
  const sem = state.seminary;
  const c = state.character;
  if (!sem || !c) return { state, lines: [] };
  const h = horariumOf(sem);
  let stats = c.stats;
  const pillarScores = { ...sem.pillarScores };
  const npcs = { ...state.npcs };
  const moves: Mover[] = [];
  let house = 0;
  let strainDelta = 0;
  const bump = (key: keyof typeof stats, delta: number, why: string) => {
    if (!delta) return;
    const before = stats[key];
    stats = applyStat(stats, key, delta);
    moves.push({ week: state.clock.week, key, delta: stats[key] - before, why });
  };
  for (const d of seminaryHorariumDefs) {
    const e = d.effects[h[d.key]!];
    bump('piety', e.piety ?? 0, d.label);
    if (e.spiritual) pillarScores.spiritual += e.spiritual;
    if (e.human) pillarScores.human += e.human;
    house += e.house ?? 0;
    strainDelta += e.strain ?? 0;
  }
  const phrases: string[] = [];
  for (const id of ruleOf(sem)) {
    const d = devotionDef(id)!;
    bump('piety', d.effects.piety ?? 0, d.label);
    bump('theology', d.effects.theology ?? 0, d.label);
    bump('knowledge', d.effects.knowledge ?? 0, d.label);
    if (d.effects.spiritual) pillarScores.spiritual += d.effects.spiritual;
    if (d.effects.human) pillarScores.human += d.effects.human;
    strainDelta += d.effects.strain ?? 0;
    phrases.push(d.digest[(state.clock.week + d.digest.length) % d.digest.length]!);
  }
  const rec = recreationOf(sem);
  if (rec) {
    bump('charisma', rec.effects.charisma ?? 0, rec.label);
    bump('piety', rec.effects.piety ?? 0, rec.label);
    bump('knowledge', rec.effects.knowledge ?? 0, rec.label);
    if (rec.effects.human) pillarScores.human += rec.effects.human;
    strainDelta -= (rec.effects.rest ?? 0) * RULE.restPerUnit;
    if (rec.effects.warmth) {
      const mate = resolveSelector({ ...state, npcs }, '@random_classmate', rng.derive(`recreation:${state.clock.week}`));
      if (mate) npcs[mate.id] = { ...mate, relationship: Math.max(-100, Math.min(100, mate.relationship + rec.effects.warmth)) };
    }
    phrases.push(rec.digest[(state.clock.week + rec.digest.length) % rec.digest.length]!);
  }
  // The house's regard: the rector a little, the vice-rector who runs the corridor more.
  for (const [tag, share] of [['rector', 0.5], ['vice_rector', 1]] as const) {
    const n = Object.values(npcs).find((x) => x.status === 'active' && x.tags.includes(tag));
    if (n && house) npcs[n.id] = { ...n, relationship: Math.max(-100, Math.min(100, n.relationship + house * share)) };
  }
  // A late morning: the night runs long, or the Office is kept loosely, and the vice-rector may see.
  const lines: string[] = [];
  let lates = sem.lates ?? 0;
  let concerns = sem.concerns;
  const strain = state.strain ?? 0;
  let late = RULE.lateBase + Math.max(0, strain - RULE.lateStrainFloor) * RULE.latePerStrain + (rec?.late ?? 0);
  if (h.office === 'min') late += RULE.officeMin;
  if (h.silence === 'min') late += RULE.silenceMin;
  if (ruleOf(sem).some((id) => devotionDef(id)?.when === 'morning')) late += RULE.morningDevotion;
  const roll = rng.derive(`late:${state.clock.week}`);
  let observanceHit = 0;
  if (roll.chance(Math.max(0, Math.min(0.9, late)))) {
    const temper = state.flags['vice_rector:enforcer'] ? RULE.noticedEnforcer : state.flags['vice_rector:confidant'] ? RULE.noticedConfidant : 1;
    if (roll.chance(Math.min(0.95, RULE.noticedBase * temper))) {
      lates++;
      observanceHit = RULE.observancePerLate;
      const vice = Object.values(npcs).find((x) => x.status === 'active' && x.tags.includes('vice_rector'));
      if (vice) npcs[vice.id] = { ...vice, relationship: Math.max(-100, vice.relationship - 1) };
      lines.push(lates >= RULE.latesForConcern ? 'Late to Lauds again, and this time the vice-rector wrote it down where the rector reads.' : 'Late to Lauds, and the vice-rector at the chapel door saw it.');
      if (lates >= RULE.latesForConcern && !concerns.includes(RULE.concern)) concerns = [...concerns, RULE.concern];
    } else {
      lines.push('Late to Lauds, and nobody at the door.');
    }
  }
  const observance = Math.max(0, Math.min(100, observanceOf(sem) + (observanceTarget(sem) - observanceOf(sem)) * RULE.observanceFollow + observanceHit));
  const next: GameState = {
    ...state,
    npcs,
    strain: Math.max(0, strain + strainDelta),
    movers: [...(state.movers ?? []), ...moves.filter((m) => m.delta !== 0)],
    character: { ...c, stats },
    seminary: { ...sem, pillarScores, lates, concerns, observance },
  };
  if (phrases.length && state.clock.week % 3 === 0) lines.unshift(`The rule: ${phrases.join(', ')}.`);
  return { state: next, lines };
}
