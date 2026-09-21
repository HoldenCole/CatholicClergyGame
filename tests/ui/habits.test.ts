import { describe, expect, it } from 'vitest';
import { habitFor, instituteIdOf, portraitForNpc, portraitForPlayer } from '@/ui/portraits/spec';
import { instituteDefs } from '@/content/institutes';
import { religiousOrder } from '@/content/religious';
import { createRng } from '@/engine/rng';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { seminaryState } from '../helpers/fixtures';
import { generateReligious } from '@/generation/institutes';
import type { Npc } from '@/types';

function friar(order: 'OP' | 'OSA') {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`habit:${order}:province`), def, def.provinces[0]!, 2010);
  return installProvince(seminaryState(`habit:${order}`), gen, 2010, gen.houses.find((h) => h.kind === 'priory')!.id);
}

describe('habits by order (portraits)', () => {
  it('every institute names its habit, and the ones in clerical black draw as priests', () => {
    for (const d of instituteDefs) {
      expect(d.habit, d.id).toBeDefined();
      expect(d.habit.line.length).toBeGreaterThan(10);
      if (d.habit.cassock) expect(habitFor(d.id)).toBeNull();
      else expect(habitFor(d.id)?.color).toBe(d.habit.color);
    }
    expect(habitFor('dominicans')!.color).toBe('#f1ece0');
    expect(habitFor('dominicans')!.cappa).toBe('#1c1917');
    expect(habitFor('dominicans', true)!.cappaOn).toBe(true);
    expect(habitFor('dominicans', false)!.cappaOn).toBe(false);
    expect(habitFor('augustinians')!.color).toBe('#1c1917');
    expect(habitFor('augustinians')!.cord).toBe('leather');
    expect(habitFor('augustinians', true)!.cappaOn).toBe(false);
    expect(habitFor('franciscans')!.cord).toBe('white');
    expect(habitFor('jesuits')).toBeNull();
  });

  it('a friar of the province wears his order\'s habit, white for a Dominican and black for an Augustinian, and a diocesan priest does not', () => {
    for (const order of ['OP', 'OSA'] as const) {
      const s = friar(order);
      const man = s.province!.friarIds.map((id) => s.npcs[id]!).find((n) => n.status === 'active')!;
      expect(instituteIdOf(man)).toBe(religiousOrder(order).instituteId);
      const p = portraitForNpc(man, 2020);
      expect(p.dress).toBe('habit');
      expect(p.habit!.color).toBe(order === 'OP' ? '#f1ece0' : '#1c1917');
      expect(p.female).toBe(false);
      const priest = Object.values(s.npcs).find((n) => n.role === 'priest' && n.status === 'active')!;
      expect(portraitForNpc(priest, 2020).dress).toBe('priest');
      // Some Dominicans wear the cappa in their portrait; none of the Augustinians can.
      const cappas = s.province!.friarIds.map((id) => portraitForNpc(s.npcs[id]!, 2020).habit?.cappaOn).filter(Boolean).length;
      if (order === 'OP') expect(cappas).toBeGreaterThan(0); else expect(cappas).toBe(0);
    }
  });

  it('the player friar wears the habit once clothed, with the cappa when he chooses it; a diocesan man is unchanged', () => {
    const s = friar('OP');
    const novice = { ...s, seminary: { ...s.seminary!, year: 1 } };
    const p = portraitForPlayer(novice);
    expect(p.dress).toBe('habit');
    expect(p.habit!.cappaOn).toBe(false);
    const cloaked = portraitForPlayer({ ...novice, religious: { ...novice.religious!, cappa: true } });
    expect(cloaked.habit!.cappaOn).toBe(true);
    const osa = friar('OSA');
    expect(portraitForPlayer({ ...osa, seminary: { ...osa.seminary!, year: 1 } }).dress).toBe('seminarian');
    expect(portraitForPlayer({ ...osa, seminary: { ...osa.seminary!, year: 2 } }).dress).toBe('habit');
    const diocesan = seminaryState('plain');
    expect(portraitForPlayer(diocesan).dress).toBe('seminarian');
    expect(portraitForPlayer({ ...diocesan, phase: 'pastor' }).dress).toBe('priest');
  });

  it('the diocese\'s own religious wear their habits too, and a sister wears the veil', () => {
    const base = seminaryState('cast');
    const world = base.world;
    if (!world?.institutes?.length) return;
    const cast: Npc[] = generateReligious(createRng('cast'), world.institutes, 2010);
    for (const n of cast) {
      const p = portraitForNpc(n, 2020);
      const def = instituteDefs.find((d) => d.id === instituteIdOf(n));
      if (!def) continue;
      if (def.habit.cassock) expect(p.dress).toBe('priest');
      else {
        expect(p.dress).toBe('habit');
        if (def.women) { expect(p.female).toBe(true); expect(p.habit!.veil).toBeDefined(); }
      }
    }
  });
});
