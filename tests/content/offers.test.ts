import { describe, it, expect } from 'vitest';
import { allOffers, offerFiles } from '@/content/offers';
import { CONSTITUENCY_KEYS, STAT_KEYS, PILLARS, ARCHETYPES } from '@/types';
import type { Condition, Effect, OfferDef } from '@/types';

const PHASES = ['seminary', 'parochial_vicar', 'administrator', 'pastor', 'chancery', 'bishop'];
const CATEGORIES = ['academic', 'chancery', 'patronage', 'social', 'seminary'];
const SELECTORS = [
  '@rector', '@spiritual_director', '@formation_advisor', '@vocation_director', '@professor_trad', '@professor_prog',
  '@bishop', '@mother', '@father', '@sibling', '@mentor_priest', '@home_pastor', '@closest_classmate', '@rival_classmate',
  '@random_classmate', '@pastor', '@secretary', '@dre', '@music_director', '@maintenance', '@parishioner', '@brother_priest',
  '@vicar_general', '@chancellor', '@vicar_for_clergy', '@group_leader',
];
const EFFECT_TARGETS = [
  'stat', 'reputation', 'relationship', 'flag', 'thread', 'position', 'pillar', 'alignment', 'outspokenness', 'honesty',
  'credential', 'trait', 'archetype', 'concern', 'risk', 'npc', 'end', 'transfer',
];

function checkCondition(c: Condition, where: string, problems: string[]): void {
  if (!c || typeof c !== 'object' || typeof (c as { type?: unknown }).type !== 'string') {
    problems.push(`${where}: malformed condition`);
    return;
  }
  if (c.type === 'relationship' && c.npcId.startsWith('@') && !SELECTORS.includes(c.npcId)) problems.push(`${where}: unknown selector ${c.npcId}`);
  if (c.type === 'stat' && !STAT_KEYS.includes(c.key)) problems.push(`${where}: bad stat ${c.key}`);
  if (c.type === 'reputation' && !CONSTITUENCY_KEYS.includes(c.key)) problems.push(`${where}: bad reputation ${c.key}`);
  if (c.type === 'pillar' && !PILLARS.includes(c.key)) problems.push(`${where}: bad pillar ${c.key}`);
  if (c.type === 'not') checkCondition(c.inner, where, problems);
  if (c.type === 'any' || c.type === 'all') c.inner.forEach((i) => checkCondition(i, where, problems));
}

function checkEffect(e: Effect, where: string, problems: string[]): void {
  if (!EFFECT_TARGETS.includes(e.target)) problems.push(`${where}: bad effect target ${e.target}`);
  if (e.target === 'stat' && !STAT_KEYS.includes(e.key as never)) problems.push(`${where}: bad stat ${e.key}`);
  if (e.target === 'pillar' && !PILLARS.includes(e.key as never)) problems.push(`${where}: bad pillar ${e.key}`);
  if (e.target === 'reputation' && !CONSTITUENCY_KEYS.includes(e.key as never)) problems.push(`${where}: bad reputation ${e.key}`);
  if (e.target === 'archetype' && !ARCHETYPES.includes(e.key as never)) problems.push(`${where}: bad archetype ${e.key}`);
  if ((e.target === 'relationship' || e.target === 'npc') && e.key.startsWith('@') && !SELECTORS.includes(e.key)) problems.push(`${where}: unknown selector ${e.key}`);
  if (e.target === 'end') problems.push(`${where}: offers may not end the run`);
  if (e.target === 'transfer' && !['flagship_suburban', 'struggling_urban', 'immigrant_growing', 'rural', 'difficult'].includes(e.key)) problems.push(`${where}: transfer key must be a parish kind`);
}

function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{(@?[a-z_:0-9]+)(?:\.[a-z]+)?\}/g)].map((m) => m[1] as string);
}

