import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState } from '../helpers/fixtures';
import { parishState } from './week.test';
import { chooseDirector, endDirection, kindOf, matchFor, maySeekDirector, offerDirectors, seekDirectors, DIRECTION } from '@/systems/direction';
import type { GameState } from '@/types';

describe('spiritual direction: the kind first, then the man (DESIGN §9.4)', () => {
  it('year one offers every kind the diocese can give, two Dominicans and a monk always, and the weaknesses vary', () => {
    const s = seminaryState('dir1');
    const { state, options } = offerDirectors(s, createRng('offer'));
    // The fixture's diocese is thin; a real one offers six to eight.
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.filter((o) => state.npcs[o.npcId]!.institute === 'inst_dominicans').length).toBe(DIRECTION.dominicans);
    expect(options.filter((o) => o.kind === 'monk').length).toBeGreaterThanOrEqual(DIRECTION.monks);
    expect(options.some((o) => o.kind === 'friar')).toBe(true);
    for (const o of options) expect(kindOf(state.npcs[o.npcId]!)).toBe(o.kind);
    // A monk from the abbey when the diocese has no monastery is in the state, with the tag the sheets read.
    const monk = options.find((o) => o.kind === 'monk')!;
    expect(state.npcs[monk.npcId]!.tags).toContain('religious');
    // The "no use for" line is not the same for every man.
    const poors = new Set(options.map((o) => o.poor));
    expect(poors.size).toBeGreaterThan(1);
    // Same seed, same men.
    expect(offerDirectors(s, createRng('offer')).options).toEqual(options);
  });

  it('a monk of contemplative temperament is the right man for a prayer that has gone dark', () => {
    const s = seminaryState('dir2');
    const { state, options } = offerDirectors(s, createRng('offer'));
    const monk = options.find((o) => o.kind === 'monk')!;
    const chosen = chooseDirector({ ...state, npcs: { ...state.npcs, [monk.npcId]: { ...state.npcs[monk.npcId]!, temperament: 'contemplative' } } }, monk.npcId);
    expect(matchFor(chosen.character!.direction, 'dark_night')).toBe('good');
    expect(chosen.npcs[monk.npcId]!.tags).toContain('spiritual_director');
  });

  it('later in life a man may look for a director again: older priests of the diocese are among the men, the last director is not, and the form can be put back', () => {
    const s = parishState('dir3');
    // A priest with a director cannot look; one who lost him can.
    const { state: st, options } = offerDirectors(s, createRng('o'));
    const withOne = chooseDirector(st, options[0]!.npcId);
    expect(maySeekDirector(withOne).ok).toBe(false);
    const lost = endDirection(withOne, 'reassigned');
    expect(maySeekDirector(lost).ok).toBe(true);
    const sought = seekDirectors(lost, createRng('seek'));
    expect(sought.mode.kind).toBe('director');
    if (sought.mode.kind !== 'director') return;
    expect(sought.mode.options.some((o) => o.npcId === options[0]!.npcId)).toBe(false);
    expect(sought.mode.options.some((o) => o.kind === 'monk')).toBe(true);
    const year = 2010 + Math.floor(sought.clock.week / 52);
    const olderPriests = Object.values(sought.npcs).filter((n) => n.role === 'priest' && n.status === 'active' && n.title === 'Fr.' && year - n.birthYear >= DIRECTION.diocesanFrom && !n.tags.includes('bishop'));
    if (olderPriests.length) expect(sought.mode.options.some((o) => o.kind === 'diocesan')).toBe(true);
    expect(sought.flags['direction:sought']).toBe(sought.clock.week);
    // Asked around lately: give it a season.
    expect(maySeekDirector({ ...sought, mode: { kind: 'clock' } } as GameState).ok).toBe(false);
    expect(maySeekDirector({ ...sought, mode: { kind: 'clock' }, clock: { ...sought.clock, week: sought.clock.week + 9 } } as GameState).ok).toBe(true);
    // Choosing again settles the new man in.
    const again = chooseDirector(sought, sought.mode.options[0]!.npcId, false);
    expect(again.character!.direction?.npcId).toBe(sought.mode.options[0]!.npcId);
    expect(again.flags['direction:split']).toBe(true);
  });
});
