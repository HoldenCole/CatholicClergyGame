import type { DiocesePreset, FinancialState, Institution, OrderPresence, ParishKind } from '@/types';
import type { Rng } from '@/engine/rng';
import { synthPool, type SynthSee } from '@/content/dioceses/synth';
import { diocesePresets } from '@/content/dioceses';
import { generateDiocese, type GeneratedDiocese } from './diocese';

/**
 * A complete diocese preset with no preset behind it: the same schema the
 * ten authored ones use (CLAUDE.md rule 5), built from a real see city and
 * generic pools, so a province can span dioceses the game has never authored
 * and generateDiocese runs on it unchanged. E3 §13.4. No real church is
 * named: every parish here is rolled.
 */
export const SYNTH = {
  /** Parishes by size. Fewer than the authored presets carry, which name every real church. */
  parishes: { small: 14, medium: 20, large: 28, huge: 36 } as Record<DiocesePreset['size'], number>,
  /** Map width in miles by size. */
  milesAcross: { small: 90, medium: 120, large: 160, huge: 220 } as Record<DiocesePreset['size'], number>,
  /** Kind shares before the Latino share tilts them. */
  kinds: { flagship_suburban: 0.3, struggling_urban: 0.2, immigrant_growing: 0.15, rural: 0.25, difficult: 0.1 } as Record<ParishKind, number>,
  /** How much a region tilts the presbyterate. */
  regionLean: { Northeast: 5, 'Mid-Atlantic': 0, Midwest: -5, South: -10, Southwest: -8, 'Mountain West': -10, West: 8 } as Record<string, number>,
} as const;

const MILES_PER_DEGREE = 69.17;

