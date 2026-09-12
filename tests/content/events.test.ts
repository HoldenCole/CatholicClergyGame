import { describe, it, expect } from 'vitest';
import { allEvents, eventFiles } from '@/content';
import { decorOptions } from '@/systems/decorState';
import { actionDefs, liturgyDials, obligationDefs } from '@/content/parish';
const LITURGY_DIALS = new Set(liturgyDials.map((d) => d.id));
const LITURGY_OPTIONS = new Set(liturgyDials.flatMap((d) => d.options.map((o) => `${d.id}:${o.id}`)));
import { CONSTITUENCY_KEYS, EVENT_CATEGORIES, SEVERITIES, STAT_KEYS, PILLARS, ARCHETYPES } from '@/types';
import type { Condition, Effect, GameEvent } from '@/types';

const PHASES = ['seminary', 'study', 'parochial_vicar', 'administrator', 'pastor', 'chancery', 'bishop'];
const PRESSURES = [
  'loyalty_vs_honesty',
  'ambition_vs_integrity',
  'friendship_vs_duty',
  'belief_vs_safety',
  'body_vs_vow',
  'doubt',
  'competence',
  'money',
];
const SEASONS = ['advent', 'christmas', 'ordinary', 'lent', 'holy_week', 'easter'];
const VOLUMES = ['private', 'semi_public', 'public'];
const ENDINGS = ['dismissed', 'left_seminary', 'left_priesthood', 'died', 'retired'];
const NPC_STATUSES = ['active', 'left', 'dead', 'retired', 'dismissed'];
const SELECTORS = [
  '@rector',
  '@spiritual_director',
  '@formation_advisor',
  '@vocation_director',
  '@professor_trad',
  '@professor_prog',
  '@bishop',
  '@mother',
  '@father',
  '@sibling',
  '@mentor_priest',
  '@home_pastor',
  '@closest_classmate',
  '@rival_classmate',
  '@random_classmate',
  '@pastor',
  '@secretary',
  '@dre',
  '@music_director',
  '@maintenance',
  '@parishioner',
  '@bonded_parishioner',
  '@brother_priest',
  '@vicar_general',
  '@chancellor',
  '@vicar_for_clergy',
  '@group_leader',
];
const GROUP_KEYS = ['type', 'vitality', 'hostile', 'suppressed', 'foundedByPlayer', 'agenda'];
const GROUP_EFFECT_KEYS = ['vitality', 'size', 'hostile', 'suppressed', 'dissolve'];
const PARISH_KEYS = ['kind', 'terrain', 'school', 'problem', 'needsSpanish', 'wealth', 'generational'];
const ROLES = ['parochial_vicar', 'administrator', 'pastor'];
const EFFECT_TARGETS = [
  'stat', 'reputation', 'relationship', 'flag', 'group', 'money', 'ap', 'thread', 'position',
  'pillar', 'alignment', 'outspokenness', 'honesty', 'credential', 'trait', 'archetype',
  'concern', 'risk', 'npc', 'end', 'decor', 'permission', 'trait_known', 'transfer', 'building', 'club', 'bond',
];
const DECOR_PLACES = ['church', 'chapel', 'office', 'rectory', 'seminary_room', 'chancery'];
const DECOR_SLOTS = ['sanctuary', 'altar_rail', 'orientation', 'confessionals', 'choir', 'statues', 'tabernacle', 'mass_form', 'music', 'style', 'devotion', 'seating', 'wall', 'desk', 'floor', 'corner'];
const LITURGICAL_TOPICS = ['ad_orientem', 'latin_mass', 'altar_rail', 'tabernacle', 'renovation', 'older_form_faculty'];
const BISHOP_KEYS = ['management', 'priority', 'rewards', 'cannotTolerate', 'stance'];
const DECOR_IDS = new Set(decorOptions.map((o) => o.id));
const ROUTINE_KEYS = new Set([...actionDefs.map((a) => a.id), ...obligationDefs.map((o) => o.key)]);

type Problem = string;

