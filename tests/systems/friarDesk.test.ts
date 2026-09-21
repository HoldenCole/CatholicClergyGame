import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { sideWorkWeek, startWork, workDefsFor, workLoad, workOffers } from '@/systems/sidework';
import { answerConfrereAsk, confrereAskWeek, confrereAskYear, CONFRERE_ASKS, eligibleConfrereAsks } from '@/systems/religious/confrereAsks';
import { clubAvailability, clubsForPhase, clubsWeek, joinClub } from '@/systems/clubs';
import { friarLoad } from '@/systems/religious/bishopAsks';
import { reputationOf } from '@/systems/religious/reputations';
import { applyEffects } from '@/engine/effects';
import { parishState } from './week.test';

function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === 'priory') ?? gen.houses[0]!).id;
  const base = seminaryState(seed);
  const c = testCharacter({ reputation: { ...base.character!.reputation, community: 30, province: 30 }, stats: { ...base.character!.stats, theology: 70, knowledge: 70, charisma: 55 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 4 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 }, reputations: { preacher: 50, professor: 45 } } };
}

function weeks(s: GameState, n: number, seed: string): { state: GameState; lines: string[] } {
  let next = s;
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    next = { ...next, clock: { ...next.clock, week: next.clock.week + 1 } };
    const r = sideWorkWeek(next, createRng(`${seed}:${i}`));
    next = confrereAskWeek(r.state);
    if (r.line) lines.push(r.line);
  }
  return { state: next, lines };
}

