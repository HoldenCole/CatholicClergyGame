import { newGame } from '@/engine/game';
import { emptyReputation } from '@/systems/reputation';
import { emptyStats } from '@/systems/stats';
import type { Character, GameEvent, GameState, Npc, SeminaryState } from '@/types';

export function testCharacter(overrides: Partial<Character> = {}): Character {
  return {
    name: { first: 'Thomas', last: 'Reilly' },
    portrait: 'p1',
    entryYear: 2010,
    background: {
      origin: 'urban_ethnic',
      tie: 'son',
      path: 'college',
      field: 'philosophy',
      career: null,
      yearsWorked: 0,
      motive: 'priest',
      family: 'supportive',
      past: null,
      entryAge: 22,
    },
    stats: emptyStats(40),
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
    ...overrides,
  };
}

export function testNpc(id: string, overrides: Partial<Npc> = {}): Npc {
  return {
    id,
    name: { first: 'Paul', last: 'Nowak' },
    role: 'classmate',
    title: '',
    birthYear: 1988,
    origin: 'suburban',
    alignment: 0,
    stats: emptyStats(40),
    ambition: 50,
    struggle: 'none',
    hiddenTrait: 'loyal',
    traitKnown: false,
    relationship: 0,
    status: 'active',
    tags: [],
    ...overrides,
  };
}

export function testSeminary(overrides: Partial<SeminaryState> = {}): SeminaryState {
  return {
    year: 1,
    emphasis: null,
    pillarScores: { human: 0, spiritual: 0, intellectual: 0, pastoral: 0 },
    zeroStreak: { human: 0, spiritual: 0, intellectual: 0, pastoral: 0 },
    evaluations: [],
    playedWeeks: [],
    summerAssignment: null,
    summers: {},
    candidacy: false,
    lectorAcolyte: false,
    diaconate: false,
    concerns: [],
    heldBackCount: 0,
    classmateIds: [],
    yearStartWeek: 0,
    ...overrides,
  };
}

/** A seminary state at week 0 with a character, three classmates, and a rector. */
export function seminaryState(seed = 'fixture'): GameState {
  const { state } = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  const npcs = {
    c1: testNpc('c1', { name: { first: 'Paul', last: 'Nowak' }, relationship: 30 }),
    c2: testNpc('c2', { name: { first: 'Miguel', last: 'Ortega' }, relationship: -10 }),
    c3: testNpc('c3', { name: { first: 'Kevin', last: 'Doyle' }, relationship: 5 }),
    rector: testNpc('rector', {
      name: { first: 'James', last: 'Kearney' },
      role: 'formator',
      title: 'Msgr.',
      tags: ['rector'],
    }),
  };
  return {
    ...state,
    mode: { kind: 'clock' },
    character: testCharacter(),
    flags: { 'tie:son': true, 'origin:urban_ethnic': true, 'field:philosophy': true, 'motive:priest': true },
    npcs,
    seminary: testSeminary({ classmateIds: ['c1', 'c2', 'c3'] }),
  };
}

export function testEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'ev',
    phase: 'seminary',
    pressure: ['competence'],
    severity: 'NOTABLE',
    category: 'formation',
    baseWeight: 10,
    suppressYears: 2,
    title: 'A test',
    body: 'Body.',
    choices: [{ id: 'a', label: 'A', effects: [] }],
    ...overrides,
  };
}
