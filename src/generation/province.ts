import type { DiocesePreset, HouseKind, Npc, OrderDef, OrderHouse, Province, ProvinceSeed, ProvinceTrajectory } from '@/types';
import type { Rng } from '@/engine/rng';
import { presetById } from '@/content/dioceses';
import { instituteDef } from '@/content/institutes';
import { provinceComplications } from '@/content/religious';
import { generateDiocese, type GeneratedDiocese } from './diocese';
import { synthDiocese, synthSees, presenceFor } from './dioceseSynth';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { finishNpc, rollAlignment, rollBaseStats } from './npc';
import { temperamentFor } from './institutes';

/**
 * A province of an order: its territory (the presets inside it, rolled as
 * they always are, and generated dioceses for the rest), its houses, and
 * every friar in it, each a generated NPC with an age, a house, and a vote.
 * E3 §3.2, §4.1, §12. Tunables are invented and marked.
 */
export const PROVINCE = {
  /** Houses by trajectory. Invented. */
  houses: { growing: [9, 12], stable: [7, 10], shrinking: [5, 8] } as Record<ProvinceTrajectory, [number, number]>,
  /** Members by house kind. Invented; E3 §3.2 says 4 to 40. */
  members: { priory: [6, 20], studium: [14, 32], novitiate: [6, 14], parish: [3, 8], school: [5, 12], mission: [3, 6], curia: [8, 18] } as Record<HouseKind, [number, number]>,
  /** Share of professed friars over sixty, by trajectory: many houses skew old. */
  old: { growing: 0.3, stable: 0.45, shrinking: 0.6 } as Record<ProvinceTrajectory, number>,
  /** Dollars per member a house budgets in a year. Invented. */
  budgetPerMember: 32_000,
  /** Council seats beside the provincial. */
  council: 4,
} as const;

export type ProvinceDiocese = GeneratedDiocese & { presetId: string; preset: DiocesePreset; generated: boolean };

export interface GeneratedProvince {
  province: Province;
  houses: OrderHouse[];
  friars: Npc[];
  dioceses: ProvinceDiocese[];
}

function rollTrajectory(rng: Rng, bias: ProvinceTrajectory | undefined): ProvinceTrajectory {
  const all: ProvinceTrajectory[] = ['growing', 'stable', 'shrinking'];
  if (bias && rng.chance(0.6)) return bias;
  return rng.pick(all);
}

/** The kinds of house a province of this size keeps, the formation houses first. */
function houseKinds(rng: Rng, order: OrderDef, n: number, trajectory: ProvinceTrajectory): HouseKind[] {
  const kinds: HouseKind[] = ['curia', 'novitiate'];
  if (trajectory !== 'shrinking' || rng.chance(0.5)) kinds.push('studium');
  const schools = order.houseNames.school.length ? (rng.chance(0.6) ? 2 : 1) : 0;
  for (let i = 0; i < schools; i++) kinds.push('school');
  while (kinds.length < n) kinds.push(rng.chance(0.55) ? 'priory' : 'parish');
  return kinds.slice(0, Math.max(n, 3));
}

function worksOf(kind: HouseKind): string[] {
  switch (kind) {
    case 'curia':
      return ['curia', 'priory_church'];
    case 'novitiate':
      return ['formation'];
    case 'studium':
      return ['formation', 'teaching'];
    case 'school':
      return ['school'];
    case 'parish':
      return ['parish'];
    case 'mission':
      return ['mission'];
    default:
      return ['priory_church', 'preaching'];
  }
}

function houseName(rng: Rng, order: OrderDef, kind: HouseKind, taken: Set<string>): string {
  const pool = kind === 'novitiate' ? order.houseNames.novitiate : kind === 'studium' ? order.houseNames.studium : kind === 'school' ? order.houseNames.school : order.houseNames.priory;
  const free = pool.filter((n) => !taken.has(n));
  const name = rng.pick(free.length ? free : pool);
  taken.add(name);
  return name;
}

