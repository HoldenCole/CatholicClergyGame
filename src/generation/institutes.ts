import type { BishopRelation, DiocesePreset, Institute, InstituteDef, InstituteTrajectory, InstituteWork, Npc, Temperament } from '@/types';
import { TEMPERAMENTS } from '@/types';
import type { Rng } from '@/engine/rng';
import { instituteDef, instituteDefs } from '@/content/institutes';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollFemaleName, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

/**
 * The religious present in a diocese. DESIGN.md §9.4: two to four institutes,
 * weighted by the preset, and four to six named religious in standing roles,
 * rolled on the same independent-attribute model as classmates.
 */
export const RELIGIOUS = {
  institutes: [2, 4] as [number, number],
  /** Named religious generated from those institutes. */
  cast: [4, 6] as [number, number],
  /** Cities a provincial sits in. Never this one: that is the point of him. */
  provincials: ['Chicago', 'Saint Louis', 'New York', 'Baltimore', 'Denver', 'Oakland', 'Cincinnati', 'Milwaukee', 'Toronto', 'Rome'],
} as const;

/** The works this diocese can actually offer an institute. */
function worksAvailable(preset: DiocesePreset): InstituteWork[] {
  const out: InstituteWork[] = ['parish', 'high_school', 'retreat_house'];
  if (preset.institutions.includes('catholic_university')) out.push('university');
  if (preset.institutions.includes('hospital_system')) out.push('hospital');
  if (preset.institutions.includes('major_seminary')) out.push('seminary_faculty');
  if (preset.institutions.includes('catholic_charities')) out.push('shelter', 'clinic');
  if (preset.size !== 'small') out.push('monastery');
  return out;
}

/** How likely this diocese is to have that institute at all. */
function weightFor(def: InstituteDef, preset: DiocesePreset, available: InstituteWork[]): number {
  if (!def.works.some((w) => available.includes(w))) return 0;
  let w = 10;
  // The presbyterate's own tilt pulls institutes toward it: a traditional bloc keeps a traditional house alive.
  w *= 1 + (def.lean * preset.dispositionBias) / 10_000;
  if (def.charism === 'tradition') w *= preset.dispositionBias <= -10 ? 2.2 : preset.dispositionBias >= 20 ? 0.25 : 0.8;
  if (def.charism === 'scholarship' && available.includes('university')) w *= 2;
  if (def.charism === 'healthcare' && available.includes('hospital')) w *= 2.2;
  if (def.charism === 'teaching') w *= 1.4;
  if (def.charism === 'contemplative' && preset.size === 'small') w *= 0.6;
  if (def.charism === 'mission' && preset.latinoShare > 0.25) w *= 1.4;
  return Math.max(0.5, w);
}

/** Two to four institutes, one of them a women's congregation, each holding what the diocese has room for. */
export function generateInstitutes(rng: Rng, preset: DiocesePreset): Institute[] {
  const available = worksAvailable(preset);
  const pool = instituteDefs.filter((d) => weightFor(d, preset, available) > 0);
  const count = rng.int(RELIGIOUS.institutes[0], RELIGIOUS.institutes[1]);
  const chosen: InstituteDef[] = [];
  // At least one women's congregation: they run the schools and the hospitals, and the pastor answers to none of them.
  const women = pool.filter((d) => d.women);
  if (women.length) chosen.push(rng.weighted(women, (d) => weightFor(d, preset, available)));
  while (chosen.length < count) {
    const rest = pool.filter((d) => !chosen.some((c) => c.id === d.id));
    if (rest.length === 0) break;
    chosen.push(rng.weighted(rest, (d) => weightFor(d, preset, available)));
  }
  const taken = new Set<InstituteWork>();
  return chosen.map((def) => {
    const mine = def.works.filter((w) => available.includes(w) && (w === 'parish' || !taken.has(w)));
    const held = mine.filter((_w, i) => i === 0 || rng.chance(0.55));
    for (const w of held) taken.add(w);
    const trajectory = rng.weighted(['growing', 'stable', 'collapsing'] as InstituteTrajectory[], (t) =>
      t === 'collapsing' ? (def.women ? 3 : 2) : t === 'growing' ? (def.lean <= -20 ? 2.5 : 1) : 3,
    );
    return {
      id: `inst_${def.id}`,
      defId: def.id,
      name: def.name,
      short: def.short,
      initials: def.initials,
      women: def.women,
      charism: def.charism,
      alignment: rollAlignment(rng, def.lean, 18),
      trajectory,
      size: Math.max(3, Math.round((trajectory === 'collapsing' ? 14 : trajectory === 'growing' ? 26 : 20) + rng.gaussian() * 8)),
      works: held.length ? held : ['parish'],
      bishop: rng.weighted(['warm', 'correct', 'strained'] as BishopRelation[], (b) => (b === 'correct' ? 4 : b === 'warm' ? 3 : def.charism === 'tradition' ? 3 : 1.5)),
      provincial: rng.pick([...RELIGIOUS.provincials]),
    };
  });
}

/** The standing roles §9.4 names. Each is filled when an institute in the diocese can fill it. */
const MEN_ROLES = [
  { tag: 'religious:theologian', needs: 'university' as InstituteWork, line: 'teaches theology at the university' },
  { tag: 'religious:pastor', needs: 'parish' as InstituteWork, line: 'pastor of the order’s parish' },
  { tag: 'religious:chaplain', needs: 'hospital' as InstituteWork, line: 'chaplain at the hospital' },
  { tag: 'religious:retreat_master', needs: 'retreat_house' as InstituteWork, line: 'gives the retreats' },
  { tag: 'religious:preacher', needs: 'parish' as InstituteWork, line: 'preaches the parish missions' },
  { tag: 'religious:contemplative', needs: 'monastery' as InstituteWork, line: 'of the monastery, rarely seen' },
];

