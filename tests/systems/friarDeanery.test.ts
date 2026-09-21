import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { pastorAskDefs, religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { currentHouse } from '@/systems/religious/house';
import { moveToHouse } from '@/systems/religious/transfer';
import { resolveSelector } from '@/engine/selectors';
import { evaluateCondition } from '@/engine/conditions';
import { formFriarDeanery, friarDeaneryPriests, friarDeaneryWeek, friarParish, friarRole } from '@/systems/religious/deanery';
import { answerPastorAsk, pastorAskWeek, pastorAskYear } from '@/systems/religious/pastorAsks';
import { pastorTaskLoad } from '@/systems/religious/requests';

function friar(seed: string, order: OrderKey = 'OP', kind = 'parish'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === kind) ?? gen.houses.find((h) => h.kind === 'priory'))!.id;
  const base = seminaryState(seed);
  const c = testCharacter({ stats: { administration: 55, charisma: 60, theology: 55, knowledge: 50, piety: 55 }, reputation: { ...base.character!.reputation, province: 20, superiors: 10, community: 20, laity: 30 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  const ordained = { ...s, clock: { ...s.clock, week: week + 52 * 4 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
  // Posted to the parish house for the parish.
  return moveToHouse(ordained, first, 'parish');
}

describe('the deanery for a friar pastor, and the pastors who ask (E3 §3.12)', () => {
  it('every parish house of the province holds a parish of its diocese, whose pastor is the prior', () => {
    const s = friar('parish');
    for (const h of Object.values(s.orderHouses!).filter((x) => x.kind === 'parish')) {
      expect(h.parishId).toBeDefined();
      const world = s.world!.diocese.presetId === h.dioceseId ? s.world! : s.territory![h.dioceseId]!;
      const parish = world.parishes.find((p) => p.id === h.parishId)!;
      expect(parish).toBeDefined();
      expect(parish.pastorId).toBe(h.priorId);
      expect(s.npcs[h.priorId]!.tags).toContain(`pastor:${parish.id}`);
      expect(Object.values(s.npcs).filter((n) => n.tags.includes(`pastor:${parish.id}`)).length).toBe(1);
    }
  });

  it('the week he arrives the deanery forms, the posting is an assignment, and the dean and the neighbours resolve; it goes when he goes', () => {
    const s = friar('deanery');
    expect(friarParish(s)).toBeDefined();
    expect(friarRole(s)).toBe('parochial_vicar');
    const formed = friarDeaneryWeek(s, createRng('d'));
    expect(formed.religious!.deanery).toBeDefined();
    expect(formed.assignment?.parishId).toBe(friarParish(s)!.id);
    expect(formed.flags['deanery:friar']).toBe(true);
    expect(formed.flags['deanery:member']).toBe(true);
    const priests = friarDeaneryPriests(formed);
    expect(priests.length).toBeGreaterThan(0);
    for (const p of priests) expect(p.npc.tags).toContain(`diocese:${formed.world!.diocese.presetId}`);
    expect(resolveSelector(formed, '@dean')?.id).toBe(formed.religious!.deanery!.deanId);
    expect(resolveSelector(formed, '@deanery_priest', createRng('x'))).toBeTruthy();
    expect(evaluateCondition({ type: 'flag', key: 'deanery:friar', value: true }, formed)).toBe(true);
    // Same seed, same deanery.
    expect(formFriarDeanery(s, createRng('d')).religious!.deanery).toEqual(formed.religious!.deanery);
    // Moved to a priory: the deanery and the assignment go, and the base parish loop never started.
    expect(formed.parish).toBeFalsy();
    const priory = Object.values(formed.orderHouses!).find((h) => h.kind === 'priory')!;
    const gone = friarDeaneryWeek(moveToHouse(formed, priory.id, 'priory_church'), createRng('g'));
    expect(gone.religious!.deanery).toBeUndefined();
    expect(gone.assignment).toBeNull();
    expect(gone.flags['deanery:friar']).toBeUndefined();
  });

  it('a pastor writes to the prior, not the friar; a yes stands six weeks, silence is a no, and the work done lands on the people and the presbyterate', () => {
    const s = friarDeaneryWeek(friar('asks'), createRng('d'));
    let asked: GameState | undefined;
    let refused: GameState | undefined;
    for (let i = 0; i < 80 && !(asked && refused); i++) {
      const y = pastorAskYear(s, createRng(`ask:${i}`));
      if (y.religious!.pastorAsk) asked ??= y;
      else if (y.religious!.pastorAskLine) refused ??= y;
    }
    expect(asked).toBeDefined();
    const ask = asked!.religious!.pastorAsk!;
    expect(ask.priorSaidYes).toBe(true);
    expect(asked!.npcs[ask.pastorId]?.role).toBe('priest');
    expect(asked!.religious!.pastorAskLine).toMatch(/wrote to the prior/);
    // Silence: six weeks on, it is a no, and the presbyterate notices.
    const late: GameState = { ...asked!, clock: { ...asked!.clock, week: ask.dueWeek } };
    const lapsed = pastorAskWeek(late);
    expect(lapsed.religious!.pastorAsk).toBeUndefined();
    expect(lapsed.character!.reputation.diocesan_clergy ?? 0).toBeLessThan(asked!.character!.reputation.diocesan_clergy ?? 0);
    // Yes: the task runs, costs blocks, and lands its effects when done.
    const yes = answerPastorAsk(asked!, true);
    const task = yes.religious!.pastorTask!;
    const def = pastorAskDefs.find((d) => d.id === task.defId)!;
    expect(task.ap).toBe(def.ap);
    expect(pastorTaskLoad(yes)).toBe(def.ap);
    expect(yes.flags[`pastor_ask:${def.id}`]).toBeDefined();
    const done = pastorAskWeek({ ...yes, clock: { ...yes.clock, week: task.untilWeek } });
    expect(done.religious!.pastorTask).toBeUndefined();
    expect(pastorTaskLoad(done)).toBe(0);
    expect(done.character!.reputation.diocesan_clergy ?? 0).toBeGreaterThan(yes.character!.reputation.diocesan_clergy ?? 0);
    expect(done.npcs[task.pastorId]!.relationship).toBeGreaterThan(yes.npcs[task.pastorId]!.relationship);
    // No: the pastor remembers a little.
    const no = answerPastorAsk(asked!, false);
    expect(no.npcs[ask.pastorId]!.relationship).toBeLessThan(asked!.npcs[ask.pastorId]!.relationship);
  });

  it('the diocesan clergy standing is the religious campaign\'s own, and leaves with the diocese', () => {
    const s = friar('clergy');
    const warm: GameState = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, diocesan_clergy: 30 } } };
    const away = Object.values(warm.orderHouses!).find((h) => h.dioceseId !== currentHouse(warm)!.dioceseId)!;
    const moved = moveToHouse(warm, away.id, away.works[0] ?? 'priory_church');
    expect(moved.character!.reputation.diocesan_clergy).toBe(0);
    expect(moved.religious!.dioceseFile![currentHouse(warm)!.dioceseId]!.diocesan_clergy).toBe(30);
  });
});
