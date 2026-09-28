import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { endStudy } from '@/engine/study';
import { offerById } from '@/content/offers';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { contendersOf, electorsOf, nameableByTheOrder, orderLegibility, PLAYER_ID, CAPITULAR_TAG } from '@/systems/religious/electorate';
import { closeChapter, holdElection, resolveElection, returnToRanks, successorChapter, termOver } from '@/systems/religious/chapter';
import { ensureGeneralCuria, GENERAL, generalChapterDue, makeCapitulars, openGeneralChapter } from '@/systems/religious/general';
import { religiousYear } from '@/systems/religious/year';
import { mayBeCreated } from '@/systems/rome/college';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import type { GameState, OrderKey } from '@/types';

/** A solemnly professed priest of fifty, a former provincial the order has heard of. */
function friar(seed: string, order: OrderKey = 'OP', patch: Partial<NonNullable<GameState['religious']>> = {}, orderRep = 70): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 65, charisma: 65, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20 } }, gen, 2010, priory.id);
  const c = s.character!;
  s = { ...s, character: { ...c, reputation: { ...c.reputation, order: orderRep, province: 50 } }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 5, legibility: 90, termsServed: [{ office: 'provincial', startWeek: -400, endWeek: -200 }], ...patch } };
  return s;
}

/** The capitulars think the world of him: the machinery under test, not the odds (which tests/qa and §16A measure). */
function beloved(state: GameState): GameState {
  const npcs = { ...state.npcs };
  for (const [id, n] of Object.entries(npcs)) if (n.tags.includes(CAPITULAR_TAG)) npcs[id] = { ...n, relationship: 90 };
  return { ...state, npcs };
}

/** A general chapter with the man in the room and the room for him, held; the seed varied until it turns to him. */
function elected(seed: string, order: OrderKey = 'OP', base?: GameState): GameState {
  for (let i = 0; i < 40; i++) {
    const s = base ? { ...base, seed: `${seed}-${i}` } : { ...friar(`${seed}-${i}`, order), seed: `${seed}-${i}` };
    const open = beloved(openGeneralChapter({ ...s, flags: { ...s.flags, 'general:delegate': true } }, createRng(`${seed}:${i}`)));
    const held = holdElection(open);
    if (held.religious!.chapter!.outcome!.electedId === PLAYER_ID) return held;
  }
  throw new Error('no world elected him');
}