function checkCondition(c: Condition, where: string, problems: Problem[]): void {
  if (!c || typeof c !== 'object' || typeof c.type !== 'string') {
    problems.push(`${where}: malformed condition ${JSON.stringify(c)}`);
    return;
  }
  const hasOp = (x: unknown) => x === '>=' || x === '<=';
  switch (c.type) {
    case 'stat':
      if (!STAT_KEYS.includes(c.key) || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad stat condition`);
      break;
    case 'reputation':
      if (!CONSTITUENCY_KEYS.includes(c.key) || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad reputation condition`);
      break;
    case 'relationship':
      if (typeof c.npcId !== 'string' || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad relationship condition`);
      else if (c.npcId.startsWith('@') && !SELECTORS.includes(c.npcId)) problems.push(`${where}: unknown selector ${c.npcId}`);
      break;
    case 'credential':
      if (typeof c.key !== 'string') problems.push(`${where}: bad credential condition`);
      break;
    case 'flag':
      if (typeof c.key !== 'string' || typeof c.value !== 'boolean') problems.push(`${where}: bad flag condition`);
      break;
    case 'alignment':
    case 'bishop_alignment':
    case 'outspokenness':
    case 'year':
      if (!hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad ${c.type} condition`);
      break;
    case 'phase':
      if (!PHASES.includes(c.value)) problems.push(`${where}: bad phase ${c.value}`);
      break;
    case 'season':
      if (!SEASONS.includes(c.value)) problems.push(`${where}: bad season ${c.value}`);
      break;
    case 'pillar':
      if (!PILLARS.includes(c.key) || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad pillar condition`);
      break;
    case 'thread':
      if (typeof c.key !== 'string' || typeof c.open !== 'boolean') problems.push(`${where}: bad thread condition`);
      break;
    case 'house':
      if (typeof c.value !== 'boolean' || (c.charism !== undefined && !['contemplative', 'active'].includes(c.charism))) problems.push(`${where}: bad house condition`);
      break;
    case 'parish':
      if (!PARISH_KEYS.includes(c.key) || c.value === undefined) problems.push(`${where}: bad parish condition`);
      break;
    case 'role':
      if (!ROLES.includes(c.value)) problems.push(`${where}: bad role ${c.value}`);
      break;
    case 'years_ordained':
    case 'weeks_served':
    case 'arc_weeks_left':
    case 'age':
    case 'calendar_year':
      if (!hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad ${c.type} condition`);
      break;
    case 'liturgy':
      if (['changes', 'friction', 'lean', 'fresh'].includes(c.key)) { if (c.op !== undefined && !hasOp(c.op)) problems.push(`${where}: bad liturgy condition`); }
      else if (!LITURGY_DIALS.has(c.key) || typeof c.value !== 'string' || !LITURGY_OPTIONS.has(`${c.key}:${c.value}`)) problems.push(`${where}: bad liturgy condition ${JSON.stringify(c)}`);
      break;
    case 'bond':
      if (!['any', 'baptized', 'married', 'buried', 'anointed', 'confirmed', 'counseled', 'helped', 'quarreled'].includes(c.kind) || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad bond condition`);
      break;
    case 'see':
      if (!['presbyterate', 'people', 'rome', 'money', 'shortage', 'years'].includes(c.key) || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad see condition`);
      break;
    case 'group':
      if (!GROUP_KEYS.includes(c.key) || c.value === undefined) problems.push(`${where}: bad group condition`);
      break;
    case 'decor':
      if (!DECOR_PLACES.includes(c.place) || !DECOR_SLOTS.includes(c.slot) || !DECOR_IDS.has(c.value)) problems.push(`${where}: bad decor condition ${JSON.stringify(c)}`);
      break;
    case 'position':
      if (typeof c.topic !== 'string' || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad position condition`);
      break;
    case 'routine':
      if (typeof c.key !== 'string' || !hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad routine condition`);
      else if (!ROUTINE_KEYS.has(c.key)) problems.push(`${where}: unknown routine key ${c.key}`);
      break;
    case 'figure':
      break;
    case 'strain':
      if (!hasOp(c.op) || typeof c.value !== 'number') problems.push(`${where}: bad strain condition`);
      break;
    case 'bishop':
      if (!BISHOP_KEYS.includes(c.key)) problems.push(`${where}: bad bishop key ${String(c.key)}`);
      else if (c.key === 'stance' && (!LITURGICAL_TOPICS.includes(c.topic) || !['free', 'by_permission', 'forbidden'].includes(c.value))) problems.push(`${where}: bad bishop stance condition`);
      break;
    case 'not':
      checkCondition(c.inner, where, problems);
      break;
    case 'any':
    case 'all':
      if (!Array.isArray(c.inner) || c.inner.length === 0) problems.push(`${where}: ${c.type} needs inner[]`);
      else c.inner.forEach((i) => checkCondition(i, where, problems));
      break;
    default:
      problems.push(`${where}: unknown condition type ${(c as { type: string }).type}`);
  }
}

