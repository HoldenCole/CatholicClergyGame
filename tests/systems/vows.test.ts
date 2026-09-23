import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { communityVote, formationYearEnd } from '@/systems/religious/formation';
import { currentHouse, membersOf } from '@/systems/religious/house';
import type { GameState } from '@/types';

/** A Dominican novice at the end of his first year, in the novitiate. */
function novice(seed: string): GameState {
  const def = religiousOrder('OP');
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const house = gen.houses.find((h) => h.kind === 'novitiate')!;
  const base = seminaryState(seed);
  const s = installProvince(base, gen, 2010, house.id);
  return { ...s, seminary: { ...s.seminary!, year: 1 }, flags: { ...s.flags, 'order:OP': true, concerns_at_year_start: 0 }, clock: { ...s.clock, week: 52 } };
}

/** The vote held n times on the same house from different seeds: the share that passed. */
function passRate(s: GameState, n = 80): number {
  let passed = 0;
  for (let i = 0; i < n; i++) if (communityVote(s, createRng(`vote:${i}`)).passed) passed++;
  return passed / n;
}

describe('the house votes on a profession (E3 §3.5)', () => {
  it('a clean novice the house has no view of is professed almost always; the old years\' concerns do not count', () => {
    for (const seed of ['clean-a', 'clean-b', 'clean-c']) expect(passRate(novice(seed)), seed).toBeGreaterThanOrEqual(0.95);
    // Six concerns from earlier years, none this year: the house votes on the year it watched.
    const s = novice('old');
    expect(passRate({ ...s, seminary: { ...s.seminary!, concerns: ['a', 'b', 'c', 'd', 'e', 'f'] }, flags: { ...s.flags, concerns_at_year_start: 6 } })).toBeGreaterThanOrEqual(0.95);
  });

  it('this year\'s concerns and a cold house pull the vote down, the novice master\'s word and the house\'s regard lift it, and a man held back once is not held back for it', () => {
    const base = novice('cold');
    const house = currentHouse(base)!;
    const npcs = { ...base.npcs };
    for (const m of membersOf(base, house)) npcs[m.id] = { ...m, relationship: -35 };
    const cold: GameState = { ...base, npcs, seminary: { ...base.seminary!, concerns: ['x', 'y', 'z'] }, character: { ...base.character!, reputation: { ...base.character!.reputation, community: -30 } } };
    const coldRate = passRate(cold);
    expect(coldRate).toBeLessThan(0.6);
    const npcs2 = { ...cold.npcs };
    for (const m of membersOf(cold, house)) if (m.tags.includes('novice_master')) npcs2[m.id] = { ...npcs2[m.id]!, relationship: 80 };
    const warm: GameState = { ...cold, npcs: npcs2, character: { ...cold.character!, reputation: { ...cold.character!.reputation, community: 40 } } };
    expect(passRate(warm)).toBeGreaterThan(coldRate);
    // Refused once: the flag is written, no concern, and the next vote is a shade easier.
    let refused: GameState | undefined;
    for (let i = 0; i < 40 && !refused; i++) {
      const r = formationYearEnd({ ...cold, seed: `r-${i}` }, createRng(`end-${i}`));
      if (r.heldBack) refused = r.state;
    }
    expect(refused).toBeDefined();
    expect(refused!.flags['vows:refused']).toBe(52);
    expect(refused!.seminary!.concerns).toEqual(['x', 'y', 'z']);
    expect(refused!.religious!.vows.simpleWeek).toBeUndefined();
    expect(passRate({ ...cold, flags: { ...cold.flags, 'vows:refused': 0 } })).toBeGreaterThanOrEqual(coldRate);
  });

  it('professed, the year writes the vows and the standing', () => {
    let done: GameState | undefined;
    const s = novice('p');
    for (let i = 0; i < 20 && !done; i++) {
      const r = formationYearEnd({ ...s, seed: `p-${i}` }, createRng(`p-${i}`));
      if (!r.heldBack) done = r.state;
    }
    expect(done).toBeDefined();
    expect(done!.religious!.vows.simpleWeek).toBe(52);
    expect(done!.flags['vows:simple']).toBe(52);
  });
});
