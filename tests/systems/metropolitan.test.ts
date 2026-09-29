import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { eventById } from '@/content';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { resolveSelector } from '@/engine/selectors';
import { offerById } from '@/content/offers';
import { actAvailable, beginAct, signAct } from '@/systems/bishop/desk';
import { seeAct } from '@/content/see';
import { metropolitanOf } from '@/systems/metropolia';
import { isMeetingWeek, METROPOLITAN, metropolitanWeek, provincePolicy, provincePolicyDefs, provinceWord } from '@/systems/metropolitan';
import { nuncioView } from '@/systems/rome/nuncioView';
import { NUNCIO } from '@/systems/rome/nuncio';
import { acceptAndGo } from '../helpers/appointment';
import { parishState } from './week.test';
import type { GameState } from '@/types';

/** A priest on a meeting week of the year. */
function priestAt(seed: string, week = 52 * 4 + METROPOLITAN.meetingWeeks[0]!): GameState {
  const s = parishState(seed);
  return { ...s, phase: 'pastor', assignment: { ...s.assignment!, role: 'pastor' }, clock: { ...s.clock, week } };
}

/** A priest whose province adopted something this week: the first seed whose dice say so. */
function adopted(seed: string): { before: GameState; after: GameState; lines: string[] } {
  const before = priestAt(seed);
  for (let i = 0; i < 40; i++) {
    const r = metropolitanWeek(before, createRng(`${seed}:${i}`));
    if (r.state.world!.metropolia!.policies?.length) return { before, after: r.state, lines: r.lines };
  }
  throw new Error('no policy adopted in 40 rolls');
}

/** A man named to Gaylord (a suffragan of Detroit), the see's world rolled, on a meeting week. */
function bishopAt(seed: string, rank: 'suffragan' | 'metropolitan' = 'suffragan'): GameState {
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
  const b = acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state;
  const week = Math.ceil(b.clock.week / 52) * 52 + METROPOLITAN.meetingWeeks[1]!;
  const m = b.world!.metropolia!;
  const metropolia = rank === 'metropolitan' ? { ...m, rank, metropolitanSee: b.see!.see, sees: m.sees.filter((s) => s.rank !== 'metropolitan') } : m;
  return { ...b, clock: { ...b.clock, week }, world: { ...b.world!, metropolia }, flags: { ...b.flags, 'study:see': true } };
}

const fits = (id: string, s: GameState) => isEligible(eventById(id)!, s);

