import type { Celebrant, ConfessionSlot, GameState, MassTime, ObligationKey, Parish, ParishSchedule, Quality, ScheduleChange, Weekday } from '@/types';
import { WEEKDAYS } from '@/types';
import type { Rng } from '@/engine/rng';
import { createRng } from '@/engine/rng';
import { currentParish, selectedOf, optionDef } from './liturgy';
import { priestsInHouse } from './ministry';
import { speaks } from './languages';

/**
 * The week as it is said. Tunable; the canon limits are real (c. 905: one Mass a
 * day, two for a just cause, three on Sundays and holy days with the Ordinary's leave)
 * and read as the diocese's working rule. Verify against the diocese's own norms.
 */
export const SCHEDULE = {
  /** Blocks a Sunday Mass costs the man who says it (the Mass, the greeting, the walk between two). */
  sundayMassAp: 0.5,
  /** A weekday Mass: half an hour and the sacristy. */
  weekdayMassAp: 0.15,
  /** The homily, by how it is prepared: the rest of the old Sunday cost. */
  homilyAp: { min: 0.5, standard: 1, invested: 2 } as Record<Quality, number>,
  /** Confessions: the light, the walk over, and a block for every four hours in the box. */
  confessionOverheadAp: 0.25,
  confessionApPerHour: 0.25,
  /** A week that does not fit says them quickly and cuts the box short. */
  cutFactor: 0.75,
  /** c. 905, as the diocese applies it. */
  canon: { weekdayMax: 2, sundayMax: 3 },
  /** A Saturday Mass at four or later is the vigil. */
  vigilFromMinute: 16 * 60,
  /** Households one Sunday Mass serves; the demand the attendance pull measures against. */
  householdsPerSundayMass: 350,
  /** Attendance pull per Sunday Mass up to demand, and the cost of each beyond it. */
  pullPerMass: 0.012,
  thinMassPenalty: 0.008,
  /** A Mass in a community's language, where the community is there to fill it. */
  communityMassPull: 0.02,
  /** Confessions on a weeknight, and a weekday Mass before seven, reach people the Saturday box does not. */
  eveningConfessionsPull: 0.006,
  earlyMassPull: 0.004,
  /** Confessions heard per hour the light is on, before the extra blocks. */
  confessionsPerHour: 3,
  /** Derived qualities: what the old table called it, from what the schedule actually holds. */
  weekdayQuality: { min: 2, invested: 6 },
  confessionQuality: { min: 60, invested: 150 },
  /** The vicar's ask: base chance, and what the pastor's temper does to it. */
  ask: { base: 0.55, perRegard: 1 / 200, mentor: 0.2, absent: 0.25, micromanager: -0.2 },
  /** Times the sheet offers. */
  times: { from: 6 * 60, to: 20 * 60, step: 30 },
  /**
   * The liturgy is said in its own time and takes nothing from the week's hours (owner's feedback); what a heavy
   * schedule does is wear him. Masses and box hours beyond these count as extra blocks for strain. Invented.
   */
  load: { massesFree: 8, perMass: 0.4, boxFreeMinutes: 120, perBoxHour: 0.5 },
  /** The times the quick changes reach for. */
  quick: { sunday: [7 * 60 + 30, 9 * 60, 10 * 60 + 30, 12 * 60, 17 * 60], vigil: 17 * 60, morning: [7 * 60, 8 * 60, 6 * 60 + 30], evening: 18 * 60 + 30, box: { saturday: 15 * 60 + 30, weeknight: 18 * 60, minutes: 60 } },
} as const;

export const DAY_LABEL: Record<Weekday, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
export const DAY_SHORT: Record<Weekday, string> = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

export function timeLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

export function languageLabel(id: string): string {
  const words: Record<string, string> = { english: 'English', spanish: 'Spanish', latin: 'Latin', vietnamese: 'Vietnamese', polish: 'Polish', tagalog: 'Tagalog', korean: 'Korean', french: 'French', german: 'German', italian: 'Italian' };
  return words[id] ?? id;
}