describe('the general chapter (E3 §16A)', () => {
  it('seeds the head of the order some way into his term, and the chapter is due when it has run', () => {
    const s = ensureGeneralCuria(friar('seed'));
    const gc = s.generalCuria!;
    expect(s.npcs[gc.generalId]!.tags).toContain('general');
    expect(gc.terms).toBe(1);
    expect(generalChapterDue(s)).toBe(false);
    const years = religiousOrder('OP').governance.generalTermYears;
    expect(generalChapterDue({ ...s, clock: { ...s.clock, week: gc.since + years * 52 } })).toBe(true);
    // The same world seeds the same man.
    expect(ensureGeneralCuria(friar('seed')).generalCuria).toEqual(gc);
  });

  it('gathers capitulars from the seed: a provincial and a delegate from each province present, varied, the same twice', () => {
    const s = friar('cap');
    const men = makeCapitulars(s, 100);
    expect(men).toHaveLength(GENERAL.provincesPresent * 2);
    expect(men.filter((n) => n.tags.includes('provincial'))).toHaveLength(GENERAL.provincesPresent);
    expect(new Set(men.map((n) => n.tags.find((t) => t.startsWith('from:')))).size).toBeGreaterThan(3);
    expect(new Set(men.map((n) => n.alignment)).size).toBeGreaterThan(5);
    expect(makeCapitulars(s, 100)).toEqual(men);
    expect(makeCapitulars(s, 101)).not.toEqual(men);
  });

  it('the room: the capitulars vote; the player only as provincial or delegate; on the ballot when the order can name him', () => {
    const s = friar('room');
    const open = openGeneralChapter(s, createRng('room'));
    const ch = open.religious!.chapter!;
    expect(ch.level).toBe('general');
    expect(ch.office).toBe('general');
    const electors = electorsOf(open, 'general', 'OP');
    expect(electors.filter((v) => !v.isPlayer)).toHaveLength(GENERAL.provincesPresent * 2);
    expect(electors.some((v) => v.isPlayer)).toBe(!!open.flags['general:delegate']);
    // As provincial he is there ex officio.
    const asProvincial = { ...open, religious: { ...open.religious!, office: { office: 'provincial' as const, bodyId: 'p', startWeek: 0, endWeek: 200, consecutive: 1 } } };
    expect(electorsOf(asProvincial, 'general', 'OP').some((v) => v.isPlayer)).toBe(true);
    // On the ballot: a former provincial the order regards; not a man the order has not heard of, nor one without a term or the order's credential.
    expect(nameableByTheOrder(open)).toBe(true);
    expect(contendersOf(open, 'general', 'OP').some((c) => c.isPlayer)).toBe(true);
    const unknown = { ...open, character: { ...open.character!, reputation: { ...open.character!.reputation, order: 10 } } };
    expect(contendersOf(unknown, 'general', 'OP').some((c) => c.isPlayer)).toBe(false);
    const noTerm = { ...open, religious: { ...open.religious!, termsServed: [] } };
    expect(contendersOf(noTerm, 'general', 'OP').some((c) => c.isPlayer)).toBe(false);
    // His legibility to the whole order follows its regard.
    expect(orderLegibility(unknown)).toBeLessThan(orderLegibility(open));
    // Every provincial present is a man the room could turn to.
    expect(contendersOf(open, 'general', 'OP').filter((c) => !c.isPlayer)).toHaveLength(GENERAL.provincesPresent);
  });

  it('the ballots are the same in the same world, and the order elects a head from the gallery when he is not in the room', () => {
    const base = friar('ballots', 'OP', {}, 20);
    // A man the province would not send: no standing with it, so no delegate's seat.
    const s: GameState = { ...base, character: { ...base.character!, reputation: { ...base.character!.reputation, province: 0 } } };
    const a = holdElection(openGeneralChapter(s, createRng('b')));
    const b = holdElection(openGeneralChapter(s, createRng('b')));
    expect(a.religious!.chapter!.ballots).toEqual(b.religious!.chapter!.ballots);
    // Not in the room: the year opens the chapter and he reads of it.
    const seeded = ensureGeneralCuria(s);
    const due = { ...seeded, clock: { ...seeded.clock, week: seeded.generalCuria!.since + religiousOrder('OP').governance.generalTermYears * 52 }, flags: { ...seeded.flags, ordained: true } };
    const year = religiousYear(due, createRng('year'));
    // A house or provincial chapter may sit the same year; the general chapter itself was read from the gallery.
    expect(year.religious!.chapter?.level).not.toBe('general');
    expect((year.letters ?? []).some((l) => l.title === 'The general chapter has elected')).toBe(true);
    expect(year.generalCuria!.generalId).not.toBe(seeded.generalCuria!.generalId);
    expect(year.npcs[year.generalCuria!.generalId]!.tags).toContain('general');
    // The capitulars went home; the elected man stayed.
    expect(Object.values(year.npcs).filter((n) => n.tags.includes(CAPITULAR_TAG))).toHaveLength(1);
    expect(year.generalCuria!.chaptersHeld).toBe(1);
  });

  it('elected: he accepts, and goes to Rome as head of the order, the posting and the term ending together', () => {
    const held = elected('rome');
    const seated = resolveElection(held, createRng('confirm'), true);
    const o = seated.religious!.office!;
    expect(o.office).toBe('general');
    const years = religiousOrder('OP').governance.generalTermYears;
    expect(o.endWeek - o.startWeek).toBe(years * 52);
    expect(seated.generalCuria!.generalId).toBe(PLAYER_ID);
    expect(seated.study!.city).toBe('generalate');
    expect(seated.study!.endWeek).toBe(o.endWeek);
    expect(seated.beats.some((b) => b.kind === 'assignment' && b.week === o.endWeek)).toBe(true);
    expect(seated.flags['office:general']).toBe(seated.clock.week);
    expect(seated.career.some((e) => /Elected Master of the Order/.test(e.text))).toBe(true);
    expect(seated.offerHistory.some((h) => h.offerId === 'fr_general_elected' && h.decision === 'accepted')).toBe(true);
    // The chapter closes and the capitulars go home.
    const closed = closeChapter(seated);
    expect(Object.values(closed.npcs).some((n) => n.tags.includes(CAPITULAR_TAG))).toBe(false);
    // Declined: the runner-up is head, and he is not in Rome.
    const declined = resolveElection(held, createRng('confirm'), false);
    expect(declined.generalCuria!.generalId).not.toBe(PLAYER_ID);
    expect(declined.study).toBeNull();
    expect(declined.religious!.declined!.general).toBe(1);
  });

  it('the term ends: he returns to the ranks a former head, the order elects again without him, and he comes home to a consultation', () => {
    const seated = closeChapter(resolveElection(elected('term'), createRng('confirm'), true));
    const o = seated.religious!.office!;
    const ended = { ...seated, clock: { ...seated.clock, week: o.endWeek } };
    expect(termOver(ended)).toBe(true);
    const back = returnToRanks(ended, 'well');
    expect(back.flags['general:served']).toBe(true);
    expect(back.generalCuria!.generalId).toBe('');
    expect(back.religious!.termsServed.at(-1)!.office).toBe('general');
    const next = successorChapter(back, 'general', 'OP', createRng('successor'));
    expect(next.letter?.title).toBe('The general chapter has elected');
    expect(next.state.generalCuria!.generalId).not.toBe('');
    expect(next.state.generalCuria!.generalId).not.toBe(PLAYER_ID);
    // The posting ends the same week: home to the province, and the record says the years.
    const home = endStudy(next.state, offerById('fr_general_elected')!, createRng('home'));
    expect(home.study).toBeNull();
    expect(home.mode.kind).toBe('consultation');
    expect(home.career.some((e) => /years at the head of the order/.test(e.text))).toBe(true);
  });

  it('an Augustinian prior general may be re-elected once, and the posting runs on; a Dominican master may not', () => {
    const seated = closeChapter(resolveElection(elected('again', 'OSA'), createRng('confirm'), true));
    const o = seated.religious!.office!;
    const due = { ...seated, clock: { ...seated.clock, week: o.endWeek } };
    expect(contendersOf(due, 'general', 'OSA').some((c) => c.isPlayer)).toBe(true);
    // Re-elected: the office and the posting run on from their end.
    const again: GameState | undefined = resolveElection(elected('again-2', 'OSA', due), createRng('c'), true);
    const years = religiousOrder('OSA').governance.generalTermYears;
    expect(again!.religious!.office!.endWeek).toBe(o.endWeek + years * 52);
    expect(again!.study!.endWeek).toBe(o.endWeek + years * 52);
    expect(again!.generalCuria!.terms).toBe(2);
    // The second term runs from the re-election, not the first: no chapter is due again until it has run.
    expect(again!.generalCuria!.since).toBe(again!.clock.week);
    expect(generalChapterDue(again!)).toBe(false);
    expect(generalChapterDue({ ...again!, clock: { ...again!.clock, week: again!.religious!.office!.endWeek } })).toBe(true);
    expect(contendersOf({ ...again!, clock: { ...again!.clock, week: again!.religious!.office!.endWeek } }, 'general', 'OSA').some((c) => c.isPlayer)).toBe(false);
    // A Dominican master serves one term.
    const op = closeChapter(resolveElection(elected('once', 'OP'), createRng('confirm'), true));
    expect(contendersOf({ ...op, clock: { ...op.clock, week: op.religious!.office!.endWeek } }, 'general', 'OP').some((c) => c.isPlayer)).toBe(false);
  });

  it('a former head of the order whom Rome regards may be created a cardinal; a friar otherwise may not', () => {
    const s = friar('hat');
    const c = s.character!;
    const day = s.clock.startDay + s.clock.week * 7;
    // Past fifty-two, as the College's gate asks (§12).
    const former = { ...s, flags: { ...s.flags, 'general:served': true }, character: { ...c, entryYear: 1976, reputation: { ...c.reputation, rome: 60 } } };
    expect(mayBeCreated(former, day)).toBe(true);
    expect(mayBeCreated({ ...former, flags: { ...s.flags } }, day)).toBe(false);
    expect(mayBeCreated({ ...former, character: { ...former.character, reputation: { ...former.character.reputation, rome: 20 } } }, day)).toBe(false);
  });

  it('the order beyond the province survives a save', () => {
    const seated = closeChapter(resolveElection(elected('save'), createRng('confirm'), true));
    const back = deserialize(serialize(buildSave(seated, createRng(seated.seed), null, {})));
    expect(back.state.generalCuria).toEqual(seated.generalCuria);
    expect(back.state.religious!.office).toEqual(seated.religious!.office);
    expect(back.state.study!.city).toBe('generalate');
  });
});
