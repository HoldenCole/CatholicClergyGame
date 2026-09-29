import type { ConferenceDocumentDef, ConferenceElection, ConferenceOffice, ConferenceOfficer, ConferenceSceneKind, GameState, IssuedDocument, Letter } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { dateOf, sundayOf } from '@/engine/time';
import { conferenceDocument, conferenceDocuments } from '@/content/conference';
import { CLERGY_HERITAGE, rollHeritage, rollMaleName } from '@/generation/names';
import { clampSigned } from './reputation';
import { readerOf, rollNorm } from './rome/policy';
import { reigning } from './rome/papacy';
import { provinceBishops, provinceWord } from './metropolitan';
import { runElection, type Elector } from './ballot';
import { SUCCESSION } from './succession';

/**
 * E2 R1.2 — the national conference of bishops (§2.3). A temper aggregated
 * from the bishops the game knows and a rolled national remainder that
 * drifts toward Rome's a third as fast as a bishop does; two assemblies a
 * year that now and then issue a document (content/conference/documents.json),
 * which comes to a priest as his bishop's letter and, weeks later, a scene at
 * home, and to a player-bishop as a vote; a president and vice-president on
 * three-year terms; and, for a player-bishop, an elected ladder on the ballot
 * engine (rule 10). The cadence and the terms are custom to verify against
 * the current statutes; every number is invented and flagged.
 */
export const CONFERENCE = {
  /** June and November. */
  assemblyWeeks: [24, 46] as readonly number[],
  /** Weeks a bishop's assembly scene stays open. */
  assemblyOpen: 3,
  /** The chance an assembly issues a document, before the fit of the temper to it. */
  documentChance: 0.4,
  /** How much of the temper the bishops the game knows are; the rest is the remainder. */
  knownShare: 0.35,
  remainderSpread: 20,
  /** The remainder closes on the pope's reading at Rome's rate over this. */
  driftDivisor: 3,
  /** Each bishop the nuncio names in a year moves the remainder a point toward his temper, to this many. */
  appointmentNudge: 1,
  appointmentsCap: 3,
  /** Weeks from the letter to the scene at home. */
  cascadeAfter: [3, 10] as [number, number],
  /** Officers are elected at the November assembly of years divisible by three (2016, 2019, …; verify). */
  electionYearMod: 0,
  termYears: 3,
  ladder: ['committee', 'chair', 'secretary', 'vice_president', 'president'] as readonly ConferenceOffice[],
  /** Years in a chair before the conference seats him on a committee. */
  seeYearsForCommittee: 2,
  /** The electorate the game does not know, and the men it does not know who stand. */
  electors: 14,
  rivals: 2,
  /** A rival's standing at each rung; the player's is his record (playerStanding). */
  rivalStanding: { committee: 7, chair: 10, secretary: 13, vice_president: 16, president: 19 } as Record<ConferenceOffice, number>,
  /** The most an elector adds for a man who reads as he does. */
  closeness: 12,
  /** The nuncio's reading: a man this far from the conference's temper costs this much; a seat at the conference is worth this. */
  nuncioGap: 45,
  nuncioGapCost: 6,
  officeWord: 3,
  /** What an office does to Rome's regard for his see, a year. */
  rome: { committee: 1, chair: 1, secretary: 2, vice_president: 3, president: 4 } as Record<ConferenceOffice, number>,
} as const;

export const OFFICE_LABEL: Record<ConferenceOffice, string> = {
  committee: 'a seat on a committee',
  chair: 'the chair of a committee',
  secretary: 'the secretary',
  vice_president: 'the vice-president',
  president: 'the president',
};

function clamp(n: number): number {
  return clampSigned(Math.round(n));
}

export function temperWord(t: number): string {
  if (t <= -40) return 'traditional, and says so';
  if (t <= -15) return 'leaning to the tradition';
  if (t < 15) return 'divided down the middle';
  if (t < 40) return 'leaning to reform';
  return 'reforming, and says so';
}

function calendarYear(state: GameState): number {
  return dateOf(state.clock).year;
}