/** Whether a Mass on that day at that time counts toward Sunday. */
export function isSundayMass(day: Weekday, minute: number): boolean {
  return day === 'sun' || (day === 'sat' && minute >= SCHEDULE.vigilFromMinute);
}

/** The languages the parish's own Masses are said in, from the communities' Masses the pastor keeps (liturgy). */
export function communityLanguages(parish: Parish): string[] {
  return selectedOf(parish, 'communities')
    .map((id) => optionDef('communities', id)?.needs?.language)
    .filter((l): l is string => !!l);
}

/**
 * The default schedule for a parish: as many Sunday Masses as its households
 * want, a vigil, a Mass each weekday, the Saturday box, and the communities'
 * Masses in their languages. Who says what follows the man's role: a vicar
 * takes the early Masses and the pastor the late ones; a pastor with a vicar
 * hands him a share. Rolled once per parish from the run's seed.
 */
export function defaultSchedule(parish: Parish, role: string, priests: number, rng: Rng): ParishSchedule {
  const demand = Math.max(2, Math.min(5, Math.round(parish.households / SCHEDULE.householdsPerSundayMass) + 1));
  const sundayTimes = [7 * 60 + 30, 9 * 60, 10 * 60 + 30, 12 * 60, 17 * 60];
  const langs = communityLanguages(parish);
  const masses: MassTime[] = [];
  let n = 0;
  const other: Celebrant = role === 'parochial_vicar' ? 'pastor' : priests > 1 ? 'vicar' : 'me';
  const mine = (i: number) => (role === 'parochial_vicar' ? i % 2 === 0 : other === 'me' || i % 3 !== 2);
  masses.push({ id: `m${n++}`, day: 'sat', minute: 17 * 60, language: 'english', celebrant: mine(0) ? 'me' : other, sunday: true });
  for (let i = 0; i < demand - 1; i++) {
    const t = sundayTimes[i]!;
    masses.push({ id: `m${n++}`, day: 'sun', minute: t, language: 'english', celebrant: mine(i + 1) ? 'me' : other, sunday: true });
  }
  // The communities' Masses take the noon and the early afternoon, said by whoever has the language, or marked for another priest.
  langs.forEach((lang, k) => {
    const t = 12 * 60 + k * 90;
    const i = masses.findIndex((m) => m.day === 'sun' && m.minute === t);
    const celebrant: Celebrant = role === 'parochial_vicar' ? (k % 2 === 0 ? 'me' : 'pastor') : 'me';
    if (i >= 0) masses[i] = { ...masses[i]!, language: lang, celebrant };
    else masses.push({ id: `m${n++}`, day: 'sun', minute: t, language: lang, celebrant, sunday: true });
  });
  // One Mass each weekday; a vicar says three of them and the Saturday morning, the pastor the rest.
  const weekdayHour = rng.pick([7 * 60, 8 * 60, 8 * 60 + 30]);
  (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as Weekday[]).forEach((d, i) => {
    const celebrant: Celebrant = role === 'parochial_vicar' ? (i % 2 === 0 ? 'me' : 'pastor') : other === 'vicar' && i % 3 === 1 ? 'vicar' : 'me';
    masses.push({ id: `m${n++}`, day: d, minute: weekdayHour, language: 'english', celebrant, sunday: false });
  });
  const confessions: ConfessionSlot[] = [{ id: 'c0', day: 'sat', minute: 15 * 60 + 30, minutes: 90, confessor: 'me' }];
  if (parish.households >= 700) confessions.push({ id: 'c1', day: 'wed', minute: 18 * 60, minutes: 60, confessor: role === 'parochial_vicar' ? 'pastor' : other === 'vicar' ? 'vicar' : 'me' });
  return { masses: underCanon(masses.sort(byTime)), confessions };
}

