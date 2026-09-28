import type { Applicant, GameState, Letter, Npc, Pillar, SeeSeminary, Seminarian, SeminaryWhere, Struggle } from '@/types';
import { PILLARS } from '@/types';
import { createRng, type Rng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { finishNpc, rollBaseStats } from '@/generation/npc';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from '@/generation/names';
import { presetById } from '@/content/dioceses';
import { synthPool } from '@/content/dioceses/synth';
import { seminaryPools } from '@/content/see';
import { priestsOfSee, shortName } from './directions';

/**
 * E4 R1.4 — the seminary. Where the see's men are formed and what the
 * bishop asks the rector to stress; the year's applicants, decided man by
 * man; the rector's report; a man delayed, dismissed, sent to Rome, or
 * called to orders; and the ordained joining the presbyterate carrying the
 * marks of his choices. Rates are invented and flagged.
 */
export const SEMINARY = {
  years: 6,
  /** Men in formation when the chair is taken, across the years. */
  seeded: [3, 5] as [number, number],
  /** Applicants a year: a floor, what the vocations activity's hours add, and what a vocations director's charisma adds. */
  applicants: { base: 0.6, perVocationsHour: 1 / 80, directorCharisma: 1 / 120, max: 4 },
  /** Growth: the emphasis adds this to its pillar's growth; the rector's stats and the man's own strength add a little; noise. */
  emphasisBonus: 4,
  rectorShare: 0.06,
  strengthBonus: 3,
  noise: 3,
  /** A concern surfaces in a year that stresses its pillar more often than not; else rarely; never after it is seen. */
  surfaceStressed: 0.55,
  surfaceOther: 0.15,
  /** The chance an issue has surfaced by ordination if never seen: it goes with him as a struggle. */
  leaveChance: { perYear: 0.04, withIssue: 0.08 },
  /** Rome: from the third year, two years there instead; the degree comes home. */
  romeFromYear: 3,
  romeMoney: -3,
  /** A man ordained: the priest's stats from his pillars. */
  stats: { base: 30, perPillar: 0.35 },
  /** The dials: an ordination is the whole future; a dismissal or a man leaving is noticed. */
  ordained: { shortage: -0.3, presbyterate: 1, people: 1 },
  dismissed: { presbyterate: -1 },
} as const;

const ISSUE_KEYS = ['none', 'none', 'none', 'rigid', 'immature', 'doubt', 'isolated', 'health', 'drink', 'ambition'] as const;

function seminaryName(state: GameState, rng: Rng): string {
  const preset = state.see ? presetById(state.see.id) : undefined;
  return preset?.seminaryName ?? rng.pick(synthPool.seminaries);
}

function clamp(v: number): number {
  return Math.max(-100, Math.min(100, Math.round(v)));
}

function band(v: number): 'low' | 'middling' | 'high' {
  return v < 40 ? 'low' : v < 70 ? 'middling' : 'high';
}

function makeApplicant(state: GameState, rng: Rng, seq: number): Applicant {
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const age = rng.int(22, 44);
  const year = dateOf(state.clock).year;
  const name = rollMaleName(rng, heritage, eraForBirthYear(year - age));
  const background = rng.pick(seminaryPools.backgrounds);
  const strength = rng.pick(seminaryPools.strengths);
  const issue = rng.pick(ISSUE_KEYS);
  return { id: `applicant_${seq}`, name: `${name.first} ${name.last}`, age, background, strength: strength.text, issue, line: `${name.first} ${name.last}, ${age}, ${background}; ${strength.text}.`, year };
}

function makeSeminarian(state: GameState, rng: Rng, seq: number, year: number, from?: Applicant): Seminarian {
  const heritage = rollHeritage(rng, CLERGY_HERITAGE);
  const age = from?.age ?? rng.int(22, 40);
  const calendar = dateOf(state.clock).year;
  const name = from?.name ?? (() => { const n = rollMaleName(rng, heritage, eraForBirthYear(calendar - age)); return `${n.first} ${n.last}`; })();
  const roll = () => Math.max(5, Math.min(95, 25 + (year - 1) * 9 + rng.int(-8, 8)));
  const pillars: Record<Pillar, number> = { human: roll(), spiritual: roll(), intellectual: roll(), pastoral: roll() };
  const issue = from?.issue ?? rng.pick(ISSUE_KEYS);
  return { id: `seminarian_${seq}`, name, entryAge: age, enteredWeek: state.clock.week - (year - 1) * 52, year, pillars, ...(issue !== 'none' ? { issue } : {}), status: 'forming', line: from ? from.line : `${name}, ${age + year - 1}, in his ${ordinal(year)} year.` };
}

export function ordinal(n: number): string {
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n - 1] ?? `${n}th`;
}

