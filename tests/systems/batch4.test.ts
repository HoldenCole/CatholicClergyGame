import { describe, expect, it } from 'vitest';
import { testNpc } from '../helpers/fixtures';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { FORMER, formerParishesYear, formerReviewLine, rememberParish } from '@/systems/formerParishes';
import { crossedSides, sidesWord, sidesYear } from '@/systems/sides';
import { christmasLine, familyYear, kinOf, siblingsOf } from '@/systems/kin';
import { ENEMIES, enemiesOf, enemiesYear, mayMend, mendWith } from '@/systems/enemies';
import { mourners, youngerMenLine } from '@/systems/lastDecade';
import { talkOf } from '@/systems/talk';
import type { GameState } from '@/types';

const year = (s: GameState) => new Date((s.clock.startDay + s.clock.week * 7) * 86_400_000).getUTCFullYear();

describe('former parishes that remember', () => {
  it('is remembered on leaving, settles toward the bonds, and its fortunes since become talk', () => {
    const s = parishState('former');
    const pid = s.assignment!.parishId;
    const left = rememberParish(s);
    const f = left.formerParishes![pid]!;
    expect(f.name).toBeTruthy();
    expect(f.standing).toBe(Math.round(s.character!.reputation.parishioners));
    // Gone to another parish; the old one has lost a third of its collections two years on.
    const other = s.world!.parishes.find((p) => p.id !== pid)!;
    const later: GameState = { ...left, clock: { ...left.clock, week: left.clock.week + 104 }, assignment: { ...left.assignment!, parishId: other.id }, world: { ...left.world!, parishes: left.world!.parishes.map((p) => (p.id === pid ? { ...p, weeklyCollections: Math.round(p.weeklyCollections * 0.6) } : p)) } };
    const y = formerParishesYear(later, createRng('fy'));
    expect(y.lines.join(' ')).toMatch(/going under/);
    expect(y.state.formerParishes![pid]!.said).toBe('decline');
    expect(talkOf(y.state).rumours.some((r) => r.kind === 'former_decline' && r.about === 'you')).toBe(true);
    expect(Math.abs(y.state.formerParishes![pid]!.standing - f.standing)).toBeLessThanOrEqual(FORMER.driftPerYear);
    expect(formerReviewLine(y.state)).toMatch(/remembers|forgotten/);
    // Said once: not again.
    const again = formerParishesYear(y.state, createRng('fy2'));
    expect(again.lines).toHaveLength(0);
  });
});

describe('sides, and the cost of changing them', () => {
  it('reads a crossing from the record, marks it, and the side that lost him writes', () => {
    const s0 = parishState('sides');
    const w = s0.clock.week;
    const stand = (week: number, value: number) => ({ topic: 'liturgy', value, volume: 'public' as const, week });
    const c = s0.character!;
    const steady: GameState = { ...s0, character: { ...c, positions: [stand(w - 400, -50), stand(w - 380, -40), stand(w - 100, -45), stand(w - 50, -30)] } };
    expect(crossedSides(steady)).toBeNull();
    const crossed: GameState = { ...s0, character: { ...c, positions: [stand(w - 400, -50), stand(w - 380, -40), stand(w - 100, 45), stand(w - 50, 30)] } };
    expect(crossedSides(crossed)).toBe('traditional');
    const withMan: GameState = { ...crossed, npcs: { ...crossed.npcs, trad: testNpc('trad', { role: 'priest', title: 'Fr.', alignment: -60, relationship: 30 }) } };
    const y = sidesYear(withMan, createRng('sy'));
    expect(y.state.flags['sides:crossings']).toBe(1);
    expect(y.state.flags['sides:lost']).toBe('traditional');
    const letter = (y.state.letterQueue ?? [])[0];
    expect(letter?.title).toBe('You were ours');
    expect(letter?.from?.npcId).toBe('trad');
    expect(sidesWord(y.state)).toMatch(/changed sides, once/);
    // Not read again for years.
    expect(sidesYear(y.state, createRng('sy2')).lines).toHaveLength(0);
  });
});

