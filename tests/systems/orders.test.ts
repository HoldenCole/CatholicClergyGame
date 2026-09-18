import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { generateDiocese } from '@/generation/diocese';
import { generateHouses, linkHouses, presenceLines } from '@/generation/houses';
import { generateInstitutes, generateReligious, religiousRoleLine } from '@/generation/institutes';
import { orderDefs } from '@/content/houses';
import { orderProfile, orderProfiles, profileForHouse } from '@/content/orders';
import { houseAsks, houseFavours } from '@/content/parish';
import { diocesePresets, presetById } from '@/content/dioceses';
import { eventById, eventsForPhase } from '@/content';
import { evaluateCondition } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import { HOUSES, askFavour, castOf, favourOffers, houseKindLine, houseWeek, housesYear, raiseHouseAsk } from '@/systems/houses';
import type { GameState, Npc, ReligiousHouse } from '@/types';

const ORDERS = ['dominicans', 'franciscans', 'augustinians'] as const;

function house(order: string): ReligiousHouse {
  const def = orderDefs.find((o) => o.id === order)!;
  return { id: `house:${order}`, name: def.names[0]!, order, orderLabel: def.label, members: def.members, charism: def.charism, alignment: 0, setting: 'city', size: 10, line: 'A house.', instituteId: `inst_${def.institute}` };
}

/** A parish with the three houses next door, each at a given standing, and a man of each institute. */
function withOrders(seed = 'orders', regard = 50): GameState {
  const base = parishState(seed);
  const houses = ['dominican', 'franciscan', 'augustinian'].map((o) => house(o));
  const world = { ...base.world!, diocese: { ...base.world!.diocese, visible: { ...base.world!.diocese.visible, houses } } };
  const standing = Object.fromEntries(houses.map((h) => [h.id, { houseId: h.id, regard, sinceWeek: 0, asked: 0, given: 0, arrangements: [] }]));
  const someone = Object.values(base.npcs).find((n) => n.name && n.stats)!;
  const man = (id: string, institute: string, tag: string, title = 'Fr.'): Npc => ({ ...someone, id, title, role: 'religious', status: 'active', institute, tags: ['religious', tag, `institute:${institute}`, `house:house:${institute.replace('inst_', '').replace(/s$/, '')}`] });
  const npcs = {
    ...base.npcs,
    religious_dominicans_prior: man('religious_dominicans_prior', 'inst_dominicans', 'religious:prior'),
    religious_dominicans_lector: man('religious_dominicans_lector', 'inst_dominicans', 'religious:lector'),
    religious_franciscans_guardian: man('religious_franciscans_guardian', 'inst_franciscans', 'religious:guardian'),
    religious_franciscans_kitchen: man('religious_franciscans_kitchen', 'inst_franciscans', 'religious:kitchen', 'Br.'),
    religious_augustinians_prior: man('religious_augustinians_prior', 'inst_augustinians', 'religious:prior'),
    religious_augustinians_headmaster: man('religious_augustinians_headmaster', 'inst_augustinians', 'religious:headmaster'),
  };
  return { ...base, world, houses: standing, npcs, strain: 40 };
}