/** No default asks a man for more than the canon allows: what he cannot say falls to another priest (the deanery's supply, a resident, a retired man). */
function underCanon(masses: MassTime[]): MassTime[] {
  let sundays = 0;
  const byDay: Partial<Record<Weekday, number>> = {};
  return masses.map((m) => {
    if (m.celebrant !== 'me') return m;
    if (m.sunday) {
      sundays++;
      return sundays > SCHEDULE.canon.sundayMax ? { ...m, celebrant: 'other' as const } : m;
    }
    byDay[m.day] = (byDay[m.day] ?? 0) + 1;
    return byDay[m.day]! > SCHEDULE.canon.weekdayMax ? { ...m, celebrant: 'other' as const } : m;
  });
}

function byTime(a: { day: Weekday; minute: number }, b: { day: Weekday; minute: number }): number {
  return WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.minute - b.minute;
}

/** The parish's schedule: the one on the record, or the default until the sheet is touched. */
export function scheduleOf(state: GameState): ParishSchedule | null {
  const ps = state.parish;
  const parish = currentParish(state);
  if (!ps || !parish) return null;
  if (ps.schedule) return ps.schedule;
  return defaultSchedule(parish, ps.role, priestsInHouse(state), createRng(`${state.seed}:schedule:${parish.id}`));
}

export function myMasses(s: ParishSchedule): MassTime[] {
  return s.masses.filter((m) => m.celebrant === 'me');
}
export function myConfessionMinutes(s: ParishSchedule): number {
  return s.confessions.filter((c) => c.confessor === 'me').reduce((n, c) => n + c.minutes, 0);
}

/** What the old quality table would have called the schedule, for the effects and the book. */
export function derivedQuality(s: ParishSchedule, key: 'weekday_masses' | 'confessions'): Quality {
  if (key === 'weekday_masses') {
    const n = myMasses(s).filter((m) => !m.sunday).length;
    return n <= SCHEDULE.weekdayQuality.min ? 'min' : n >= SCHEDULE.weekdayQuality.invested ? 'invested' : 'standard';
  }
  const minutes = myConfessionMinutes(s);
  return minutes < SCHEDULE.confessionQuality.min ? 'min' : minutes > SCHEDULE.confessionQuality.invested ? 'invested' : 'standard';
}

/** Blocks the schedule charges the man for one of the liturgical obligations, before skill and relief. */
export function scheduleAp(s: ParishSchedule, key: ObligationKey, homily: Quality): number | null {
  const mine = myMasses(s);
  switch (key) {
    case 'sunday_masses': return SCHEDULE.sundayMassAp * mine.filter((m) => m.sunday).length + SCHEDULE.homilyAp[homily];
    case 'weekday_masses': return SCHEDULE.weekdayMassAp * mine.filter((m) => !m.sunday).length;
    case 'confessions': return SCHEDULE.confessionOverheadAp + (SCHEDULE.confessionApPerHour * myConfessionMinutes(s)) / 60;
    default: return null;
  }
}

/** What a heavy week of Masses and the box costs in wear, in blocks: nothing up to an ordinary week's, then by the Mass and the hour. */
export function liturgyLoadBlocks(s: ParishSchedule | null): number {
  if (!s) return 0;
  const masses = myMasses(s).length;
  const minutes = myConfessionMinutes(s);
  return Math.max(0, masses - SCHEDULE.load.massesFree) * SCHEDULE.load.perMass + (Math.max(0, minutes - SCHEDULE.load.boxFreeMinutes) / 60) * SCHEDULE.load.perBoxHour;
}

/** A change the sheet offers as one button, with its reason. */
export interface QuickChange {
  id: string;
  label: string;
  change: ScheduleChange;
  /** What it is for: the pews, the communities, the canon, a lighter week. */
  why: string;
}

/**
 * The changes most worth making, computed from the schedule and the parish (owner's feedback: the sheet needed
 * buttons for the Mass decisions instead of three menus). Each is a plain `ScheduleChange`; nothing here the
 * sheet's menus could not do by hand.
 */
