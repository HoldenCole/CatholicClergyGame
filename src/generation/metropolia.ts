import type { Diocese, DioceseMetropolia, Metropolia, MetropoliaSee, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { metropoliaDefs, metropoliaOfSee, type MetropoliaDef, type MetropoliaSeeDef } from '@/content/metropolias';
import { synthPool, type SynthSee } from '@/content/dioceses/synth';
import { SYNTH } from './dioceseSynth';
import { generateBishop } from './bishop';

/**
 * The province, generated. E2 §2.1. The structure is data (which sees, whose
 * metropolitan); the bishops are rolled from the seed: a man for every see
 * but the home diocese's own, with the region's lean and a spread wide
 * enough that a province has a range of bishops in it. Tunables invented.
 */
export const METROPOLIA = {
  /** Alignment spread around the region's lean for a province's bishops. */
  spread: 30,
} as const;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** The pool's see for a city, told apart by state. */
export function poolSeeFor(def: MetropoliaSeeDef): SynthSee | undefined {
  const names = [def.see, ...(def.aliases ?? [])];
  return synthPool.sees.find((s) => names.includes(s.see) && s.state === def.state) ?? synthPool.sees.find((s) => names.includes(s.see));
}

/** The province a diocese sits in: by its see city, or the first of its region when the city is generated (rule 13). */
export function metropoliaDefFor(see: string, region: string, state?: string): { def: MetropoliaDef; rank: 'metropolitan' | 'suffragan' } {
  const found = metropoliaOfSee(see, state);
  if (found) return found;
  const byRegion = metropoliaDefs.find((d) => poolSeeFor(d.metropolitan)?.region === region) ?? metropoliaDefs[0]!;
  return { def: byRegion, rank: 'suffragan' };
}

/** What the card may say. */
export function visibleMetropolia(see: string, region: string, state?: string): DioceseMetropolia {
  const { def, rank } = metropoliaDefFor(see, region, state);
  return { id: def.id, name: def.name, rank, metropolitanSee: def.metropolitan.see, sees: def.suffragans.length + 1 };
}

function seeRecord(def: MetropoliaSeeDef, rank: MetropoliaSee['rank'], fallbackRegion: string): MetropoliaSee {
  const pool = poolSeeFor(def);
  return {
    id: pool?.id ?? `gen_${slug(def.see)}_${slug(def.state)}`,
    name: pool?.name ?? `${rank === 'metropolitan' ? 'Archdiocese' : 'Diocese'} of ${def.see}`,
    see: def.see,
    state: def.state,
    region: pool?.region ?? fallbackRegion,
    rank,
    ...(pool ? { poolId: pool.id } : {}),
  };
}

/** A bishop for a see of the province, from the region's lean and Rome's temper. */
export function generateSeeBishop(rng: Rng, see: MetropoliaSee, year: number, id: string, romeTemperament = 0): Npc {
  const lean = (SYNTH.regionLean[see.region] ?? 0) * 0.5 + romeTemperament * 0.5;
  const heritage = synthPool.heritage[see.region] ?? {};
  const { npc } = generateBishop(rng, { heritage, dispositionBias: lean + rng.float(-METROPOLIA.spread, METROPOLIA.spread) }, year, id);
  return { ...npc, title: see.rank === 'metropolitan' ? 'Archbishop' : 'Bishop', tags: [...npc.tags.filter((t) => t !== 'bishop'), 'province_bishop', `see:${see.id}`] };
}

/** The province of a diocese: every see but its own, each with a bishop. */
export function generateMetropolia(rng: Rng, diocese: Pick<Diocese, 'visible'>, year: number, state?: string): { metropolia: Metropolia; npcs: Npc[] } {
  const { def, rank } = metropoliaDefFor(diocese.visible.see, diocese.visible.region, state);
  const home = diocese.visible.see;
  const defs: [MetropoliaSeeDef, MetropoliaSee['rank']][] = [[def.metropolitan, 'metropolitan'], ...def.suffragans.map((s): [MetropoliaSeeDef, MetropoliaSee['rank']] => [s, 'suffragan'])];
  const npcs: Npc[] = [];
  const sees: MetropoliaSee[] = [];
  for (const [d, r] of defs) {
    if ([d.see, ...(d.aliases ?? [])].includes(home)) continue;
    const rec = seeRecord(d, r, diocese.visible.region);
    const npc = generateSeeBishop(rng.derive(`bishop:${rec.id}`), rec, year, `${rec.id}:bishop`);
    npcs.push(npc);
    sees.push({ ...rec, bishopId: npc.id, installedYear: year - Math.min(year - npc.birthYear - 45, rng.int(1, 12)) });
  }
  return { metropolia: { id: def.id, name: def.name, metropolitanSee: def.metropolitan.see, rank, sees }, npcs };
}
