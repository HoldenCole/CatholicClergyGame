import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { allEvents, eventById } from '@/content';
import { directionDefs } from '@/content/see';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { renderText } from '@/engine/text';
import { studyWeekHook, type EventDeps } from '@/engine/weekHook';
import { ageOf, answerTo, awayOf, destinationsFor, DIRECTIONS, directionAvailable, directionsWeek, giveDirection, officeOf, parishOf, priestsOfSee } from '@/systems/bishop/directions';
import { acceptAndGo } from '../helpers/appointment';
import type { DirectionAnswer, GameState, Npc } from '@/types';

function bishop(seed: string): { home: GameState; b: GameState } {
  const base = parishState(seed);
  const c = base.character!;
  const home: GameState = {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, credentials: [...c.credentials, 'JCL'], reputation: { ...c.reputation, chancery: 72, rome: 40 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true, aux_named: true, vg_served: true, 'nuncio:named_see': 'gaylord' },
    offers: [{ offerId: 'ep_diocesan_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }],
  };
  return { home, b: acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state };
}

const def = (id: string) => directionDefs.find((d) => d.id === id)!;
const warm = (s: GameState, n: Npc, r = 80): GameState => ({ ...s, npcs: { ...s.npcs, [n.id]: { ...n, relationship: r } } });
const pastorOfSee = (s: GameState) => priestsOfSee(s).find((n) => parishOf(s, n) && !parishOf(s, n)!.cathedral)!;
const deps: EventDeps = { pool: allEvents, lookup: (id) => eventById(id), offerLookup: (id) => offerById(id) };

describe('directions to people (E4 R1.2)', () => {
  it('the directions are data: nine kinds, a welcome, a reply for every answer, and a note', () => {
    expect(directionDefs.map((d) => d.kind).sort()).toEqual(['chancery', 'dean', 'monsignor', 'move', 'rebuke', 'retire', 'sabbatical', 'study', 'treatment']);
    for (const d of directionDefs) {
      expect(d.welcome).toBeGreaterThanOrEqual(-1);
      expect(d.welcome).toBeLessThanOrEqual(1);
      for (const a of ['accepted', 'reluctant', 'refused'] as DirectionAnswer[]) expect(d.letter[a].length).toBeGreaterThan(0);
      expect(d.note).toContain('{priest}');
    }
  });

  it("the priests of the see are his own, none of home's; the file gates what may be asked of each", () => {
    const { home, b } = bishop('dir-list');
    const priests = priestsOfSee(b);
    expect(priests.length).toBeGreaterThan(8);
    const homeIds = new Set(Object.keys(home.npcs));
    for (const n of priests) expect(homeIds.has(n.id)).toBe(false);
    const p = pastorOfSee(b);
    const young = { ...p, birthYear: b.clock.startDay > 0 ? p.birthYear : p.birthYear };
    void young;
    const at = (n: Npc, id: string) => directionAvailable(b, def(id), n);
    // Age gates.
    const boy = { ...p, birthYear: 2000 };
    expect(at(boy, 'retire').why).toBe('Too young for it.');
    expect(at({ ...p, birthYear: 1940 }, 'study').why).toBe('Too old for it.');
    // The struggle in the file, the title he has, the stat, and whether he is a pastor.
    expect(at({ ...p, struggle: 'none' }, 'treatment').why).toBe('Nothing in the file asks it.');
    expect(at({ ...p, struggle: 'drink' }, 'treatment').ok).toBe(true);
    expect(at({ ...p, title: 'Msgr.', birthYear: 1965 }, 'monsignor').why).toBe('He has it.');
    expect(at({ ...p, stats: { ...p.stats, administration: 10 } }, 'chancery').why).toBe('Not the man for it.');
    expect(at({ ...p, tags: p.tags.filter((t) => !t.startsWith('pastor:')) }, 'move').why).toBe('Not a pastor.');
    // The chancery's man is already of it.
    const vg = priestsOfSee(b).find((n) => officeOf(n) === 'vicar_general')!;
    expect(at(vg, 'chancery').why).toBe('Already of the chancery.');
    // Not one of home's.
    const homePriest = Object.values(b.npcs).find((n) => n.role === 'priest' && n.tags.includes(`diocese:${home.world!.diocese.presetId}`))!;
    expect(at(homePriest, 'rebuke').why).toBe('Not one of yours.');
  });

  it('the answer follows his regard and the direction\'s welcome, and only a refusable direction is refused', () => {
    const { b } = bishop('dir-answer');
    const p = pastorOfSee(b);
    const tally = (id: string, r: number) => {
      const out = { accepted: 0, reluctant: 0, refused: 0 };
      for (let w = 0; w < 60; w++) out[answerTo({ ...b, clock: { ...b.clock, week: w } }, def(id), { ...p, relationship: r })]++;
      return out;
    };
    expect(tally('dean', 80).accepted).toBeGreaterThan(50);
    expect(tally('rebuke', -80).refused).toBe(0);
    expect(tally('rebuke', -80).reluctant).toBeGreaterThan(50);
    expect(tally('retire', -80).refused).toBeGreaterThan(30);
    expect(tally('retire', 80).accepted).toBeGreaterThan(tally('retire', -80).accepted);
  });

  it('a move swaps two pastors or fills a vacancy; a resignation leaves one; and the record and the letter say so', () => {
    const { b } = bishop('dir-move');
    const p = pastorOfSee(b);
    const s = warm(b, p);
    const dests = destinationsFor(s, p);
    const to = dests.find((d) => s.npcs[d.pastorId]?.status === 'active')!;
    const other = s.npcs[to.pastorId]!;
    const own = parishOf(s, p)!;
    const out = giveDirection(s, p.id, 'move', { parishId: to.id })!;
    expect(out.state.see!.directions?.[0]).toMatchObject({ id: 'move', npcId: p.id, parishId: to.id });
    if (out.state.see!.directions![0]!.answer !== 'refused') {
      expect(parishOf(out.state, out.state.npcs[p.id]!)?.id).toBe(to.id);
      expect(parishOf(out.state, out.state.npcs[other.id]!)?.id).toBe(own.id);
      expect(out.state.world!.parishes.find((x) => x.id === to.id)!.pastorId).toBe(p.id);
      expect(out.letter.body.join(' ')).toContain(to.name);
    }
    expect(out.state.career.at(-1)!.text).toContain(to.name);
    expect(out.state.flags['direction:move']).toBe(true);
    expect(out.state.see!.lastDirectionWeek).toBe(s.clock.week);
    // A resignation, accepted: retired, the parish vacant, the shortage worse; then the vacancy is a destination first.
    const old = { ...pastorOfSee(b), birthYear: 1948, relationship: 90 };
    const r = giveDirection({ ...b, npcs: { ...b.npcs, [old.id]: old } }, old.id, 'retire')!;
    expect(r.state.see!.directions![0]!.answer).toBe('accepted');
    expect(r.state.npcs[old.id]!.status).toBe('retired');
    const vacant = r.state.world!.parishes.find((x) => x.id === parishOf(b, old)!.id)!;
    expect(vacant.pastorId).toBe('');
    expect(r.state.see!.shortage).toBeGreaterThan(b.see!.shortage);
    const later = { ...r.state, clock: { ...r.state.clock, week: r.state.clock.week + 5 } };
    const next = pastorOfSee(later);
    expect(destinationsFor(later, next)[0]!.id).toBe(vacant.id);
  });

  it('a dean, the purple, the chancery, a correction: the diocese changes as the direction says', () => {
    const { b } = bishop('dir-kinds');
    const p = { ...pastorOfSee(b), relationship: 95, birthYear: 1968 };
    const s = { ...b, npcs: { ...b.npcs, [p.id]: p } };
    const dean = giveDirection(s, p.id, 'dean')!;
    expect(dean.state.npcs[p.id]!.tags).toContain('dean');
    expect(directionAvailable(dean.state, def('dean'), dean.state.npcs[p.id]!).why).toMatch(/One a month|twice in a year|Already dean/);
    const msgr = giveDirection(s, p.id, 'monsignor')!;
    expect(msgr.state.npcs[p.id]!.title).toBe('Msgr.');
    expect(msgr.state.see!.rome).toBeLessThan(s.see!.rome);
    const q = { ...priestsOfSee(s).filter((n) => n.id !== p.id && parishOf(s, n))[0]!, relationship: 95, stats: { ...p.stats, administration: 70 } };
    const s2 = { ...s, npcs: { ...s.npcs, [q.id]: q } };
    const oldVg = priestsOfSee(s2).find((n) => officeOf(n) === 'vicar_general')!;
    const vg = giveDirection(s2, q.id, 'chancery', { office: 'vicar_general' })!;
    expect(officeOf(vg.state.npcs[q.id]!)).toBe('vicar_general');
    expect(officeOf(vg.state.npcs[oldVg.id]!)).toBeUndefined();
    expect(vg.state.world!.diocese.hidden.chanceryIds).toContain(q.id);
    expect(vg.state.world!.diocese.hidden.chanceryIds).not.toContain(oldVg.id);
    expect(vg.letter.body[0]).toContain('Vicar General');
    const cold = { ...p, relationship: -40 };
    const rebuke = giveDirection({ ...s, npcs: { ...s.npcs, [p.id]: cold } }, p.id, 'rebuke')!;
    expect(rebuke.state.npcs[p.id]!.tags.some((t) => t.startsWith('corrected:'))).toBe(true);
    expect(rebuke.state.npcs[p.id]!.relationship).toBeLessThan(cold.relationship);
    expect(rebuke.state.see!.presbyterate).toBeLessThan(s.see!.presbyterate);
  });

  it('a man sent away is away, and comes home on his week with the tag; then the same man waits a year', () => {
    const { b } = bishop('dir-away');
    const p = { ...pastorOfSee(b), relationship: 95, birthYear: 1985, stats: { ...pastorOfSee(b).stats, theology: 70 } };
    const s = { ...b, npcs: { ...b.npcs, [p.id]: p } };
    const out = giveDirection(s, p.id, 'study')!;
    expect(out.state.see!.directions![0]!.answer).toBe('accepted');
    const away = awayOf(out.state.npcs[p.id]!)!;
    expect(away.what).toBe('study');
    expect(away.until).toBe(s.clock.week + 104);
    expect(directionAvailable(out.state, def('sabbatical'), out.state.npcs[p.id]!).why).toMatch(/Away|One a month/);
    const early = directionsWeek({ ...out.state, clock: { ...out.state.clock, week: away.until - 1 } });
    expect(awayOf(early.state.npcs[p.id]!)).not.toBeNull();
    const home = studyWeekHook(deps)({ ...out.state, mode: { kind: 'clock' }, pending: [], clock: { ...out.state.clock, week: away.until } }, createRng('home'), []);
    expect(awayOf(home.npcs[p.id]!)).toBeNull();
    expect(home.npcs[p.id]!.tags).toContain('studied_rome');
    expect(home.digest.at(-1)!.lines.some((l) => /home from Rome/.test(l))).toBe(true);
    // The month's rest, and the year's for the same man.
    const q = priestsOfSee(out.state).find((n) => n.id !== p.id)!;
    expect(directionAvailable(out.state, def('rebuke'), q).why).toBe('One a month.');
    const month = { ...out.state, clock: { ...out.state.clock, week: out.state.clock.week + 5 } };
    expect(directionAvailable(month, def('rebuke'), q).ok).toBe(true);
    expect(directionAvailable({ ...home, clock: { ...home.clock, week: out.state.clock.week + 30 } }, def('rebuke'), home.npcs[p.id]!).why).toBe('Not the same man twice in a year.');
  });

  it("the directions' scenes hang on the flags, and name the man", () => {
    const { b } = bishop('dir-scenes');
    const p = { ...pastorOfSee(b), relationship: -90, birthYear: 1945 };
    const s = { ...b, npcs: { ...b.npcs, [p.id]: p } };
    let out = giveDirection(s, p.id, 'retire')!;
    for (let w = 1; w < 40 && out.state.see!.directions![0]!.answer !== 'refused'; w++) out = giveDirection({ ...s, clock: { ...s.clock, week: s.clock.week + w } }, p.id, 'retire')!;
    expect(out.state.see!.directions![0]!.answer).toBe('refused');
    expect(out.state.npcs[p.id]!.status).toBe('active');
    expect(out.state.see!.shortage).toBeLessThan(s.see!.shortage);
    const scene = eventById('bp_dir_refused')!;
    expect(isEligible(scene, out.state) && evaluateAll(scene.requires, out.state)).toBe(true);
    expect(renderText(scene.body, out.state)).toContain(p.name.last);
    for (const id of ['bp_dir_treatment_letter', 'bp_dir_purple', 'bp_dir_rome_postcard', 'bp_dir_moved']) {
      expect(eventById(id)).toBeDefined();
      expect(evaluateAll(eventById(id)!.requires, out.state)).toBe(false);
    }
    expect(ageOf(out.state, out.state.npcs[p.id]!)).toBeGreaterThanOrEqual(DIRECTIONS.canonAge - 10);
  });
});