function checkOffer(o: OfferDef, file: string, problems: string[], ids: Set<string>): void {
  const where = `${file} › ${o.id}`;
  if (typeof o.id !== 'string' || !/^[a-z0-9_]+$/.test(o.id)) problems.push(`${where}: id must be snake_case`);
  if (ids.has(o.id)) problems.push(`${where}: duplicate id`);
  ids.add(o.id);
  if (!CATEGORIES.includes(o.category)) problems.push(`${where}: bad category`);
  if (!Array.isArray(o.phase) || o.phase.some((p) => !PHASES.includes(p))) problems.push(`${where}: bad phase`);
  if (o.phase?.includes('seminary') && (!o.yearGate || o.yearGate.some((y) => y < 1 || y > 7))) problems.push(`${where}: seminary offers need yearGate 1..7`);
  if (typeof o.title !== 'string' || o.title.length < 3) problems.push(`${where}: title`);
  if (typeof o.body !== 'string' || o.body.split(/\s+/).length < 40) problems.push(`${where}: body too short`);
  if (o.from && !SELECTORS.includes(o.from)) problems.push(`${where}: unknown from ${o.from}`);
  if (!Array.isArray(o.requires)) problems.push(`${where}: requires must be an array`);
  else o.requires.forEach((c) => checkCondition(c, where, problems));
  o.bias?.forEach((b) => checkCondition(b.when, where, problems));
  if (typeof o.weight !== 'number' || o.weight <= 0 || o.weight > 200) problems.push(`${where}: weight should be 1..200`);
  if (!Number.isInteger(o.windowWeeks) || o.windowWeeks < 0 || o.windowWeeks > 8) problems.push(`${where}: windowWeeks 0..8`);
  for (const side of ['accept', 'decline'] as const) {
    const s = o[side];
    if (!s || typeof s.outcome !== 'string' || s.outcome.split(/\s+/).length < 12) problems.push(`${where}: ${side}.outcome too short`);
    if (!s || !Array.isArray(s.effects)) problems.push(`${where}: ${side}.effects`);
    else s.effects.forEach((e) => checkEffect(e, `${where} › ${side}`, problems));
  }
  if (o.decline && o.decline.effects.length === 0 && !o.from) problems.push(`${where}: declining must have a consequence (effects or from)`);
  const c = o.accept?.commitment;
  if (c) {
    if (!Number.isInteger(c.weeks) || c.weeks < 1) problems.push(`${where}: commitment.weeks`);
    if (typeof c.apPerWeek !== 'number' || c.apPerWeek < 0) problems.push(`${where}: commitment.apPerWeek`);
    if (!Array.isArray(c.onComplete)) problems.push(`${where}: commitment.onComplete`);
    else c.onComplete.forEach((e) => checkEffect(e, `${where} › commitment`, problems));
    if (c.weekly !== undefined) {
      if (!Array.isArray(c.weekly)) problems.push(`${where}: commitment.weekly`);
      else c.weekly.forEach((e) => checkEffect(e, `${where} › weekly`, problems));
    }
    if (c.away !== undefined && !['rome_stl', 'cua_jcl', 'bishops_secretary'].includes(c.away)) problems.push(`${where}: unknown away program ${c.away}`);
    if (typeof c.completeOutcome !== 'string' || c.completeOutcome.length < 20) problems.push(`${where}: commitment.completeOutcome`);
  }
  if (o.failure) {
    if (typeof o.failure.chance !== 'number' || o.failure.chance <= 0 || o.failure.chance > 1) problems.push(`${where}: failure.chance`);
    if (!Array.isArray(o.failure.unless) || o.failure.unless.length === 0) problems.push(`${where}: failure.unless`);
    else o.failure.unless.forEach((cc) => checkCondition(cc, where, problems));
    o.failure.effects?.forEach((e) => checkEffect(e, `${where} › failure`, problems));
    if (typeof o.failure.outcome !== 'string') problems.push(`${where}: failure.outcome`);
  }
  for (const token of tokensIn([o.title, o.body, o.accept?.outcome ?? '', o.decline?.outcome ?? ''].join(' '))) {
    if (token.startsWith('@') && !SELECTORS.includes(token)) problems.push(`${where}: unknown selector ${token}`);
  }
}

describe('content/offers', () => {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const [file, data] of Object.entries(offerFiles)) {
    if (!Array.isArray(data.offers)) {
      problems.push(`${file}: expected { offers: [] }`);
      continue;
    }
    for (const o of data.offers) checkOffer(o, file, problems, ids);
  }

  it('every offer is well-formed', () => {
    expect(problems).toEqual([]);
  });

  it('the seminary tier has a reachable ladder for every build', () => {
    const seminary = allOffers.filter((o) => o.phase.includes('seminary'));
    if (seminary.length === 0) return;
    expect(seminary.length).toBeGreaterThanOrEqual(12);
    const categories = new Set(seminary.map((o) => o.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
    // About half should be visibly bad fits: they carry a cost somewhere.
    const costly = seminary.filter((o) => o.accept.effects.some((e) => (e.delta ?? 0) < 0) || (o.accept.commitment?.apPerWeek ?? 0) > 0);
    expect(costly.length).toBeGreaterThanOrEqual(Math.floor(seminary.length / 3));
  });
});
