import type { GameState, OrderKey, Province, ProvinceTrajectory, ReligiousAnswers } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousCreation } from '@/content/creation';
import { religiousOrder } from '@/content/religious';
import { applyEffects } from '@/engine/effects';
import { generateProvince, type GeneratedProvince } from '@/generation/province';
import { installProvince } from './install';

/**
 * The religious campaign's new game. E3 §4: the player chooses an order,
 * then a province from a preview; the province rolls first and the preview
 * reads only its visible half (CLAUDE.md rule 6), then creation's additions.
 */
export interface ProvinceVisible {
  id: string;
  name: string;
  region: string;
  order: OrderKey;
  /** Size and trajectory in plain language. */
  size: string;
  trajectory: ProvinceTrajectory;
  /** −100 observant .. +100 progressive, and a word for the tension. */
  disposition: number;
  tension: 'of one mind' | 'quietly split' | 'openly divided';
  provincial: { name: string; age: number; yearsInOffice: number; line: string };
  works: string[];
  territory: string[];
  complication: string;
  line: string;
}

export interface ProvinceCandidate extends GeneratedProvince {
  visible: ProvinceVisible;
}

function sizeWord(n: number, pyramid: number): string {
  const size = n >= 180 ? 'A large province' : n >= 100 ? 'A middling province' : 'A small province';
  const age = pyramid >= 0.55 ? ', most of its men past sixty' : pyramid >= 0.4 ? ', greying' : ', with young men in it';
  return `${size} of about ${Math.round(n / 10) * 10} friars${age}.`;
}

/** The preview's half of a rolled province. Nothing hidden is read here. */
export function provincePreview(gen: GeneratedProvince, year: number): ProvinceVisible {
  const p: Province = gen.province;
  const provincial = gen.friars.find((f) => f.id === p.provincialId)!;
  const old = gen.friars.filter((f) => year - f.birthYear >= 60).length / Math.max(1, gen.friars.length);
  const disposition = Math.round((p.factions.progressive - p.factions.observant) * 120);
  const works = [...new Set(gen.houses.flatMap((h) => h.works))].map((w) => ({ curia: "the provincial's house", priory_church: 'priory churches', preaching: 'preaching', formation: 'formation', teaching: 'a house of studies', school: 'schools', parish: 'parishes', mission: 'a mission' }[w] ?? w));
  return {
    id: p.id,
    name: p.name,
    region: p.region,
    order: p.order,
    size: sizeWord(gen.friars.length, old),
    trajectory: p.trajectory,
    disposition,
    tension: p.factions.hostility < 45 ? 'of one mind' : p.factions.hostility < 70 ? 'quietly split' : 'openly divided',
    provincial: { name: `${provincial.title} ${provincial.name.first} ${provincial.name.last}`, age: year - provincial.birthYear, yearsInOffice: year - p.provincialSince, line: `${provincial.temperament ?? 'steady'} in the room, and ${provincial.alignment < -20 ? 'a man of the old observance' : provincial.alignment > 20 ? 'a man for this century' : 'hard to place on the line'}.` },
    works,
    territory: gen.dioceses.map((d) => d.diocese.visible.name),
    complication: p.complication,
    line: p.line,
  };
}

/** Every province of an order rolls before the player sees anything. */
export function generateProvinceCandidates(rng: Rng, order: OrderKey, year: number): ProvinceCandidate[] {
  const def = religiousOrder(order);
  return def.provinces.map((seed) => {
    const gen = generateProvince(rng.derive(`province:${seed.id}`), def, seed, year);
    return { ...gen, visible: provincePreview(gen, year) };
  });
}

/** Install the chosen province and the creation additions. The novitiate is where he starts. */
export function beginReligious(state: GameState, candidate: ProvinceCandidate, answers: ReligiousAnswers, year: number): GameState {
  // Formation begins in the house the order's first year is lived in: the novitiate, or a priory for a pre-novitiate.
  const firstKind = religiousOrder(answers.order).formation[0]?.house ?? 'novitiate';
  const first = candidate.houses.find((h) => h.kind === firstKind) ?? candidate.houses.find((h) => h.kind === 'novitiate');
  let next = installProvince(state, candidate, year, first?.id);
  const r = next.religious!;
  const why = religiousCreation.whys.find((w) => w.id === answers.why);
  const tie = religiousCreation.ties.find((t) => t.id === answers.tie);
  next = { ...next, religious: { ...r, why: answers.why, tie: answers.tie, ...(answers.religiousName && religiousOrder(answers.order).mechanics.religiousName ? { religiousName: answers.religiousName } : {}) }, flags: { ...next.flags, [`why:${answers.why}`]: true, [`province_tie:${answers.tie}`]: true } };
  if (why) next = applyEffects(next, why.effects, {}, why.label);
  if (tie) next = applyEffects(next, tie.effects, {}, tie.label);
  for (const hook of why?.hooks ?? []) next = { ...next, character: next.character ? { ...next.character, hooks: [...next.character.hooks, hook] } : next.character };
  return next;
}

/** What the man is called in the house: the religious name, if the order gives one. */
export function religiousNameOf(state: GameState): string | undefined {
  return state.religious?.religiousName;
}
