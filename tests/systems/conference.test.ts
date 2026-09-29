import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { eventById } from '@/content';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { renderText } from '@/engine/text';
import { offerById } from '@/content/offers';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { conferenceDocuments } from '@/content/conference';
import { CONFERENCE, conferenceTemper, conferenceWeek, conferenceWord, conferenceYear, dueConferenceScene, electionFor, ensureConference, isAssemblyWeek, isElectionAssembly, latestConferenceDocument, nextOffice, openDocuments, playerStanding } from '@/systems/conference';
import { nuncioView } from '@/systems/rome/nuncioView';
import { redHatChance } from '@/systems/rome/college';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { acceptAndGo } from '../helpers/appointment';
import { parishState } from './week.test';
import type { ConferenceOffice, GameState } from '@/types';

/** A pastor at a week of the year. */
function priestAt(seed: string, yearWeek: number, yearsIn = 4): GameState {
  const s = parishState(seed);
  return ensureConference({ ...s, phase: 'pastor', assignment: { ...s.assignment!, role: 'pastor' }, clock: { ...s.clock, week: 52 * yearsIn + yearWeek } });
}

/** The first week at or after `from` that is this week of the year and, when asked, a November of an election year. */
function weekOf(s: GameState, from: number, yearWeek: number, election = false): number {
  for (let w = from; w < from + 52 * 6; w++) {
    if (w % 52 !== yearWeek) continue;
    if (!election || dateOf(s.clock, w).year % 3 === CONFERENCE.electionYearMod) return w;
  }
  throw new Error('no such week');
}

/** A man named to Gaylord, the see's world rolled, some years in the chair. */
function bishopAt(seed: string, opts: { election?: boolean; yearWeek?: number; years?: number } = {}): GameState {
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
  const week = weekOf(b, b.clock.week + 52, opts.yearWeek ?? CONFERENCE.assemblyWeeks[1]!, opts.election ?? false);
  const years = opts.years ?? 3;
  // The nuncio is in Washington by then, as he is in play.
  return ensureConference(nuncioWeek({ ...b, clock: { ...b.clock, week }, see: { ...b.see!, installedWeek: week - 52 * years }, flags: { ...b.flags, 'study:see': true } }).state);
}

const fits = (id: string, s: GameState) => isEligible(eventById(id)!, s);

/** Run the assembly week until the dice issue a document. */
function assemblyWithDocument(s: GameState): { state: GameState; letters: ReturnType<typeof conferenceWeek>['letters']; lines: string[] } {
  for (let i = 0; i < 40; i++) {
    const r = conferenceWeek(s, createRng(`doc:${i}`));
    if (latestConferenceDocument(r.state)) return r;
  }
  throw new Error('no document in 40 rolls');
}

describe('E2 R1.2: the conference as a temper', () => {
  it('is rolled once from the seed, the same twice and never the same across seeds, and reads from the bishops the game knows', () => {
    const a = priestAt('temper', 10);
    const b = ensureConference({ ...parishState('temper'), clock: a.clock });
    expect(a.conference).toEqual(b.conference);
    expect(ensureConference(a)).toBe(a);
    const c = a.conference!;
    expect(Math.abs(c.remainder)).toBeLessThanOrEqual(100);
    expect(c.temper).toBe(conferenceTemper(a, c.remainder));
    expect(c.president.name).toMatch(/^(Archbishop|Bishop) /);
    expect(c.vicePresident.name).not.toBe(c.president.name);
    const remainders = new Set<number>();
    const names = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const s = ensureConference({ ...parishState('temper'), seed: `t${i}` });
      remainders.add(Math.round(s.conference!.remainder / 10));
      names.add(s.conference!.president.name);
    }
    expect(remainders.size).toBeGreaterThanOrEqual(4);
    expect(names.size).toBeGreaterThanOrEqual(15);
    // The known bishops pull the temper their way.
    const npcs = { ...a.npcs };
    for (const n of Object.values(npcs)) if (n.role === 'bishop') npcs[n.id] = { ...n, alignment: 90 };
    const warm = conferenceTemper({ ...a, npcs }, c.remainder);
    for (const n of Object.values(npcs)) if (n.role === 'bishop') npcs[n.id] = { ...n, alignment: -90 };
    const cold = conferenceTemper({ ...a, npcs }, c.remainder);
    expect(warm).toBeGreaterThan(cold);
    expect(Math.abs(warm - cold - 180 * CONFERENCE.knownShare)).toBeLessThanOrEqual(1);
  });

  it('the year: the remainder drifts toward the pope a third as fast as Rome, the nuncio\'s appointments nudge it, and an office earns Rome\'s regard', () => {
    const s0 = priestAt('drift', 3);
    const pope = s0.rome!.popes[s0.rome!.popes.length - 1]!;
    const far = { ...s0, conference: { ...s0.conference!, remainder: pope.temperament >= 0 ? -80 : 80 } };
    const r = conferenceYear(far, createRng('y'));
    const moved = r.state.conference!.remainder - far.conference.remainder;
    expect(Math.sign(moved)).toBe(Math.sign(pope.temperament - far.conference.remainder));
    expect(Math.abs(moved)).toBeLessThan(Math.abs(pope.temperament - far.conference.remainder) * 0.35);
    expect(r.state.conference!.temper).toBe(conferenceTemper(r.state, r.state.conference!.remainder));
    // Same seed, same year.
    expect(conferenceYear(far, createRng('y')).state).toEqual(r.state);
  });

  it('the nuncio reads a man far from the conference\'s temper as a harder appointment', () => {
    const s = priestAt('gap', 3);
    const near = { ...s, conference: { ...s.conference!, temper: s.character!.alignment } };
    const far = { ...s, conference: { ...s.conference!, temper: s.character!.alignment >= 0 ? s.character!.alignment - 60 : s.character!.alignment + 60 } };
    expect(conferenceWord(near).value).toBe(0);
    expect(conferenceWord(far).value).toBe(-CONFERENCE.nuncioGapCost);
    expect(conferenceWord(far).bad[0]).toMatch(/far from the conference/);
    expect(nuncioView(far).value).toBeLessThanOrEqual(nuncioView(near).value);
  });
});