describe("the friar's desk, a brother's letter, and the order's circles (E3 §6.2)", () => {
  it('the desk offers the order\'s projects and the shared ones, never the parish\'s, and each order its own', () => {
    const op = friar('desk');
    const ids = workDefsFor(op).map((d) => d.id);
    expect(ids).toContain('op_article');
    expect(ids).toContain('op_childrens_catechesis');
    expect(ids).toContain('fr_house_history');
    expect(ids).not.toContain('osa_confessions_notes');
    expect(ids).not.toContain('book');
    const osa = friar('desk', 'OSA');
    const osaIds = workDefsFor(osa).map((d) => d.id);
    expect(osaIds).toContain('osa_confessions_notes');
    expect(osaIds).not.toContain('op_stl');
    // A diocesan pastor keeps the parish's works and gets none of the desk's.
    const pastor = parishState('p1');
    expect(workDefsFor(pastor).map((d) => d.id)).toContain('book');
    expect(workDefsFor(pastor).some((d) => d.id.startsWith('op_'))).toBe(false);
    // Gates: the doctorate wants the licentiate first.
    const offers = workOffers(op);
    expect(offers.find((o) => o.def.id === 'op_std')!.available).toBe(false);
    expect(offers.find((o) => o.def.id === 'op_stl')!.available).toBe(true);
    expect(offers.find((o) => o.def.id === 'op_article')!.available).toBe(true);
  });

  it('a project runs on the desk week by week, takes blocks, passes its milestones, and lands: the licentiate confers a credential and feeds what he is known for', () => {
    const s = startWork(friar('stl'), 'op_stl');
    expect(s.sideWork?.id).toBe('op_stl');
    expect(workLoad(s)).toBe(2);
    expect(friarLoad(s)).toBeGreaterThanOrEqual(2);
    const before = reputationOf(s, 'professor');
    const run = weeks(s, 131, 'stl');
    expect(run.lines.length).toBeGreaterThanOrEqual(3);
    expect(run.state.sideWork).toBeNull();
    expect(run.state.character!.credentials).toContain('stl');
    expect(reputationOf(run.state, 'professor')).toBeGreaterThan(before);
    expect(run.state.flags['work:stl']).toBe(true);
    // Same seed, same run.
    expect(weeks(s, 131, 'stl').state.character!.credentials).toEqual(run.state.character!.credentials);
    // Now the doctorate opens.
    expect(workOffers(run.state).find((o) => o.def.id === 'op_std')!.available).toBe(true);
    // The known effect is what the content uses, held under the cap.
    const known = applyEffects(s, [{ target: 'known', key: 'evangelist', delta: 8 }], {}, 'x');
    expect(reputationOf(known, 'evangelist')).toBeGreaterThan(reputationOf(s, 'evangelist'));
  });

  it('a brother writes for help; yes takes blocks for the weeks and lands its effects, no is remembered, and silence is a no', () => {
    const s = friar('letter');
    expect(eligibleConfrereAsks(s).length).toBeGreaterThan(3);
    let asked: GameState = s;
    for (let i = 0; i < 20 && !asked.religious!.confrereAsk; i++) asked = confrereAskYear(s, createRng(`ask:${i}`));
    const ask = asked.religious!.confrereAsk!;
    expect(ask).toBeDefined();
    const npc = asked.npcs[ask.npcId]!;
    expect(npc.tags).toContain('order:OP');
    expect(asked.letters?.at(-1)?.sort).toBe('confrere');
    expect(asked.religious!.confrereAskLine).toContain(npc.name.last);
    // Yes.
    const yes = answerConfrereAsk(asked, true);
    expect(yes.religious!.confrereTask?.defId).toBe(ask.defId);
    expect(friarLoad(yes)).toBe(friarLoad(asked) + yes.religious!.confrereTask!.ap);
    const done = weeks(yes, yes.religious!.confrereTask!.untilWeek - yes.religious!.confrereTask!.startWeek + 1, 'd').state;
    expect(done.religious!.confrereTask).toBeUndefined();
    expect(done.npcs[npc.id]!.relationship).toBe(Math.min(100, npc.relationship + CONFRERE_ASKS.yesRegard));
    expect(done.career.at(-1)?.text).toContain('done');
    // No.
    const no = answerConfrereAsk(asked, false);
    expect(no.religious!.confrereAsk).toBeUndefined();
    expect(no.npcs[npc.id]!.relationship).toBe(npc.relationship + CONFRERE_ASKS.noRegard);
    // Silence.
    const late = confrereAskWeek({ ...asked, clock: { ...asked.clock, week: ask.dueWeek } });
    expect(late.religious!.confrereAsk).toBeUndefined();
    expect(late.character!.reputation.community).toBe((asked.character!.reputation.community ?? 0) + CONFRERE_ASKS.silenceCommunity);
    // Not asked twice while one stands.
    expect(confrereAskYear(asked, createRng('again')).religious!.confrereAsk).toEqual(ask);
  });

  it("a friar's circles are the order's: the diocesan tables are gone, the order's own are there, and a week of belonging pays", () => {
    const op = friar('clubs');
    const ids = clubsForPhase(op).map((c) => c.id);
    expect(ids).toContain('province_thomists');
    expect(ids).toContain('friars_schola');
    expect(ids).toContain('young_friars_table');
    expect(ids).not.toContain('deanery_table');
    expect(ids).not.toContain('emmaus');
    expect(ids).not.toContain('osa_reading_circle');
    expect(ids).toContain('priests_running');
    const osa = friar('clubs', 'OSA');
    const osaIds = clubsForPhase(osa).map((c) => c.id);
    expect(osaIds).toContain('osa_reading_circle');
    expect(osaIds).not.toContain('province_thomists');
    // A diocesan pastor sees none of the order's.
    const pastor = parishState('p2');
    const pastorIds = clubsForPhase(pastor).map((c) => c.id);
    expect(pastorIds).toContain('deanery_table');
    expect(pastorIds).not.toContain('province_thomists');
    // Join, and a week builds what it says.
    const av = clubAvailability(op);
    expect(av.find((a) => a.def.id === 'province_thomists')!.open).toBe(true);
    expect(av.find((a) => a.def.id === 'preaching_band')!.why).toBe('by invitation');
    const joined = joinClub(op, 'province_thomists', createRng('j'));
    expect(joined.clubs!.memberships.province_thomists!.fellows.length).toBeGreaterThan(0);
    const week = clubsWeek({ ...joined, clock: { ...joined.clock, week: joined.clock.week + 1 } }).state;
    expect(week.character!.stats.theology).toBeGreaterThan(joined.character!.stats.theology);
    expect(reputationOf(week, 'professor')).toBeGreaterThan(reputationOf(joined, 'professor'));
  });

  it('the studies posting at the studium is on the order, for both orders', () => {
    for (const key of ['OP', 'OSA'] as OrderKey[]) {
      const a = religiousOrder(key).apostolates.find((x) => x.id === 'studium_studies');
      expect(a?.houseKind).toBe('studium');
      expect(a?.work).toBe('study');
    }
  });
});
