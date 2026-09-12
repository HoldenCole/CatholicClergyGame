import { describe, it, expect } from 'vitest';
import { generateHouses, houseOf } from '@/generation/houses';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { currentDecor, decorOptions, facultyGate, furnish, grantChance, mayFurnish, petition, resolvePermissions } from '@/systems/decor';
import { chapelStyle } from '@/ui/scenes/art/places';
import { createClock, dateOf } from '@/engine/time';
import { spend, spendAvailability, spendWords } from '@/systems/spending';
import { evaluateAll } from '@/engine/conditions';
import { resolveWeek } from '@/systems/week';
import { actionById } from '@/content/parish';
import { buildSave, deserialize, serialize } from '@/engine/save';
import type { GameState } from '@/types';

describe('generation/houses', () => {
  it('rolls one to four distinct houses, and neither the order nor the alignment collapses', () => {
    const orders = new Map<string, number>();
    const alignments = new Set<number>();
    const counts = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const houses = generateHouses(createRng(`houses:${i}`), (['small', 'medium', 'large', 'huge'] as const)[i % 4]!);
      counts.add(houses.length);
      expect(houses.length).toBeGreaterThanOrEqual(1);
      expect(houses.length).toBeLessThanOrEqual(4);
      expect(new Set(houses.map((h) => h.order)).size).toBe(houses.length);
      for (const h of houses) {
        orders.set(h.order, (orders.get(h.order) ?? 0) + 1);
        alignments.add(h.alignment);
        expect(h.name.length).toBeGreaterThan(3);
        expect(h.line).toContain(h.name);
        expect(h.size).toBeGreaterThan(0);
      }
    }
    expect(counts.size).toBeGreaterThanOrEqual(3);
    expect(orders.size).toBe(8);
    for (const n of orders.values()) expect(n).toBeGreaterThan(50);
    expect(alignments.size).toBeGreaterThan(40);
  });

  it('is deterministic for a seed', () => {
    expect(generateHouses(createRng('same'), 'large')).toEqual(generateHouses(createRng('same'), 'large'));
  });

  it('every generated diocese carries its houses, and a save without them gets the same ones on load', () => {
    const s = parishState('houses');
    const houses = s.world!.diocese.visible.houses;
    expect(houses.length).toBeGreaterThanOrEqual(1);
    const rng = createRng(s.seed);
    const save = buildSave(s, rng, null);
    const stripped = JSON.parse(serialize(save));
    delete stripped.state.world.diocese.visible.houses;
    const a = deserialize(JSON.stringify(stripped)).state.world!.diocese.visible.houses;
    const b = deserialize(JSON.stringify(stripped)).state.world!.diocese.visible.houses;
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a).toEqual(b);
  });
});

describe('the pastor and the monastery', () => {
  function rich(seed: string): GameState {
    const base = parishState(seed);
    return {
      ...base,
      assignment: { ...base.assignment!, role: 'pastor' },
      parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 900000, debt: 0 } },
    };
  }

  it('house conditions read the diocese, and the spends name the house', () => {
    const s = rich('house:spend');
    const houses = s.world!.diocese.visible.houses;
    expect(evaluateAll([{ type: 'house', value: true }], s)).toBe(true);
    const contemplative = houses.some((h) => h.charism === 'contemplative');
    expect(evaluateAll([{ type: 'house', charism: 'contemplative', value: true }], s)).toBe(contemplative);
    const none: GameState = { ...s, world: { ...s.world!, diocese: { ...s.world!.diocese, visible: { ...s.world!.diocese.visible, houses: [] } } } };
    expect(evaluateAll([{ type: 'house', value: true }], none)).toBe(false);
    expect(spendAvailability(none).find((x) => x.def.id === 'house_partnership')!.available).toBe(false);

    const partnership = spendAvailability(s).find((x) => x.def.id === 'house_partnership')!;
    expect(partnership.available).toBe(true);
    const words = spendWords(s, partnership.def);
    expect(words.label).toContain(houseOf(houses)!.name);
    expect(words.label).not.toContain('{house}');
    const joined = spend(s, 'house_partnership');
    expect(joined.flags['partner:house']).toBe(true);
    expect(joined.career[joined.career.length - 1]!.text).toContain(houseOf(houses)!.name);
    // The standing programs open only with a house of the right charism.
    const prayers = spendAvailability(joined).find((x) => x.def.id === 'house_prayers')!;
    const friars = spendAvailability(joined).find((x) => x.def.id === 'friars_help')!;
    expect(prayers.available).toBe(houses.some((h) => h.charism === 'contemplative'));
    expect(friars.available).toBe(houses.some((h) => h.charism === 'active'));
  });

  it('the chapel: restoration once, perpetual adoration only after the chapel is built', () => {
    const s = rich('chapel');
    expect(spendAvailability(s).find((x) => x.def.id === 'perpetual_adoration')!.available).toBe(false);
    const restored = spend(s, 'chapel_restoration');
    expect(restored.flags.chapel_restored).toBe(true);
    expect(spendAvailability(restored).find((x) => x.def.id === 'chapel_restoration')!.available).toBe(false);
    const built = spend(restored, 'adoration_chapel');
    const perpetual = spend(built, 'perpetual_adoration');
    expect(perpetual.parish!.finance.funds?.perpetual_adoration).toBeDefined();
  });
});