describe('three orders told apart (DESIGN §9.4b)', () => {
  it('each has a profile, a house in the pool that is its institute\'s, its own people, favours and asks', () => {
    for (const id of ORDERS) {
      const p = orderProfile(id)!;
      expect(p, id).toBeDefined();
      const order = orderDefs.find((o) => o.id === p.houseOrder)!;
      expect(order.institute).toBe(id);
      expect(profileForHouse({ order: p.houseOrder })!.id).toBe(id);
      expect(p.people.filter((r) => r.always).length).toBe(1);
      expect(p.people.length).toBe(3);
      for (const f of p.favours) {
        const def = houseFavours.find((d) => d.id === f)!;
        expect(def.order, f).toBe(p.houseOrder);
        expect(def.effects, f).toBeDefined();
      }
      expect(houseAsks.some((a) => a.order === p.houseOrder), id).toBe(true);
      expect(houseKindLine({ order: p.houseOrder } as ReligiousHouse)).toMatch(new RegExp(`A ${p.house} under a ${p.superior}`));
    }
    expect(orderProfiles.length).toBe(3);
  });

  it('an institute present gets its own house first, linked by id and never by charism alone', () => {
    let linkedByOrder = 0;
    for (let i = 0; i < 200; i++) {
      const preset = diocesePresets[i % diocesePresets.length]!;
      const institutes = generateInstitutes(createRng(`inst-${i}`), preset);
      const houses = generateHouses(createRng(`h-${i}`), preset.size, institutes);
      expect(new Set(houses.map((h) => h.order)).size).toBe(houses.length);
      for (const inst of institutes) {
        const order = orderDefs.find((o) => o.institute === inst.defId);
        if (order) expect(houses.some((h) => h.order === order.id), `${preset.id} ${inst.defId}`).toBe(true);
      }
      const cast = generateReligious(createRng(`cast-${i}`), institutes, 2010);
      const linked = linkHouses(houses, institutes, cast);
      for (const h of linked.houses) {
        const order = orderDefs.find((o) => o.id === h.order)!;
        if (!h.instituteId) continue;
        const inst = institutes.find((x) => x.id === h.instituteId)!;
        if (order.institute) {
          expect(inst.defId, `${h.order} linked to ${inst.defId}`).toBe(order.institute);
          linkedByOrder++;
        }
      }
      // A Dominican priory is never the Jesuits' house.
      const priory = linked.houses.find((h) => h.order === 'dominican');
      if (priory?.instituteId) expect(institutes.find((x) => x.id === priory.instituteId)!.defId).toBe('dominicans');
    }
    expect(linkedByOrder).toBeGreaterThan(100);
    expect(generateHouses(createRng('same'), 'large', [])).toEqual(generateHouses(createRng('same'), 'large', []));
  });

  it('the preset says how present each order is: strong is always there, none never, and the line goes on the house', () => {
    const count = (id: string, order: string) => Array.from({ length: 80 }, (_, i) => generateInstitutes(createRng(`p-${id}-${i}`), presetById(id)!)).filter((s) => s.some((x) => x.defId === order)).length;
    expect(count('philadelphia', 'augustinians')).toBe(80);
    expect(count('chicago', 'dominicans')).toBe(80);
    expect(count('new_orleans', 'augustinians')).toBe(0);
    expect(count('houston', 'augustinians')).toBe(0);
    expect(count('philadelphia', 'dominicans')).toBeLessThan(count('washington', 'dominicans'));
    // Every preset has the block, and every line lands on the house it is about.
    for (const preset of diocesePresets) {
      expect(preset.orders, preset.id).toBeDefined();
      for (const id of ORDERS) expect(preset.orders![id]?.presence, `${preset.id} ${id}`).toBeDefined();
    }
    const d = generateDiocese(createRng('phl'), presetById('philadelphia')!, 2010);
    const osa = d.diocese.visible.houses.find((h) => h.order === 'augustinian')!;
    expect(osa).toBeDefined();
    expect(osa.line).toMatch(/1842/);
    const bare = presenceLines([house('dominican')], [], { orders: {} });
    expect(bare[0]!.line).toBe('A house.');
  });

  it('the order\'s own people are in the cast: the superior always, one of the others rolled, and independent of each other', () => {
    const roles = new Map<string, number>();
    const stats: number[] = [];
    const aligns: number[] = [];
    for (let i = 0; i < 300; i++) {
      const institutes = generateInstitutes(createRng(`c-${i}`), presetById('chicago')!);
      const cast = generateReligious(createRng(`cc-${i}`), institutes, 2010);
      for (const inst of institutes) {
        const p = orderProfile(inst.defId);
        if (!p) continue;
        const mine = cast.filter((n) => n.institute === inst.id && p.people.some((r) => n.tags.includes(`religious:${r.role}`)));
        expect(mine.some((n) => n.tags.includes(`religious:${p.people.find((r) => r.always)!.role}`)), `${inst.defId} superior`).toBe(true);
        expect(mine.length).toBeLessThanOrEqual(2);
        for (const n of mine) {
          const tag = n.tags.find((t) => t.startsWith('religious:'))!;
          roles.set(tag, (roles.get(tag) ?? 0) + 1);
          expect(religiousRoleLine(n)).toBeTruthy();
          if (tag === 'religious:kitchen') expect(n.title).toBe('Br.');
          if (tag === 'religious:student') expect(2010 - n.birthYear).toBeLessThanOrEqual(31);
          stats.push(n.stats.theology);
          aligns.push(n.alignment);
        }
      }
    }
    for (const r of ['religious:prior', 'religious:lector', 'religious:student', 'religious:guardian', 'religious:kitchen', 'religious:confessor', 'religious:headmaster']) expect(roles.get(r) ?? 0, r).toBeGreaterThan(0);
    // Alignment and stats roll apart (CLAUDE.md rule 4).
    const n = stats.length;
    const mx = stats.reduce((a, b) => a + b, 0) / n;
    const my = aligns.reduce((a, b) => a + b, 0) / n;
    const cov = stats.reduce((a, x, i) => a + (x - mx) * (aligns[i]! - my), 0);
    const sx = Math.sqrt(stats.reduce((a, x) => a + (x - mx) ** 2, 0));
    const sy = Math.sqrt(aligns.reduce((a, y) => a + (y - my) ** 2, 0));
    expect(Math.abs(cov / (sx * sy))).toBeLessThan(0.2);
  });

  it('a favour of one order is refused at another\'s house, and its authored effects land when it is given', () => {
    const s = withOrders('fav');
    const offers = favourOffers(s);
    const at = (h: string, f: string) => offers.find((o) => o.house.id === `house:${h}` && o.def.id === f)!;
    expect(at('dominican', 'course').available).toBe(true);
    expect(at('franciscan', 'course').why).toMatch(/Only the Dominicans/);
    expect(at('augustinian', 'kitchen').why).toMatch(/Only the Franciscans/);
    expect(at('dominican', 'common_table').why).toMatch(/Only the Augustinians/);
    expect(() => askFavour(s, 'house:franciscan', 'course', createRng('x'))).toThrow(/Only the Dominicans/);
    // The course: the parish learns, the man learns, the flag is set, the hall is paid for.
    const course = askFavour(s, 'house:dominican', 'course', createRng('c'));
    expect(course.state.character!.reputation.parishioners).toBe(s.character!.reputation.parishioners + 4);
    expect(course.state.flags['house:course']).toBe(true);
    expect(course.state.parish!.finance.cash).toBe(s.parish!.finance.cash - 600);
    expect(course.line).toMatch(/six Thursday nights/);
    // The friars' winter puts money back and takes wear off.
    const mercy = askFavour(s, 'house:franciscan', 'mercy', createRng('m'));
    expect(mercy.state.parish!.finance.cash).toBe(s.parish!.finance.cash + 900);
    expect(mercy.state.strain).toBe(34);
    // A standing kitchen leaves a flag scenes read, and the provincial's withdrawal takes it away.
    const kitchen = askFavour(s, 'house:franciscan', 'kitchen', createRng('k'));
    expect(kitchen.state.flags['house:kitchen']).toBe(true);
    expect(kitchen.line).toMatch(/Br\. .* will run a kitchen/);
    let gone: GameState | undefined;
    for (let i = 0; i < 200 && !gone; i++) {
      const y = housesYear({ ...kitchen.state, clock: { ...kitchen.state.clock, week: kitchen.state.clock.week + i } }, createRng(`y-${i}`));
      if (y.lines.some((l) => /Tuesday kitchen/.test(l))) gone = y.state;
    }
    expect(gone).toBeDefined();
    expect(gone!.flags['house:kitchen']).toBeUndefined();
  });

  it('a chair at the Augustinians\' table takes wear off the man every week, and only that', () => {
    const s = withOrders('table');
    const table = askFavour(s, 'house:augustinian', 'common_table', createRng('t')).state;
    expect(table.flags['house:common_table']).toBe(true);
    expect(houseWeek(table, 0).strain).toBeCloseTo(40 - HOUSES.tableRelief, 5);
    expect(houseWeek(s, 0).strain).toBe(40);
    expect(table.character!.reputation).toEqual(s.character!.reputation);
  });

  it('an order asks only what it asks: the disputation is the Dominicans\', the Transitus the Franciscans\', the dinner the Augustinians\'', () => {
    const seen = new Map<string, Set<string>>();
    const s = withOrders('ask', 30);
    for (let i = 0; i < 120; i++) {
      const r = raiseHouseAsk(s, createRng(`a-${i}`));
      const standing = Object.values(r.state.houses!).find((x) => x.ask)!;
      const set = seen.get(standing.houseId) ?? new Set<string>();
      set.add(standing.ask!.id);
      seen.set(standing.houseId, set);
    }
    expect(seen.get('house:dominican')).toContain('disputation');
    expect(seen.get('house:dominican')).not.toContain('transitus');
    expect(seen.get('house:franciscan')).toContain('transitus');
    expect(seen.get('house:franciscan')).not.toContain('school_dinner');
    expect(seen.get('house:augustinian')).toContain('school_dinner');
    expect(seen.get('house:augustinian')).not.toContain('disputation');
  });

  it('the selectors find the order\'s man, the house condition reads the order, and the scenes are gated on both', () => {
    const s = withOrders('sel');
    expect(resolveSelector(s, '@dominican_lector')!.id).toBe('religious_dominicans_lector');
    expect(resolveSelector(s, '@franciscan_kitchen')!.title).toBe('Br.');
    expect(resolveSelector(s, '@augustinian_prior')!.id).toBe('religious_augustinians_prior');
    expect(resolveSelector(s, '@dominican_student')).toBeNull();
    expect(resolveSelector(s, '@franciscan', createRng('r'))!.institute).toBe('inst_franciscans');
    expect(evaluateCondition({ type: 'house', order: 'dominican', value: true }, s)).toBe(true);
    expect(evaluateCondition({ type: 'house', order: 'norbertine', value: true }, s)).toBe(false);
    const pool = eventsForPhase('pastor').filter((e) => e.id.startsWith('or_'));
    expect(pool.length).toBe(9);
    for (const e of pool) expect(e.requires!.some((c) => c.type === 'house' && c.order), e.id).toBe(true);
    // The kitchen's neighbours need the kitchen; the table needs the chair.
    expect(eventById('or_ofm_the_neighbours')!.requires!.every((c) => evaluateCondition(c, s))).toBe(false);
    expect(eventById('or_ofm_the_neighbours')!.requires!.every((c) => evaluateCondition(c, { ...s, flags: { ...s.flags, 'house:kitchen': true } }))).toBe(true);
    const friary = castOf(s, house('franciscan')).map((c) => c.line);
    expect(friary).toContain('guardian of the friary, which is the word they use instead of superior, on purpose');
    expect(friary).toContain('the brother who runs the kitchen, not a priest, and the best-known man of the house');
  });
});
