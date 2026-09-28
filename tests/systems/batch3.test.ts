import { describe, expect, it } from 'vitest';
import { testNpc, testSeminary } from '../helpers/fixtures';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { EMERITI, emeritiOf, emeritiYear, jubileeWithOrdainer, ordainingBishop } from '@/systems/emeriti';
import { nuncioView } from '@/systems/rome/nuncioView';
import { askBrother, favoursFrom } from '@/systems/brothers';
import { classReunion } from '@/systems/classmates';
import { fillVacantParishes, formedAsBishop, GROWN_BISHOP } from '@/systems/formed';
import { refillDeanery } from '@/systems/deanery';
import { peopleStop } from '@/systems/peopleStop';
import { stopAfterWeek } from '@/engine/clock';
import type { GameState } from '@/types';

function withEmeritus(s: GameState, rel: number, age = 80): GameState {
  const year = new Date((s.clock.startDay + s.clock.week * 7) * 86_400_000).getUTCFullYear();
  return { ...s, npcs: { ...s.npcs, em: testNpc('em', { role: 'bishop', title: 'Bishop', name: { first: 'Kenneth', last: 'Hogan' }, birthYear: year - age, status: 'retired', relationship: rel, tags: ['bishop_emeritus'] }) } };
}

describe('bishops who remember', () => {
  it('an emeritus dies in time, and the chancellor writes about the funeral', () => {
    const s = withEmeritus(parishState('em'), 50, 92);
    expect(emeritiOf(s)).toHaveLength(1);
    let next = s;
    let died = false;
    for (let y = 0; y < 30 && !died; y++) {
      const r = emeritiYear({ ...next, clock: { ...next.clock, week: next.clock.week + 52 * y } }, createRng(`em:${y}`));
      if (r.lines.length) { died = true; next = r.state; }
    }
    expect(died).toBe(true);
    expect(next.npcs['em']!.status).toBe('dead');
    expect(next.flags['emeritus:asked_to_preach']).toBe(true);
    const letter = (next.letterQueue ?? [])[0]!;
    expect(letter.sort).toBe('mail');
    expect(letter.title).toMatch(/funeral of Bishop Hogan/);
    expect(letter.replies?.map((r) => r.id)).toEqual(['preach', 'concelebrate', 'card']);
  });
  it('his word reaches the nuncio, for or against', () => {
    const base = parishState('nv');
    const warm = nuncioView(withEmeritus(base, 60)).value;
    const cold = nuncioView(withEmeritus(base, -50)).value;
    const none = nuncioView(base).value;
    expect(warm - none).toBeCloseTo(EMERITI.nuncio, 5);
    expect(none - cold).toBeCloseTo(EMERITI.nuncio, 5);
  });
  it('the bishop who ordained him comes to the silver jubilee', () => {
    const s = parishState('jub');
    const b = ordainingBishop(s);
    expect(b).toBeDefined();
    // Retire him so he is not the sitting bishop.
    const retired = { ...s, npcs: { ...s.npcs, [b!.id]: { ...b!, status: 'retired' as const, relationship: 30, tags: [...b!.tags.filter((t) => t !== 'bishop'), 'bishop_emeritus'] } }, world: { ...s.world!, diocese: { ...s.world!.diocese, hidden: { ...s.world!.diocese.hidden, bishop: { ...s.world!.diocese.hidden.bishop, npcId: 'someone_else' } } } } };
    const came = jubileeWithOrdainer(retired);
    expect(came.line).toMatch(/who ordained you, came/);
    expect(came.state.npcs[b!.id]!.relationship).toBe(38);
  });
});

function withClass(s: GameState): GameState {
  const cm = testNpc('cm1', { role: 'classmate', name: { first: 'Iván', last: 'Ibarra' }, status: 'active', relationship: 20, title: 'Fr.' });
  return { ...s, seminary: { ...(s.seminary ?? testSeminary()), classmateIds: ['cm1'] }, npcs: { ...s.npcs, cm1: cm } };
}

describe('the class as a network', () => {
  it('a classmate bishop speaks for him, and the nuncio hears it for a few years', () => {
    const s = withClass(parishState('speak'));
    const cm = s.npcs['cm1']!;
    const bishop = { ...s, npcs: { ...s.npcs, [cm.id]: { ...cm, relationship: 60, title: 'Bishop', tags: [...cm.tags, 'bishop_elsewhere'] } } };
    const offers = favoursFrom(bishop, bishop.npcs[cm.id]!);
    expect(offers.find((f) => f.def.id === 'speak')!.available).toBe(true);
    expect(favoursFrom(s, { ...cm, relationship: 60 }).find((f) => f.def.id === 'speak')!.why).toMatch(/not a bishop/);
    const asked = askBrother(bishop, cm.id, 'speak');
    expect(nuncioView(asked.state).value).toBeGreaterThan(nuncioView(bishop).value);
    expect(nuncioView(asked.state).good.some((g) => /class has spoken/.test(g))).toBe(true);
  });
  it('the class meets every five years, and every man who came is a little warmer', () => {
    const s = withClass(parishState('reunion'));
    const none = classReunion(s, 4);
    expect(none.letter).toBeNull();
    const ten = classReunion(s, 10);
    expect(ten.letter?.sort).toBe('class');
    expect(ten.letter?.body.length).toBeGreaterThan(2);
    const cm = Object.values(s.npcs).find((n) => n.role === 'classmate' && n.status === 'active')!;
    expect(ten.state.npcs[cm.id]!.relationship).toBe(cm.relationship + 3);
    expect(ten.state.npcs[cm.id]!.contactWeek).toBe(s.clock.week);
  });
});