describe('faculties for the older form', () => {
  function vicar(seed: string, stance: 'by_permission' | 'forbidden'): GameState {
    const base = parishState(seed);
    const world = base.world!;
    const bishop = { ...world.diocese.hidden.bishop, liturgy: { ...world.diocese.hidden.bishop.liturgy, older_form_faculty: stance } };
    return { ...base, assignment: { ...base.assignment!, role: 'parochial_vicar' }, world: { ...world, diocese: { ...world.diocese, hidden: { ...world.diocese.hidden, bishop } } } };
  }

  it('a vicar may write, the letter is answered, and the faculties open the older Mass', () => {
    const shut = vicar('shut', 'forbidden');
    expect(facultyGate(shut).canAsk).toBe(false);
    expect(facultyGate(shut).why).toMatch(/no faculties/);

    const s = vicar('open', 'by_permission');
    expect(facultyGate(s).canAsk).toBe(true);
    expect(evaluateAll(actionById('older_mass')!.requires!, s)).toBe(false);
    const asked = petition(s, 'older_form_faculty', createRng('ask')).state;
    expect(asked.permissions.older_form_faculty?.status).toBe('pending');
    expect(facultyGate(asked).why).toMatch(/No answer yet/);
    const due: GameState = { ...asked, clock: { ...asked.clock, week: asked.permissions.older_form_faculty!.answerWeek } };
    const bishopId = due.world!.diocese.hidden.bishop.npcId;
    const warm: GameState = {
      ...due,
      character: { ...due.character!, credentials: [...due.character!.credentials, 'latin'], reputation: { ...due.character!.reputation, chancery: 100 } },
      npcs: { ...due.npcs, [bishopId]: { ...due.npcs[bishopId]!, relationship: 100 } },
    };
    expect(grantChance(warm, 'older_form_faculty')).toBeGreaterThan(0.85);
    const yes = resolvePermissions(warm, createRng('yes'));
    expect(yes.lines[0]).toMatch(/faculties to celebrate the older form/);
    expect(yes.state.flags.can_celebrate_tlm).toBe(true);
    expect(facultyGate(yes.state).ok).toBe(true);
    expect(evaluateAll(actionById('older_mass')!.requires!, yes.state)).toBe(true);
    // Hours put to it move the traditional wing; without the faculties the same hours do nothing.
    const routine = { ...yes.state.parish!.routine, discretionary: { older_mass: 2 } };
    const withHours: GameState = { ...yes.state, parish: { ...yes.state.parish!, routine } };
    const before = withHours.character!.reputation.traditional_bloc;
    const after = resolveWeek(withHours, createRng('week')).state.character!.reputation.traditional_bloc;
    expect(after).toBeGreaterThan(before);
    const without: GameState = { ...withHours, flags: { ...withHours.flags, can_celebrate_tlm: false } };
    const still = resolveWeek(without, createRng('week')).state.character!.reputation.traditional_bloc;
    expect(still).toBeLessThanOrEqual(before);
  });

  it('a pastor cannot put the older Mass on the parish without the faculties', () => {
    const s = vicar('pastor', 'by_permission');
    const pastor: GameState = { ...s, assignment: { ...s.assignment!, role: 'pastor' }, clock: createClock({ year: 2024, month: 1, day: 7 }) };
    const tlm = decorOptions.find((o) => o.id === 'mass_tlm')!;
    expect(evaluateAll(tlm.requires ?? [], pastor)).toBe(false);
    expect(evaluateAll(tlm.requires ?? [], { ...pastor, flags: { ...pastor.flags, can_celebrate_tlm: true } })).toBe(true);
  });
});