/** One friar. Students and novices are young; the professed follow the province's pyramid. */
function friar(rng: Rng, order: OrderDef, house: Pick<OrderHouse, 'id' | 'alignment' | 'kind'>, year: number, n: number, standing: 'novice' | 'student' | 'professed', old: number): Npc {
  const age = standing === 'novice' ? rng.int(21, 33) : standing === 'student' ? rng.int(24, 36) : rng.chance(old) ? rng.int(61, 88) : rng.int(32, 60);
  const birthYear = year - age;
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const inst = instituteDef(order.instituteId);
  const brother = standing === 'professed' && rng.chance(0.12);
  const npc = finishNpc(rng, {
    id: `friar_${house.id}_${n}`,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'religious',
    title: standing === 'professed' && !brother ? 'Fr.' : 'Br.',
    birthYear,
    origin: rng.pick(['suburban', 'rural'] as const),
    stats: rollBaseStats(rng, 28, 64),
    relationship: rng.int(-5, 12),
  });
  const vows = standing === 'novice' ? 'vows:novice' : standing === 'student' ? 'vows:simple' : 'vows:solemn';
  return {
    ...npc,
    alignment: rollAlignment(rng, house.alignment, 18),
    institute: `inst_${order.instituteId}`,
    ...(inst ? { charism: inst.charism } : {}),
    temperament: temperamentFor(rng, inst?.charism ?? 'preaching'),
    tags: [...npc.tags, 'religious', 'friar', `order:${order.key}`, `house:${house.id}`, vows, ...(brother ? ['lay_brother'] : [])],
  };
}

