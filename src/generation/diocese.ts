import type {
  ClergyNeed,
  Diocese,
  DiocesePreset,
  FinancialState,
  Institution,
  Npc,
  Parish,
  ScandalHandling,
  Tension,
} from '@/types';
import type { Rng } from '@/engine/rng';
import { generateBishop, PRIORITY_LABEL, temperamentLine } from './bishop';
import { generateChancery } from './chancery';
import { generateParishes } from './parishes';

export interface GeneratedDiocese {
  diocese: Diocese;
  parishes: Parish[];
  npcs: Npc[];
}

export function clergyNeedOf(shortage: number): ClergyNeed {
  if (shortage >= 5) return 'critically_short';
  if (shortage >= 3) return 'stretched';
  if (shortage === 2) return 'adequate';
  return 'deep_bench';
}

export function tensionOf(hostility: number): Tension {
  if (hostility < 35) return 'one_voice';
  if (hostility < 70) return 'quietly_split';
  return 'openly_divided';
}

const INSTITUTION_LINES: Record<Institution, string> = {
  major_seminary: 'A major seminary: faculty appointments, and a rector who notices who is good.',
  catholic_university: 'A Catholic university: strong academic tracks and donors who read.',
  hospital_system: 'A hospital system: chaplaincies, bioethics, and a constituency of physicians.',
  school_network: 'A large school system: a superintendent’s office that needs priests who can run things.',
  national_cathedral: 'A cathedral the country watches: a platform, or an exposure, depending on the man.',
  diocesan_media: 'A diocesan paper and studio: communications posts, powerful and exposed.',
  catholic_charities: 'A large Catholic Charities: social outreach and the civic boards that come with it.',
  nunciature_proximity: 'The nunciature nearby: Rome hears about you sooner, for better and worse.',
  shrine: 'A shrine with pilgrims: a rector’s post that is half tourism and half prayer.',
};

/**
 * A full diocese from a preset. The preset is a bias; the state rolls.
 * Returns visible and hidden halves already split so the preview cannot
 * reach the wrong one. DESIGN.md §3.1a and §9.1.
 */
export function generateDiocese(rng: Rng, preset: DiocesePreset, year: number): GeneratedDiocese {
  const bishop = generateBishop(rng.derive('bishop'), preset, year);
  const chancery = generateChancery(rng.derive('chancery'), preset, year, bishop.profile.alignment);
  const generated = generateParishes(rng.derive('parishes'), preset, year);
  const parishes = generated.map((g) => g.parish);
  const pastors = generated.map((g) => g.pastor);

  // Factions: three weights plus hostility, tilted by the preset.
  let traditional = rng.float(0.15, 0.45) - preset.dispositionBias / 250;
  let progressive = rng.float(0.15, 0.45) + preset.dispositionBias / 250;
  traditional = Math.max(0.05, traditional);
  progressive = Math.max(0.05, progressive);
  let mainstream = 1 - traditional - progressive;
  if (mainstream < 0.1) {
    const scale = 0.9 / (traditional + progressive);
    traditional *= scale;
    progressive *= scale;
    mainstream = 0.1;
  }
  const hostility = rng.int(0, 100);
  // There is always a shortage: no diocese rolls below 'stretched'. Playtesting asked for it; the presets' bias still spreads 3..5.
  const shortage = Math.min(5, Math.max(3, Math.round(preset.shortageBias + rng.gaussian() * 1.1)));
  const financial = rng.weighted(Object.keys(preset.financialWeights) as FinancialState[], (f) => preset.financialWeights[f]);
  const scandalHandling = rng.weighted(['transparent', 'defensive', 'concealing'] as ScandalHandling[], (h) => ({ transparent: 2, defensive: 3, concealing: 1 })[h]);
  const need = clergyNeedOf(shortage);
  const tension = tensionOf(hostility);
  const disposition = Math.max(-100, Math.min(100, Math.round((progressive - traditional) * 160)));

  const character = [rng.pick(preset.character.base)];
  const needLine = preset.character.byNeed[need];
  const tensionLine = preset.character.byTension[tension];
  const finLine = preset.character.byFinancial[financial];
  if (needLine) character.push(needLine);
  if (tensionLine) character.push(tensionLine);
  if (finLine && financial !== 'strained') character.push(finLine);

  const opportunities = preset.institutions.map((i) => INSTITUTION_LINES[i]);
  const troubled = parishes.filter((p) => p.debt >= 1_000_000).length;
  if (troubled >= 2) opportunities.push(`${troubled === 2 ? 'Two' : 'Three'} parishes in serious financial trouble: a fixer will be noticed.`);
  if (shortage >= 4) opportunities.push('A presbyterate short enough that a competent man is promoted before he asks.');

  const diocese: Diocese = {
    presetId: preset.id,
    visible: {
      id: preset.id,
      name: preset.name,
      see: preset.see,
      region: preset.region,
      size: preset.size,
      disposition,
      tension,
      clergyNeed: need,
      bishop: {
        npcId: bishop.npc.id,
        name: `${bishop.npc.title} ${bishop.npc.name.first} ${bishop.npc.name.last}`,
        age: year - bishop.npc.birthYear,
        yearsInOffice: year - bishop.profile.installedYear,
        temperamentLine: temperamentLine(rng, bishop.profile),
        priorities: bishop.profile.priorities,
      },
      character,
      opportunities,
      institutions: preset.institutions,
      complication: rng.pick(preset.complications),
    },
    hidden: {
      factions: { traditional: round2(traditional), mainstream: round2(mainstream), progressive: round2(progressive), hostility },
      shortage,
      financial,
      bishop: bishop.profile,
      chanceryIds: chancery.map((n) => n.id),
      scandal: { latent: rng.int(0, 100), handling: scandalHandling },
      pastorAges: rng.weighted(['young', 'mixed', 'top_heavy'] as const, (p) => ({ young: 1, mixed: 3, top_heavy: 2 })[p]),
      hiddenComplication: rng.pick(preset.hiddenComplications),
    },
  };
  return { diocese, parishes, npcs: [bishop.npc, ...chancery, ...pastors] };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export const NEED_LABEL: Record<ClergyNeed, string> = {
  critically_short: 'critically short',
  stretched: 'stretched',
  adequate: 'adequate',
  deep_bench: 'a deep bench',
};

export const TENSION_LABEL: Record<Tension, string> = {
  one_voice: 'one voice',
  quietly_split: 'quietly split',
  openly_divided: 'openly divided',
};

export function prioritiesLine(priorities: Diocese['visible']['bishop']['priorities']): string {
  return `${PRIORITY_LABEL[priorities[0]]} and ${PRIORITY_LABEL[priorities[1]]}`;
}
