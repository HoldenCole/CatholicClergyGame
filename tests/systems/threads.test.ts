import { describe, expect, it } from 'vitest';
import { allEvents } from '@/content';
import { createRng } from '@/engine/rng';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { renderText } from '@/engine/text';
import { findSender, mailDefs } from '@/systems/mail';
import { housesOf } from '@/systems/houses';
import { testNpc } from '../helpers/fixtures';
import { parishState } from './week.test';
import type { GameState } from '@/types';

describe('one world, round 2: the past writes and the tracks come home', () => {
  it('the other lanes have senders: the nuncio he served under, the dicastery, the College table, a man he formed, a house that knows him', () => {
    const base = parishState('threads-senders');
    const rng = createRng('t');
    for (const from of ['nuncio_chief', 'curia_colleague', 'nac_classmate', 'formed', 'house'] as const) expect(findSender(base, from, rng), from).toBeNull();
    const house = housesOf(base)[0]!;
    const s: GameState = {
      ...base,
      npcs: {
        ...base.npcs,
        chief: testNpc('chief', { role: 'official', title: 'Archbishop', status: 'retired', tags: ['nuncio_chief', 'country:Kenya'], relationship: 30 }),
        col: testNpc('col', { role: 'official', title: 'Msgr.', tags: ['curia_colleague'], relationship: 20 }),
        tab: testNpc('tab', { role: 'classmate', title: 'Fr.', tags: ['nac_classmate', 'nac'], relationship: 20 }),
        son: testNpc('son', { role: 'priest', title: 'Fr.', tags: ['formed_by:player'], relationship: 20 }),
      },
      houses: { [house.id]: { houseId: house.id, regard: 30, sinceWeek: 0, asked: 0, given: 1, arrangements: [] } },
    };
    const chief = findSender(s, 'nuncio_chief', rng)!;
    expect(chief.sender.who).toBe('the nuncio you served under in Kenya');
    expect(chief.extra.country).toBe('Kenya');
    expect(findSender(s, 'curia_colleague', rng)!.sender.who).toBe('of the dicastery');
    expect(findSender(s, 'nac_classmate', rng)!.sender.name).toMatch(/^Fr\. /);
    expect(findSender(s, 'formed', rng)!.sender.who).toBe('a man you formed');
    const abbot = findSender(s, 'house', rng)!;
    expect(abbot.sender.npcId).toBeUndefined();
    expect(abbot.sender.name).toMatch(new RegExp(`^the (abbot|prior|prioress|provost) of ${house.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`));
    expect(abbot.extra.house).toBe(house.name);
    // A house that barely knows him does not write.
    expect(findSender({ ...s, houses: { [house.id]: { ...s.houses![house.id]!, regard: 5 } } }, 'house', rng)).toBeNull();
    // The letters of the new senders are in the book, and none of their effects binds a man who is not there.
    const mine = mailDefs.filter((d) => ['nuncio_chief', 'curia_colleague', 'nac_classmate', 'formed', 'house'].includes(d.from));
    expect(mine.length).toBeGreaterThanOrEqual(10);
    for (const d of mine.filter((d) => d.from === 'house')) for (const r of d.replies) for (const e of r.effects) expect(e.key, `${d.id}/${r.id}`).not.toBe('@sender');
  });

  it('the tracks come home: a scene for each of the years elsewhere, gated on what he did, rendering clean at the parish', () => {
    const scenes = allEvents.filter((e) => e.id.startsWith('th_'));
    expect(scenes.length).toBeGreaterThanOrEqual(12);
    const base = parishState('threads-scenes');
    const plain: GameState = { ...base, phase: 'pastor', flags: { ...base.flags, ordination_week: base.clock.week - 52 * 10 } };
    for (const e of scenes) expect(isEligible(e, plain), `${e.id} for a plain pastor`).toBe(false);
    const gates: Record<string, Partial<GameState>> = {
      diplomat_served: { flags: { ...plain.flags, diplomat_served: true } },
      curia_served: { flags: { ...plain.flags, curia_served: true } },
      nac_alumnus: { flags: { ...plain.flags, nac_alumnus: true } },
      'nac:formator_served': { flags: { ...plain.flags, 'nac:formator_served': true } },
      'vatican:chaplain_served': { flags: { ...plain.flags, 'vatican:chaplain_served': true } },
      cpe_unit: { character: { ...plain.character!, credentials: [...plain.character!.credentials, 'cpe_unit'] } },
      STL: { character: { ...plain.character!, credentials: [...plain.character!.credentials, 'STL'] } },
    };
    for (const [gate, over] of Object.entries(gates)) {
      const s: GameState = { ...plain, ...over };
      const open = scenes.filter((e) => evaluateAll(e.requires!, s));
      expect(open.length, gate).toBeGreaterThanOrEqual(1);
      for (const e of open) {
        const text = [e.title, e.body, ...e.choices.flatMap((c) => [c.label, c.outcome ?? ''])].join(' ');
        const out = renderText(text, s, {});
        expect(out, e.id).not.toMatch(/\{[a-z_]+\}/);
        expect(out, e.id).not.toMatch(/\{@(?!bishop)/);
      }
    }
  });
});