describe('E2 R1.1: the provincial meeting as a priest hears of it', () => {
  it('the bishops meet on the weeks of the calendar and on no other', () => {
    expect(isMeetingWeek(priestAt('w', 18))).toBe(true);
    expect(isMeetingWeek(priestAt('w', 52 * 3 + 44))).toBe(true);
    expect(isMeetingWeek(priestAt('w', 20))).toBe(false);
    const quiet = priestAt('quiet', 20);
    const r = metropolitanWeek(quiet, createRng('q'));
    expect(r.state).toBe(quiet);
    expect(r.lines).toEqual([]);
  });

  it('a meeting is weather until something common comes home as the bishop\'s letter, once, and the scenes of it open', () => {
    const { before, after, lines } = adopted('adopt');
    const p = after.world!.metropolia!.policies![0]!;
    const def = provincePolicy(p.id)!;
    expect(p.week).toBe(before.clock.week);
    expect(after.world!.metropolia!.lastMeetingWeek).toBe(before.clock.week);
    expect(after.flags[`metropolia:policy:${p.id}`]).toBe(before.clock.week);
    expect(after.flags['metropolia:policy:last']).toBe(p.id);
    const letter = after.letters!.at(-1)!;
    expect(letter.sort).toBe('bishop');
    expect(letter.title).toBe(`From the province's bishops: ${def.label.toLowerCase()}`);
    expect(letter.body.slice(0, def.letter.length)).toEqual(def.letter);
    expect(after.career.at(-1)!.text).toContain(def.line);
    expect(lines.some((l) => l.includes(def.line))).toBe(true);
    // The condition reads it, within its window and not beyond.
    expect(evaluateAll([{ type: 'metropolia', key: 'policy', value: p.id }], after)).toBe(true);
    expect(evaluateAll([{ type: 'metropolia', key: 'policy', value: p.id, within: 8 }], { ...after, clock: { ...after.clock, week: after.clock.week + 9 } })).toBe(false);
    expect(evaluateAll([{ type: 'metropolia', key: 'policy', value: p.id }], before)).toBe(false);
    // Not adopted again inside its years; open again after.
    const again = { ...after, clock: { ...after.clock, week: after.clock.week + 52 } };
    for (let i = 0; i < 30; i++) {
      const r = metropolitanWeek(again, createRng(`again:${i}`));
      expect(r.state.world!.metropolia!.policies!.filter((x) => x.id === p.id)).toHaveLength(1);
    }
    const later = { ...after, clock: { ...after.clock, week: after.clock.week + 52 * def.years } };
    let twice = false;
    for (let i = 0; i < 60 && !twice; i++) twice = metropolitanWeek(later, createRng(`later:${i}`)).state.world!.metropolia!.policies!.filter((x) => x.id === p.id).length === 2;
    expect(twice).toBe(true);
  });

  it('every policy has a priest\'s scene that opens on it and not before', () => {
    const scenes: Record<string, string> = { common_mass_schedule: 'mp_mass_schedule', common_seminary: 'mp_common_seminary', common_statement_immigration: 'mp_statement_immigration', common_statement_liberty: 'mp_statement_liberty', older_mass_common_norm: 'mp_older_mass_norm', clergy_convocation: 'mp_convocation' };
    const s0 = priestAt('scenes');
    const s = { ...s0, character: { ...s0.character!, stats: { ...s0.character!.stats, theology: 60 }, reputation: { ...s0.character!.reputation, brother_priests: 30 } } };
    for (const def of provincePolicyDefs) {
      const id = scenes[def.id];
      if (!id) continue;
      expect(fits(id, s), id).toBe(false);
      const with_ = { ...s, world: { ...s.world!, metropolia: { ...s.world!.metropolia!, policies: [{ id: def.id, week: s.clock.week }] } } };
      expect(fits(id, with_), id).toBe(true);
    }
  });

  it('the province leans the way its bishops read: a traditional province adopts the older norm, a progressive one the immigration statement', () => {
    const count = (align: number) => {
      const s0 = priestAt('lean');
      const npcs = { ...s0.npcs };
      for (const n of Object.values(npcs)) if (n.role === 'bishop') npcs[n.id] = { ...n, alignment: align };
      const s = { ...s0, npcs };
      const tally: Record<string, number> = {};
      for (let i = 0; i < 300; i++) for (const p of metropolitanWeek(s, createRng(`lean:${align}:${i}`)).state.world!.metropolia!.policies ?? []) tally[p.id] = (tally[p.id] ?? 0) + 1;
      return tally;
    };
    const trad = count(-80);
    const prog = count(80);
    expect(trad.older_mass_common_norm ?? 0).toBeGreaterThan(prog.older_mass_common_norm ?? 0);
    expect(prog.common_statement_immigration ?? 0).toBeGreaterThan(trad.common_statement_immigration ?? 0);
    // Same seed, same meeting.
    const s = priestAt('same');
    expect(metropolitanWeek(s, createRng('same')).state).toEqual(metropolitanWeek(s, createRng('same')).state);
  });
});