function rollOfficer(rng: Rng, temper: number, week: number): ConferenceOfficer {
  const name = rollMaleName(rng, rollHeritage(rng, CLERGY_HERITAGE), 'older');
  const title = rng.chance(0.6) ? 'Archbishop' : 'Bishop';
  return { name: `${title} ${name.last}`, alignment: clamp(temper + rng.gaussian() * 15), sinceWeek: week - rng.int(0, CONFERENCE.termYears * 52) };
}

/** The bishops the game knows: the province's, the home see's, and the man himself when he holds a chair. */
function knownReadings(state: GameState): number[] {
  const out = provinceBishops(state).map((b) => b.alignment);
  if (state.see && state.character) out.push(state.character.alignment);
  return out;
}

export function conferenceTemper(state: GameState, remainder: number): number {
  const known = knownReadings(state);
  if (!known.length) return clamp(remainder);
  const mean = known.reduce((n, a) => n + a, 0) / known.length;
  return clamp(CONFERENCE.knownShare * mean + (1 - CONFERENCE.knownShare) * remainder);
}

/** The conference on first sight: the remainder rolled around Rome's temper, and the officers of the day. */
export function ensureConference(state: GameState): GameState {
  if (state.conference || !state.world) return state;
  const rng = createRng(`${state.seed}:conference`);
  const remainder = clamp(state.romeTemperament + rng.gaussian() * CONFERENCE.remainderSpread);
  const week = state.clock.week;
  const temper = conferenceTemper(state, remainder);
  const president = rollOfficer(rng.derive('president'), temper, week);
  const vicePresident = rollOfficer(rng.derive('vp'), temper, week);
  return { ...state, conference: { temper, remainder, president, vicePresident, assemblies: [] } };
}

export function isAssemblyWeek(state: GameState): boolean {
  return CONFERENCE.assemblyWeeks.includes(state.clock.week % 52);
}

export function isElectionAssembly(state: GameState): boolean {
  return state.clock.week % 52 === CONFERENCE.assemblyWeeks[1] && calendarYear(state) % 3 === CONFERENCE.electionYearMod;
}

/** The latest document the conference issued in his lifetime, if any. */
export function latestConferenceDocument(state: GameState): { doc: IssuedDocument; index: number } | null {
  const issued = state.rome?.issued ?? [];
  for (let i = issued.length - 1; i >= 0; i--) if (issued[i]!.source === 'conference') return { doc: issued[i]!, index: i };
  return null;
}

function issuedWithin(state: GameState, id: string, years: number): boolean {
  const at = state.conference?.assemblies.find((a) => a.docId === id);
  const last = [...(state.conference?.assemblies ?? [])].reverse().find((a) => a.docId === id);
  return !!(at && last) && state.clock.week - last.week < years * 52;
}

/** The documents the assembly may issue now. */
export function openDocuments(state: GameState): ConferenceDocumentDef[] {
  const presidential = calendarYear(state) % 4 === 0;
  return conferenceDocuments.filter((d) => (!d.electionYear || presidential) && !issuedWithin(state, d.id, d.years));
}

const NORM_LINE: Record<string, string> = {
  enthusiastic: '{bishop} writes that he voted for it, and means to see it kept.',
  faithful: '{bishop} sends it with a covering note and a date.',
  minimal: '{bishop} sends it with a note that says the diocese will do what it must, which is not the same as what it asks.',
  slow: '{bishop} sends it without a covering note, which is a note.',
};

/**
 * Issue a conference document into the man's world: into the record beside
 * Rome's, with `source`, on an axis of its own that moves no law. A priest
 * has his bishop's letter with the bishop's reading, and the scene at home
 * some weeks on; a bishop was in the room, and the assembly's scene is his.
 */
