import type {
  CareerOption,
  Character,
  CreationAnswers,
  CreationContent,
  CreationOption,
  GameState,
  Hook,
} from '@/types';
import { MAX_ENTRY_AGE, SEMINARY_YEARS } from '@/types';
import { applyEffects } from '@/engine/effects';
import { emptyReputation } from './reputation';
import { emptyStats } from './stats';

/** Every stat starts here before background is applied. Invented. */
export const BASE_STAT = 30;
/** DESIGN.md §7.2: ordained at 32 or later reads as a late vocation. Entry at 25+ gets there. */
export const LATE_VOCATION_ENTRY_AGE = 25;
/** DESIGN.md §3.3: career gains diminish after this many years. */
export const CAREER_FULL_YEARS = 8;

export function pathOf(answers: CreationAnswers, content: CreationContent) {
  return content.paths.find((p) => p.id === answers.path);
}

export function entryAge(answers: CreationAnswers, content: CreationContent): number {
  const path = pathOf(answers, content);
  const base = path?.entryAge ?? 18;
  return Math.min(MAX_ENTRY_AGE, base + (answers.career ? answers.yearsWorked : 0));
}

export function maxYearsWorked(answers: CreationAnswers, content: CreationContent): number {
  const path = pathOf(answers, content);
  return Math.max(0, MAX_ENTRY_AGE - (path?.entryAge ?? 18));
}

/** Careers the current path and field admit. DESIGN.md §3.3 */
export function availableCareers(answers: Pick<CreationAnswers, 'path' | 'field'>, content: CreationContent): CareerOption[] {
  const path = content.paths.find((p) => p.id === answers.path);
  const hasDegree = !!path && path.id !== 'high_school' && path.id !== 'some_college';
  return content.careers.filter((c) => {
    if (!hasDegree) return !!c.noDegree;
    if (c.requiresField.length === 0) return true;
    return answers.field !== null && c.requiresField.includes(answers.field);
  });
}

export function validateAnswers(answers: CreationAnswers, content: CreationContent): string[] {
  const errors: string[] = [];
  if (!answers.firstName.trim() || !answers.lastName.trim()) errors.push('A name is required.');
  if (!content.origins.some((o) => o.id === answers.origin)) errors.push('Unknown origin.');
  if (!content.ties.some((t) => t.id === answers.tie)) errors.push('Unknown diocese tie.');
  const path = pathOf(answers, content);
  if (!path) errors.push('Unknown path.');
  else {
    if (path.hasField && !answers.field) errors.push('A field of study is required for this path.');
    if (!path.hasField && answers.field) errors.push('This path has no field of study.');
  }
  if (answers.field && !content.fields.some((f) => f.id === answers.field)) errors.push('Unknown field.');
  if (answers.career) {
    if (!availableCareers(answers, content).some((c) => c.id === answers.career)) {
      errors.push('That career is not open to this education.');
    }
    if (answers.yearsWorked < 1) errors.push('A career needs at least one year.');
    if (answers.yearsWorked > maxYearsWorked(answers, content)) errors.push('Entry age cannot exceed 40.');
  } else if (answers.yearsWorked !== 0) {
    errors.push('Years worked require a career.');
  }
  if (!content.motives.some((m) => m.id === answers.motive)) errors.push('Unknown motive.');
  if (!content.families.some((f) => f.id === answers.family)) errors.push('Unknown family.');
  if (answers.past !== null && !content.pasts.some((p) => p.id === answers.past)) errors.push('Unknown past.');
  if (!Number.isInteger(answers.entryYear) || answers.entryYear < 1950 || answers.entryYear > 2100) {
    errors.push('Entry year out of range.');
  }
  return errors;
}

/** The chosen options, in the order their effects apply. */
export function chosenOptions(answers: CreationAnswers, content: CreationContent): CreationOption[] {
  const out: CreationOption[] = [];
  const push = (o: CreationOption | undefined) => o && out.push(o);
  push(content.origins.find((o) => o.id === answers.origin));
  push(content.ties.find((o) => o.id === answers.tie));
  push(pathOf(answers, content));
  push(content.fields.find((o) => o.id === answers.field));
  push(content.careers.find((o) => o.id === answers.career));
  push(content.motives.find((o) => o.id === answers.motive));
  push(content.families.find((o) => o.id === answers.family));
  push(content.pasts.find((o) => o.id === answers.past));
  return out;
}

/** Stat gained from a career over N years, diminishing after CAREER_FULL_YEARS. */
export function careerGain(career: CareerOption, years: number): number {
  const full = Math.min(years, CAREER_FULL_YEARS);
  const tail = Math.max(0, years - CAREER_FULL_YEARS);
  return career.perYear.delta * (full + tail * 0.5);
}

/**
 * Build the character and creation flags into the state. Throws on invalid
 * answers. NPC generation (family, formators, classmates) happens elsewhere.
 */
export function applyCreation(state: GameState, answers: CreationAnswers, content: CreationContent): GameState {
  const errors = validateAnswers(answers, content);
  if (errors.length) throw new Error(errors.join(' '));

  const age = entryAge(answers, content);
  const character: Character = {
    name: { first: answers.firstName.trim(), last: answers.lastName.trim() },
    portrait: answers.portrait,
    entryYear: answers.entryYear,
    background: {
      origin: answers.origin,
      tie: answers.tie,
      path: answers.path,
      field: answers.field,
      career: answers.career,
      yearsWorked: answers.career ? answers.yearsWorked : 0,
      motive: answers.motive,
      family: answers.family,
      past: answers.past,
      entryAge: age,
    },
    stats: emptyStats(BASE_STAT),
    alignment: 0,
    outspokenness: 0,
    honesty: 0,
    reputation: emptyReputation(),
    credentials: [],
    traits: [],
    positions: [],
    latentRisks: [],
    hooks: [],
    archetype: null,
    archetypeLeaning: { pastoral: 0, teaching: 0, theological: 0, administrative: 0, missionary: 0 },
  };

  const flags: GameState['flags'] = {
    ...state.flags,
    [`origin:${answers.origin}`]: true,
    [`tie:${answers.tie}`]: true,
    [`path:${answers.path}`]: true,
    [`motive:${answers.motive}`]: true,
    [`family:${answers.family}`]: true,
  };
  if (answers.field) flags[`field:${answers.field}`] = true;
  if (answers.career) flags[`career:${answers.career}`] = true;
  if (answers.past) flags[`past:${answers.past}`] = true;
  if (age >= LATE_VOCATION_ENTRY_AGE) flags.late_vocation = true;

  let next: GameState = { ...state, character, flags };
  const hooks: Hook[] = [];
  for (const option of chosenOptions(answers, content)) {
    next = applyEffects(next, option.effects);
    for (const h of option.hooks ?? []) hooks.push({ id: h.id, kind: h.kind, label: h.label });
  }
  const career = content.careers.find((c) => c.id === answers.career);
  if (career) {
    next = applyEffects(next, [
      { target: 'stat', key: career.perYear.key, delta: careerGain(career, answers.yearsWorked) },
      { target: 'trait', key: career.trait },
    ]);
  }
  const past = content.pasts.find((p) => p.id === answers.past);
  if (past?.risk) {
    next = applyEffects(next, [{ target: 'risk', key: past.risk.id, value: past.risk.label, delta: past.risk.severity }]);
  }
  return { ...next, character: { ...next.character!, hooks } };
}

export function ordinationAge(character: Character): number {
  return character.background.entryAge + SEMINARY_YEARS;
}
