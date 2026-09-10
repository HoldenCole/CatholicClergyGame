import type { Career, EntryPath, Field, Npc, Origin, Stats } from '@/types';
import type { Rng } from '@/engine/rng';
import { creationContent } from '@/content/creation';
import { eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

/** DESIGN.md §9.2: class size rolls too. Invented weights. */
const CLASS_SIZE_WEIGHTS: Record<number, number> = { 6: 1, 7: 2, 8: 3, 9: 3, 10: 3, 11: 2, 12: 1 };
const ORIGIN_WEIGHTS: Record<Origin, number> = {
  urban_ethnic: 3,
  latino_immigrant: 3,
  rural: 2,
  suburban: 4,
  convert: 1,
  lapsed: 2,
};
const PATH_WEIGHTS: Record<EntryPath, number> = {
  high_school: 2,
  some_college: 1,
  college: 5,
  masters_1: 1,
  masters_2: 1,
  doctoral: 1,
};
const FIELD_WEIGHTS: Record<Field, number> = {
  business: 2,
  philosophy: 3,
  history_law: 1.5,
  stem: 2,
  classics: 1.5,
};

/** Stat deltas an option would give the player, reused so classmates are shaped by the same table. */
function statDeltas(effects: { target: string; key: string; delta?: number }[]): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const e of effects) {
    if (e.target === 'stat' && e.delta) out[e.key as keyof Stats] = (out[e.key as keyof Stats] ?? 0) + e.delta;
  }
  return out;
}

export function rollClassSize(rng: Rng): number {
  const sizes = Object.keys(CLASS_SIZE_WEIGHTS).map(Number);
  return rng.weighted(sizes, (s) => CLASS_SIZE_WEIGHTS[s] ?? 0);
}

/** One classmate from independent rolls. Alignment never looks at stats or background. */
export function generateClassmate(rng: Rng, index: number, entryYear: number): Npc {
  const c = creationContent;
  const origin = rng.weighted(Object.keys(ORIGIN_WEIGHTS) as Origin[], (o) => ORIGIN_WEIGHTS[o]);
  const originOpt = c.origins.find((o) => o.id === origin)!;
  const path = rng.weighted(Object.keys(PATH_WEIGHTS) as EntryPath[], (p) => PATH_WEIGHTS[p]);
  const pathOpt = c.paths.find((p) => p.id === path)!;
  const field: Field | null = pathOpt.hasField
    ? rng.weighted(Object.keys(FIELD_WEIGHTS) as Field[], (f) => FIELD_WEIGHTS[f])
    : null;
  const hasDegree = path !== 'high_school' && path !== 'some_college';
  let career: Career | null = null;
  let yearsWorked = 0;
  const careers = c.careers.filter((k) =>
    hasDegree ? k.requiresField.length === 0 || (field && k.requiresField.includes(field)) : k.noDegree,
  );
  if (careers.length && rng.chance(hasDegree ? 0.45 : 0.25)) {
    career = rng.pick(careers).id;
    yearsWorked = Math.max(1, Math.round(Math.abs(rng.gaussian()) * 5 + 1));
  }
  const entryAge = Math.min(40, pathOpt.entryAge + yearsWorked);
  const birthYear = entryYear - entryAge;

  let stats = rollBaseStats(rng, 22, 42);
  stats = addStats(stats, statDeltas(originOpt.effects));
  stats = addStats(stats, statDeltas(pathOpt.effects));
  if (field) stats = addStats(stats, statDeltas(c.fields.find((f) => f.id === field)!.effects));
  if (career) {
    const opt = c.careers.find((k) => k.id === career)!;
    stats = addStats(stats, statDeltas(opt.effects));
    stats = addStats(stats, { [opt.perYear.key]: Math.min(yearsWorked, 8) * opt.perYear.delta });
  }
  const motive = rng.pick(c.motives);
  stats = addStats(stats, statDeltas(motive.effects));
  // Independent noise so two men with the same background still differ.
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    stats[key] = Math.min(100, Math.max(0, Math.round(stats[key] + rng.gaussian() * 4)));
  }

  const heritage = rollHeritage(rng, originOpt.heritage);
  const npc = finishNpc(rng, {
    id: `cm_${index + 1}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'classmate',
    title: '',
    birthYear,
    origin,
    stats,
    alignment: rollAlignment(rng),
  });
  return { ...npc, formation: { entryAge, field, career } };
}

export function generateClass(rng: Rng, entryYear: number): Npc[] {
  const size = rollClassSize(rng);
  return Array.from({ length: size }, (_, i) => generateClassmate(rng, i, entryYear));
}
