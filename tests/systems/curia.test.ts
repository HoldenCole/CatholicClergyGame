import { describe, it, expect } from 'vitest';
import { offerById, allOffers } from '@/content/offers';
import { allEvents } from '@/content';
import { createRng } from '@/engine/rng';
import { toDayNumber } from '@/engine/calendar';
import { isOfferEligible } from '@/engine/offers';
import { resolveSelector } from '@/engine/selectors';
import { endStudy } from '@/engine/study';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { CURIA, curiaTokens, curiaWeek, dicasteryDef, dicasteryFor, dicasteryName, leaveCuriaForSee, rankOf } from '@/systems/rome/curia';
import { acceptAndGo } from '../helpers/appointment';
import { parishState } from './week.test';
import type { GameState } from '@/types';

const day = (y: number, m: number, d: number) => toDayNumber({ year: y, month: m, day: d });

/** A pastor of eight years, back from a Roman degree, whom Rome and the nuncio read well. */
function candidate(seed: string, credentials: string[] = ['italian']): GameState {
  const base = nuncioWeek(parishState(seed)).state;
  const c = base.character!;
  return {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    flags: { ...base.flags, ordination_week: base.clock.week - 8 * 52, rome_alumnus: true },
    character: { ...c, entryYear: 2000, background: { ...c.background, entryAge: 22 }, credentials: [...c.credentials, ...credentials], reputation: { ...c.reputation, rome: 45, chancery: 40 } },
  };
}

function lent(seed: string, credentials?: string[]): GameState {
  const s = candidate(seed, credentials);
  const def = offerById('rome_curia_official')!;
  const open: GameState = { ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 4, bindings: {} }] };
  return acceptAndGo(open, def, createRng(`${seed}:go`)).state;
}

function weeks(state: GameState, n: number, tweak?: (s: GameState) => GameState): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    if (tweak) s = tweak(s);
    s = curiaWeek(s).state;
  }
  return s;
}

/** Hold the dials where a well-regarded official keeps them. */
const trusted = (s: GameState): GameState => ({ ...s, study: { ...s.study!, place: { desk: 70, superiors: 80, city: 40, priesthood: 40 } } });

describe('the dicasteries', () => {
  it('put a man where his record fits, the same in the same world', () => {
    expect(['texts', 'signatura']).toContain(dicasteryFor(candidate('fit-jcl', ['JCL'])).key);
    expect(dicasteryFor(candidate('fit-std', ['STD', 'STL'])).key).toBe('ddf');
    expect(dicasteryFor(candidate('same'))).toEqual(dicasteryFor(candidate('same')));
  });

  it('carry their names by date: congregations before Praedicate Evangelium, dicasteries after', () => {
    const ddf = dicasteryDef('ddf')!;
    expect(dicasteryName(ddf, day(2015, 1, 1))).toBe('the Congregation for the Doctrine of the Faith');
    expect(dicasteryName(ddf, day(2023, 1, 1))).toBe('the Dicastery for the Doctrine of the Faith');
    expect(dicasteryName(dicasteryDef('laity')!, day(2012, 1, 1))).toBe('the Pontifical Council for the Laity');
    expect(dicasteryName(dicasteryDef('signatura')!, day(2030, 1, 1))).toBe('the Supreme Tribunal of the Apostolic Signatura');
  });
});

