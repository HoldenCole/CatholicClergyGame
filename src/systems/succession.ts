import type { GameState, Letter, LiturgicalPolicy, LiturgicalTopic, Npc } from '@/types';
import { LITURGICAL_TOPICS } from '@/types';
import { clubDef } from '@/content/clubs';
import { clubsOf } from './clubs';
import { TOPIC_LABEL } from './decor';
import { prioritiesLine } from '@/generation/diocese';
import type { Rng } from '@/engine/rng';
import { generateBishop, temperamentLine } from '@/generation/bishop';
import { presetById } from '@/content/dioceses';
import { clampSigned } from './reputation';

/** Invented. DESIGN 5.3 and 9.3. */
export const SUCCESSION = {
  retirementAge: 75,
  /** Chance per year past 75 that Rome accepts the letter. */
  acceptancePerYear: 0.35,
  deathPerYearOver70: 0.025,
  /** Rome's temperament drifts a little each year and swings with a conclave now and then. */
  romeDriftStep: 5,
  conclavePerYear: 0.07,
  /** How much of chancery standing survives a succession before revaluation. */
  chanceryCarry: 0.5,
} as const;

export interface SuccessionResult {
  state: GameState;
  newBishop: Npc | null;
  /** Prose for the digest and the career record. */
  lines: string[];
  /** The letter that makes it a turn. */
  letter?: Letter;
}

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/** Rome's temperament: a drifting number the successor rolls around. */
export function driftRome(state: GameState, rng: Rng): GameState {
  let t = state.romeTemperament + rng.int(-SUCCESSION.romeDriftStep, SUCCESSION.romeDriftStep);
  if (rng.chance(SUCCESSION.conclavePerYear)) t = Math.round(rng.gaussian() * 40);
  return { ...state, romeTemperament: clampSigned(t) };
}

/**
 * Every chancery relationship is revalued and every public statement
 * re-read against a new standard. The loud man who was the last bishop's
 * favorite becomes the new bishop's problem; the exile is called back.
 */
/** How a bishop reads the circles a man belongs to: the ones the offers set as flags. */
const AFFILIATION_LEAN: Record<string, number> = { 'affiliation:trad_fraternity': -1, 'affiliation:prog_caucus': 1, 'affiliation:opus_dei': -0.5, 'affiliation:cursillo': 0.2, 'affiliation:diocesan_fraternity': 0 };

export interface Reread {
  /** Clubs and affiliations the new bishop reads, with the sign of his reading. */
  circles: { label: string; agrees: boolean }[];
  /** Stands taken aloud that sit with him, and against him. */
  withHim: number;
  againstHim: number;
  /** Permissions the old bishop granted that this one does not allow. */
  revoked: LiturgicalTopic[];
  /** Topics that were free and now need a letter, or the reverse. */
  tightened: LiturgicalTopic[];
  loosened: LiturgicalTopic[];
}

/** What the new bishop makes of the man's circles: clubs with a leaning, and the affiliations the offers set. */
export function circlesOf(state: GameState, successor: Npc): Reread['circles'] {
  const out: Reread['circles'] = [];
  const bishop = Math.sign(successor.alignment);
  if (bishop === 0) return out;
  for (const id of Object.keys(clubsOf(state).memberships)) {
    const def = clubDef(id);
    if (!def || !def.leaning) continue;
    out.push({ label: def.label, agrees: Math.sign(def.leaning) === bishop });
  }
  for (const [flag, lean] of Object.entries(AFFILIATION_LEAN)) {
    if (!state.flags[flag] || !lean) continue;
    out.push({ label: flag.replace('affiliation:', '').replace(/_/g, ' '), agrees: Math.sign(lean) === bishop });
  }
  return out;
}

/**
 * Every chancery relationship is revalued and every public statement
 * re-read against a new standard. The loud man who was the last bishop's
 * favorite becomes the new bishop's problem; the exile is called back.
 * The circles he keeps are read too, and leave the old bishop granted
 * that this one forbids is withdrawn.
 */