describe('the chapel and the parish Latin Mass', () => {
  it('the pastor styles the chapel with a smaller reaction than the church; a vicar cannot', () => {
    const base = parishState('chapel:look');
    const pastor: GameState = { ...base, assignment: { ...base.assignment!, role: 'pastor' }, parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 500000 } } };
    expect(mayFurnish(base, 'chapel').ok).toBe(false);
    expect(mayFurnish(pastor, 'chapel').ok).toBe(true);
    expect(currentDecor(pastor, 'chapel').style).toBe('chapel_as_is');
    const done = furnish(pastor, 'chapel', 'chapel_old');
    expect(currentDecor(done.state, 'chapel').style).toBe('chapel_old');
    expect(done.state.parish!.finance.cash).toBe(500000 - 30000);
    expect(done.state.career[done.state.career.length - 1]!.text).toMatch(/Changed the chapel/);
    const churchMove = furnish(pastor, 'church', 'statues_none').state.character!.reputation.progressive_bloc - pastor.character!.reputation.progressive_bloc;
    const chapelMove = furnish(pastor, 'chapel', 'chapel_modern').state.character!.reputation.progressive_bloc - pastor.character!.reputation.progressive_bloc;
    expect(chapelMove).toBeGreaterThan(0);
    expect(chapelMove).toBeLessThan(churchMove);
    // Matching the church reads the sanctuary.
    expect(chapelStyle({ style: 'chapel_match' }, { sanctuary: 'sanct_high_altar' })).toBe('old');
    expect(chapelStyle({ style: 'chapel_match' }, { sanctuary: 'sanct_modern' })).toBe('modern');
    expect(chapelStyle({ style: 'chapel_soft' }, { sanctuary: 'sanct_modern' })).toBe('soft');
  });

  it('the older Mass stays where it already stands or before 2021, and needs faculties to begin otherwise', () => {
    const base = parishState('tlm:rule');
    const pastor: GameState = { ...base, assignment: { ...base.assignment!, role: 'pastor' } };
    const tlm = decorOptions.find((o) => o.id === 'mass_tlm')!;
    const yearOf = (s: GameState) => dateOf(s.clock).year;
    const now: GameState = { ...pastor, clock: createClock({ year: 2024, month: 1, day: 7 }) };
    expect(yearOf(now)).toBe(2024);
    expect(evaluateAll(tlm.requires!, now)).toBe(false);
    const before: GameState = { ...pastor, clock: createClock({ year: 2018, month: 1, day: 7 }) };
    expect(evaluateAll(tlm.requires!, before)).toBe(true);
    const withFaculties: GameState = { ...now, flags: { ...now.flags, can_celebrate_tlm: true } };
    expect(evaluateAll(tlm.requires!, withFaculties)).toBe(true);
    // A parish with a Latin Mass community already has it, and keeps it.
    const world = now.world!;
    const pid = now.assignment!.parishId;
    const community: GameState = { ...now, world: { ...world, parishes: world.parishes.map((p) => (p.id === pid ? { ...p, problem: 'tlm_faction' } : p)) } };
    expect(currentDecor(community, 'church').mass_form).toBe('mass_tlm');
    expect(evaluateAll(tlm.requires!, community)).toBe(true);
  });
});