/** The seminary as the chair finds it: men across the years, the province's seminary unless the see has its own. */
export function seedSeminary(state: GameState, rng: Rng): SeeSeminary {
  const own = state.world?.diocese.visible.institutions.includes('major_seminary') ?? false;
  const count = rng.int(SEMINARY.seeded[0], SEMINARY.seeded[1]);
  const men: Seminarian[] = [];
  for (let i = 0; i < count; i++) men.push(makeSeminarian(state, rng.derive(`man:${i}`), i + 1, rng.int(1, SEMINARY.years)));
  men.sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
  const director = priestsOfSee(state).find((n) => n.tags.includes('vocations_director'));
  return { where: own ? 'own' : 'province', emphasis: 'pastoral', name: seminaryName(state, rng.derive('name')), men, applicants: [], ordainedIds: [], seq: count, ...(director ? { vocationsDirectorId: director.id } : {}) };
}

export function seminaryOf(state: GameState): SeeSeminary | undefined {
  return state.see?.seminary;
}

function withSeminary(state: GameState, sem: SeeSeminary): GameState {
  return { ...state, see: { ...state.see!, seminary: sem } };
}

export function setWhere(state: GameState, where: SeminaryWhere): GameState {
  const sem = seminaryOf(state);
  if (!sem || sem.where === where) return state;
  if (where === 'own' && !state.world?.diocese.visible.institutions.includes('major_seminary')) return state;
  const rng = createRng(`${state.seed}:seminary-name:${where}:${state.clock.week}`);
  const name = where === 'rome' ? 'the Roman colleges' : where === 'own' ? seminaryName(state, rng) : rng.pick(synthPool.seminaries);
  const { rectorId: _r, ...rest } = sem;
  return { ...withSeminary(state, { ...rest, where, name, ...(where === 'own' ? { rectorId: sem.rectorId ?? '' } : {}) }), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Sent the diocese's men to ${seminaryPools.where[where].label.replace(/^The /, 'the ')}.` }] };
}

export function setEmphasis(state: GameState, emphasis: Pillar): GameState {
  const sem = seminaryOf(state);
  return sem && sem.emphasis !== emphasis ? withSeminary(state, { ...sem, emphasis }) : state;
}

/** The rector, for a seminary of the see's own; the vocations director for any. Both priests of the see. */
export function nameRector(state: GameState, npcId: string): GameState {
  const sem = seminaryOf(state);
  const npc = state.npcs[npcId];
  if (!sem || sem.where !== 'own' || !npc || !priestsOfSee(state).some((n) => n.id === npcId)) return state;
  const npcs = { ...state.npcs };
  const old = sem.rectorId ? npcs[sem.rectorId] : undefined;
  if (old) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== 'rector') };
  npcs[npcId] = { ...npc, tags: [...npc.tags.filter((t) => t !== 'rector'), 'rector'] };
  return { ...withSeminary({ ...state, npcs }, { ...sem, rectorId: npcId }), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Named ${shortName(npc)} rector of ${sem.name}.` }] };
}

export function nameVocationsDirector(state: GameState, npcId: string): GameState {
  const sem = seminaryOf(state);
  const npc = state.npcs[npcId];
  if (!sem || !npc || !priestsOfSee(state).some((n) => n.id === npcId)) return state;
  const npcs = { ...state.npcs };
  const old = sem.vocationsDirectorId ? npcs[sem.vocationsDirectorId] : undefined;
  if (old) npcs[old.id] = { ...old, tags: old.tags.filter((t) => t !== 'vocations_director' && t !== 'vocation_director') };
  npcs[npcId] = { ...npc, tags: [...npc.tags.filter((t) => t !== 'vocations_director'), 'vocations_director'] };
  return { ...withSeminary({ ...state, npcs }, { ...sem, vocationsDirectorId: npcId }), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Named ${shortName(npc)} director of vocations.` }] };
}