export function quickChanges(state: GameState): QuickChange[] {
  const s = scheduleOf(state);
  const parish = currentParish(state);
  if (!s || !parish) return [];
  const out: QuickChange[] = [];
  const mine = myMasses(s);
  const sundays = s.masses.filter((m) => m.sunday);
  const demand = sundayDemand(parish);
  const q = SCHEDULE.quick;
  // Sunday: a Mass the households want, at the first ordinary time that is free.
  if (sundays.length < demand) {
    const t = q.sunday.find((m) => canSay(s, 'sun', m).ok);
    if (t !== undefined) out.push({ id: 'sunday', label: `Add a Sunday Mass at ${timeLabel(t)}`, change: { kind: 'add_mass', day: 'sun', minute: t, language: 'english' }, why: `the ${parish.households} households want about ${demand} Sunday Masses and have ${sundays.length}` });
  }
  if (!s.masses.some((m) => m.day === 'sat' && m.sunday) && canSay(s, 'sat', q.vigil).ok) out.push({ id: 'vigil', label: `Add a Saturday vigil at ${timeLabel(q.vigil)}`, change: { kind: 'add_mass', day: 'sat', minute: q.vigil, language: 'english' }, why: 'the vigil counts for Sunday, and reaches the people who work on Sunday' });
  // The communities, in their languages, where the man has the language.
  for (const lang of communityLanguages(parish)) {
    if (s.masses.some((m) => m.sunday && m.language === lang)) continue;
    if (!canSayIn(state, lang)) continue;
    const t = [12 * 60, 13 * 60 + 30, 17 * 60, 10 * 60 + 30].find((m) => canSay(s, 'sun', m).ok);
    if (t !== undefined) out.push({ id: `community:${lang}`, label: `Add a ${languageLabel(lang)} Mass on Sunday at ${timeLabel(t)}`, change: { kind: 'add_mass', day: 'sun', minute: t, language: lang }, why: `the parish has a ${languageLabel(lang)}-speaking community with no Mass of its own` });
  }
  // A weekday morning where there is none, and an evening Mass once a week.
  const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const bare = weekdays.find((d) => !s.masses.some((m) => m.day === d));
  if (bare) {
    const t = q.morning.find((m) => canSay(s, bare, m).ok);
    if (t !== undefined) out.push({ id: `morning:${bare}`, label: `Add a ${DAY_LABEL[bare]} morning Mass at ${timeLabel(t)}`, change: { kind: 'add_mass', day: bare, minute: t, language: 'english' }, why: `${DAY_LABEL[bare]} has no Mass` });
  }
  if (!s.masses.some((m) => !m.sunday && m.minute >= 17 * 60)) {
    const d = weekdays.find((x) => canSay(s, x, q.evening).ok);
    if (d) out.push({ id: 'evening', label: `Add a ${DAY_LABEL[d]} evening Mass at ${timeLabel(q.evening)}`, change: { kind: 'add_mass', day: d, minute: q.evening, language: 'english' }, why: 'an evening Mass reaches the people who work' });
  }
  if (!s.masses.some((m) => !m.sunday && m.minute <= 7 * 60)) {
    const d = weekdays.find((x) => canSay(s, x, 6 * 60 + 30).ok);
    if (d) out.push({ id: 'early', label: `Add a ${DAY_LABEL[d]} Mass at ${timeLabel(6 * 60 + 30)}, before work`, change: { kind: 'add_mass', day: d, minute: 6 * 60 + 30, language: 'english' }, why: 'a Mass before seven reaches the shift workers' });
  }
  // The box: a Saturday afternoon, and a weeknight.
  if (!s.confessions.some((c) => c.day === 'sat') && canOpenBox(s, 'sat', q.box.saturday, 90).ok) out.push({ id: 'box:sat', label: `Open the box Saturday at ${timeLabel(q.box.saturday)} for 90 minutes`, change: { kind: 'add_confessions', day: 'sat', minute: q.box.saturday, minutes: 90 }, why: 'a parish keeps a Saturday box' });
  if (!s.confessions.some((c) => c.minute >= 17 * 60)) {
    const d = weekdays.find((x) => canOpenBox(s, x, q.box.weeknight, q.box.minutes).ok);
    if (d) out.push({ id: 'box:evening', label: `Open the box ${DAY_LABEL[d]} at ${timeLabel(q.box.weeknight)} for an hour`, change: { kind: 'add_confessions', day: d, minute: q.box.weeknight, minutes: q.box.minutes }, why: 'a weeknight box reaches the people the Saturday one does not' });
  }
  // Too many: the thinnest Sunday Mass of his, and the heaviest week.
  if (sundays.length > demand) {
    const thin = [...mine.filter((m) => m.sunday && m.language === 'english' && m.day === 'sun')].sort((a, b) => b.minute - a.minute)[0] ?? mine.find((m) => m.sunday);
    if (thin) out.push({ id: 'drop:thin', label: `Drop the ${DAY_LABEL[thin.day]} ${timeLabel(thin.minute)} Mass, the thinnest`, change: { kind: 'remove_mass', id: thin.id }, why: `${sundays.length} Sunday Masses for ${parish.households} households: the pews are thin` });
  }
  if (liturgyLoadBlocks(s) > 0) {
    const heavy = mine.filter((m) => !m.sunday).sort((a, b) => a.minute - b.minute)[0];
    if (heavy) out.push({ id: 'drop:weekday', label: `Drop the ${DAY_LABEL[heavy.day]} ${timeLabel(heavy.minute)} Mass, for a lighter week`, change: { kind: 'remove_mass', id: heavy.id }, why: `${mine.length} Masses and ${myConfessionMinutes(s)} minutes in the box a week wears on you` });
  }
  return out;
}