export function issueConferenceDocument(state: GameState, def: ConferenceDocumentDef, rng: Rng): { state: GameState; line: string; letter: Letter | null } {
  const week = state.clock.week;
  const axis = `conference:${def.topic}`;
  const reader = readerOf(state, axis);
  const read = reader ? { norm: rollNorm(state.seed, `conf:${def.id}:${week}`, reader.id, reader.alignment, def.lean), bishopId: reader.id } : {};
  const doc: IssuedDocument = { id: `conf:${def.id}:${week}`, kind: def.kind, title: def.title, gist: def.gist, day: sundayOf(state.clock), week, popeId: 'conference', source: 'conference', axis, value: def.id, ...read };
  const rome = state.rome ?? { popes: [] };
  const issued = [...(rome.issued ?? []), doc];
  const c = state.conference!;
  let next: GameState = {
    ...state,
    rome: { ...rome, issued },
    conference: { ...c, assemblies: c.assemblies.map((a) => (a.week === week ? { ...a, docId: def.id } : a)) },
    career: [...state.career, { week, kind: 'note', text: `The conference issued ${def.line}.` }],
  };
  const line = `From the conference: ${def.title}, ${def.gist}.`;
  if (state.see || !reader) return { state: next, line, letter: null };
  const bishop = state.npcs[reader.id];
  const who = bishop ? `${bishop.title} ${bishop.name.last}` : 'The bishop';
  const letter: Letter = {
    sort: 'bishop',
    title: `From the conference: ${def.title}`,
    body: [...def.letter, `What it asks of the parish: ${def.change}`, (NORM_LINE[doc.norm ?? 'faithful'] ?? NORM_LINE.faithful!).replace('{bishop}', who)],
    week,
  };
  next = { ...next, conference: { ...next.conference!, scene: { kind: 'cascade', dueWeek: week + rng.int(CONFERENCE.cascadeAfter[0], CONFERENCE.cascadeAfter[1]), docIndex: issued.length - 1 } } };
  return { state: next, line, letter };
}

/** The rung the man may stand for at the next election, if any. */
export function nextOffice(state: GameState): ConferenceOffice | null {
  const c = state.conference;
  if (!state.see || !c || c.held) return null;
  if ((state.clock.week - state.see.installedWeek) / 52 < CONFERENCE.seeYearsForCommittee) return null;
  const highest = Math.max(-1, ...(c.past ?? []).map((h) => CONFERENCE.ladder.indexOf(h.office)));
  return CONFERENCE.ladder[highest + 1] ?? null;
}

/** What the conference's electors know of him: Rome's regard, the years in the chair, the offices held, his own see's standing with Rome, the province's word. */
export function playerStanding(state: GameState): number {
  const c = state.character!;
  const years = state.see ? (state.clock.week - state.see.installedWeek) / 52 : 0;
  const past = state.conference?.past?.length ?? 0;
  return (c.reputation.rome ?? 0) / 10 + Math.min(10, years) + past * 3 + (state.see?.rome ?? 0) / 20 + provinceWord(state).value;
}

interface Rival { id: string; name: string; alignment: number; standing: number }

function rollRivals(rng: Rng, office: ConferenceOffice, temper: number): Rival[] {
  const out: Rival[] = [];
  for (let i = 0; i < CONFERENCE.rivals; i++) {
    const name = rollMaleName(rng, rollHeritage(rng, CLERGY_HERITAGE), 'older');
    out.push({ id: `rival:${i}`, name: `${rng.chance(0.5) ? 'Archbishop' : 'Bishop'} ${name.last}`, alignment: clamp(temper + rng.gaussian() * 25), standing: CONFERENCE.rivalStanding[office] + rng.int(-3, 3) });
  }
  return out;
}

function closeness(a: number, b: number): number {
  return CONFERENCE.closeness * (1 - Math.abs(a - b) / 100);
}

/**
 * The election for an office, deterministic in the seed, the week, the
 * electorate the game knows (the province's bishops, who know him), and
 * the one it rolls. The player stands against rolled men of the rung's
 * standing; every elector scores every candidate on standing and on how
 * the man reads beside him, and the ballots run in systems/ballot.ts.
 */
