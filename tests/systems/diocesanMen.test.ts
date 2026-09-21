import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { currentHouse } from '@/systems/religious/house';
import { resolveSelector } from '@/engine/selectors';
import { InternalForumError } from '@/engine/internalForum';
import { diocesanClassmates, diocesanClassmateYear, diocesanClassmatesOrdain, diocesanClassmatesStart } from '@/systems/religious/diocesanClassmates';
import { advanceTrajectories } from '@/systems/trajectories';
import { answerDirectionAsk, directees, directingWeek, directingYear, seminaryMenStart, seminaryMenYear, takeDirectee } from '@/systems/religious/directing';
import { applyInternalForum } from '@/engine/internalForum';
import { directingLoad } from '@/systems/religious/requests';

function friar(seed: string, order: OrderKey = 'OP', kind = 'studium'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === kind) ?? gen.houses[0])!.id;
  const base = seminaryState(seed);
  const c = testCharacter({ stats: { administration: 50, charisma: 55, theology: 65, knowledge: 55, piety: 70 }, reputation: { ...base.character!.reputation, province: 20, superiors: 10, community: 20, laity: 20, diocesan_clergy: 20 } });
  return installProvince({ ...base, character: c }, gen, 2010, first);
}

function ordained(s: GameState, years = 6): GameState {
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * years }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

describe("the diocese's men (E3 §3.13)", () => {
  it('the studium\'s first year brings two or three diocesan seminarians, rolled and not picked, who are ordained the June he is and become the diocese\'s priests', () => {
    const s = friar('dcm');
    const year = religiousOrder('OP').formation.find((f) => f.house === 'studium')!.year;
    const inStudium: GameState = { ...s, seminary: { ...s.seminary!, year } };
    const met = diocesanClassmatesStart(inStudium, createRng('dcm:1'));
    const men = diocesanClassmates(met);
    expect(men.length).toBeGreaterThanOrEqual(2);
    expect(men.length).toBeLessThanOrEqual(3);
    expect(met.flags['dcm:met']).toBeDefined();
    for (const n of men) {
      expect(n.tags).toContain('diocesan_classmate');
      expect(n.tags).toContain(`diocese:${currentHouse(s)!.dioceseId}`);
      expect(n.role).toBe('classmate');
    }
    // Two seeds, two different men; the same seed, the same men.
    const other = diocesanClassmates(diocesanClassmatesStart(inStudium, createRng('dcm:2')));
    expect(other.map((n) => n.name.last)).not.toEqual(men.map((n) => n.name.last));
    expect(diocesanClassmates(diocesanClassmatesStart(inStudium, createRng('dcm:1'))).map((n) => n.name.last)).toEqual(men.map((n) => n.name.last));
    // Not the friar's own classmates.
    expect(resolveSelector(met, '@diocesan_classmate', createRng('x'))?.tags).toContain('diocesan_classmate');
    expect(resolveSelector(met, '@closest_classmate')?.tags ?? []).not.toContain('diocesan_classmate');
    // Ordained with him; a pastor in time takes a parish of his diocese.
    const o = diocesanClassmatesOrdain(ordained(met, 0), createRng('ord'));
    for (const n of diocesanClassmates(o)) expect(n.role === 'priest' || n.status !== 'active').toBe(true);
    let late = { ...o, clock: { ...o.clock, week: o.clock.week + 52 * 14 } };
    late = advanceTrajectories(late, 14).state;
    late = diocesanClassmateYear(late, createRng('y'));
    const pastors = diocesanClassmates(late).filter((n) => n.tags.includes('pastor') && n.status === 'active');
    for (const p of pastors) {
      const tag = p.tags.find((t) => t.startsWith('pastor:'));
      expect(tag).toBeDefined();
      const pid = tag!.slice('pastor:'.length);
      const did = p.tags.find((t) => t.startsWith('diocese:'))!.slice('diocese:'.length);
      const world = late.world!.diocese.presetId === did ? late.world! : late.territory![did]!;
      expect(world.parishes.find((x) => x.id === pid)?.pastorId).toBe(p.id);
      expect(Object.values(late.npcs).filter((n) => n.tags.includes(tag!)).length).toBe(1);
    }
    if (pastors.length) expect(late.flags['dcm:pastor']).toBe(true);
  });

  it("teaching at the seminary brings its men; they are ordained four years on into that diocese's presbyterate", () => {
    const s = ordained(friar('sem', 'OSA', 'priory'));
    const teaching: GameState = { ...s, religious: { ...s.religious!, apostolate: { id: 'seminary_faculty', dioceseId: s.world!.diocese.presetId, label: 'Teaching at the diocesan seminary', startWeek: s.clock.week } } };
    const met = seminaryMenStart(teaching, createRng('men'));
    const did = s.world!.diocese.presetId;
    const ids = met.religious!.seminarians![did]!;
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(resolveSelector(met, '@diocesan_seminarian', createRng('x'))?.tags).toContain('diocesan_seminarian');
    expect(seminaryMenStart(met, createRng('again')).religious!.seminarians![did]).toEqual(ids);
    const later = seminaryMenYear({ ...met, clock: { ...met.clock, week: met.clock.week + 52 * 4 } }, createRng('o'));
    for (const id of ids) expect(later.npcs[id]!.role).toBe('priest');
    expect(later.flags['seminary:men_ordained']).toBeDefined();
  });

  it('direction given is sealed: a priest asks, a yes costs a block, the weeks move only the friar\'s interior, and a reputation effect throws', () => {
    const s = ordained(friar('dir', 'OP', 'priory'));
    let asked: GameState | undefined;
    for (let i = 0; i < 60 && !asked; i++) {
      const y = directingYear(s, createRng(`dir:${i}`));
      if (y.religious!.directionAsk) asked = y;
    }
    expect(asked).toBeDefined();
    expect(asked!.religious!.directionAsk!.kind).toBe('priest');
    const yes = answerDirectionAsk(asked!, true);
    expect(directees(yes).length).toBe(1);
    expect(directingLoad(yes)).toBe(1);
    expect(yes.flags['directee:priest']).toBeDefined();
    const before = { ...yes.character!.reputation };
    let next = yes;
    for (let i = 0; i < 52; i++) next = directingWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } });
    expect(next.character!.reputation).toEqual(before);
    expect(next.character!.stats.piety).toBeGreaterThan(yes.character!.stats.piety);
    const id = directees(yes)[0]!.npcId;
    expect(next.npcs[id]!.relationship).toBeGreaterThan(yes.npcs[id]!.relationship);
    expect(() => applyInternalForum(yes, [{ target: 'reputation', key: 'local_bishop', delta: 5 }], {}, 'a leak')).toThrow(InternalForumError);
    // A no is the man's to remember and nothing else's.
    const no = answerDirectionAsk(asked!, false);
    expect(no.character!.reputation).toEqual(asked!.character!.reputation);
    expect(no.npcs[asked!.religious!.directionAsk!.npcId]!.relationship).toBeLessThan(asked!.npcs[asked!.religious!.directionAsk!.npcId]!.relationship);
    // Three at most.
    let full = yes;
    const priests = Object.values(full.npcs).filter((n) => n.role === 'priest' && n.status === 'active' && n.id !== id).slice(0, 3);
    for (const p of priests) full = takeDirectee(full, p.id, 'priest');
    expect(directees(full).length).toBe(3);
  });
});