describe('the family across the life', () => {
  it('siblings have children he baptizes, a niece asks for the wedding, the house comes up when the mother dies, and Christmas has a table', () => {
    let s = parishState('kin');
    s = { ...s, flags: { ...s.flags, ordained: true }, npcs: { ...s.npcs, sib: testNpc('sib', { role: 'family', name: { first: 'Anna', last: s.character!.name.last }, birthYear: year(s) - 30, tags: ['sibling'], relationship: 20 }), mum: testNpc('mum', { role: 'family', name: { first: 'Maria', last: s.character!.name.last }, birthYear: year(s) - 60, tags: ['mother'], relationship: 40 }) } };
    expect(siblingsOf(s)).toHaveLength(1);
    let born: GameState | null = null;
    for (let i = 0; i < 20 && !born; i++) { const y = familyYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 * i } }, createRng(`k${i}`)); if (y.lines.some((l) => /had a/.test(l))) born = y.state; }
    expect(born).not.toBeNull();
    const kid = kinOf(born!)[0]!;
    expect(kid.bonds?.[0]?.kind).toBe('baptized');
    expect(born!.npcs['sib']!.relationship).toBe(26);
    // Grown, the niece asks for her wedding.
    const later = { ...born!, clock: { ...born!.clock, week: born!.clock.week + 52 * 28 } };
    const grown: GameState = { ...later, npcs: { ...later.npcs, [kid.id]: { ...kid, birthYear: year(later) - 28 } } };
    let asked: GameState | null = null;
    for (let i = 0; i < 40 && !asked; i++) { const y = familyYear({ ...grown, mail: [], letterQueue: [] }, createRng(`w${i}`)); if ((y.state.letterQueue ?? []).some((l) => l.title === 'Would you marry us')) asked = y.state; }
    expect(asked).not.toBeNull();
    // The mother dies; the sibling writes about the house, once.
    const bereft: GameState = { ...asked!, letterQueue: [], npcs: { ...asked!.npcs, mum: { ...asked!.npcs['mum']!, status: 'dead' } } };
    const h = familyYear(bereft, createRng('h'));
    expect((h.state.letterQueue ?? []).some((l) => l.title === 'The house')).toBe(true);
    expect(h.state.flags['family:house']).toBeTruthy();
    expect((familyYear({ ...h.state, letterQueue: [] }, createRng('h2')).state.letterQueue ?? []).some((l) => l.title === 'The house')).toBe(false);
    // Christmas.
    const christmas = { ...bereft, clock: { ...bereft.clock, week: bereft.clock.week + [...Array(60).keys()].find((k) => { const d = new Date((bereft.clock.startDay + (bereft.clock.week + k) * 7) * 86_400_000); return d.getUTCMonth() === 11 && d.getUTCDate() >= 22 && d.getUTCDate() <= 28; })! } };
    expect(christmasLine(christmas)).toMatch(/Christmas/);
    expect(christmasLine(christmas)).toMatch(/missed aloud/);
  });
});

describe('enemies with agency', () => {
  it('a hostile priest talks, a hostile leader petitions, and going to a man mends what his kind allows', () => {
    let s = parishState('foes');
    s = { ...s, flags: { ...s.flags, ordained: true } };
    const pid = s.assignment!.parishId;
    const group = Object.values(s.groups).find((g) => g.parishId === pid)!;
    const leader = s.npcs[group.leaderId]!;
    s = { ...s, npcs: { ...s.npcs, [leader.id]: { ...leader, relationship: -60 }, foe: testNpc('foe', { role: 'priest', title: 'Fr.', relationship: -50, tags: ['priest', `pastor:${pid}x`], hiddenTrait: 'loyal' }) } };
    expect(enemiesOf(s).map((n) => n.id).sort()).toEqual(['foe', leader.id].sort());
    let acted: ReturnType<typeof enemiesYear> | null = null;
    for (let i = 0; i < 12 && !(acted && acted.lines.length >= 2); i++) acted = enemiesYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 * i } }, createRng(`e${i}`));
    expect(acted!.lines.join(' ')).toMatch(/petition/);
    expect(acted!.lines.join(' ')).toMatch(/talking/);
    expect(talkOf(acted!.state).rumours.some((r) => r.about === 'you')).toBe(true);
    expect((acted!.state.file ?? []).some((e) => e.kind === 'complaint' && e.by === leader.id)).toBe(true);
    // Mending.
    expect(mayMend(s, 'foe').ok).toBe(true);
    const mended = mendWith(s, 'foe');
    expect(mended.state.npcs['foe']!.relationship).toBe(-50 + ENEMIES.mend.loyal);
    expect(mended.line).toMatch(/door is open/);
    expect(mayMend(mended.state, 'foe').ok).toBe(false);
    // A man who was mended does not act this year.
    const quiet = enemiesYear({ ...mended.state, npcs: { ...mended.state.npcs, foe: { ...mended.state.npcs['foe']!, relationship: -45 } } }, createRng('q'));
    expect(quiet.lines.some((l) => /Nowak/.test(l))).toBe(false);
  });
});

describe('the last decade', () => {
  it('the younger men have a view of the old man, and the shelf knows who would come', () => {
    const s = parishState('old2', {}, true);
    expect(youngerMenLine(s)).toBeNull();
    const c = s.character!;
    const old: GameState = { ...s, character: { ...c, background: { ...c.background, entryAge: c.background.entryAge + 45 } } };
    const born = old.character!.entryYear - old.character!.background.entryAge;
    const warmed = Object.fromEntries(Object.values(old.npcs).filter((n) => n.role === 'priest' && n.birthYear >= born + 12).map((n) => [n.id, { ...n, relationship: 40 }]));
    const young: GameState = { ...old, npcs: { ...old.npcs, ...warmed, y1: testNpc('y1', { role: 'priest', birthYear: born + 30, relationship: 40 }), y2: testNpc('y2', { role: 'priest', birthYear: born + 25, relationship: 35 }) } };
    expect(youngerMenLine(young)).toMatch(/younger men \(\d+\) are warm/);
    const who = mourners(young);
    expect(who.length).toBeGreaterThanOrEqual(2);
    expect(who.length).toBeLessThanOrEqual(12);
    expect(who.every((n) => n.relationship >= 15)).toBe(true);
  });
});