export function electionFor(state: GameState, office: ConferenceOffice, stood: boolean): ConferenceElection {
  const week = state.clock.week;
  const c = state.conference!;
  const rng = createRng(`${state.seed}:conference:${office}:${week}`);
  const rivals = rollRivals(rng.derive('rivals'), office, c.temper);
  const standing = playerStanding(state);
  const me = state.character!;
  const candidates: { id: string; alignment: number; standing: number }[] = [...rivals, ...(stood ? [{ id: 'player', alignment: me.alignment, standing }] : [])];
  const electors: Elector[] = [];
  for (const b of provinceBishops(state)) {
    const scores: Record<string, number> = {};
    for (const x of candidates) scores[x.id] = x.standing + closeness(b.alignment, x.alignment) + (x.id === 'player' ? b.relationship / 8 : 0);
    electors.push({ id: b.id, scores });
  }
  const gen = rng.derive('electors');
  for (let i = 0; i < CONFERENCE.electors; i++) {
    const align = clamp(c.temper + gen.gaussian() * 30);
    const scores: Record<string, number> = {};
    for (const x of candidates) scores[x.id] = x.standing + closeness(align, x.alignment) + gen.gaussian() * 2;
    electors.push({ id: `elector:${i}`, scores });
  }
  const result = runElection(rng.derive('ballots'), electors, candidates.map((x) => x.id));
  const last = result.rounds[result.rounds.length - 1]!;
  const nameOf = (id: string) => (id === 'player' ? `Bishop ${me.name.last}` : rivals.find((r) => r.id === id)?.name ?? id);
  const tallies: Record<string, number> = {};
  for (const [id, n] of Object.entries(last.tallies)) tallies[nameOf(id)] = n;
  return { week, office, winner: result.electedId, winnerName: nameOf(result.electedId), stood, won: result.electedId === 'player', rounds: result.rounds.length, ended: result.ended, tallies };
}

/** Hold the election he stood in (or watched): the office, the record, the letter, and the scene of the result. */
export function holdElection(state: GameState, office: ConferenceOffice, stood: boolean): { state: GameState; election: ConferenceElection; letter: Letter | null; line: string } {
  const week = state.clock.week;
  const e = electionFor(state, office, stood);
  const c = state.conference!;
  let next: GameState = { ...state, conference: { ...c, elections: [...(c.elections ?? []), e] } };
  const label = OFFICE_LABEL[office];
  if (e.won) {
    const held = { office, sinceWeek: week, endWeek: week + CONFERENCE.termYears * 52 };
    const me = state.character!;
    const officer: ConferenceOfficer = { name: `Bishop ${me.name.last}`, alignment: me.alignment, sinceWeek: week, npcId: 'player' };
    next = {
      ...next,
      conference: { ...next.conference!, held, ...(office === 'president' ? { president: officer } : office === 'vice_president' ? { vicePresident: officer } : {}) },
      flags: { ...next.flags, 'conference:office': office, 'conference:result': 'won' },
      career: [...next.career, { week, kind: 'promotion', text: `Elected ${label} of the bishops' conference, on the ${ordinal(e.rounds)} ballot.` }],
    };
  } else {
    next = { ...next, flags: { ...next.flags, 'conference:result': stood ? 'lost' : 'watched' }, career: stood ? [...next.career, { week, kind: 'passed_over', text: `Stood for ${label} of the bishops' conference; ${e.winnerName} was elected on the ${ordinal(e.rounds)} ballot.` }] : next.career };
  }
  next = { ...next, conference: { ...next.conference!, scene: { kind: 'result', dueWeek: week } } };
  const rows = Object.entries(e.tallies).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ label: name, value: `${n}` }));
  const letter: Letter | null = stood ? { sort: 'bishop', title: `The conference: ${label}`, body: [e.won ? `The ballots for ${label} went ${e.rounds === 1 ? 'one round' : `${e.rounds} rounds`}, and the last of them to you.` : `The ballots for ${label} went ${e.rounds === 1 ? 'one round' : `${e.rounds} rounds`}, and the last of them to ${e.winnerName}.`, e.ended === 'plurality' ? 'It ended on a plurality, which the statutes allow and the losers remember.' : e.ended === 'narrowed' ? 'The field narrowed to two before it was decided.' : 'A clear majority.'], rows, week } : null;
  const line = e.won ? `Elected ${label} of the conference.` : stood ? `${e.winnerName} is elected ${label} of the conference; you were not.` : `${e.winnerName} is elected ${label} of the conference.`;
  return { state: next, election: e, letter, line };
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`;
}

/** The officers' terms at an election assembly: the vice-president succeeds (the custom; verify), a new vice-president is rolled around the temper. */
function officersTurn(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const c = state.conference!;
  const week = state.clock.week;
  const lines: string[] = [];
  let conference = c;
  if (c.president.npcId === 'player' || c.vicePresident.npcId === 'player') return { state, lines };
  const president: ConferenceOfficer = { ...c.vicePresident, sinceWeek: week };
  const vicePresident = rollOfficer(rng, c.temper, week);
  conference = { ...conference, president, vicePresident: { ...vicePresident, sinceWeek: week } };
  lines.push(`${president.name} is elected president of the bishops' conference, and ${vicePresident.name} vice-president.`);
  return { state: { ...state, conference }, lines };
}

