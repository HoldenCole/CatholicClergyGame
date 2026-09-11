import { describe, it, expect } from 'vitest';
import { choiceMeaning } from '@/systems/choiceMeaning';
import { allEvents } from '@/content';

describe('every choice can say what it is saying', () => {
  it('a position, a lean, and who warms or cools come out in words', () => {
    const m = choiceMeaning({ id: 'a', label: 'Say it', volume: 'public', positionTopic: 'liturgy', positionValue: -50, effects: [{ target: 'alignment', key: 'alignment', delta: -3 }, { target: 'reputation', key: 'traditional_bloc', delta: 6 }, { target: 'relationship', key: '@bishop', delta: -8 }] })!;
    expect(m).toMatch(/A public stand on the liturgy, hard the traditional side\./);
    expect(m).toMatch(/Leans you toward tradition\./);
    expect(m).toMatch(/the traditional wing warms; the bishop cools\./);
    const q = choiceMeaning({ id: 'b', label: 'Keep quiet', effects: [{ target: 'stat', key: 'piety', delta: 0.2 }] });
    expect(q).toBeNull();
    const t = choiceMeaning({ id: 'c', label: 'x', volume: 'semi_public', positionTopic: 'tlm', positionValue: 30, effects: [{ target: 'concern', key: 'c', value: 'x' }] })!;
    expect(t).toMatch(/A stand said aloud on the Latin Mass, against it\./);
    expect(t).toMatch(/Goes in the file as a concern\./);
  });

  it('every stance-bearing choice in the content gets a meaning line', () => {
    let stance = 0;
    for (const e of allEvents) for (const c of e.choices) {
      const hasStance = c.positionTopic !== undefined || (c.effects ?? []).some((x) => x.target === 'alignment' && Math.abs(x.delta ?? 0) >= 1);
      if (!hasStance) continue;
      stance++;
      expect(choiceMeaning(c), `${e.id} › ${c.id}`).not.toBeNull();
    }
    expect(stance).toBeGreaterThan(200);
  });
});