/** Admissions, man by man: an applicant admitted begins his first year; declined, he goes. */
export function admit(state: GameState, applicantId: string, yes: boolean): GameState {
  const sem = seminaryOf(state);
  const a = sem?.applicants.find((x) => x.id === applicantId);
  if (!sem || !a) return state;
  const applicants = sem.applicants.filter((x) => x.id !== applicantId);
  if (!yes) return { ...withSeminary(state, { ...sem, applicants }), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Declined ${a.name} for the seminary.` }] };
  const seq = sem.seq + 1;
  const man = makeSeminarian(state, createRng(`${state.seed}:admit:${a.id}`), seq, 1, a);
  return { ...withSeminary(state, { ...sem, applicants, seq, men: [...sem.men, { ...man, enteredWeek: state.clock.week }] }), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Admitted ${a.name}, ${a.age}, to the seminary.` }] };
}

function man(sem: SeeSeminary, id: string): Seminarian | undefined {
  return sem.men.find((m) => m.id === id && m.status === 'forming');
}

function replace(sem: SeeSeminary, m: Seminarian): SeeSeminary {
  return { ...sem, men: sem.men.map((x) => (x.id === m.id ? m : x)) };
}

/** A year's delay before the next step. */
export function delayMan(state: GameState, id: string): GameState {
  const sem = seminaryOf(state);
  const m = sem && man(sem, id);
  if (!sem || !m) return state;
  return { ...withSeminary(state, replace(sem, { ...m, delayed: (m.delayed ?? 0) + 1, line: `${m.line} Held a year.` })), career: [...state.career, { week: state.clock.week, kind: 'note', text: `Held ${m.name} a year in the seminary.` }] };
}

export function dismissMan(state: GameState, id: string): GameState {
  const sem = seminaryOf(state);
  const m = sem && man(sem, id);
  if (!sem || !m || !state.see) return state;
  const see = { ...state.see, presbyterate: clamp(state.see.presbyterate + SEMINARY.dismissed.presbyterate) };
  return { ...state, see: { ...see, seminary: replace(sem, { ...m, status: 'dismissed' }) }, flags: { ...state.flags, 'seminary:dismissed': true, 'seminary:man': m.name }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Dismissed ${m.name} from the seminary in his ${ordinal(m.year)} year.` }] };
}

/** From the third year: he finishes in Rome, the diocese pays, and comes home with a degree. */
export function sendToRome(state: GameState, id: string): GameState {
  const sem = seminaryOf(state);
  const m = sem && man(sem, id);
  if (!sem || !m || m.rome !== undefined || m.year < SEMINARY.romeFromYear || !state.see) return state;
  const see = { ...state.see, money: clamp(state.see.money + SEMINARY.romeMoney), rome: clamp(state.see.rome + 1) };
  return { ...state, see: { ...see, seminary: replace(sem, { ...m, rome: state.clock.week, line: `${m.line} Sent to Rome.` }) }, flags: { ...state.flags, 'seminary:rome': true, 'seminary:man': m.name }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Sent ${m.name} to Rome to finish his formation.` }] };
}