export interface ConferenceWeek { state: GameState; lines: string[]; letters: Letter[] }

/**
 * The week: a stand from last week's assembly is voted on; an assembly week
 * sends the bishop away (a priest) or brings him into the room (a bishop),
 * may issue a document, and at the November of an election year elects.
 */
export function conferenceWeek(state: GameState, rng: Rng): ConferenceWeek {
  const lines: string[] = [];
  const letters: Letter[] = [];
  if (!state.world) return { state, lines, letters };
  let next = ensureConference(state);
  const week = next.clock.week;
  // He let his name stand last week: the ballots.
  const stand = next.flags['conference:stand'];
  if (typeof stand === 'string' && next.see) {
    const flags = { ...next.flags };
    delete flags['conference:stand'];
    const held = holdElection({ ...next, flags }, stand as ConferenceOffice, true);
    next = held.state;
    lines.push(held.line);
    if (held.letter) letters.push(held.letter);
  }
  // A term that has run out.
  const c = next.conference!;
  if (c.held && week >= c.held.endWeek) {
    const flags = { ...next.flags };
    delete flags['conference:office'];
    const { held: _h, ...rest } = c;
    next = { ...next, flags, conference: { ...rest, past: [...(c.past ?? []), c.held] }, career: [...next.career, { week, kind: 'note', text: `The term as ${OFFICE_LABEL[c.held.office]} of the conference ended.` }] };
    lines.push(`Your term as ${OFFICE_LABEL[c.held.office]} of the conference is over; the floor again.`);
  }
  if (!isAssemblyWeek(next) || next.conference!.lastAssemblyWeek === week) return { state: next, lines, letters };
  next = { ...next, conference: { ...next.conference!, lastAssemblyWeek: week, assemblies: [...next.conference!.assemblies, { week }] } };
  const election = isElectionAssembly(next);
  if (next.see) {
    next = { ...next, flags: { ...next.flags, 'conference:assembly': week } };
    lines.push(`The bishops' conference meets this week, and you are in the room.`);
  } else {
    lines.push(`The bishop is away at the conference's assembly this week; the vicar general signs the mail.`);
  }
  // A document, now and then.
  if (rng.chance(CONFERENCE.documentChance)) {
    const open = openDocuments(next);
    if (open.length) {
      const temper = next.conference!.temper;
      const def = rng.weighted(open, (d) => Math.max(0.05, 1 + d.lean * (temper / 100) * 2));
      const issued = issueConferenceDocument(next, def, rng.derive('cascade'));
      next = issued.state;
      lines.push(issued.line);
      if (issued.letter) letters.push(issued.letter);
    }
  }
  if (election) {
    const office = nextOffice(next);
    if (office) {
      next = { ...next, flags: { ...next.flags, 'conference:election': week }, conference: { ...next.conference!, scene: { kind: 'election', dueWeek: week } } };
    } else if (next.see && next.conference!.held && ['president', 'vice_president'].includes(next.conference!.held.office)) {
      // His own term as an officer ends with the election.
      const h = next.conference!.held;
      next = { ...next, conference: { ...next.conference!, held: { ...h, endWeek: week } } };
    }
    const turned = officersTurn(next, rng.derive('officers'));
    next = turned.state;
    lines.push(...turned.lines);
    if (!office && next.see) next = { ...next, conference: { ...next.conference!, scene: { kind: 'assembly', dueWeek: week } } };
  } else if (next.see) {
    next = { ...next, conference: { ...next.conference!, scene: { kind: 'assembly', dueWeek: week } } };
  }
  return { state: next, lines, letters };
}