/** The attendance pull of the schedule: Masses enough for the households, the communities served, the box open when people can come. */
export function schedulePull(state: GameState): number {
  const s = scheduleOf(state);
  const parish = currentParish(state);
  if (!s || !parish) return 0;
  const demand = sundayDemand(parish);
  const sundays = s.masses.filter((m) => m.sunday).length;
  let pull = Math.min(sundays, demand) * SCHEDULE.pullPerMass - Math.max(0, sundays - demand) * SCHEDULE.thinMassPenalty;
  for (const lang of new Set(s.masses.filter((m) => m.sunday && m.language !== 'english').map((m) => m.language))) {
    if (communityLanguages(parish).includes(lang)) pull += SCHEDULE.communityMassPull;
  }
  if (s.confessions.some((c) => c.minute >= 17 * 60)) pull += SCHEDULE.eveningConfessionsPull;
  if (s.masses.some((m) => !m.sunday && m.minute <= 7 * 60)) pull += SCHEDULE.earlyMassPull;
  return pull;
}

/** Masses said and confessions heard in a week, for the book. */
export function scheduleBook(s: ParishSchedule): { masses: number; confessions: number } {
  return { masses: myMasses(s).length, confessions: (myConfessionMinutes(s) / 60) * SCHEDULE.confessionsPerHour };
}

/** Whether the man may say one more Mass that day under the canon. */
/** How many Sunday Masses a parish of that size wants: one per so many households, and one more. */
export function sundayDemand(parish: Parish): number {
  return Math.max(2, Math.round(parish.households / SCHEDULE.householdsPerSundayMass) + 1);
}

/** Whether the box can open then: not over another hour the same confessor already keeps that day. */
export function canOpenBox(s: ParishSchedule, day: Weekday, minute: number, minutes: number, confessor: Celebrant = 'me'): { ok: boolean; why: string | null } {
  const clash = s.confessions.find((c) => c.day === day && c.confessor === confessor && minute < c.minute + c.minutes && c.minute < minute + minutes);
  if (clash) return { ok: false, why: `the box is already open ${DAY_LABEL[day]} at ${timeLabel(clash.minute)}` };
  return { ok: true, why: null };
}

