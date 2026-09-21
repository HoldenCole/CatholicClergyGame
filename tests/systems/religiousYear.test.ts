import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { acknowledgeEvaluation, ordain, startSeminary } from '@/engine/seminary';
import { testNpc } from '../helpers/fixtures';
import { creationContent } from '@/content/creation';
import { applyCreation } from '@/systems/creation';
import { beginReligious, generateProvinceCandidates } from '@/systems/religious/newGame';
import { decideAssignment, receiveAssignment } from '@/systems/religious/obedience';
import { religiousModeStep, religiousYear } from '@/systems/religious/year';
import { holdElection, resolveElection } from '@/systems/religious/chapter';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { currentHouse } from '@/systems/religious/house';
import { generateRun } from '@/generation';
import type { CreationAnswers, GameState, Npc } from '@/types';

const answers: CreationAnswers = { firstName: 'Michael', lastName: 'Hale', portrait: 'p1', entryYear: 2010, origin: 'suburban', tie: 'transfer', path: 'college', field: 'philosophy', career: null, yearsWorked: 0, motive: 'priest', family: 'supportive', past: null };

function ordainedFriar(seed: string): GameState {
  const { state, rng } = newGame({ seed, start: { year: 2010, month: 8, day: 20 }, campaign: 'religious' });
  const candidates = generateProvinceCandidates(rng.derive('provinces'), 'OP', 2010);
  let s = applyCreation(state, answers, creationContent);
  s = beginReligious(s, candidates[0]!, { order: 'OP', provinceId: candidates[0]!.province.id, why: 'charism', tie: 'outside' }, 2010);
  const npcs: Record<string, Npc> = { ...s.npcs, c1: testNpc('c1', { role: 'classmate', tags: ['classmate'] }) };
  for (const id of s.province!.friarIds) npcs[id] = { ...npcs[id]!, relationship: 45 };
  s = { ...startSeminary({ ...s, npcs }, ['c1'], 'x'), mode: { kind: 'clock' } };
  for (let y = 1; y <= 7; y++) {
    const record = { year: s.seminary!.year, result: 'ADVANCED' as const, pillars: { human: 8, spiritual: 8, intellectual: 8, pastoral: 8 }, notes: [] };
    s = acknowledgeEvaluation({ ...s, seminary: { ...s.seminary!, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 } }, clock: { ...s.clock, week: s.clock.week + 52 }, mode: { kind: 'evaluation', record } } as GameState);
  }
  return ordain(s, createRng('o'));
}

describe('the friar\'s year and week (E3 R1.5)', () => {
  it('a new religious game carries the campaign, and the run generator installs the chosen province', () => {
    const { state, rng } = newGame({ seed: 'gen', start: { year: 2010, month: 8, day: 20 }, campaign: 'religious' });
    expect(state.campaign).toBe('religious');
    expect(newGame({ seed: 'gen', start: { year: 2010, month: 8, day: 20 } }).state.campaign).toBeUndefined();
    const candidates = generateProvinceCandidates(rng.derive('provinces:OP'), 'OP', 2010).map((c) => ({ id: c.province.id, visible: c.visible, gen: { province: c.province, houses: c.houses, friars: c.friars, dioceses: c.dioceses } }));
    const run = generateRun({ ...state, provinceCandidates: candidates }, answers, rng, { order: 'OP', provinceId: candidates[1]!.id, why: 'alumnus', tie: 'educated', religiousName: 'Albert' });
    expect(run.religious!.provinceId).toBe(candidates[1]!.id);
    expect(run.religious!.religiousName).toBe('Albert');
    expect(run.provinceCandidates).toBeNull();
    expect(run.seminary!.name).toBe(currentHouse(run)!.name);
    expect(run.mode.kind).toBe('year_start');
    expect(run.seminary!.classmateIds.length).toBeGreaterThan(0);
    expect(run.npcs[run.province!.provincialId]).toBeDefined();
  });

  it('ordination leaves a consultation waiting; the week hands it to the man as a decision, and the letter after it', () => {
    const s = ordainedFriar('modes');
    expect(s.mode.kind).toBe('clock');
    expect(religiousModeStep(s).mode.kind).toBe('consultation');
    const decided = decideAssignment(s, createRng('d'));
    expect(religiousModeStep(decided).mode.kind).toBe('obedience_letter');
    const gone = receiveAssignment(decided, 'good');
    expect(religiousModeStep(gone).mode.kind).toBe('clock');
    // A pending scene or another mode is left alone.
    expect(religiousModeStep({ ...s, mode: { kind: 'year_start', year: 1 } }).mode.kind).toBe('year_start');
  });

  it('the year: the posting\'s term up opens a consultation; a house chapter comes due; a term of office runs out', () => {
    let s = receiveAssignment(decideAssignment(ordainedFriar('year'), createRng('d')), 'good');
    const start = s.clock.week;
    // Six years on: the term is up, and it is a house chapter year too; the chapter comes first.
    const later = { ...s, clock: { ...s.clock, week: start + 6 * 52 } };
    const y = religiousYear(later, createRng('y'));
    expect(['chapter', 'consultation']).toContain(y.mode.kind);
    if (y.mode.kind === 'chapter') {
      const office = y.religious!.chapter!.office;
      expect(['prior', 'provincial']).toContain(office);
      expect(y.flags[office === 'prior' ? `chapter:house:${currentHouse(y)!.id}` : 'chapter:provincial']).toBe(later.clock.week);
      // The chapter closed, the next year sees the term.
      const held = resolveElection(holdElection(y), createRng('c'), true);
      const closed = { ...held, religious: { ...held.religious!, chapter: undefined }, mode: { kind: 'clock' as const }, clock: { ...held.clock, week: held.clock.week + 52 } };
      const { chapter: _c, ...rest } = closed.religious!;
      const again = religiousYear({ ...closed, religious: rest }, createRng('y2'));
      expect(['consultation', 'term_end', 'chapter']).toContain(again.mode.kind);
    }
    // A term of office over: the return to the ranks is the player's to say.
    s = { ...s, religious: { ...s.religious!, office: { office: 'prior', bodyId: s.religious!.houseId, startWeek: start, endWeek: start + 52, consecutive: 1 } }, clock: { ...s.clock, week: start + 52 } };
    expect(religiousYear(s, createRng('t')).mode.kind).toBe('term_end');
    // Ambition fades a little each year.
    const eager = { ...receiveAssignment(decideAssignment(ordainedFriar('amb'), createRng('d')), 'good') };
    const withAmbition = { ...eager, religious: { ...eager.religious!, perceivedAmbition: 50 } };
    expect(religiousYear(withAmbition, createRng('a')).religious!.perceivedAmbition).toBeLessThan(50);
    void PLAYER_ID;
  });
});