/** Every parish name the authored presets roll from, once each: the pool a generated diocese names its churches from. */
const PARISH_NAMES: string[] = [...new Set(diocesePresets.flatMap((p) => p.parishSeeds.flatMap((s) => s.patrons)))];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** A town name no other place of this diocese carries. */
function townName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const name = `${rng.pick(synthPool.townPrefixes)} ${rng.pick(synthPool.townSuffixes)}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const name = `${rng.pick(synthPool.townPrefixes)} ${rng.pick(synthPool.townSuffixes)} ${taken.size}`;
  taken.add(name);
  return name;
}

/** A point some miles from the see, as a coordinate. */
function near(rng: Rng, see: SynthSee, minMiles: number, maxMiles: number): { lat: number; lon: number } {
  const miles = rng.float(minMiles, maxMiles);
  const angle = rng.float(0, Math.PI * 2);
  const lat = see.lat + (Math.sin(angle) * miles) / MILES_PER_DEGREE;
  const lon = see.lon + (Math.cos(angle) * miles) / (MILES_PER_DEGREE * Math.cos((see.lat * Math.PI) / 180));
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

function rollInstitutions(rng: Rng, size: DiocesePreset['size']): Institution[] {
  const out: Institution[] = ['catholic_charities'];
  const big = size === 'large' || size === 'huge';
  if (big || rng.chance(0.6)) out.push('school_network');
  if (rng.chance(big ? 0.7 : 0.4)) out.push('hospital_system');
  if (rng.chance(big ? 0.45 : 0.15)) out.push('catholic_university');
  if (rng.chance(big ? 0.3 : 0.1)) out.push('major_seminary');
  if (rng.chance(0.25)) out.push('diocesan_media');
  if (rng.chance(0.15)) out.push('shrine');
  return out;
}

export interface SynthOptions {
  /** The orders' presence here, when a province has set it. */
  orders?: DiocesePreset['orders'];
}

/**
 * Build the preset: the bias layer a rolled diocese needs. Deterministic
 * from the rng and the see.
 */
export function synthPreset(rng: Rng, see: SynthSee, opts: SynthOptions = {}): DiocesePreset {
  const size = see.size;
  const wealth = Math.max(1, Math.min(5, Math.round(rng.float(1.5, 4.5) + (see.growth === 'fast' ? 0.5 : see.growth === 'shrinking' ? -0.5 : 0))));
  const financialWeights: Record<FinancialState, number> = wealth >= 4 ? { healthy: 3, strained: 2, crisis: 1 } : wealth >= 3 ? { healthy: 2, strained: 3, crisis: 1 } : { healthy: 1, strained: 3, crisis: 2 };
  const taken = new Set<string>();
  const miles = SYNTH.milesAcross[size];
  // The see city's neighborhoods, close in; the towns, farther out.
  const hoods = rng.shuffle(synthPool.neighborhoods).slice(0, size === 'small' ? 6 : size === 'medium' ? 8 : 10);
  const places: { name: string; lat: number; lon: number }[] = hoods.map((name) => ({ name, ...near(rng, see, 1, miles * 0.06) }));
  const suburbs = Array.from({ length: size === 'small' ? 4 : 6 }, () => ({ name: townName(rng, taken), ...near(rng, see, miles * 0.08, miles * 0.22) }));
  const towns = Array.from({ length: size === 'small' ? 5 : 8 }, () => ({ name: townName(rng, taken), ...near(rng, see, miles * 0.22, miles * 0.46) }));
  places.push(...suburbs, ...towns);
  // Parish seeds: the cathedral downtown, then the kinds by share, the Latino share feeding the immigrant parishes.
  const n = SYNTH.parishes[size];
  const shares: Record<ParishKind, number> = { ...SYNTH.kinds };
  shares.immigrant_growing += see.latinoShare * 0.3;
  shares.flagship_suburban -= see.latinoShare * 0.15;
  shares.rural -= see.latinoShare * 0.15;
  const kinds: ParishKind[] = [];
  const order: ParishKind[] = ['flagship_suburban', 'struggling_urban', 'immigrant_growing', 'rural', 'difficult'];
  for (const k of order) for (let i = 0; i < Math.max(1, Math.round((n - 1) * shares[k])); i++) kinds.push(k);
  const placesFor = (k: ParishKind): string[] => {
    const pool = k === 'rural' ? towns : k === 'flagship_suburban' ? suburbs : k === 'difficult' ? [...hoods.map((h) => ({ name: h })), ...towns] : hoods.map((h) => ({ name: h }));
    return rng.shuffle(pool.map((p) => p.name)).slice(0, 3);
  };
  const patronPool = rng.shuffle(PARISH_NAMES);
  let pi = 0;
  const nextPatrons = (): string[] => {
    const out = [patronPool[pi++ % patronPool.length]!, patronPool[pi++ % patronPool.length]!, patronPool[pi++ % patronPool.length]!];
    return out;
  };
  const parishSeeds: DiocesePreset['parishSeeds'] = [
    { kind: 'struggling_urban', places: ['Downtown'], patrons: nextPatrons(), cathedral: true },
    ...rng.shuffle(kinds).slice(0, n - 1).map((kind) => ({ kind, places: placesFor(kind), patrons: nextPatrons() })),
  ];
  if (!places.some((p) => p.name === 'Downtown')) places.unshift({ name: 'Downtown', lat: see.lat, lon: see.lon });
  const heritage = { ...(synthPool.heritage[see.region] ?? synthPool.heritage.Midwest!) };
  heritage.mexican = (heritage.mexican ?? 0.5) * (0.5 + see.latinoShare * 3);
  const voice = synthPool.voice[see.climate];
  const preset: DiocesePreset = {
    id: see.id,
    name: see.name,
    see: see.see,
    region: see.region,
    size,
    wealth,
    mediaExposure: size === 'large' ? rng.int(2, 4) : rng.int(1, 3),
    romeConnection: rng.int(1, 3),
    latinoShare: see.latinoShare,
    growth: see.growth,
    dispositionBias: Math.round((SYNTH.regionLean[see.region] ?? 0) + rng.float(-20, 20)),
    shortageBias: see.growth === 'shrinking' ? rng.int(3, 5) : rng.int(3, 4),
    financialWeights,
    institutions: rollInstitutions(rng, size),
    character: {
      base: rng.shuffle(synthPool.character.base).slice(0, 5),
      byNeed: synthPool.character.byNeed,
      byFinancial: synthPool.character.byFinancial,
      byTension: synthPool.character.byTension,
    },
    complications: rng.shuffle(synthPool.complications).slice(0, 4),
    hiddenComplications: rng.shuffle(synthPool.hiddenComplications).slice(0, 3),
    parishSeeds,
    map: { lat: see.lat, lon: see.lon, milesAcross: miles },
    places,
    heritage,
    seminaryName: rng.pick(synthPool.seminaries),
    voice: { weather: [...voice.weather], sunday: [...voice.sunday], presbyterate: [...voice.presbyterate] },
    orders: opts.orders ?? {},
  };
  return preset;
}

/** The see cities of some regions, none of them a preset's, in a stable order. */
/** One see of the pool by its city, for a province that keeps a formation house there. */
export function synthSeeNamed(see: string): SynthSee | undefined {
  return synthPool.sees.find((s) => s.see === see);
}

export function synthSees(regions: readonly string[], exclude: readonly string[] = []): SynthSee[] {
  const presetSees = new Set(exclude);
  return synthPool.sees.filter((s) => regions.includes(s.region) && !presetSees.has(s.id) && !presetSees.has(slug(s.see)));
}

/** A rolled diocese, complete, from a see city. Presets always win where one exists. */
export function synthDiocese(rng: Rng, see: SynthSee, year: number, opts: SynthOptions = {}): GeneratedDiocese & { presetId: string; preset: DiocesePreset } {
  const preset = synthPreset(rng.derive('preset'), see, opts);
  return { presetId: preset.id, preset, ...generateDiocese(rng.derive('diocese'), preset, year) };
}

/** Presence of an order in a generated diocese, for a province's territory. */
export function presenceFor(rng: Rng, hasHouse: boolean): OrderPresence {
  if (hasHouse) return rng.chance(0.4) ? 'strong' : 'present';
  return rng.chance(0.5) ? 'thin' : 'none';
}