/** The ordained man: a priest of the see, his stats from his pillars, his struggle from what formation never surfaced; placed where the diocese is short. */
function ordain(state: GameState, m: Seminarian, rng: Rng): { state: GameState; npc: Npc } {
  const see = state.see!;
  const year = dateOf(state.clock).year;
  const stat = (p: Pillar) => Math.round(SEMINARY.stats.base + m.pillars[p] * SEMINARY.stats.perPillar);
  const [first, ...rest] = m.name.split(' ');
  const last = rest.join(' ') || first!;
  const seen = !!m.issueSeen;
  const struggle = (m.issue && !seen ? seminaryPools.issues[m.issue]?.struggle : 'none') as Struggle;
  const base = finishNpc(rng, {
    id: `${see.dioceseId}:ordained_${m.id}`,
    name: { first: first!, last },
    role: 'priest',
    title: 'Fr.',
    birthYear: year - (m.entryAge + m.year - 1 + (m.delayed ?? 0)),
    origin: 'suburban',
    stats: { ...rollBaseStats(rng, 20, 30), charisma: stat('human'), piety: stat('spiritual'), theology: stat('intellectual') + (m.rome !== undefined ? 10 : 0), administration: stat('pastoral') - 5, knowledge: Math.round((stat('intellectual') + stat('pastoral')) / 2) },
    tags: ['priest', `diocese:${see.dioceseId}`, 'formed_by_you', 'newly_ordained', ...(m.rome !== undefined ? ['studied_rome'] : [])],
    alignment: clamp(state.character!.alignment * 0.5 + rng.gaussian() * 25),
    relationship: 25,
  });
  const npc: Npc = { ...base, struggle };
  // A vacant parish takes him as administrator; else he is a vicar at the cathedral.
  const vacant = state.world?.parishes.find((p) => !p.cathedral && (!state.npcs[p.pastorId] || state.npcs[p.pastorId]!.status !== 'active'));
  const cathedral = state.world?.parishes.find((p) => p.cathedral);
  const placed: Npc = vacant ? { ...npc, tags: [...npc.tags, `pastor:${vacant.id}`, 'pastor'] } : { ...npc, tags: [...npc.tags, ...(cathedral ? [`vicar:${cathedral.id}`] : [])] };
  const world = vacant && state.world ? { ...state.world, parishes: state.world.parishes.map((p) => (p.id === vacant.id ? { ...p, pastorId: npc.id } : p)) } : state.world;
  return { state: { ...state, world, npcs: { ...state.npcs, [placed.id]: placed } }, npc: placed };
}

export interface SeminaryYear {
  state: GameState;
  letter: Letter | null;
  ordained: number;
  lines: string[];
}