describe('the men he formed, grown', () => {
  it('a vacant parish goes to a man he formed when one is due, and the deanery follows', () => {
    const s = parishState('grown', {}, true);
    const d = s.parish!.deanery!;
    const pid = d.parishIds.find((id) => id !== s.assignment!.parishId)!;
    const parish = s.world!.parishes.find((p) => p.id === pid)!;
    const old = s.npcs[parish.pastorId]!;
    const year = new Date((s.clock.startDay + s.clock.week * 7) * 86_400_000).getUTCFullYear();
    const gone: GameState = { ...s, npcs: { ...s.npcs, [old.id]: { ...old, status: 'retired' } }, formed: [{ npcId: 'sem_x', name: 'Peter Shea', year: year - 6, verdict: 'strong' }] };
    let filled: ReturnType<typeof fillVacantParishes> | null = null;
    for (let i = 0; i < 12 && !(filled && filled.lines.some((l) => /Peter Shea/.test(l))); i++) filled = fillVacantParishes(gone, createRng(`fill:${i}`));
    expect(filled!.lines.join(' ')).toMatch(/Fr\. Peter Shea, whom you had as a seminarian/);
    const next = filled!.state;
    const np = next.world!.parishes.find((p) => p.id === pid)!;
    const man = next.npcs[np.pastorId]!;
    expect(man.tags).toContain(`pastor:${pid}`);
    expect(man.relationship).toBe(30);
    expect(next.formed![0]!.returned).toBe(true);
    const seated = refillDeanery(next);
    expect(seated.parish!.deanery!.priestIds).toContain(man.id);
    // A vacancy with no man due gets a priest nobody knew.
    const plain = fillVacantParishes({ ...gone, formed: [] }, createRng('plain'));
    expect(plain.lines).toHaveLength(0);
    expect(plain.state.npcs[plain.state.world!.parishes.find((p) => p.id === pid)!.pastorId]!.status).toBe('active');
  });
  it('one of them, strong and twenty years on, may be the bishop Rome names', () => {
    const s = parishState('bish');
    const year = new Date((s.clock.startDay + s.clock.week * 7) * 86_400_000).getUTCFullYear();
    const withMen: GameState = { ...s, formed: [{ npcId: 'a', name: 'Luke Barry', year: year - GROWN_BISHOP.years - 1, verdict: 'strong' }, { npcId: 'b', name: 'Too Young', year: year - 3, verdict: 'strong' }] };
    let named = 0;
    for (let i = 0; i < 200; i++) { const g = formedAsBishop(withMen, createRng(`g:${i}`)); if (g) { named++; expect(g.name).toBe('Luke Barry'); } }
    expect(named).toBeGreaterThan(10);
    expect(named).toBeLessThan(60);
    expect(formedAsBishop({ ...withMen, formed: [] }, createRng('none'))).toBeNull();
  });
});

describe('the clock stops for people', () => {
  it('stops for news of someone who matters, not for a stranger, and not when turned off', () => {
    const s = withClass(parishState('stop'));
    const cm = s.npcs['cm1']!;
    const week = s.clock.week;
    const withLine = (line: string): GameState => ({ ...s, digest: [...s.digest, { week, lines: [line] }] });
    expect(peopleStop(withLine(`Fr. ${cm.name.first} ${cm.name.last} has died.`))).toMatch(/has died/);
    expect(peopleStop(withLine('Fr. Nobody Whatsoever has died.'))).toBeNull();
    expect(peopleStop(withLine(`Fr. ${cm.name.last} bought a car.`))).toBeNull();
    expect(peopleStop({ ...withLine(`${cm.name.last} has died.`), settings: { ...(s.settings ?? { workWeek: 'standard' as never, wear: 1 }), stopForPeople: false } })).toBeNull();
    const stop = stopAfterWeek('SKIP', { ...withLine(`Fr. ${cm.name.last} has been named a bishop.`), mode: { kind: 'clock' } }, []);
    expect(stop?.kind).toBe('person');
  });
});