export function canSay(s: ParishSchedule, day: Weekday, minute: number): { ok: boolean; why: string | null } {
  const sunday = isSundayMass(day, minute);
  const mine = myMasses(s);
  if (sunday) {
    const count = mine.filter((m) => m.sunday).length;
    if (count >= SCHEDULE.canon.sundayMax) return { ok: false, why: `three Masses on a Sunday is the canon's limit, and the vigil counts` };
  } else {
    const count = mine.filter((m) => !m.sunday && m.day === day).length;
    if (count >= SCHEDULE.canon.weekdayMax) return { ok: false, why: `two Masses on a weekday is the canon's limit` };
  }
  if (s.masses.some((m) => m.day === day && Math.abs(m.minute - minute) < 60)) return { ok: false, why: 'there is a Mass within the hour already' };
  return { ok: true, why: null };
}

/** Whether a Mass in that language can be said by the man: English always, the rest need the language. */
export function canSayIn(state: GameState, language: string): boolean {
  return language === 'english' || speaks(state, language);
}

/** Who sets the schedule: a pastor or administrator, or an absent pastor's vicar in practice; a vicar otherwise asks. */
export function setsSchedule(state: GameState): boolean {
  const role = state.parish?.role;
  return role === 'pastor' || role === 'administrator';
}