describe('a posting in the Curia', () => {
  it("comes by the Secretariat of State's letter to a man Rome and the nuncio read well", () => {
    const def = offerById('rome_curia_official')!;
    expect(allOffers.filter((o) => o.accept.commitment?.away === 'curia_official')).toHaveLength(1);
    expect(isOfferEligible(def, candidate('eligible'))).toBe(true);
    const cold = candidate('cold');
    expect(isOfferEligible(def, { ...cold, character: { ...cold.character!, reputation: { ...cold.character!.reputation, rome: -10 } } })).toBe(false);
    expect(renderText(def.body, candidate('eligible'))).toMatch(/^The letter comes to .+ The (Congregation|Dicastery|Pontifical|Supreme|Secretariat)/);
  });

  it('is an office, its superiors, the week of an official, and four dials', () => {
    const s = lent('posting');
    expect(s.phase).toBe('study');
    expect(s.study!.city).toBe('curia');
    expect(s.study!.school).toBe(dicasteryName(dicasteryDef(String(s.flags['curia:dicastery']))!, toDayNumber({ year: 2017, month: 8, day: 20 }) + 1));
    expect(rankOf(s)).toBe('official');
    expect(s.flags[`curia:in:${s.flags['curia:dicastery']}`]).toBe(true);
    for (const sel of ['@curia_prefect', '@curia_secretary', '@curia_colleague']) expect(resolveSelector(s, sel)).toBeTruthy();
    expect(resolveSelector(s, '@curia_prefect')!.title).toBe('Cardinal');
    const ids = studyActivitiesFor(s).map((a) => a.def.id);
    expect(ids).toEqual(expect.arrayContaining(['curia_files', 'curia_drafts', 'curia_sunday', 'curia_chapel']));
    expect(Object.keys(s.study!.place!).sort()).toEqual(['city', 'desk', 'priesthood', 'superiors']);
  });

  it('climbs the ladder a rung at a time for a man the superiors trust: head of office, undersecretary, secretary and archbishop', () => {
    let s = lent('ladder');
    // A man of forty-four when lent: the pope names no undersecretary under forty-four, no secretary under fifty.
    s = { ...s, character: { ...s.character!, entryYear: 1995, reputation: { ...s.character!.reputation, rome: 70 } } };
    const start = s.study!.endWeek;
    s = weeks(s, 52 * 6, trusted);
    expect(rankOf(s)).toBe('head');
    // The secretary's desk is a chance each year for a man of fifty and the score: it comes in his time.
    for (let y = 0; y < 20 && rankOf(s) !== 'secretary'; y++) s = weeks(s, 52, trusted);
    expect(rankOf(s)).toBe('secretary');
    expect(s.flags['curia:head'] && s.flags['curia:undersecretary']).toBe(true);
    expect(s.flags.ordained_bishop).toBe(true);
    expect(s.study!.endWeek).toBeGreaterThan(start);
    expect(s.beats.some((b) => b.kind === 'assignment' && b.week === s.study!.endWeek)).toBe(true);
    expect(s.career.filter((c) => c.kind === 'promotion').length).toBeGreaterThanOrEqual(4);
  });

  it('names no undersecretary while the see of Rome is vacant', () => {
    let s = lent('vacant');
    s = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, rome: 70 } } };
    const vacant = (x: GameState): GameState => ({ ...trusted(x), rome: { ...x.rome!, vacancy: { sinceDay: 0, electionDay: 1e9, cause: 'died', priorId: 'x' } } });
    s = weeks(s, 52 * 5, vacant);
    expect(['official', 'head']).toContain(rankOf(s));
  });

  it('asks him to stay near the end, and a yes keeps him three more years', () => {
    // A liked official, not a rising one: the superiors would keep him, and no rung above opens.
    let s = lent('stay');
    s = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, rome: 0 } } };
    const end = s.study!.endWeek;
    s = weeks(s, end - s.clock.week - CURIA.askBefore + 1, (x) => ({ ...x, study: { ...x.study!, place: { ...x.study!.place!, superiors: 30, desk: -60 } } }));
    expect(rankOf(s)).toBe('official');
    expect(s.flags['curia:asked_stay']).toBe(true);
    const scene = allEvents.find((e) => e.id === 'cu_stay')!;
    expect(isEligible(scene, s) && evaluateAll(scene.requires ?? [], s)).toBe(true);
    s = weeks({ ...s, flags: { ...s.flags, 'curia:stays': true, 'curia:answered_stay': true } }, 1);
    expect(s.study!.endWeek).toBe(end + CURIA.stayWeeks);
    expect(s.flags['curia:stayed']).toBe(1);
  });

  it('five years in a dicastery: he comes home changed, or not, and a secretary goes to a see', () => {
    const def = offerById('rome_curia_official')!;
    const at = (priesthood: number): GameState => {
      const s = lent('home');
      return { ...s, clock: { ...s.clock, week: s.study!.endWeek }, study: { ...s.study!, place: { desk: 40, superiors: 30, city: 50, priesthood } } };
    };
    const priest = endStudy(at(50), def, createRng('home'));
    expect(priest.study).toBeNull();
    expect(priest.flags.curia_served).toBe(true);
    expect(priest.flags['curia:came_home_a_priest']).toBe(true);
    expect(priest.letterQueue?.some((l) => l.title === 'Home from Rome')).toBe(true);
    const clerk = endStudy(at(-40), def, createRng('home'));
    expect(clerk.flags['curia:came_home_a_clerk']).toBe(true);
    expect(clerk.character!.stats.piety).toBeLessThan(priest.character!.stats.piety);
    // A secretary is not sent home but named to a see: the nuncio's letter follows.
    const sec = at(20);
    const done = endStudy({ ...sec, flags: { ...sec.flags, 'curia:rank': 'secretary', 'curia:secretary': true, ordained_bishop: true } }, def, createRng('home'));
    expect(typeof done.flags['nuncio:named_see']).toBe('string');
    expect(isOfferEligible(offerById('ep_diocesan_bishop')!, { ...done, mode: { kind: 'clock' }, phase: 'pastor' })).toBe(true);
  });

  it('a man sent from the Curia straight to a see has the Curia on his record as served', () => {
    const s = lent('to-a-see');
    const left = leaveCuriaForSee(s);
    expect(left.flags.curia_served).toBe(true);
    expect(left.offerHistory.at(-1)).toMatchObject({ offerId: 'rome_curia_official', decision: 'completed' });
  });

  it('the Secretariat of State calls its rungs by its own names', () => {
    const s = lent('secretariat');
    const at: GameState = { ...s, flags: { ...s.flags, 'curia:dicastery': 'secretariat', 'curia:rank': 'secretary' } };
    expect(curiaTokens(at).curia_rank).toBe('substitute for general affairs');
    expect(curiaTokens({ ...at, flags: { ...at.flags, 'curia:dicastery': 'ddf' } }).curia_rank).toBe('secretary');
  });

  it("an office's own scenes come only to the men who work in it", () => {
    const s = lent('scenes', ['JCL']);
    const mine = String(s.flags['curia:dicastery']);
    const office = allEvents.filter((e) => e.id.startsWith('cu_') && (e.requires ?? []).some((c) => c.type === 'flag' && c.key.startsWith('curia:in:')));
    expect(office.length).toBeGreaterThanOrEqual(8);
    for (const e of office) {
      const key = (e.requires ?? []).find((c) => c.type === 'flag' && c.key.startsWith('curia:in:'));
      const fits = evaluateAll(e.requires ?? [], s);
      expect(fits, e.id).toBe(key?.type === 'flag' && key.key === `curia:in:${mine}`);
    }
  });
});
