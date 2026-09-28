import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { allEvents, eventById } from '@/content';
import { seeActs } from '@/content/see';
import { sundayOf } from '@/engine/time';
import { applyEffects } from '@/engine/effects';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { seeYear } from '@/engine/see';
import { deserialize, serialize, buildSave } from '@/engine/save';
import { studyWeekHook, type EventDeps } from '@/engine/weekHook';
import { setStudyActivity } from '@/systems/studyWeek';
import { actAvailable, actProgress, beginAct, closableParishes, DECREE, dropAct, signAct } from '@/systems/bishop/desk';
import { NORM_AS_DONE, READING } from '@/systems/bishop/reading';
import { documentsOfHisLife, dueCascade, issueDocument, type Draft } from '@/systems/rome/documents';
import { normFor } from '@/systems/rome/policy';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

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
  return acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state;
}

const deps: EventDeps = { pool: allEvents, lookup: (id) => eventById(id), offerLookup: (id) => offerById(id) };
const week = (s: GameState, n = 1): GameState => ({ ...s, clock: { ...s.clock, week: s.clock.week + n } });

describe("the bishop's desk (E4 R1.1)", () => {
  it('the acts are data: hours, a letter, a note, a target the engine knows', () => {
    expect(seeActs.length).toBeGreaterThanOrEqual(6);
    for (const a of seeActs) {
      expect(a.hours).toBeGreaterThan(0);
      expect(a.letter.length).toBeGreaterThan(0);
      expect(a.note.length).toBeGreaterThan(0);
      if (a.target) expect(['parish', 'stance']).toContain(a.target);
      for (const e of a.effects) if (e.target === 'see') expect(['presbyterate', 'people', 'rome', 'money', 'shortage']).toContain(e.key);
    }
  });

  it('an act is begun, written in the desk\'s hours through the week, and signed: the dials move, the letter comes, the record keeps it, and it rests', () => {
    let s = setStudyActivity(bishop('desk'), 'see_desk', 3);
    expect(actAvailable(s, seeActs.find((a) => a.id === 'pastoral_letter')!).ok).toBe(true);
    s = beginAct(s, 'pastoral_letter');
    expect(s.see!.desk?.actId).toBe('pastoral_letter');
    expect(actProgress(s)).toEqual({ done: 0, need: 6 });
    // Nothing else may be begun while it is on the desk; it can be dropped.
    expect(actAvailable(s, seeActs.find((a) => a.id === 'appeal')!).why).toMatch(/already on the desk/);
    expect(dropAct(s).see!.desk).toBeUndefined();
    const people = s.see!.people;
    const hook = studyWeekHook(deps);
    let w = hook(week(s), createRng('w1'), []);
    expect(actProgress(w)?.done).toBe(3);
    expect(w.see!.desk).toBeDefined();
    w = hook({ ...week(w), mode: { kind: 'clock' }, pending: [] }, createRng('w2'), []);
    expect(w.see!.desk).toBeUndefined();
    expect(w.see!.acts?.map((a) => a.actId)).toEqual(['pastoral_letter']);
    expect(w.see!.people).toBe(people + 5);
    expect(w.letterQueue?.some((l) => l.title === 'A pastoral letter') || w.letters?.some((l) => l.title === 'A pastoral letter')).toBe(true);
    expect(w.career.at(-1)?.text).toMatch(/pastoral letter/);
    expect(actAvailable(w, seeActs.find((a) => a.id === 'pastoral_letter')!).why).toMatch(/Not again/);
  });

  it('a decree on the liturgy sets the diocese\'s own policy, and the wings read it', () => {
    const s = bishop('decree');
    const before = s.world!.diocese.hidden.bishop.liturgy.latin_mass;
    const target = before === 'forbidden' ? 'free' : 'forbidden';
    const begun = beginAct(s, 'decree_liturgy', { topic: 'latin_mass', stance: target });
    expect(begun.see!.desk?.topic).toBe('latin_mass');
    const out = signAct(begun)!;
    expect(out.state.world!.diocese.hidden.bishop.liturgy.latin_mass).toBe(target);
    const f = s.world!.diocese.hidden.factions;
    const steps = ({ free: 0, by_permission: 1, forbidden: 2 } as const)[target] - ({ free: 0, by_permission: 1, forbidden: 2 } as const)[before];
    expect(out.state.see!.presbyterate - s.see!.presbyterate).toBe(Math.round(steps * (f.progressive * DECREE.presbyterate.progressive - f.traditional * DECREE.presbyterate.traditional)));
    expect(out.letter.body[0]).toContain('Gaylord');
    expect(out.state.see!.acts?.[0]).toMatchObject({ actId: 'decree_liturgy', topic: 'latin_mass', stance: target });
    // The same stance twice is no decree; a bad topic is refused.
    expect(beginAct(out.state, 'decree_liturgy', { topic: 'latin_mass', stance: target }).see!.desk).toBeUndefined();
    expect(beginAct(s, 'decree_liturgy', { topic: 'nave' as never, stance: 'free' }).see!.desk).toBeUndefined();
  });

  it('a closing takes a parish off the map and frees its pastor; the yearly forced closing does the same', () => {
    const s = bishop('close');
    const parishes = closableParishes(s);
    expect(parishes.length).toBeGreaterThan(0);
    expect(parishes.every((p) => !p.cathedral)).toBe(true);
    const doomed = parishes[0]!;
    const out = signAct(beginAct(s, 'close_parish', { parishId: doomed.id }))!;
    expect(out.state.world!.parishes.some((p) => p.id === doomed.id)).toBe(false);
    expect(out.state.world!.parishes.length).toBe(s.world!.parishes.length - 1);
    expect(out.state.see!.closings).toBe(1);
    expect(out.state.flags.bp_began_closings).toBe(true);
    expect(out.state.npcs[doomed.pastorId]?.tags).not.toContain(`pastor:${doomed.id}`);
    expect(out.letter.body[0]).toContain(doomed.name);
    expect(out.state.see!.acts?.[0]?.parishName).toBe(doomed.name);
    // The arithmetic: a critical shortage, nobody has begun, and no man ordained this year to relieve it (the seminary empty).
    const forced = seeYear({ ...s, see: { ...s.see!, shortage: 5, seminary: { ...s.see!.seminary!, men: [] } } }, createRng('fy'));
    expect(forced.state.world!.parishes.length).toBe(s.world!.parishes.length - 1);
    expect(forced.state.see!.closings).toBe(1);
    expect(forced.letter.body.join(' ')).toMatch(/closed this year/);
  });

  it('a synod waits a year and happens once in a chair', () => {
    const s = bishop('synod');
    const def = seeActs.find((a) => a.id === 'synod')!;
    expect(actAvailable(s, def).why).toBe('Not yet.');
    const later = week(s, 53);
    expect(actAvailable(later, def).ok).toBe(true);
    const out = signAct(beginAct(later, 'synod'))!;
    expect(out.state.flags.bp_synod).toBe(true);
    expect(actAvailable(out.state, def).why).toBe('Once in a chair.');
  });

  it("Rome's document reaches the bishop as a scene of his own, and his reading becomes the diocese's", () => {
    const s = bishop('read');
    const pope = s.rome!.popes.at(-1)!;
    const draft: Draft = { id: 'gen:test', kind: 'motu_proprio', title: 'Traditionis Test', gist: 'on the older Mass', day: sundayOf(s.clock), popeId: pope.id, axis: 'older_mass', value: 'faculties', from: 'free' };
    const issued = issueDocument(s, draft);
    const doc = issued.state.rome!.issued!.at(-1)!;
    expect(doc.norm).toBeUndefined();
    expect(issued.letter!.body[2]).toContain('yours to give');
    const due = { ...issued.state, clock: { ...issued.state.clock, week: issued.state.rome!.cascade!.dueWeek } };
    expect(dueCascade(due)!.axis).toBe('older_mass');
    const scene = eventById('bp_read_older_mass')!;
    expect(isEligible(scene, due) && evaluateAll(scene.requires, due)).toBe(true);
    // Through the week: the cascade reaches him and the scene is his.
    const hook = studyWeekHook(deps);
    const w = hook({ ...due, mode: { kind: 'clock' }, pending: [] }, createRng('cw'), []);
    expect(w.pending.some((p) => p.eventId === 'bp_read_older_mass') || w.career.some((c) => /^Read Traditionis Test/.test(c.text))).toBe(true);
    // His reading: the record, the dials, the profile.
    const read = applyEffects(due, [{ target: 'norm', key: 'older_mass', value: 'slow' }]);
    const after = read.rome!.issued!.at(-1)!;
    expect(after.norm).toBe('slow');
    expect(after.bishopId).toBe('player');
    expect(after.implemented).toBe(NORM_AS_DONE.slow);
    expect(read.see!.rome).toBe(Math.max(-100, due.see!.rome + READING.rome * READING.weight.slow));
    expect(normFor(read, 'older_mass')).toBe('slow');
    expect(documentsOfHisLife(read).at(-1)!.line).toContain('the bishop slow-walked it');
    // Every generated axis but religious life, which the provincial reads, has its scene.
    for (const ax of ['older_mass', 'missal', 'remarried_communion', 'blessings', 'marriage_cases', 'lay_ministries', 'synodality', 'creation']) expect(eventById(`bp_read_${ax}`)).toBeDefined();
  });

  it('an act on the desk survives a save', () => {
    const s = beginAct(setStudyActivity(bishop('desk-save'), 'see_desk', 2), 'appeal');
    const back = deserialize(serialize(buildSave(s, createRng(s.seed), null, {}))).state;
    expect(back.see!.desk).toEqual(s.see!.desk);
    expect(actProgress(back)).toEqual(actProgress(s));
  });
});