/** The year: the remainder drifts toward the pope's reading, the nuncio's appointments move it, the temper is read again, and an office earns its keep. */
export function conferenceYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (!state.world) return { state, lines: [] };
  let next = ensureConference(state);
  const c = next.conference!;
  const pope = reigning(next);
  let remainder = c.remainder;
  if (pope) remainder += (pope.temperament - remainder) * (SUCCESSION.romeTowardPope / CONFERENCE.driftDivisor);
  remainder += rng.int(-2, 2);
  const nuncio = next.rome?.nuncio;
  if (nuncio) {
    const named = (next.rome?.ternas ?? []).filter((t) => t.done && next.clock.week - t.nameWeek < 52).length;
    remainder += Math.min(CONFERENCE.appointmentsCap, named) * CONFERENCE.appointmentNudge * Math.sign(nuncio.temperament - remainder);
  }
  remainder = clamp(remainder);
  next = { ...next, conference: { ...c, remainder, temper: conferenceTemper(next, remainder) } };
  if (next.see && c.held) next = { ...next, see: { ...next.see, rome: clamp(next.see.rome + CONFERENCE.rome[c.held.office]) } };
  return { state: next, lines: [] };
}

/** The conference's word in the nuncio's reading: a man far from its temper is a harder appointment; a seat at it is a name. */
export function conferenceWord(state: GameState): { value: number; good: string[]; bad: string[] } {
  const c = state.conference;
  const me = state.character;
  if (!c || !me) return { value: 0, good: [], bad: [] };
  const good: string[] = [];
  const bad: string[] = [];
  let v = 0;
  if (Math.abs(me.alignment - c.temper) >= CONFERENCE.nuncioGap) { v -= CONFERENCE.nuncioGapCost; bad.push("a reading far from the conference's"); }
  if (c.held) { v += CONFERENCE.officeWord; good.push(`${OFFICE_LABEL[c.held.office]} of the conference`); }
  return { value: v, good, bad };
}

export function dueConferenceScene(state: GameState): ConferenceSceneKind | null {
  const s = state.conference?.scene;
  return s && state.clock.week >= s.dueWeek ? s.kind : null;
}

export function closeConferenceScene(state: GameState): GameState {
  if (!state.conference?.scene) return state;
  const { scene: _s, ...c } = state.conference;
  return { ...state, conference: c };
}

/** {conference_president}, {conference_doc}, {conference_doc_gist}, {conference_office}, {conference_winner}, {conference_temper}. */
export function conferenceTokens(state: GameState): Record<string, string> {
  const c = state.conference;
  if (!c) return {};
  const latest = latestConferenceDocument(state);
  const def = latest ? conferenceDocument(latest.doc.value ?? '') : undefined;
  const last = c.elections?.[c.elections.length - 1];
  const office = c.held?.office ?? (typeof state.flags['conference:stand'] === 'string' ? (state.flags['conference:stand'] as ConferenceOffice) : nextOffice(state));
  return {
    conference_president: c.president.name,
    conference_doc: def?.title ?? latest?.doc.title ?? 'the document',
    conference_doc_gist: def?.gist ?? latest?.doc.gist ?? 'its subject',
    conference_office: office ? OFFICE_LABEL[office] : 'an office',
    conference_winner: last?.winnerName ?? c.president.name,
    conference_temper: temperWord(c.temper),
  };
}