function nextId(s: ParishSchedule, prefix: 'm' | 'c'): string {
  const list: { id: string }[] = prefix === 'm' ? s.masses : s.confessions;
  let n = list.length;
  while (list.some((x) => x.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Apply a change, as the man in charge would. Throws on a change the canon or the schedule forbids. */
export function applyChange(state: GameState, s: ParishSchedule, change: ScheduleChange, celebrant: Celebrant = 'me'): ParishSchedule {
  switch (change.kind) {
    case 'add_mass': {
      if (celebrant === 'me') {
        const can = canSay(s, change.day, change.minute);
        if (!can.ok) throw new Error(can.why!);
        if (!canSayIn(state, change.language)) throw new Error(`you do not have the ${languageLabel(change.language)} for it`);
      }
      const mass: MassTime = { id: nextId(s, 'm'), day: change.day, minute: change.minute, language: change.language, celebrant, sunday: isSundayMass(change.day, change.minute) };
      return { ...s, masses: [...s.masses, mass].sort(byTime) };
    }
    case 'remove_mass': {
      if (!s.masses.some((m) => m.id === change.id)) return s;
      if (s.masses.filter((m) => m.sunday).length <= 1 && s.masses.find((m) => m.id === change.id)?.sunday) throw new Error('a parish keeps at least one Sunday Mass');
      return { ...s, masses: s.masses.filter((m) => m.id !== change.id) };
    }
    case 'hand_mass': {
      const m = s.masses.find((x) => x.id === change.id);
      if (!m) return s;
      if (change.to === 'me') {
        const can = canSay({ ...s, masses: s.masses.filter((x) => x.id !== m.id) }, m.day, m.minute);
        if (!can.ok) throw new Error(can.why!);
        if (!canSayIn(state, m.language)) throw new Error(`you do not have the ${languageLabel(m.language)} for it`);
      }
      return { ...s, masses: s.masses.map((x) => (x.id === m.id ? { ...x, celebrant: change.to } : x)) };
    }
    case 'add_confessions': {
      const can = canOpenBox(s, change.day, change.minute, change.minutes, celebrant);
      if (!can.ok) throw new Error(can.why!);
      const slot: ConfessionSlot = { id: nextId(s, 'c'), day: change.day, minute: change.minute, minutes: change.minutes, confessor: celebrant };
      return { ...s, confessions: [...s.confessions, slot].sort(byTime) };
    }
    case 'remove_confessions':
      return { ...s, confessions: s.confessions.filter((c) => c.id !== change.id) };
  }
}

export function describeChange(change: ScheduleChange, s: ParishSchedule): string {
  switch (change.kind) {
    case 'add_mass': { const lang = languageLabel(change.language); return `${/^[AEIOU]/.test(lang) ? 'an' : 'a'} ${lang} Mass on ${DAY_LABEL[change.day]} at ${timeLabel(change.minute)}`; }
    case 'remove_mass': { const m = s.masses.find((x) => x.id === change.id); return m ? `dropping the ${DAY_LABEL[m.day]} ${timeLabel(m.minute)} Mass` : 'dropping a Mass'; }
    case 'hand_mass': { const m = s.masses.find((x) => x.id === change.id); return m ? `the ${DAY_LABEL[m.day]} ${timeLabel(m.minute)} Mass ${change.to === 'me' ? 'taken on' : 'handed to ' + change.to}` : 'a Mass handed on'; }
    case 'add_confessions': return `confessions on ${DAY_LABEL[change.day]} at ${timeLabel(change.minute)} for ${change.minutes} minutes`;
    case 'remove_confessions': { const c = s.confessions.find((x) => x.id === change.id); return c ? `dropping the ${DAY_LABEL[c.day]} confessions` : 'dropping a confession slot'; }
  }
}

/** The pastor's answer to a vicar's ask: his regard and his temper decide, deterministically from the week. */
export function pastorGrants(state: GameState, change: ScheduleChange): boolean {
  const pastor = Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${state.parish?.parishId}`));
  const regard = pastor?.relationship ?? 0;
  let chance = SCHEDULE.ask.base + regard * SCHEDULE.ask.perRegard;
  if (state.flags['boss:mentor']) chance += SCHEDULE.ask.mentor;
  if (state.flags['boss:absent']) chance += SCHEDULE.ask.absent;
  if (state.flags['boss:micromanager']) chance += SCHEDULE.ask.micromanager;
  // Dropping a Mass is a harder ask than adding one.
  if (change.kind === 'remove_mass' || change.kind === 'remove_confessions') chance -= 0.15;
  const rng = createRng(`${state.seed}:ask:${state.clock.week}:${JSON.stringify(change)}`);
  return rng.chance(Math.max(0.05, Math.min(0.95, chance)));
}

/**
 * The man changes the schedule: directly where he sets it, by asking the pastor
 * where he does not. A refused ask writes the pastor's answer on the sheet and
 * costs a point with him; a granted one is applied.
 */
export function changeSchedule(state: GameState, change: ScheduleChange): GameState {
  const s = scheduleOf(state);
  if (!s || !state.parish) return state;
  const text = describeChange(change, s);
  if (setsSchedule(state)) {
    const next = applyChange(state, s, change);
    return { ...state, parish: { ...state.parish, schedule: next }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `The schedule: ${text}.` }] };
  }
  // What the schedule itself forbids is not the pastor's to grant.
  if (change.kind === 'add_mass') { const can = canSay(s, change.day, change.minute); if (!can.ok) throw new Error(can.why!); }
  if (change.kind === 'add_confessions') { const can = canOpenBox(s, change.day, change.minute, change.minutes); if (!can.ok) throw new Error(can.why!); }
  const earlier = s.lastAsk && s.lastAsk.week === state.clock.week ? `${s.lastAsk.text} ` : '';
  const granted = pastorGrants(state, change);
  if (!granted) {
    const pastor = Object.values(state.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${state.parish?.parishId}`));
    const npcs = pastor ? { ...state.npcs, [pastor.id]: { ...pastor, relationship: Math.max(-100, pastor.relationship - 1) } } : state.npcs;
    return { ...state, npcs, parish: { ...state.parish, schedule: { ...s, lastAsk: { week: state.clock.week, text: `${earlier}You asked the pastor for ${text}. He said no, and said it kindly, and it is his schedule.`, granted: false } } } };
  }
  const next = applyChange(state, s, change);
  return { ...state, parish: { ...state.parish, schedule: { ...next, lastAsk: { week: state.clock.week, text: `${earlier}You asked the pastor for ${text}, and he said yes.`, granted: true } } }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Asked the pastor for ${text}; he agreed.` }] };
}

/**
 * A scene changes the schedule outright (the people asked, the pastor agreed in the
 * prose): `mass:add "sun 17:00 spanish"`, `mass:remove "sun 07:30"`, `confessions:add
 * "wed 18:00 60"`, `confessions:remove "wed 18:00"`. Nothing the canon forbids is forced.
 */
export function scheduleEffect(state: GameState, key: string, value: string): GameState {
  const s = scheduleOf(state);
  if (!s || !state.parish) return state;
  const parsed = parseScheduleValue(value);
  if (!parsed) return state;
  let next: ParishSchedule = s;
  try {
    if (key === 'mass:add') next = applyChange(state, s, { kind: 'add_mass', day: parsed.day, minute: parsed.minute, language: parsed.extra ?? 'english' }, canSayIn(state, parsed.extra ?? 'english') ? 'me' : 'other');
    else if (key === 'mass:remove') {
      const m = s.masses.find((x) => x.day === parsed.day && x.minute === parsed.minute);
      if (m) next = applyChange(state, s, { kind: 'remove_mass', id: m.id });
    } else if (key === 'confessions:add') next = applyChange(state, s, { kind: 'add_confessions', day: parsed.day, minute: parsed.minute, minutes: Number(parsed.extra ?? 60) });
    else if (key === 'confessions:remove') {
      const c = s.confessions.find((x) => x.day === parsed.day && x.minute === parsed.minute);
      if (c) next = applyChange(state, s, { kind: 'remove_confessions', id: c.id });
    }
  } catch {
    return state;
  }
  return { ...state, parish: { ...state.parish, schedule: next } };
}

export function parseScheduleValue(value: string): { day: Weekday; minute: number; extra?: string } | null {
  const m = /^(sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2}):(\d{2})(?:\s+(\S+))?$/.exec(value.trim());
  if (!m) return null;
  const minute = Number(m[2]) * 60 + Number(m[3]);
  return { day: m[1] as Weekday, minute, ...(m[4] ? { extra: m[4] } : {}) };
}

/** A condition on the schedule, for the scenes that ask about it. */
export function scheduleMeasure(state: GameState, key: string, value?: string): number | boolean {
  const s = scheduleOf(state);
  const parish = currentParish(state);
  if (!s) return key === 'sunday_masses' || key === 'weekday_masses' || key === 'confession_minutes' || key === 'masses_mine' ? 0 : false;
  switch (key) {
    case 'sunday_masses': return s.masses.filter((m) => m.sunday).length;
    case 'weekday_masses': return s.masses.filter((m) => !m.sunday).length;
    case 'masses_mine': return myMasses(s).length;
    case 'confession_minutes': return s.confessions.reduce((n, c) => n + c.minutes, 0);
    case 'evening_confessions': return s.confessions.some((c) => c.minute >= 17 * 60);
    case 'weekend_confessions': return s.confessions.some((c) => c.day === 'sat' || c.day === 'sun');
    case 'early_mass': return s.masses.some((m) => !m.sunday && m.minute <= 7 * 60);
    case 'evening_mass': return s.masses.some((m) => m.sunday && m.day === 'sun' && m.minute >= 17 * 60);
    case 'mass_in': return s.masses.some((m) => m.language === value);
    case 'community_unserved': return !!parish && communityLanguages(parish).some((l) => !s.masses.some((m) => m.language === l));
    case 'short_of_demand': return !!parish && s.masses.filter((m) => m.sunday).length < Math.max(2, Math.round(parish.households / SCHEDULE.householdsPerSundayMass) + 1);
    case 'over_demand': return !!parish && s.masses.filter((m) => m.sunday).length > Math.max(2, Math.round(parish.households / SCHEDULE.householdsPerSundayMass) + 1);
    default: return false;
  }
}