const WOMEN_ROLES = [
  { tag: 'religious:principal', needs: 'high_school' as InstituteWork, line: 'runs the school' },
  { tag: 'religious:superior', needs: 'shelter' as InstituteWork, line: 'local superior, and runs the house' },
  { tag: 'religious:prioress', needs: 'monastery' as InstituteWork, line: 'prioress of the monastery' },
  { tag: 'religious:nurse', needs: 'hospital' as InstituteWork, line: 'at the hospital, forty years' },
];

/** The temperament a charism tends to produce, rolled around rather than fixed. */
function temperamentFor(rng: Rng, charism: string): Temperament {
  const lean: Record<string, Temperament> = {
    preaching: 'scholarly',
    scholarship: 'scholarly',
    contemplative: 'contemplative',
    poverty: 'warm',
    mission: 'brisk',
    teaching: 'brisk',
    healthcare: 'brisk',
    charity: 'warm',
    tradition: 'severe',
  };
  return rng.chance(0.55) ? (lean[charism] ?? 'warm') : rng.pick([...TEMPERAMENTS]);
}

/**
 * Four to six named religious, rolled independently and tagged with the role
 * each fills. They persist for the whole game and never enter the terna.
 */
export function generateReligious(rng: Rng, institutes: Institute[], year: number): Npc[] {
  const out: Npc[] = [];
  const held = new Set(institutes.flatMap((i) => i.works));
  const roles = [
    ...MEN_ROLES.filter((r) => held.has(r.needs) && institutes.some((i) => !i.women && i.works.includes(r.needs))),
    ...WOMEN_ROLES.filter((r) => held.has(r.needs) && institutes.some((i) => i.women && i.works.includes(r.needs))),
  ];
  const want = Math.min(rng.int(RELIGIOUS.cast[0], RELIGIOUS.cast[1]), roles.length);
  for (const role of rng.shuffle(roles).slice(0, want)) {
    const women = WOMEN_ROLES.some((r) => r.tag === role.tag);
    const house = rng.pick(institutes.filter((i) => i.women === women && i.works.includes(role.needs)));
    if (!house) continue;
    const birthYear = year - rng.int(38, 74);
    const heritage = rollHeritage(rng, CLERGY_HERITAGE);
    const era = eraForBirthYear(birthYear);
    const def = instituteDefs.find((d) => d.id === house.defId)!;
    const npc = finishNpc(rng, {
      id: `religious_${house.defId}_${role.tag.split(':')[1]}`,
      name: women ? rollFemaleName(rng, heritage) : rollMaleName(rng, heritage, era),
      role: 'religious',
      title: rng.pick([...def.titles]),
      birthYear,
      origin: 'suburban',
      // Their gifts follow the charism; everything else rolls free, as a classmate's does.
      stats: addStats(rollBaseStats(rng, 34, 62), charismStats(house.charism)),
      relationship: rng.int(-5, 20),
    });
    out.push({
      ...npc,
      alignment: rollAlignment(rng, house.alignment, 14),
      institute: house.id,
      charism: house.charism,
      temperament: temperamentFor(rng, house.charism),
      tags: [...npc.tags, 'religious', role.tag, `institute:${house.id}`],
    });
  }
  return out;
}

function charismStats(charism: string): Partial<Record<'administration' | 'charisma' | 'theology' | 'knowledge' | 'piety', number>> {
  switch (charism) {
    case 'preaching': return { charisma: 18, theology: 14 };
    case 'scholarship': return { knowledge: 22, theology: 16 };
    case 'contemplative': return { piety: 26, theology: 8 };
    case 'poverty': return { piety: 14, charisma: 10 };
    case 'mission': return { charisma: 14, piety: 10 };
    case 'teaching': return { knowledge: 16, administration: 12 };
    case 'healthcare': return { administration: 16, charisma: 10 };
    case 'charity': return { charisma: 12, administration: 10, piety: 8 };
    default: return { piety: 16, theology: 12 };
  }
}

/**
 * Most seminary faculty are religious, and these are the player's first
 * religious contacts. DESIGN.md §6.6: the formation staff is drawn from the
 * institutes present plus one or two from outside, and they persist for the
 * whole game. The role stays `formator`, because the rector and the professors
 * are still the external forum; what changes is whose house they belong to.
 */
export function makeFormatorsReligious(rng: Rng, formators: Npc[], institutes: Institute[]): Npc[] {
  const houses = institutes.filter((i) => !i.women);
  // One or two from outside the diocese, so the seminary is not a closed room.
  const outside = instituteDefs.filter((d) => !d.women && !houses.some((h) => h.defId === d.id));
  return formators.map((n) => {
    // The rector is the diocesan bishop's man and stays secular; the vocation director is chancery.
    if (n.tags.includes('rector') || n.role === 'official' || n.role === 'bishop') return n;
    const wantsReligious = n.tags.includes('spiritual_director') ? rng.chance(0.85) : rng.chance(0.6);
    if (!wantsReligious) return n;
    const house = houses.length && rng.chance(0.7) ? rng.pick(houses) : undefined;
    const def = house ? instituteDef(house.defId)! : outside.length ? rng.pick(outside) : undefined;
    if (!def) return n;
    return {
      ...n,
      title: rng.chance(0.85) ? 'Fr.' : rng.pick([...def.titles]),
      institute: house ? house.id : `inst_${def.id}`,
      charism: def.charism,
      temperament: temperamentFor(rng, def.charism),
      tags: [...new Set([...n.tags, 'religious', `institute:${house ? house.id : `inst_${def.id}`}`])],
    };
  });
}