/** The year: applicants come, the men grow by where and what is stressed, concerns surface, some leave, the sixth year ends in orders, and the rector writes. */
export function seminaryYear(state: GameState, rng: Rng): SeminaryYear {
  const see = state.see;
  const sem = see?.seminary;
  if (!see || !sem || !state.world) return { state, letter: null, ordained: 0, lines: [] };
  const where = seminaryPools.where[sem.where];
  const rector = sem.rectorId ? state.npcs[sem.rectorId] : undefined;
  const director = sem.vocationsDirectorId ? state.npcs[sem.vocationsDirectorId] : undefined;
  const week = state.clock.week;
  let next = state;
  let seq = sem.seq;
  const body: string[] = [];
  const lines: string[] = [];
  let ordained = 0;
  let money = 0;
  const newlyOrdained: string[] = [];
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('seminary:')) delete flags[k];
  const men: Seminarian[] = [];
  const kept = sem.men.filter((m) => m.status === 'forming');
  for (const m0 of kept) {
    const r = rng.derive(`man:${m0.id}:${week}`);
    let m = { ...m0 };
    money += where.money;
    // He leaves, now and then; more often with a concern in the file.
    if (r.chance(m.issue ? SEMINARY.leaveChance.withIssue : SEMINARY.leaveChance.perYear)) {
      men.push({ ...m, status: 'left' });
      const line = rng.pick(seminaryPools.left).replace('{man}', m.name).replace('{year}', ordinal(m.year));
      body.push(line);
      lines.push(`${m.name} left the seminary.`);
      flags['seminary:left'] = true;
      flags['seminary:man'] = m.name;
      continue;
    }
    // Growth: where, the emphasis, the rector, a strength, noise.
    const pillars = { ...m.pillars };
    for (const p of PILLARS) {
      let g = where.growth[p] + (sem.emphasis === p ? SEMINARY.emphasisBonus : 0) + r.gaussian() * SEMINARY.noise;
      if (rector) g += (p === 'intellectual' ? rector.stats.theology : p === 'spiritual' ? rector.stats.piety : rector.stats.charisma) * SEMINARY.rectorShare;
      if (m.rome !== undefined && p === 'intellectual') g += 4;
      pillars[p] = Math.max(0, Math.min(100, Math.round(pillars[p] + g)));
    }
    m = { ...m, pillars };
    // A concern surfaces, or does not.
    if (m.issue && !m.issueSeen) {
      const def = seminaryPools.issues[m.issue];
      const stressed = def?.pillar === sem.emphasis;
      if (def && r.chance(stressed ? SEMINARY.surfaceStressed : SEMINARY.surfaceOther)) {
        m = { ...m, issueSeen: m.year, line: `${m.line} ${def.label}.` };
        body.push(`On ${m.name}: ${def.seen}`);
        flags['seminary:concern'] = true;
        flags['seminary:man'] = m.name;
      }
    }
    // The year ends: held, ordained, or a year older.
    if (m.delayed && m.delayed > 0) {
      men.push({ ...m, delayed: m.delayed - 1 });
      body.push(`${m.name} kept his ${ordinal(m.year)} year, as you asked.`);
      continue;
    }
    if (m.year >= SEMINARY.years) {
      const out = ordain(next, m, r.derive('ordain'));
      next = out.state;
      men.push({ ...m, status: 'ordained' });
      ordained++;
      body.push(rng.pick(seminaryPools.ordination).replace('{man}', m.name).replace('{see}', see.name));
      lines.push(`${m.name} ordained a priest of the diocese.`);
      flags['seminary:ordained'] = true;
      flags['seminary:man'] = m.name;
      newlyOrdained.push(out.npc.id);
      continue;
    }
    const report = PILLARS.map((p) => seminaryPools.report[p][band(pillars[p])]).join('; ');
    body.push(`${m.name}, ${ordinal(m.year)} year: ${report}.`);
    men.push({ ...m, year: m.year + 1 });
  }
  // The applicants: the vocations work, the director, and a floor; decided man by man from the sheet, and gone by the next year if not.
  const hours = state.study?.hoursLogged.see_seminary ?? 0;
  const expected = SEMINARY.applicants.base + hours * SEMINARY.applicants.perVocationsHour + (director ? director.stats.charisma * SEMINARY.applicants.directorCharisma : 0);
  const n = Math.min(SEMINARY.applicants.max, Math.floor(expected) + (rng.derive(`applicants:${week}`).chance(expected - Math.floor(expected)) ? 1 : 0));
  const applicants: Applicant[] = [];
  for (let i = 0; i < n; i++) applicants.push(makeApplicant(next, rng.derive(`applicant:${week}:${i}`), ++seq));
  if (applicants.length) body.push(`${applicants.length === 1 ? 'One man has' : `${applicants.length} men have`} applied to the seminary; the vocations director's files are on your desk.`);
  const dials = { shortage: Math.max(1, Math.min(5, next.see!.shortage + ordained * SEMINARY.ordained.shortage)), presbyterate: clamp(next.see!.presbyterate + ordained * SEMINARY.ordained.presbyterate), people: clamp(next.see!.people + ordained * SEMINARY.ordained.people), money: clamp(next.see!.money + money) };
  const semNext: SeeSeminary = { ...sem, men: [...sem.men.filter((m) => m.status !== 'forming'), ...men].slice(-40), applicants, seq, ordainedIds: [...sem.ordainedIds, ...newlyOrdained] };
  next = { ...next, see: { ...next.see!, ...dials, ordinations: next.see!.ordinations + ordained, seminary: semNext }, flags };
  const letter: Letter | null = body.length ? { sort: 'bishop', title: `The rector's report: ${sem.name}`, body, week } : null;
  return { state: next, letter, ordained, lines };
}

/** {seminary_man}: the man the seminary's last news was about. */
export function seminaryTokens(state: GameState): Record<string, string> {
  const m = state.flags['seminary:man'];
  return typeof m === 'string' ? { seminary_man: m } : {};
}