function checkEffect(e: Effect, where: string, problems: Problem[]): void {
  if (!EFFECT_TARGETS.includes(e.target)) {
    problems.push(`${where}: unknown effect target ${e.target}`);
    return;
  }
  if (typeof e.key !== 'string') problems.push(`${where}: effect key must be a string`);
  const needsDelta = ['stat', 'reputation', 'relationship', 'pillar', 'alignment', 'outspokenness', 'honesty', 'archetype'];
  if (needsDelta.includes(e.target) && typeof e.delta !== 'number') problems.push(`${where}: ${e.target} effect needs delta`);
  if (e.target === 'stat' && !STAT_KEYS.includes(e.key as never)) problems.push(`${where}: bad stat key ${e.key}`);
  if (e.target === 'pillar' && !PILLARS.includes(e.key as never)) problems.push(`${where}: bad pillar key ${e.key}`);
  if (e.target === 'reputation' && !CONSTITUENCY_KEYS.includes(e.key as never)) problems.push(`${where}: bad reputation key ${e.key}`);
  if (e.target === 'archetype' && !ARCHETYPES.includes(e.key as never)) problems.push(`${where}: bad archetype ${e.key}`);
  if ((e.target === 'relationship' || e.target === 'npc' || e.target === 'trait_known') && e.key.startsWith('@') && !SELECTORS.includes(e.key)) {
    problems.push(`${where}: unknown selector ${e.key}`);
  }
  if (e.target === 'npc' && !NPC_STATUSES.includes(String(e.value))) problems.push(`${where}: npc effect needs a status value`);
  if (e.target === 'end') {
    if (!ENDINGS.includes(e.key)) problems.push(`${where}: bad ending ${e.key}`);
    if (typeof e.value !== 'string' || e.value.length < 20) problems.push(`${where}: end effect needs a closing summary in value`);
  }
  if (e.target === 'risk' && (typeof e.value !== 'string' || ![1, 2, 3].includes(e.delta ?? 0))) {
    problems.push(`${where}: risk effect needs value label and delta 1-3`);
  }
  if (e.target === 'flag' && e.value === undefined && e.delta === undefined) {
    problems.push(`${where}: flag effect needs value or delta`);
  }
  if (e.target === 'group' && !GROUP_EFFECT_KEYS.includes(e.key)) problems.push(`${where}: bad group effect key ${e.key}`);
  if (e.target === 'group' && (e.key === 'vitality' || e.key === 'size') && typeof e.delta !== 'number') problems.push(`${where}: group ${e.key} needs delta`);
  if ((e.target === 'money' || e.target === 'ap') && typeof e.delta !== 'number') problems.push(`${where}: ${e.target} effect needs delta`);
  if (e.target === 'decor') {
    const [place, slot] = e.key.split(':');
    if (!DECOR_PLACES.includes(place ?? '') || !DECOR_SLOTS.includes(slot ?? '') || !DECOR_IDS.has(String(e.value))) problems.push(`${where}: bad decor effect ${e.key}=${String(e.value)}`);
  }
  if (e.target === 'transfer' && !['flagship_suburban', 'struggling_urban', 'immigrant_growing', 'rural', 'difficult'].includes(e.key)) problems.push(`${where}: transfer key must be a parish kind`);
  if (e.target === 'building' && (!['church', 'rectory', 'hall', 'school'].includes(e.key) || typeof e.delta !== 'number')) problems.push(`${where}: bad building effect`);
  if (e.target === 'permission' && (!LITURGICAL_TOPICS.includes(e.key) || !['granted', 'denied'].includes(String(e.value)))) problems.push(`${where}: bad permission effect`);
}

function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{(@?[a-z_:0-9]+)(?:\.[a-z]+)?\}/g)].map((m) => m[1] as string);
}