describe('E2 R1.1: the meeting as a bishop, and the metropolitan', () => {
  it('a suffragan is in the room: the meeting flag opens his scenes for three weeks, and the archbishop is a man he can name', () => {
    const b0 = bishopAt('suff');
    expect(b0.world!.metropolia!.rank).toBe('suffragan');
    const r = metropolitanWeek(b0, createRng('m'));
    const b = r.state;
    expect(b.flags['metropolia:meeting']).toBe(b0.clock.week);
    expect(b.world!.metropolia!.policies ?? []).toEqual([]);
    expect(r.lines[0]).toMatch(/^The bishops of the Province of .* meet this week\.$/);
    expect(evaluateAll([{ type: 'metropolia', key: 'meeting' }], b)).toBe(true);
    expect(evaluateAll([{ type: 'metropolia', key: 'meeting' }], { ...b, clock: { ...b.clock, week: b.clock.week + 4 } })).toBe(false);
    expect(fits('mp_meeting_agenda', b)).toBe(true);
    expect(fits('mp_meeting_statement', b)).toBe(true);
    expect(fits('mp_presiding', b)).toBe(false);
    expect(fits('mp_pallium', b)).toBe(false);
    expect(fits('mp_meeting_agenda', b0)).toBe(false);
    const met = metropolitanOf(b)!;
    expect(met.title).toBe('Archbishop');
    expect(resolveSelector(b, '@metropolitan', createRng('sel'))?.id).toBe(met.id);
    // The desk: calling the province is the metropolitan's, not his.
    expect(actAvailable(b, seeAct('provincial_meeting')!).ok).toBe(false);
    expect(actAvailable(b, seeAct('hear_appeal')!).ok).toBe(false);
  });

  it('a metropolitan presides, wears the pallium in his first year, and can call the province from his desk', () => {
    const b0 = bishopAt('metro', 'metropolitan');
    const b = metropolitanWeek(b0, createRng('m')).state;
    expect(fits('mp_presiding', b)).toBe(true);
    expect(fits('mp_pallium', b)).toBe(true);
    expect(fits('mp_meeting_agenda', b)).toBe(false);
    expect(fits('mp_pallium', { ...b, clock: { ...b.clock, week: b.clock.week + 52 * 2 } })).toBe(false);
    expect(resolveSelector(b, '@metropolitan', createRng('sel'))).toBeNull();
    // Off the calendar: the desk act calls the meeting, and the next week it is held.
    const quiet: GameState = { ...b0, clock: { ...b0.clock, week: b0.clock.week + 5 } };
    expect(metropolitanWeek(quiet, createRng('q')).state).toBe(quiet);
    expect(actAvailable(quiet, seeAct('provincial_meeting')!).ok).toBe(true);
    const onDesk = beginAct(quiet, 'provincial_meeting');
    expect(onDesk.see!.desk?.actId).toBe('provincial_meeting');
    const signed = signAct({ ...onDesk, study: { ...onDesk.study!, hoursLogged: { ...onDesk.study!.hoursLogged, see_desk: (onDesk.study!.hoursLogged.see_desk ?? 0) + 4 } } })!;
    expect(signed.state.flags['metropolia:called']).toBe(true);
    expect(signed.state.see!.rome).toBe(quiet.see!.rome + 1);
    const held = metropolitanWeek(signed.state, createRng('held'));
    expect(held.lines).toHaveLength(1);
    expect(held.state.flags['metropolia:called']).toBeUndefined();
    expect(held.state.flags['metropolia:meeting']).toBe(quiet.clock.week);
    expect(held.state.world!.metropolia!.lastMeetingWeek).toBe(quiet.clock.week);
    expect(fits('mp_presiding', held.state)).toBe(true);
    // Not twice in a year from the desk.
    expect(actAvailable(held.state, seeAct('provincial_meeting')!).ok).toBe(false);
  });

  it('a new archbishop, and a vacant metropolitan see, are conditions a scene can read', () => {
    const b = bishopAt('newmet');
    const m = b.world!.metropolia!;
    const metSee = m.sees.find((s) => s.rank === 'metropolitan')!;
    expect(fits('mp_new_archbishop_bishop', b)).toBe(false);
    const year = 2017 + Math.floor(b.clock.week / 52);
    const fresh = { ...b, world: { ...b.world!, metropolia: { ...m, sees: m.sees.map((s) => (s.id === metSee.id ? { ...s, installedYear: year } : s)) } } };
    expect(evaluateAll([{ type: 'metropolia', key: 'metropolitan', value: 'new', within: 52 }], fresh)).toBe(true);
    expect(fits('mp_new_archbishop_bishop', fresh)).toBe(true);
    const gone = { ...metSee };
    delete (gone as { bishopId?: string }).bishopId;
    const vacant = { ...b, world: { ...b.world!, metropolia: { ...m, sees: m.sees.map((s) => (s.id === metSee.id ? gone : s)) } } };
    expect(evaluateAll([{ type: 'metropolia', key: 'metropolitan', value: 'vacant' }], vacant)).toBe(true);
    expect(evaluateAll([{ type: 'metropolia', key: 'metropolitan', value: 'new' }], vacant)).toBe(false);
    expect(metropolitanOf(vacant)).toBeUndefined();
    // The priest's side of the same news.
    const p = priestAt('newmet-priest');
    const pm = p.world!.metropolia!;
    const suff = { ...p, world: { ...p.world!, metropolia: { ...pm, rank: 'suffragan' as const, sees: [{ ...pm.sees[0]!, rank: 'metropolitan' as const, installedYear: 2021 }, ...pm.sees.slice(1)] } } };
    expect(fits('mp_new_archbishop_priest', suff)).toBe(true);
    expect(fits('mp_jubilee_archbishop', suff)).toBe(false);
    expect(fits('mp_jubilee_archbishop', { ...suff, flags: { ...suff.flags, ordination_week: suff.clock.week - 52 * 26 } })).toBe(true);
  });

  it('the province\'s word is a term in the nuncio\'s reading: the archbishop\'s regard weighs most', () => {
    const p0 = priestAt('word');
    const pm = p0.world!.metropolia!;
    const p = { ...p0, world: { ...p0.world!, metropolia: { ...pm, rank: 'suffragan' as const, sees: [{ ...pm.sees[0]!, rank: 'metropolitan' as const }, ...pm.sees.slice(1)] } } };
    const met = metropolitanOf(p)!;
    // A bishop of the province who is not his own: the archbishop over a suffragan see; in the metropolitan see, one of the suffragans.
    expect(resolveSelector(p, '@province_bishop', createRng('pb'))?.id).toBe(met.id);
    const noticed = resolveSelector(p0, '@province_bishop', createRng('pb'))!;
    expect(noticed.tags).toContain('province_bishop');
    expect(noticed.id).not.toBe(p0.world!.diocese.hidden.bishop.npcId);
    expect(resolveSelector(p0, '@metropolitan')).toBeNull();
    const cold = provinceWord(p);
    expect(cold.value).toBe(0);
    const warm = { ...p, npcs: { ...p.npcs, [met.id]: { ...met, relationship: 60 } } };
    const w = provinceWord(warm);
    expect(w.value).toBeCloseTo(0.6 * METROPOLITAN.provinceWord.metropolitan, 5);
    expect(w.good[0]).toMatch(/the metropolitan, speaks for you/);
    expect(nuncioView(warm).value).toBeGreaterThan(nuncioView(p).value);
    expect(nuncioView(warm).good).toContain(w.good[0]);
    const sour = { ...p, npcs: { ...p.npcs, [met.id]: { ...met, relationship: -40 } } };
    expect(provinceWord(sour).bad[0]).toMatch(/the metropolitan, does not/);
    // The suffragans together weigh half as much.
    const others = Object.values(p.npcs).filter((n) => n.tags.includes('province_bishop') && n.id !== met.id);
    const liked = { ...p, npcs: { ...p.npcs, ...Object.fromEntries(others.map((n) => [n.id, { ...n, relationship: 50 }])) } };
    expect(provinceWord(liked).value).toBeCloseTo(0.5 * METROPOLITAN.provinceWord.suffragans, 5);
    expect(provinceWord(liked).good[0]).toMatch(/for the right reasons/);
    expect(NUNCIO.provinceWeight).toBeGreaterThan(1);
  });
});