describe('E2 R1.2: the assembly as a priest hears of it', () => {
  it('the bishops meet in June and November and not otherwise; the bishop is away, and the letter comes when something is issued', () => {
    expect(isAssemblyWeek(priestAt('w', 24))).toBe(true);
    expect(isAssemblyWeek(priestAt('w', 46))).toBe(true);
    expect(isAssemblyWeek(priestAt('w', 30))).toBe(false);
    const quiet = priestAt('quiet', 30);
    const q = conferenceWeek(quiet, createRng('q'));
    expect(q.state).toBe(quiet);
    const s = priestAt('assembly', 24);
    const r = conferenceWeek(s, createRng('any'));
    expect(r.lines[0]).toMatch(/^The bishop is away at the conference's assembly/);
    expect(r.state.conference!.assemblies).toHaveLength(1);
    expect(r.state.conference!.lastAssemblyWeek).toBe(s.clock.week);
    // Not twice in a week.
    expect(conferenceWeek(r.state, createRng('again')).state).toBe(r.state);
    const { state: issued, letters } = assemblyWithDocument(s);
    const latest = latestConferenceDocument(issued)!;
    const def = conferenceDocuments.find((d) => d.id === latest.doc.value)!;
    expect(latest.doc.source).toBe('conference');
    expect(latest.doc.popeId).toBe('conference');
    expect(latest.doc.axis).toBe(`conference:${def.topic}`);
    expect(latest.doc.norm).toBeDefined();
    expect(latest.doc.bishopId).toBe(s.world!.diocese.hidden.bishop.npcId);
    expect(letters).toHaveLength(1);
    expect(letters[0]!.sort).toBe('bishop');
    expect(letters[0]!.title).toBe(`From the conference: ${def.title}`);
    expect(letters[0]!.body.slice(0, def.letter.length)).toEqual(def.letter);
    expect(issued.career.at(-1)!.text).toContain(def.line);
    // Rome's law is untouched.
    expect(issued.rome!.policies).toEqual(s.rome!.policies);
    // The scene at home is due some weeks on, and its own scene fits then.
    const scene = issued.conference!.scene!;
    expect(scene.kind).toBe('cascade');
    expect(scene.dueWeek - s.clock.week).toBeGreaterThanOrEqual(CONFERENCE.cascadeAfter[0]);
    expect(scene.dueWeek - s.clock.week).toBeLessThanOrEqual(CONFERENCE.cascadeAfter[1]);
    expect(dueConferenceScene(issued)).toBeNull();
    const due = { ...issued, clock: { ...issued.clock, week: scene.dueWeek } };
    expect(dueConferenceScene(due)).toBe('cascade');
    expect(evaluateAll([{ type: 'conference', key: 'document', value: def.id, within: 12, implemented: false }], due)).toBe(true);
    expect(fits('cf_home_any', due)).toBe(true);
    const own = eventById(`cf_home_${{ economy_pastoral: 'economy', immigration_statement: 'immigration', racism_pastoral: 'racism', translation_guidelines: 'translation', voting_guide: 'voting_guide', religious_liberty_statement: 'liberty', safeguarding_norms: 'safeguarding', eucharist_pastoral: 'eucharist', family_pastoral: 'family', synod_guidelines: 'synod', creation_statement: 'creation', women_statement: 'women', reverence_guidelines: 'reverence' }[def.id]}`)!;
    expect(own).toBeDefined();
    expect(fits(own.id, due)).toBe(true);
    expect((own.priority ?? 0) > (eventById('cf_home_any')!.priority ?? 0)).toBe(true);
    expect(renderText('{conference_doc}, {conference_doc_gist}', due, {})).toBe(`${def.title}, ${def.gist}`);
    // Not again inside its years.
    const later = { ...issued, clock: { ...issued.clock, week: issued.clock.week + 52 } };
    expect(openDocuments(later).some((d) => d.id === def.id)).toBe(false);
    expect(openDocuments({ ...later, clock: { ...later.clock, week: later.clock.week + 52 * def.years } }).some((d) => d.id === def.id)).toBe(true);
  });

  it('every document has a scene at home that records what he did with it on the document\'s own axis', () => {
    const ids: Record<string, string> = { economy_pastoral: 'cf_home_economy', immigration_statement: 'cf_home_immigration', racism_pastoral: 'cf_home_racism', translation_guidelines: 'cf_home_translation', voting_guide: 'cf_home_voting_guide', religious_liberty_statement: 'cf_home_liberty', safeguarding_norms: 'cf_home_safeguarding', eucharist_pastoral: 'cf_home_eucharist', family_pastoral: 'cf_home_family', synod_guidelines: 'cf_home_synod', creation_statement: 'cf_home_creation', women_statement: 'cf_home_women', reverence_guidelines: 'cf_home_reverence' };
    for (const def of conferenceDocuments) {
      const e = eventById(ids[def.id]!)!;
      expect(e, def.id).toBeDefined();
      expect(e.beat).toBe('conference');
      for (const c of e.choices) expect(c.effects.some((f) => f.target === 'document' && f.key === `conference:${def.topic}`), `${e.id}/${c.id}`).toBe(true);
    }
    // The voting guide only in a presidential year.
    const s = priestAt('guide', 24);
    const year = dateOf(s.clock).year;
    expect(openDocuments(s).some((d) => d.id === 'voting_guide')).toBe(year % 4 === 0);
  });

  it('the conference leans the way its temper reads: a traditional conference issues the liberty statement, a reforming one the immigration statement', () => {
    const tally = (temper: number) => {
      const s0 = priestAt('lean', 46);
      const s = { ...s0, conference: { ...s0.conference!, temper } };
      const out: Record<string, number> = {};
      for (let i = 0; i < 300; i++) { const d = latestConferenceDocument(conferenceWeek(s, createRng(`lean:${temper}:${i}`)).state); if (d) out[d.doc.value!] = (out[d.doc.value!] ?? 0) + 1; }
      return out;
    };
    const trad = tally(-80);
    const prog = tally(80);
    expect(trad.religious_liberty_statement ?? 0).toBeGreaterThan(prog.religious_liberty_statement ?? 0);
    expect(prog.immigration_statement ?? 0).toBeGreaterThan(trad.immigration_statement ?? 0);
  });

  it('the conference survives a save, and a save without one gets one on the first week', () => {
    const { state: s } = assemblyWithDocument(priestAt('save', 24));
    const back = deserialize(serialize(buildSave(s, createRng(s.seed), null, {})));
    expect(back.state.conference).toEqual(s.conference);
    expect(latestConferenceDocument(back.state)!.doc).toEqual(latestConferenceDocument(s)!.doc);
    const bare = { ...s };
    delete (bare as { conference?: unknown }).conference;
    const first = conferenceWeek({ ...bare, clock: { ...bare.clock, week: bare.clock.week + 1 } }, createRng('first'));
    expect(first.state.conference).toBeDefined();
    expect(first.state.conference!.president.name).toBe(s.conference!.president.name);
    expect(first.state.conference!.remainder).toBe(s.conference!.remainder);
  });
});

describe('E2 R1.2: the assembly as a bishop, and the offices', () => {
  it('a bishop is in the room: the flag opens the assembly scenes, a document this week is his vote, and none is the corridor', () => {
    const b0 = bishopAt('room', { yearWeek: 24 });
    const r = conferenceWeek(b0, createRng('room'));
    expect(r.state.flags['conference:assembly']).toBe(b0.clock.week);
    expect(r.lines[0]).toMatch(/you are in the room/);
    expect(r.letters).toHaveLength(0);
    expect(dueConferenceScene(r.state)).toBe('assembly');
    const doc = latestConferenceDocument(r.state);
    if (doc) {
      expect(fits('cf_as_vote_any', r.state)).toBe(true);
      expect(fits('cf_as_floor', r.state)).toBe(false);
      expect(doc.doc.norm).toBeUndefined();
    } else {
      expect(fits('cf_as_floor', r.state)).toBe(true);
      expect(fits('cf_as_nuncio_corridor', r.state)).toBe(true);
      expect(fits('cf_as_vote_any', r.state)).toBe(false);
    }
    // Both happen across seeds.
    let voted = 0;
    for (let i = 0; i < 20; i++) if (latestConferenceDocument(conferenceWeek(b0, createRng(`v${i}`)).state)) voted++;
    expect(voted).toBeGreaterThan(2);
    expect(voted).toBeLessThan(18);
    // June is never an election; the committee is the first rung after two years in the chair.
    expect(isElectionAssembly(b0)).toBe(false);
    expect(nextOffice(b0)).toBe('committee');
    expect(nextOffice({ ...b0, see: { ...b0.see!, installedWeek: b0.clock.week - 52 } })).toBeNull();
    expect(fits('cf_as_stand_committee', r.state)).toBe(false);
  });

  it('the election: he is asked to stand, the ballots run the week after on the ballot engine, deterministic, and standing decides it', () => {
    const b0 = bishopAt('ballot', { election: true });
    expect(isElectionAssembly(b0)).toBe(true);
    const r = conferenceWeek(b0, createRng('e'));
    expect(r.state.flags['conference:election']).toBe(b0.clock.week);
    expect(dueConferenceScene(r.state)).toBe('election');
    expect(fits('cf_as_stand_committee', r.state)).toBe(true);
    expect(fits('cf_as_stand_chair', r.state)).toBe(false);
    expect(renderText('{conference_office}', r.state, {})).toBe('a seat on a committee');
    // The officers turned: the vice-president is president now.
    expect(r.state.conference!.president.name).toBe(b0.conference!.vicePresident.name);
    expect(r.state.conference!.president.sinceWeek).toBe(b0.clock.week);
    expect(r.lines.some((l) => /is elected president of the bishops' conference/.test(l))).toBe(true);
    expect(evaluateAll([{ type: 'conference', key: 'president', value: 'new' }], r.state)).toBe(true);
    // He stands.
    const stood = { ...r.state, flags: { ...r.state.flags, 'conference:stand': 'committee' }, clock: { ...r.state.clock, week: r.state.clock.week + 1 } };
    const strong = { ...stood, character: { ...stood.character!, reputation: { ...stood.character!.reputation, rome: 90 } }, see: { ...stood.see!, rome: 80 }, npcs: Object.fromEntries(Object.entries(stood.npcs).map(([id, n]) => [id, n.tags.includes('province_bishop') ? { ...n, relationship: 70 } : n])) };
    const weak = { ...stood, character: { ...stood.character!, reputation: { ...stood.character!.reputation, rome: -60 }, alignment: stood.conference!.temper >= 0 ? -95 : 95 }, see: { ...stood.see!, rome: -60 }, npcs: Object.fromEntries(Object.entries(stood.npcs).map(([id, n]) => [id, n.tags.includes('province_bishop') ? { ...n, relationship: -50 } : n])) };
    expect(playerStanding(strong)).toBeGreaterThan(playerStanding(weak) + 15);
    const won = conferenceWeek(strong, createRng('w'));
    const lost = conferenceWeek(weak, createRng('l'));
    expect(conferenceWeek(strong, createRng('other')).state.conference!.elections).toEqual(won.state.conference!.elections);
    const e = won.state.conference!.elections![0]!;
    expect(e.office).toBe('committee');
    expect(e.stood).toBe(true);
    expect(e.won).toBe(true);
    expect(Object.keys(e.tallies)).toContain(`Bishop ${strong.character!.name.last}`);
    expect(won.state.conference!.held).toEqual({ office: 'committee', sinceWeek: stood.clock.week, endWeek: stood.clock.week + CONFERENCE.termYears * 52 });
    expect(won.state.flags['conference:office']).toBe('committee');
    expect(won.state.flags['conference:stand']).toBeUndefined();
    expect(won.state.flags['conference:result']).toBe('won');
    expect(won.letters[0]!.title).toBe('The conference: a seat on a committee');
    expect(won.letters[0]!.rows!.length).toBeGreaterThanOrEqual(3);
    expect(won.state.career.at(-1)!.kind).toBe('promotion');
    expect(dueConferenceScene(won.state)).toBe('result');
    expect(fits('cf_as_won', won.state)).toBe(true);
    expect(fits('cf_as_lost', won.state)).toBe(false);
    expect(fits('cf_as_committee_work', won.state)).toBe(true);
    expect(conferenceWord(won.state).good[0]).toMatch(/committee/);
    const l = lost.state.conference!.elections![0]!;
    expect(l.won).toBe(false);
    expect(l.stood).toBe(true);
    expect(lost.state.conference!.held).toBeUndefined();
    expect(lost.state.flags['conference:result']).toBe('lost');
    expect(fits('cf_as_lost', lost.state)).toBe(true);
    expect(renderText('{conference_winner}', lost.state, {})).toBe(l.winnerName);
    // The office earns its keep and ends on its week; the next rung waits.
    const year = conferenceYear(won.state, createRng('y'));
    expect(year.state.see!.rome).toBe(won.state.see!.rome + CONFERENCE.rome.committee);
    const over = conferenceWeek({ ...won.state, clock: { ...won.state.clock, week: won.state.conference!.held!.endWeek + 1 } }, createRng('over'));
    expect(over.state.conference!.held).toBeUndefined();
    expect(over.state.conference!.past).toHaveLength(1);
    expect(over.state.flags['conference:office']).toBeUndefined();
    expect(nextOffice(over.state)).toBe('chair');
  });

  it('the ladder to the presidency: each rung follows the last, the president is the man Rome reads for the red hat, and the ballots are table-stable', () => {
    const b0 = bishopAt('ladder', { election: true, years: 12 });
    const ladder = CONFERENCE.ladder;
    const past = ladder.slice(0, 4).map((office, i) => ({ office, sinceWeek: b0.clock.week - 52 * 3 * (5 - i), endWeek: b0.clock.week - 52 * 3 * (4 - i) }));
    const seasoned = { ...b0, conference: { ...b0.conference!, past } };
    expect(nextOffice(seasoned)).toBe('president');
    expect(fits('cf_as_stand_president', { ...conferenceWeek(seasoned, createRng('p')).state })).toBe(true);
    const stood = { ...seasoned, flags: { ...seasoned.flags, 'conference:stand': 'president' }, clock: { ...seasoned.clock, week: seasoned.clock.week + 1 }, character: { ...seasoned.character!, reputation: { ...seasoned.character!.reputation, rome: 90 }, alignment: seasoned.conference!.temper }, see: { ...seasoned.see!, rome: 90 } };
    const r = conferenceWeek(stood, createRng('pres'));
    const e = r.state.conference!.elections![0]!;
    expect(e.office).toBe('president');
    if (e.won) {
      expect(r.state.conference!.president.npcId).toBe('player');
      expect(fits('cf_as_president_speaks', r.state)).toBe(true);
      const pope = r.state.rome!.popes[r.state.rome!.popes.length - 1]!;
      expect(redHatChance(r.state, pope)).toBeGreaterThan(redHatChance({ ...r.state, conference: { ...r.state.conference!, held: undefined as never } }, pope));
    }
    // The rungs are harder as they rise: a man of fixed standing wins the low ones more often than the high across seeds.
    const wins = (office: ConferenceOffice) => { let n = 0; for (let i = 0; i < 24; i++) if (electionFor({ ...stood, seed: `w${i}`, conference: { ...stood.conference!, past: [] }, character: { ...stood.character!, reputation: { ...stood.character!.reputation, rome: 30 } }, see: { ...stood.see!, rome: 20 } }, office, true).won) n++; return n; };
    expect(wins('committee')).toBeGreaterThan(wins('president'));
    // Table: the same electorate and seed give the same ballots.
    const a = electionFor(stood, 'president', true);
    const b = electionFor({ ...stood }, 'president', true);
    expect(a).toEqual(b);
    expect(a.rounds).toBeGreaterThanOrEqual(1);
    // Watched from the floor: no stand, no candidacy, a winner anyway.
    const watched = electionFor(stood, 'president', false);
    expect(watched.stood).toBe(false);
    expect(watched.won).toBe(false);
    expect(Object.keys(watched.tallies)).not.toContain(`Bishop ${stood.character!.name.last}`);
  });
});