function checkEvent(ev: GameEvent, file: string, problems: Problem[], ids: Set<string>): void {
  const where = `${file} › ${ev.id ?? '(no id)'}`;
  if (typeof ev.id !== 'string' || !/^[a-z0-9_]+$/.test(ev.id)) problems.push(`${where}: id must be snake_case`);
  if (ids.has(ev.id)) problems.push(`${where}: duplicate id`);
  ids.add(ev.id);
  const phases = Array.isArray(ev.phase) ? ev.phase : [ev.phase];
  if (phases.length === 0 || phases.some((p) => !PHASES.includes(p))) problems.push(`${where}: bad phase`);
  if (!SEVERITIES.includes(ev.severity)) problems.push(`${where}: bad severity`);
  if (!EVENT_CATEGORIES.includes(ev.category)) problems.push(`${where}: bad category`);
  if (!Array.isArray(ev.pressure) || ev.pressure.length === 0 || ev.pressure.some((p) => !PRESSURES.includes(p))) {
    problems.push(`${where}: bad pressure tags`);
  }
  if (typeof ev.baseWeight !== 'number' || ev.baseWeight <= 0) problems.push(`${where}: baseWeight must be > 0`);
  if (typeof ev.suppressYears !== 'number' || ev.suppressYears < 1) problems.push(`${where}: suppressYears must be >= 1`);
  if (phases.includes('seminary')) {
    if (!ev.yearGate || ev.yearGate.some((y) => y < 1 || y > 7)) problems.push(`${where}: seminary events need yearGate within 1..7`);
  } else if (ev.yearGate) {
    problems.push(`${where}: yearGate is seminary-only; use years_ordained conditions`);
  }
  if (typeof ev.title !== 'string' || ev.title.length < 3) problems.push(`${where}: title`);
  if (typeof ev.body !== 'string' || ev.body.split(/\s+/).length < 40) problems.push(`${where}: body too short (< 40 words)`);
  ev.requires?.forEach((c) => checkCondition(c, where, problems));
  ev.bias?.forEach((b) => {
    checkCondition(b.when, where, problems);
    if (typeof b.multiplier !== 'number' || b.multiplier < 0) problems.push(`${where}: bias multiplier`);
  });
  for (const token of tokensIn(ev.title + ' ' + ev.body)) {
    if (token.startsWith('@') && !SELECTORS.includes(token)) problems.push(`${where}: unknown selector ${token}`);
    if (!token.startsWith('@') && !['name', 'first_name', 'surname', 'diocese', 'parish', 'seminary', 'school', 'city', 'residence'].includes(token)) {
      problems.push(`${where}: unknown token {${token}}`);
    }
  }
  if (!Array.isArray(ev.choices) || ev.choices.length < 1 || ev.choices.length > 5) problems.push(`${where}: 1–5 choices`);
  const choiceIds = new Set<string>();
  for (const ch of ev.choices ?? []) {
    const cw = `${where} › ${ch.id}`;
    if (typeof ch.id !== 'string') problems.push(`${cw}: choice id`);
    if (choiceIds.has(ch.id)) problems.push(`${cw}: duplicate choice id`);
    choiceIds.add(ch.id);
    if (typeof ch.label !== 'string' || ch.label.length < 3) problems.push(`${cw}: label`);
    if (typeof ch.outcome !== 'string' || ch.outcome.split(/\s+/).length < 12) problems.push(`${cw}: outcome prose too short`);
    if (!Array.isArray(ch.effects)) problems.push(`${cw}: effects must be an array`);
    ch.requires?.forEach((c) => checkCondition(c, cw, problems));
    ch.effects?.forEach((e) => checkEffect(e, cw, problems));
    if (ch.volume !== undefined) {
      if (!VOLUMES.includes(ch.volume)) problems.push(`${cw}: bad volume`);
      if (typeof ch.positionTopic !== 'string' || typeof ch.positionValue !== 'number') problems.push(`${cw}: volume needs positionTopic and positionValue`);
    }
    for (const token of tokensIn(ch.label + ' ' + (ch.outcome ?? ''))) {
      if (token.startsWith('@') && !SELECTORS.includes(token)) problems.push(`${cw}: unknown selector ${token}`);
    }
  }
  if (ev.severity === 'ROUTINE') {
    const auto = ev.choices?.some((c) => c.default && !c.requires) || ev.choices?.some((c) => !c.requires);
    if (!auto) problems.push(`${where}: ROUTINE events need an ungated default choice`);
  }
}

describe('content/events', () => {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  for (const [file, data] of Object.entries(eventFiles)) {
    if (!Array.isArray(data.events)) {
      problems.push(`${file}: expected { events: [] }`);
      continue;
    }
    for (const ev of data.events) checkEvent(ev, file, problems, ids);
  }

  it('every event is well-formed', () => {
    expect(problems).toEqual([]);
  });

  it('follow-ups and threads resolve to real events', () => {
    const missing: string[] = [];
    const opened = new Set<string>();
    const resolved = new Set<string>();
    for (const ev of allEvents) {
      for (const ch of ev.choices) {
        if (ch.followUpId && !ids.has(ch.followUpId)) missing.push(`${ev.id} › ${ch.id} follows up ${ch.followUpId}`);
        if (ch.opensThread) opened.add(ch.opensThread);
        if (ch.resolvesThread) resolved.add(ch.resolvesThread);
      }
    }
    expect(missing).toEqual([]);
    const danglingResolve = [...resolved].filter((t) => !opened.has(t));
    expect(danglingResolve).toEqual([]);
    const neverResolved = [...opened].filter((t) => !resolved.has(t));
    expect(neverResolved).toEqual([]);
  });

  it('the seminary pools are deep enough', () => {
    const seminary = allEvents.filter((e) => e.phase === 'seminary' || (Array.isArray(e.phase) && e.phase.includes('seminary')));
    if (seminary.length === 0) return; // pools not authored yet
    for (let year = 1; year <= 7; year++) {
      const pool = seminary.filter((e) => e.yearGate?.includes(year));
      expect(pool.length, `year ${year} pool`).toBeGreaterThanOrEqual(10);
    }
    expect(seminary.some((e) => e.beat === 'candidacy' && e.yearGate?.includes(4))).toBe(true);
    expect(seminary.some((e) => e.beat === 'diaconate' && e.yearGate?.includes(6))).toBe(true);
  });
});