export function revalue(state: GameState, successor: Npc, policy?: { before: LiturgicalPolicy; after: LiturgicalPolicy }): { state: GameState; verdict: string; reread: Reread } {
  const c = state.character;
  const empty: Reread = { circles: [], withHim: 0, againstHim: 0, revoked: [], tightened: [], loosened: [] };
  if (!c) return { state, verdict: '', reread: empty };
  const publicPositions = c.positions.filter((p) => p.volume === 'public' || p.volume === 'semi_public');
  const gap = Math.abs(successor.alignment - c.alignment);
  const affinity = (30 - gap) / 2; // −35 .. +15
  let reread = 0;
  let withHim = 0;
  let againstHim = 0;
  for (const p of publicPositions) {
    const agrees = Math.sign(p.value) === Math.sign(successor.alignment) || successor.alignment === 0;
    if (agrees) withHim += 1; else againstHim += 1;
    reread += (agrees ? 1 : -1) * (p.volume === 'public' ? 2 : 1);
  }
  const circles = circlesOf(state, successor);
  for (const circle of circles) reread += circle.agrees ? 1.5 : -1.5;
  const swing = (affinity + reread) * (1 + c.outspokenness / 100);
  const chancery = clampSigned(c.reputation.chancery * SUCCESSION.chanceryCarry + swing);
  const relationship = Math.round(clampSigned(swing));
  const verdict =
    swing >= 15 ? 'The new bishop has heard of you, and approves.' :
    swing <= -15 ? 'The new bishop has heard of you. That is the problem.' :
    c.outspokenness >= 40 ? 'The new bishop has read your file and formed no opinion yet, which for a man on the record is a mercy.' :
    'The new bishop does not know you, which is neither good nor bad.';

  // Leave granted under the old bishop that the new one forbids is withdrawn.
  const revoked: LiturgicalTopic[] = [];
  const tightened: LiturgicalTopic[] = [];
  const loosened: LiturgicalTopic[] = [];
  let permissions = state.permissions;
  let flags = state.flags;
  if (policy) {
    for (const topic of LITURGICAL_TOPICS) {
      const before = policy.before[topic];
      const after = policy.after[topic];
      if (before === after) continue;
      if (after === 'forbidden') {
        const p = permissions[topic];
        if (p?.status === 'granted' || before === 'free') {
          revoked.push(topic);
          permissions = { ...permissions, [topic]: { topic, status: 'denied', bishopId: successor.id, askedWeek: p?.askedWeek ?? state.clock.week, answerWeek: state.clock.week } };
          flags = { ...flags, [`permission:${topic}`]: false };
        } else tightened.push(topic);
      } else if (after === 'by_permission' && before === 'free') tightened.push(topic);
      else loosened.push(topic);
    }
  }
  return {
    state: {
      ...state,
      permissions,
      flags,
      character: { ...c, reputation: { ...c.reputation, chancery } },
      npcs: { ...state.npcs, [successor.id]: { ...successor, relationship } },
    },
    verdict,
    reread: { circles, withHim, againstHim, revoked, tightened, loosened },
  };
}

/** The letter that makes a succession a turn: who he is, what he allows, and how he reads you. */
export function bishopLetter(state: GameState, successor: Npc, verdict: string, reread: Reread): Letter {
  const world = state.world!;
  const v = world.diocese.visible.bishop;
  const policy = world.diocese.hidden.bishop.liturgy;
  const name = `${successor.title} ${successor.name.first} ${successor.name.last}`;
  const body: string[] = [];
  body.push(`${name} is the new bishop of ${world.diocese.visible.see}. ${v.temperamentLine} He says his priorities are ${prioritiesLine(v.priorities)}; the diocese will find out in a year what he meant.`);
  const allowed = LITURGICAL_TOPICS.filter((t) => policy[t] === 'free').map((t) => TOPIC_LABEL[t]);
  const byLeave = LITURGICAL_TOPICS.filter((t) => policy[t] === 'by_permission').map((t) => TOPIC_LABEL[t]);
  const shut = LITURGICAL_TOPICS.filter((t) => policy[t] === 'forbidden').map((t) => TOPIC_LABEL[t]);
  body.push([allowed.length ? `Under him, ${allowed.join(', ')} ${allowed.length === 1 ? 'needs' : 'need'} no one's leave.` : '', byLeave.length ? `${byLeave.join(', ')} ${byLeave.length === 1 ? 'takes' : 'take'} a letter to the chancery.` : '', shut.length ? `${shut.join(', ')} ${shut.length === 1 ? 'is' : 'are'} not open in this diocese while he holds it.` : ''].filter(Boolean).join(' ').replace(/^./, (ch) => ch.toUpperCase()));
  if (reread.revoked.length) body.push(`The leave you had for ${reread.revoked.map((t) => TOPIC_LABEL[t]).join(' and ')} is withdrawn. What is already built may stand; what it permitted may not go on.`);
  else if (reread.tightened.length) body.push(`${reread.tightened.map((t) => TOPIC_LABEL[t]).join(' and ')} ${reread.tightened.length === 1 ? 'was' : 'were'} free under his predecessor and now ${reread.tightened.length === 1 ? 'takes' : 'take'} a letter.`.replace(/^./, (ch) => ch.toUpperCase()));
  if (reread.loosened.length) body.push(`${reread.loosened.map((t) => TOPIC_LABEL[t]).join(' and ')} ${reread.loosened.length === 1 ? 'is' : 'are'} open now that ${reread.loosened.length === 1 ? 'was' : 'were'} not.`.replace(/^./, (ch) => ch.toUpperCase()));
  body.push(verdict);
  const rows: Letter['rows'] = [];
  const aloud = reread.withHim + reread.againstHim;
  if (aloud) rows.push({ label: 'Your file, reread', value: reread.againstHim === 0 ? `${aloud} stand${aloud === 1 ? '' : 's'} taken aloud, all of them ones he could have said himself` : reread.withHim === 0 ? `${aloud} stand${aloud === 1 ? '' : 's'} taken aloud, every one of them against him` : `${reread.withHim} stand${reread.withHim === 1 ? '' : 's'} he agrees with; ${reread.againstHim} he does not` });
  if (reread.circles.length) rows.push({ label: 'Your circles', value: reread.circles.map((c) => `${c.label} (${c.agrees ? 'his kind of company' : 'not his kind of company'})`).join('; ') });
  const jobs = Object.keys(state.flags).filter((k) => k.startsWith('office:') && state.flags[k]).map((k) => k.replace('office:', '').replace(/_/g, ' '));
  if (jobs.length) rows.push({ label: 'Your posts', value: `${jobs.join(', ')}: held at his pleasure now, not his predecessor's` });
  return { sort: 'bishop', title: `A new bishop: ${name}`, body, rows, week: state.clock.week };
}

