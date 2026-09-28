import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { seminaryPools } from '@/content/see';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { seeYear } from '@/engine/see';
import { careerYear } from '@/engine/career';
import { deserialize, serialize, buildSave } from '@/engine/save';
import { admit, delayMan, dismissMan, nameRector, nameVocationsDirector, SEMINARY, seminaryYear, sendToRome, setEmphasis, setWhere } from '@/systems/bishop/seminary';
import { priestsOfSee } from '@/systems/bishop/directions';
import { acceptAndGo } from '../helpers/appointment';
import { PILLARS, type GameState } from '@/types';

function bishop(seed: string): GameState {
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
  return { ...acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state, mode: { kind: 'clock' } };
}
const year = (s: GameState, n = 1): GameState => ({ ...s, clock: { ...s.clock, week: s.clock.week + 52 * n } });

describe('the seminary (E4 R1.4)', () => {
  it('the chair finds a seminary: men across the years, the province\'s unless the see has its own, and the data behind it', () => {
    const s = bishop('sem-seed');
    const sem = s.see!.seminary!;
    expect(sem.men.length).toBeGreaterThanOrEqual(SEMINARY.seeded[0]);
    expect(sem.men.length).toBeLessThanOrEqual(SEMINARY.seeded[1]);
    for (const m of sem.men) {
      expect(m.year).toBeGreaterThanOrEqual(1);
      expect(m.year).toBeLessThanOrEqual(SEMINARY.years);
      for (const p of PILLARS) expect(m.pillars[p]).toBeGreaterThanOrEqual(0);
    }
    const own = s.world!.diocese.visible.institutions.includes('major_seminary');
    expect(sem.where).toBe(own ? 'own' : 'province');
    expect(sem.name.length).toBeGreaterThan(0);
    for (const w of ['own', 'province', 'rome'] as const) {
      expect(seminaryPools.where[w].money).toBeLessThan(0);
      for (const p of PILLARS) expect(seminaryPools.where[w].growth[p]).toBeGreaterThan(0);
    }
    for (const k of Object.keys(seminaryPools.issues)) expect(PILLARS).toContain(seminaryPools.issues[k]!.pillar);
  });

  it('where and the emphasis are chosen; the rector needs a seminary of the see\'s own; the director is any priest of the see', () => {
    const s = bishop('sem-choose');
    const rome = setWhere(s, 'rome');
    expect(rome.see!.seminary!.where).toBe('rome');
    expect(rome.see!.seminary!.name).toBe('the Roman colleges');
    expect(rome.career.at(-1)!.text).toMatch(/Rome/);
    const own = s.world!.diocese.visible.institutions.includes('major_seminary');
    if (!own) expect(setWhere(s, 'own').see!.seminary!.where).not.toBe('own');
    const em = setEmphasis(s, 'intellectual');
    expect(em.see!.seminary!.emphasis).toBe('intellectual');
    const priest = priestsOfSee(s)[0]!;
    const dir = nameVocationsDirector(s, priest.id);
    expect(dir.see!.seminary!.vocationsDirectorId).toBe(priest.id);
    expect(dir.npcs[priest.id]!.tags).toContain('vocations_director');
    if (own) {
      const r = nameRector(s, priest.id);
      expect(r.see!.seminary!.rectorId).toBe(priest.id);
      expect(r.npcs[priest.id]!.tags).toContain('rector');
    } else {
      expect(nameRector(s, priest.id).see!.seminary!.rectorId).toBeUndefined();
    }
    // Not a priest of the see: nothing happens.
    const stranger = Object.values(s.npcs).find((n) => n.role === 'priest' && !priestsOfSee(s).some((p) => p.id === n.id))!;
    expect(nameVocationsDirector(s, stranger.id).see!.seminary!.vocationsDirectorId).toBe(s.see!.seminary!.vocationsDirectorId);
  });

  it('the year: applicants come and are decided man by man, men grow and are reported, and concerns surface more where they are stressed', { timeout: 30_000 }, () => {
    const s = setEmphasis(bishop('sem-year'), 'human');
    const before = s.see!.seminary!.men.filter((m) => m.status === 'forming');
    const out = seminaryYear(year(s), createRng('y1'));
    const sem = out.state.see!.seminary!;
    expect(out.letter?.title).toContain(sem.name);
    // Every man who stayed and was not ordained is a year older and grew.
    for (const m0 of before) {
      const m = sem.men.find((x) => x.id === m0.id)!;
      if (m.status !== 'forming') continue;
      expect(m.year).toBe(m0.year + 1);
      expect(PILLARS.reduce((a, p) => a + m.pillars[p], 0)).toBeGreaterThan(PILLARS.reduce((a, p) => a + m0.pillars[p], 0));
    }
    // Applicants over many years and seeds: some come; admitted, a man begins his first year; declined, he goes.
    let admitted: GameState | null = null;
    for (let i = 0; i < 30 && !admitted; i++) {
      const o = seminaryYear(year(s, 1), createRng(`ap-${i}`));
      const a = o.state.see!.seminary!.applicants[0];
      if (!a) continue;
      const yes = admit(o.state, a.id, true);
      expect(yes.see!.seminary!.men.some((m) => m.name === a.name && m.year === 1 && m.status === 'forming')).toBe(true);
      expect(yes.see!.seminary!.applicants).toHaveLength(o.state.see!.seminary!.applicants.length - 1);
      const no = admit(o.state, a.id, false);
      expect(no.see!.seminary!.men.some((m) => m.name === a.name)).toBe(false);
      expect(no.career.at(-1)!.text).toMatch(/Declined/);
      admitted = yes;
    }
    expect(admitted).not.toBeNull();
    // A concern surfaces more often in a year that stresses its pillar.
    const fixture = bishop('sem-year');
    const count = (emphasis: 'human' | 'pastoral') => {
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const base = setEmphasis(fixture, emphasis);
        const men = base.see!.seminary!.men.map((m) => { const { issueSeen: _seen, ...rest } = m; return { ...rest, issue: 'immature' }; });
        const o = seminaryYear(year({ ...base, see: { ...base.see!, seminary: { ...base.see!.seminary!, men } } }), createRng(`c-${emphasis}-${i}`));
        n += o.state.see!.seminary!.men.filter((m) => m.issueSeen).length;
      }
      return n;
    };
    expect(count('human')).toBeGreaterThan(count('pastoral'));
  });

  it('a man may be held, sent to Rome from the third year, or dismissed', () => {
    const s = bishop('sem-acts');
    const sem = s.see!.seminary!;
    const m = sem.men.find((x) => x.status === 'forming')!;
    const held = delayMan(s, m.id);
    expect(held.see!.seminary!.men.find((x) => x.id === m.id)!.delayed).toBe(1);
    const afterHold = seminaryYear(year(held), createRng('h'));
    const hm = afterHold.state.see!.seminary!.men.find((x) => x.id === m.id)!;
    if (hm.status === 'forming') expect(hm.year).toBe(m.year);
    const young = { ...m, year: 2 };
    const s2 = { ...s, see: { ...s.see!, seminary: { ...sem, men: sem.men.map((x) => (x.id === m.id ? young : x)) } } };
    expect(sendToRome(s2, m.id).see!.seminary!.men.find((x) => x.id === m.id)!.rome).toBeUndefined();
    const old = { ...m, year: 4 };
    const s3 = { ...s, see: { ...s.see!, seminary: { ...sem, men: sem.men.map((x) => (x.id === m.id ? old : x)) } } };
    const rome = sendToRome(s3, m.id);
    expect(rome.see!.seminary!.men.find((x) => x.id === m.id)!.rome).toBe(s.clock.week);
    expect(rome.see!.money).toBe(s.see!.money + SEMINARY.romeMoney);
    expect(rome.flags['seminary:rome']).toBe(true);
    expect(evaluateAll(eventById('bp_sem_rome_letter')!.requires, rome)).toBe(true);
    expect(renderText(eventById('bp_sem_rome_letter')!.body, rome)).toContain(m.name);
    const gone = dismissMan(s, m.id);
    expect(gone.see!.seminary!.men.find((x) => x.id === m.id)!.status).toBe('dismissed');
    expect(gone.see!.presbyterate).toBe(s.see!.presbyterate + SEMINARY.dismissed.presbyterate);
  });

  it('the sixth year ends in orders: a priest of the see with stats from his pillars, placed where the diocese is short, and the see counts him', () => {
    const s = bishop('sem-ordain');
    const sem = s.see!.seminary!;
    const { issueSeen: _seen, ...m0 } = sem.men.find((x) => x.status === 'forming')!;
    const m = { ...m0, year: 6, pillars: { human: 80, spiritual: 60, intellectual: 90, pastoral: 40 }, issue: 'drink' };
    const vacantId = s.world!.parishes.find((p) => !p.cathedral)!.id;
    const base: GameState = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === vacantId ? { ...p, pastorId: '' } : p)) }, see: { ...s.see!, seminary: { ...sem, men: [m] } } };
    let out = seminaryYear(year(base), createRng('o'));
    for (let i = 0; i < 20 && out.ordained === 0; i++) out = seminaryYear(year(base), createRng(`o${i}`));
    expect(out.ordained).toBe(1);
    const id = out.state.see!.seminary!.ordainedIds[0]!;
    const priest = out.state.npcs[id]!;
    expect(priest.role).toBe('priest');
    expect(priest.tags).toContain(`diocese:${s.see!.dioceseId}`);
    expect(priest.tags).toContain('formed_by_you');
    expect(priest.tags).toContain(`pastor:${vacantId}`);
    expect(out.state.world!.parishes.find((p) => p.id === vacantId)!.pastorId).toBe(id);
    // His stats follow his pillars (the origin adds a point or two).
    expect(priest.stats.theology).toBeGreaterThanOrEqual(Math.round(SEMINARY.stats.base + 90 * SEMINARY.stats.perPillar) - 3);
    expect(priest.stats.theology).toBeGreaterThan(priest.stats.charisma);
    expect(priest.stats.charisma).toBeGreaterThan(priest.stats.piety);
    expect(priest.stats.piety).toBeGreaterThan(priest.stats.administration);
    // A concern formation never surfaced goes with him.
    expect(priest.struggle).toBe('drink');
    expect(priestsOfSee(out.state).some((n) => n.id === id)).toBe(true);
    expect(out.state.flags['seminary:ordained']).toBe(true);
    expect(evaluateAll(eventById('bp_sem_ordination_dinner')!.requires, out.state)).toBe(true);
    expect(out.letter!.body.join(' ')).toContain(m.name);
    // Through the see's year: the ordination is the see's, and the rector's report is a second letter.
    const sy = seeYear(year(base), createRng('o'));
    expect(sy.state.see!.ordinations).toBe(s.see!.ordinations + sy.state.see!.seminary!.ordainedIds.length);
    expect(sy.seminaryLetter).toBeDefined();
    const cy = careerYear(year(base), createRng('cy'));
    expect(cy.letterQueue!.some((l) => /rector's report/.test(l.title))).toBe(true);
  });

  it('a man who leaves is news, and the seminary survives a save', () => {
    const s = bishop('sem-left');
    const sem = s.see!.seminary!;
    let left: GameState | null = null;
    for (let i = 0; i < 60 && !left; i++) {
      const o = seminaryYear(year(s), createRng(`l${i}`));
      if (o.state.flags['seminary:left']) left = o.state;
    }
    expect(left).not.toBeNull();
    expect(left!.see!.seminary!.men.some((m) => m.status === 'left')).toBe(true);
    expect(evaluateAll(eventById('bp_sem_left')!.requires, left!)).toBe(true);
    expect(renderText(eventById('bp_sem_left')!.body, left!)).toContain(left!.flags['seminary:man'] as string);
    const back = deserialize(serialize(buildSave(left!, createRng(left!.seed), null, {}))).state;
    expect(back.see!.seminary).toEqual(left!.see!.seminary);
    expect(sem.men.length).toBeGreaterThan(0);
  });
});