export function generateProvince(rng: Rng, order: OrderDef, seed: ProvinceSeed, year: number): GeneratedProvince {
  const trajectory = rollTrajectory(rng.derive('trajectory'), seed.trajectoryBias);
  const hostility = rng.int(30, 85);
  const lean = (seed.dispositionBias ?? 0) + rng.float(-15, 15);
  const observant = Math.max(0.15, Math.min(0.7, 0.42 - lean / 200 + rng.float(-0.08, 0.08)));
  const progressive = Math.max(0.15, Math.min(0.7, 0.42 + lean / 200 + rng.float(-0.08, 0.08)));
  const alignment = Math.round((progressive - observant) * 120);

  // Territory: the presets inside it, then generated sees from its regions.
  const presets = seed.dioceseIds.map((id) => presetById(id)).filter((p): p is DiocesePreset => !!p);
  const want = rng.int(seed.dioceses[0], seed.dioceses[1]);
  const extra = rng.shuffle(synthSees(seed.regions, seed.dioceseIds)).slice(0, Math.max(0, want - presets.length));
  // Houses: how many, what kinds, and which diocese each sits in, decided before the dioceses roll so a generated diocese knows the order is there.
  const [lo, hi] = PROVINCE.houses[trajectory];
  const n = Math.max(3, Math.min(rng.int(lo, hi), (presets.length + extra.length) * 2));
  const kinds = houseKinds(rng.derive('kinds'), order, n, trajectory);
  const territoryIds = [...presets.map((p) => p.id), ...extra.map((s) => s.id)];
  const curiaId = territoryIds.find((id) => presets.find((p) => p.id === id)?.see === seed.curia || extra.find((s) => s.id === id)?.see === seed.curia) ?? territoryIds[0]!;
  const placement: string[] = kinds.map(() => '');
  placement[0] = curiaId;
  // Every preset diocese gets a house; the rest of the houses scatter, generated dioceses a little less often.
  const others = rng.shuffle(territoryIds.filter((id) => id !== curiaId));
  for (let i = 1; i < placement.length; i++) placement[i] = i - 1 < others.length ? others[i - 1]! : rng.pick(territoryIds);
  const housed = new Set(placement);

  const dioceses: ProvinceDiocese[] = [
    ...presets.map((preset) => ({ presetId: preset.id, preset, generated: false, ...generateDiocese(rng.derive(`diocese:${preset.id}`), preset, year) })),
    ...extra.map((see) => ({
      generated: true,
      ...synthDiocese(rng.derive(`synth:${see.id}`), see, year, { orders: { [order.instituteId]: { presence: presenceFor(rng, housed.has(see.id)) } } }),
    })),
  ];

  const provinceId = seed.id;
  const taken = new Set<string>();
  const houses: OrderHouse[] = [];
  const friars: Npc[] = [];
  const old = PROVINCE.old[trajectory];
  kinds.forEach((kind, i) => {
    const id = `${provinceId}:house${i + 1}`;
    const hrng = rng.derive(`house:${id}`);
    const houseAlignment = Math.max(-100, Math.min(100, Math.round(alignment + hrng.gaussian() * 22)));
    const [mlo, mhi] = PROVINCE.members[kind];
    const size = Math.max(3, Math.round(hrng.int(mlo, mhi) * (trajectory === 'shrinking' ? 0.75 : trajectory === 'growing' ? 1.1 : 1)));
    const house: OrderHouse = {
      id,
      provinceId,
      dioceseId: placement[i]!,
      name: houseName(hrng, order, kind, taken),
      kind,
      memberIds: [],
      priorId: '',
      cohesion: Math.round(hrng.float(30, 85)),
      observance: Math.max(5, Math.min(95, Math.round(55 - houseAlignment / 4 + hrng.gaussian() * 15))),
      alignment: houseAlignment,
      works: worksOf(kind),
      budget: Math.round((size * PROVINCE.budgetPerMember * hrng.float(0.8, 1.2)) / 1000) * 1000,
    };
    const members: Npc[] = [];
    for (let k = 0; k < size; k++) {
      const standing = kind === 'novitiate' ? (k < Math.min(size - 3, Math.ceil(size * 0.6)) ? 'novice' : 'professed') : kind === 'studium' ? (k < Math.ceil(size * 0.65) ? 'student' : 'professed') : 'professed';
      members.push(friar(hrng, order, house, year, k, standing, old));
    }
    // The prior: a solemnly professed man of the middle years, the one the house would follow.
    const eligible = members.filter((m) => m.tags.includes('vows:solemn') && !m.tags.includes('lay_brother') && year - m.birthYear >= 38 && year - m.birthYear <= 72);
    const professedMen = members.filter((m) => m.tags.includes('vows:solemn') && !m.tags.includes('lay_brother'));
    const prior = (eligible.length ? eligible : professedMen.length ? professedMen : members).map((m) => ({ m, s: m.stats.administration + m.stats.charisma + hrng.float(-20, 20) })).sort((a, b) => b.s - a.s)[0]!.m;
    prior.tags.push('prior');
    house.priorId = prior.id;
    // The formation houses have their own men: a novice master, a master of students, apart from the prior.
    if (kind === 'novitiate' || kind === 'studium') {
      const formator = (eligible.length > 1 ? eligible : members).filter((m) => m.id !== prior.id).sort((a, b) => b.stats.piety + b.stats.theology - (a.stats.piety + a.stats.theology))[0];
      if (formator) formator.tags.push(kind === 'novitiate' ? 'novice_master' : 'master_of_students');
    }
    house.memberIds = members.map((m) => m.id);
    houses.push(house);
    friars.push(...members);
  });

  // The provincial and his council, from the solemnly professed across the province; the provincial lives at the curia.
  const professed = friars.filter((f) => f.tags.includes('vows:solemn') && !f.tags.includes('lay_brother'));
  const curia = houses[0]!;
  const provincialPool = professed.filter((f) => f.tags.includes(`house:${curia.id}`) && year - f.birthYear >= 45 && year - f.birthYear <= 70 && !f.tags.includes('prior'));
  const provincial = rng.pick(provincialPool.length ? provincialPool : professed.filter((f) => f.tags.includes(`house:${curia.id}`)));
  provincial.tags.push('provincial');
  const councilPool = professed.filter((f) => f.id !== provincial.id && year - f.birthYear >= 40);
  const council = rng.shuffle(councilPool).slice(0, PROVINCE.council);
  for (const c of council) c.tags.push('councilor');
  const retired = friars.filter((f) => year - f.birthYear >= 70).length;
  const balance = Math.round((trajectory === 'growing' ? rng.float(0.5, 4) : trajectory === 'stable' ? rng.float(-1, 2.5) : rng.float(-4, 1)) * 1_000_000);

  const province: Province = {
    id: provinceId,
    order: order.key,
    name: seed.name,
    region: seed.region,
    dioceseIds: territoryIds,
    houseIds: houses.map((h) => h.id),
    friarIds: friars.map((f) => f.id),
    provincialId: provincial.id,
    councilIds: council.map((c) => c.id),
    curiaHouseId: curia.id,
    finances: { balance, retirementBurden: Math.round((retired / Math.max(1, friars.length)) * 100) / 100 },
    factions: { observant: Math.round(observant * 100) / 100, progressive: Math.round(progressive * 100) / 100, hostility },
    trajectory,
    provincialSince: year - rng.int(0, order.governance.provincialTermYears - 1),
    complication: rng.pick(provinceComplications),
    line: seed.line,
  };
  return { province, houses, friars, dioceses };
}

/** The friars of a house, from the state's people. */
export function membersOf(house: Pick<OrderHouse, 'memberIds'>, npcs: Record<string, Npc>): Npc[] {
  return house.memberIds.map((id) => npcs[id]).filter((n): n is Npc => !!n);
}