/** Roll whether the see changes hands this year, and if so install the successor and revalue. */
export function successionYear(state: GameState, rng: Rng): SuccessionResult {
  const world = state.world;
  if (!world) return { state, newBishop: null, lines: [] };
  const year = calendarYear(state);
  const current = state.npcs[world.diocese.hidden.bishop.npcId];
  if (!current) return { state, newBishop: null, lines: [] };
  const age = year - current.birthYear;
  let why: 'retired' | 'died' | 'promoted' | null = null;
  if (age >= SUCCESSION.retirementAge && rng.chance(SUCCESSION.acceptancePerYear)) why = 'retired';
  else if (age >= 70 && rng.chance(SUCCESSION.deathPerYearOver70)) why = 'died';
  else if (world.diocese.hidden.bishop.ambition >= 70 && age < 68 && rng.chance(0.04)) why = 'promoted';
  if (!why) return { state, newBishop: null, lines: [] };

  const preset = presetById(world.diocese.presetId);
  if (!preset) return { state, newBishop: null, lines: [] };
  const seeded = generateBishop(rng.derive(`successor:${year}`), { ...preset, dispositionBias: state.romeTemperament * 0.6 + (world.diocese.hidden.financial === 'crisis' ? 0 : preset.dispositionBias * 0.3) }, year, `bishop_${year}`);
  successor: {
    // A diocese in crisis gets a fixer; a scandal gets an outsider. DESIGN 9.3
    if (world.diocese.hidden.financial === 'crisis') seeded.npc.stats.administration = Math.min(100, seeded.npc.stats.administration + 15);
    if (world.diocese.hidden.scandal.latent >= 60) seeded.npc.origin = 'suburban';
    break successor;
  }
  seeded.profile.installedYear = year;
  const npcs = {
    ...state.npcs,
    [current.id]: { ...current, status: why === 'died' ? ('dead' as const) : ('retired' as const), tags: current.tags.filter((t) => t !== 'bishop').concat(why === 'promoted' ? 'archbishop_elsewhere' : 'bishop_emeritus') },
    [seeded.npc.id]: seeded.npc,
  };
  const diocese = {
    ...world.diocese,
    hidden: { ...world.diocese.hidden, bishop: seeded.profile },
    visible: {
      ...world.diocese.visible,
      bishop: {
        npcId: seeded.npc.id,
        name: `${seeded.npc.title} ${seeded.npc.name.first} ${seeded.npc.name.last}`,
        age: year - seeded.npc.birthYear,
        yearsInOffice: 0,
        temperamentLine: temperamentLine(rng, seeded.profile),
        priorities: seeded.profile.priorities,
      },
    },
  };
  const withNew: GameState = { ...state, npcs, world: { ...world, diocese, bishopHistory: [...world.bishopHistory, seeded.npc.id] } };
  const { state: revalued, verdict, reread } = revalue(withNew, seeded.npc, { before: world.diocese.hidden.bishop.liturgy, after: seeded.profile.liturgy });
  const letter = bishopLetter(revalued, seeded.npc, verdict, reread);
  const lines = [
    `${current.title} ${current.name.last} has ${why === 'promoted' ? 'been named to a larger see' : why}. Rome has named ${seeded.npc.title} ${seeded.npc.name.first} ${seeded.npc.name.last} to ${world.diocese.visible.see}.`,
    verdict,
  ];
  return { state: { ...revalued, flags: { ...revalued.flags, successions: Number(revalued.flags.successions ?? 0) + 1, [`succession:${year}`]: true } }, newBishop: seeded.npc, lines, letter };
}
