import { create } from 'zustand';
import type {
  CreationAnswers,
  EventCategory,
  GameState,
  InterruptLevel,
  ObligationKey,
  Pillar,
  Quality,
  Snapshot,
  Speed,
  SummerAssignment,
} from '@/types';
import { SAVE_VERSION } from '@/types';
import { noDraw, noHook, runClock, type StopReason, type WeekDraw, type WeekHook } from './clock';
import { newGame as buildNewGame, type NewGameOptions } from './game';
import type { Rng } from './rng';
import { buildSave, deserialize, rngFromSave, SaveError, serialize } from './save';
import { eventById, eventsForPhase } from '@/content';
import { offerById, offersForPhase } from '@/content/offers';
import { acceptOffer as doAccept, declineOffer as doDecline } from './offers';
import { generateRun } from '@/generation';
import { generateCandidates, installWorld } from '@/generation/world';
import { fromDayNumber } from './calendar';
import { acceptAssignment as doAcceptAssignment } from './seminary';
import {
  acknowledgeEvaluation as ackEvaluation,
  chooseEmphasis as pickEmphasis,
  chooseSummer as pickSummer,
  leaveSeminary as leave,
  ordain as doOrdain,
} from './seminary';
import { parishWeekHook, resolvePending, seminaryWeekHook, studyWeekHook, type EventDeps } from './weekHook';
import { setDiscretionary as doSetDiscretionary, setObligation as doSetObligation, startAssignment } from './parish';
import { focusGroup as doFocus, replaceLeader as doReplaceLeader, startFounding as doStartFounding, suppressGroup as doSuppress } from '@/systems/groups';
import { startWork as doStartWork, stopWork as doStopWork } from '@/systems/problems';
import { joinClub as doJoinClub, leaveClub as doLeaveClub } from '@/systems/clubs';
import { readLetter as doReadLetter } from '@/systems/review';
import { haveAWord as doHaveAWord } from '@/systems/talks';
import { closeFund as doCloseFund, fundGroup as doFundGroup, invest as doInvest, spend as doSpend, withdraw as doWithdraw } from '@/systems/spending';
import { yearOf } from '@/ui/portraits/spec';
import { payDebt as doPayDebt } from '@/systems/finance';
import { applyForOpening as doApply } from '@/systems/openings';
import type { GroupType, ProjectType } from '@/types';
import { pushProject as doPushProject, startProject as doStartProject } from '@/systems/projects';
import { setDial as doSetDial } from '@/systems/liturgy';
import { chooseAssignment as doChooseAssignment } from '@/systems/choice';
import { furnish as doFurnish, petition as doPetition } from '@/systems/decor';
import { setHomily as doSetHomily } from '@/systems/homily';
import { hire as doHire, letGo as doLetGo } from '@/systems/staff';
import { goAway as doGoAway } from '@/systems/away';
import { setSeminaryActivity as doSetSeminaryActivity } from '@/systems/seminaryWeek';
import { setStudyActivity as doSetStudyActivity } from '@/systems/studyWeek';
import { hoursOf } from '@/systems/week';
import { DEFAULT_SETTINGS } from '@/systems/workweek';
import type { GameSettings } from '@/types';
import { setPreference, type Preference } from '@/systems/assignment';
import type { DecorPlace, LiturgicalTopic } from '@/types';
import { anthropicProvider, type Provider } from '@/llm/provider';
import { DEFAULT_LLM, loadLlmSettings, saveLlmSettings, type LlmSettings } from '@/llm/settings';
import { skinArc, skinEvent, skinOutcome } from '@/llm/skin';

/** Weeks per synchronous batch when running to the next stop. */
export const BATCH_WEEKS: Record<Speed, number> = {
  PAUSED: 0,
  MANUAL: 1,
  AUTO: 52,
  SKIP: 52 * 10,
};

export interface GameStore {
  game: GameState | null;
  /** The one retained auto-resolved week, for rewind. */
  previous: Snapshot | null;
  prose: Record<string, string>;
  lastStop: StopReason | null;
  /** True while the UI is ticking the clock on a timer. */
  running: boolean;
  error: string | null;

  newGame(options: NewGameOptions): void;
  setSpeed(speed: Speed): void;
  /** Advance up to `weeks` weeks at the current speed (MANUAL always advances one). */
  tick(weeks?: number): StopReason | null;
  /** Advance until the clock stops or the batch cap is reached. */
  runToStop(): StopReason | null;
  /** Restore the week before the last auto-resolved one and drop to MANUAL. */
  rewind(): void;
  setInterrupt(category: EventCategory, level: InterruptLevel): void;
  setRunning(running: boolean): void;
  exportSave(): string;
  importSave(json: string): void;
  clearError(): void;

  /** Pick one of the rolled dioceses, or 'surprise' for a blind roll with a small bonus. DESIGN §3.1a */
  chooseDiocese(presetId: string | 'surprise'): void;
  /** Character creation is done; generate the run and enter seminary. */
  startGame(answers: CreationAnswers): void;
  acceptAssignment(): void;
  /** The bishop laid out a choice; take one. */
  chooseAssignment(id: string): void;
  setObligation(key: ObligationKey, quality: Quality): void;
  /** Hours a week a seminarian gives an activity. */
  setSeminaryActivity(id: string, ap: number): void;
  /** A priest-student's free hours. */
  setStudyActivity(id: string, ap: number): void;
  /** What the man has asked the chancery for, read by the assignment algorithm. DESIGN §7.4 */
  setPreference(pref: Preference): void;
  setDiscretionary(actionId: string, ap: number): void;
  foundGroup(type: GroupType): void;
  suppressGroup(groupId: string, suppressed: boolean): void;
  /** Single a group out for the sustaining hours. */
  focusGroup(groupId: string, focus: boolean): void;
  /** Pay down the parish debt from cash in hand. Pastor or administrator only. */
  payDebt(amount: number): void;
  /** Put your name forward for an opening. */
  applyForOpening(openingId: string): void;
  /** The player's own dials: the length of the week and how much it wears. Kept in the save. */
  setSettings(partial: Partial<GameSettings>): void;
  /** The man has read the letter in his hands; the clock may move. */
  readLetter(): void;
  /** An hour with one person of the parish or diocese. */
  haveAWord(npcId: string): void;
  lastTalk: { npcId: string; text: string; week: number } | null;
  /** What a pastor does with money that is not owed. */
  spend(id: string): void;
  closeFund(id: string): void;
  fundGroup(groupId: string, amount: number): void;
  invest(amount: number): void;
  withdraw(amount: number): void;
  /** Societies: join an open one from the sheet, or leave one. */
  joinClub(id: string): void;
  leaveClub(id: string): void;
  /** Cut something from your own week for an hour, or take it back. */
  toggleSacrifice(id: string): void;
  /** Begin, or abandon, the work on the parish's problem. */
  startWork(): void;
  stopWork(): void;
  /** Put a new leader over a group. */
  replaceLeader(groupId: string): void;
  startProject(type: ProjectType): void;
  pushProject(type: ProjectType, on: boolean): void;
  /** Turn a dial of the pastor's Mass. */
  setDial(dial: string, option: string): void;
  furnish(place: DecorPlace, optionId: string): void;
  /** Write to the chancery for leave on a liturgical topic. */
  petition(topic: LiturgicalTopic): void;
  setHomily(topic: string): void;
  letGo(npcId: string): void;
  hire(candidateId: string): void;
  goAway(placeId: string): void;
  lastFurnishLine: string | null;

  /** The skinning layer. Off by default; the game is complete without it. */
  llm: LlmSettings;
  setLlm(patch: Partial<LlmSettings>): void;
  /** Called after the state changes: skins whatever is newly waiting, in the background. */
  requestSkins(): void;
  chooseEmphasis(emphasis: Record<Pillar, number>): void;
  chooseSummer(id: SummerAssignment): void;
  /** Resolve the event at the head of the pending queue. */
  resolveEvent(choiceId: string): void;
  acknowledgeEvaluation(): void;
  leaveSeminary(): void;
  ordain(): void;
  acceptOffer(offerId: string): void;
  declineOffer(offerId: string): void;
  /** Prose from the last offer decision, for the UI. */
  lastOfferOutcome: string | null;
}

// The live RNG is deliberately kept out of the reactive state: it is mutable,
// non-serializable, and its state is captured on demand by exportSave.
let rng: Rng | null = null;
let draw: WeekDraw = noDraw;
let hookOverride: WeekHook | null = null;
let providerOverride: Provider | null = null;

/** Tests inject a fake provider. */
export function setProvider(p: Provider | null): void {
  providerOverride = p;
}

function providerFor(settings: LlmSettings): Provider | null {
  if (providerOverride) return providerOverride;
  if (!settings.enabled || !settings.apiKey) return null;
  return anthropicProvider(settings);
}

/** Tests inject a synthetic draw here. */
export function setWeekDraw(next: WeekDraw): void {
  draw = next;
}

/** Tests may replace the phase hook; pass null to restore the real one. */
export function setWeekHook(next: WeekHook | null): void {
  hookOverride = next;
}

function depsFor(state: GameState): EventDeps {
  return { pool: eventsForPhase(state.phase), lookup: eventById, offers: offersForPhase(state.phase), offerLookup: offerById };
}

/** The per-week hook for the current phase. */
function hookFor(state: GameState): WeekHook {
  if (hookOverride) return hookOverride;
  if (state.phase === 'seminary') return seminaryWeekHook(depsFor(state));
  if (state.study) return studyWeekHook(depsFor(state));
  if (state.parish) return parishWeekHook(depsFor(state));
  return noHook;
}

function update(set: (partial: Partial<GameStore>) => void, get: () => GameStore, fn: (game: GameState, rng: Rng) => GameState): void {
  const { game } = get();
  if (!game || !rng) return;
  try {
    set({ game: fn(game, rng), error: null });
    get().requestSkins();
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) });
  }
}

/** Test hook: the live RNG, or null before a game exists. */
export function currentRng(): Rng | null {
  return rng;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  previous: null,
  prose: {},
  lastStop: null,
  running: false,
  error: null,
  lastOfferOutcome: null,
  lastTalk: null,
  lastFurnishLine: null,
  llm: typeof window === 'undefined' ? DEFAULT_LLM : loadLlmSettings(),

  setLlm(patch) {
    const llm = { ...get().llm, ...patch };
    saveLlmSettings(llm);
    set({ llm });
  },

  requestSkins() {
    const { game, prose, llm } = get();
    if (!game) return;
    const provider = providerFor(llm);
    if (!provider) return;
    const store = (result: { key: string; prose: string } | null) => {
      if (result) set({ prose: { ...get().prose, [result.key]: result.prose } });
    };
    for (const pending of game.pending) {
      const event = eventById(pending.eventId);
      if (event) void skinEvent(game, event, pending, prose, provider).then(store);
    }
    if (game.parish && game.parish.weeksServed === 0) void skinArc(game, prose, provider).then(store);
  },

  newGame(options) {
    const built = buildNewGame(options);
    rng = built.rng;
    const year = fromDayNumber(built.state.clock.startDay).year;
    const candidates = generateCandidates(rng.derive('world'), year);
    set({ game: { ...built.state, candidates }, previous: null, prose: {}, lastStop: null, running: false, error: null, lastOfferOutcome: null });
  },

  chooseDiocese(presetId) {
    update(set, get, (game, r) => {
      const candidates = game.candidates ?? [];
      if (candidates.length === 0) throw new Error('no dioceses rolled');
      const year = fromDayNumber(game.clock.startDay).year;
      if (presetId === 'surprise') {
        const pick = r.derive('surprise').pick(candidates);
        const installed = installWorld(game, pick, year);
        return { ...installed, flags: { ...installed.flags, surprise_me: true } };
      }
      const chosen = candidates.find((c) => c.presetId === presetId);
      if (!chosen) throw new Error(`unknown diocese ${presetId}`);
      const installed = installWorld(game, chosen, year);
      const { surprise_me: _surprise, ...flags } = installed.flags;
      return { ...installed, flags };
    });
  },

  setSpeed(speed) {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, speed }, running: speed === 'PAUSED' ? false : get().running });
  },

  tick(weeks = 1) {
    const { game } = get();
    if (!game || !rng || game.speed === 'PAUSED') return null;
    const maxWeeks = game.speed === 'MANUAL' ? 1 : weeks;
    const result = runClock(game, rng, { maxWeeks, draw, hook: hookFor(game) });
    const autoResolved = game.speed === 'AUTO' || game.speed === 'SKIP';
    // A one-week timer tick that simply kept going has no stop worth reporting.
    const keptGoing = result.stop.kind === 'cap' && maxWeeks === 1;
    set({
      game: result.state,
      lastStop: keptGoing ? null : result.stop,
      previous: autoResolved ? result.beforeLast : null,
      running: result.stop.kind === 'cap' ? get().running : false,
    });
    if (result.state.pending.length || result.stop.kind === 'mode') get().requestSkins();
    return result.stop;
  },

  runToStop() {
    const { game } = get();
    if (!game) return null;
    return get().tick(BATCH_WEEKS[game.speed]);
  },

  rewind() {
    const { previous } = get();
    if (!previous || !rng) return;
    rng = rngFromSave({ version: SAVE_VERSION, state: previous.state, rngState: previous.rngState, previous: null, prose: {} });
    set({
      game: { ...previous.state, speed: 'MANUAL' },
      previous: null,
      lastStop: null,
      running: false,
    });
  },

  setInterrupt(category, level) {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, interrupts: { ...game.interrupts, [category]: level } } });
  },

  setRunning(running) {
    const { game } = get();
    if (!game || game.speed === 'PAUSED' || game.speed === 'MANUAL') {
      set({ running: false });
      return;
    }
    set({ running });
  },

  exportSave() {
    const { game, previous, prose } = get();
    if (!game || !rng) throw new SaveError('no game to save');
    return serialize(buildSave(game, rng, previous, prose));
  },

  importSave(json) {
    try {
      const save = deserialize(json);
      rng = rngFromSave(save);
      set({
        game: { ...save.state, speed: 'PAUSED' },
        previous: save.previous,
        prose: save.prose,
        lastStop: null,
        running: false,
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  clearError() {
    set({ error: null });
  },

  startGame(answers) {
    update(set, get, (game, r) => ({ ...generateRun(game, answers, r), candidates: null }));
  },
  chooseEmphasis(emphasis) {
    update(set, get, (game, r) => pickEmphasis(game, emphasis, r));
  },
  chooseSummer(id) {
    update(set, get, (game) => pickSummer(game, id));
  },
  resolveEvent(choiceId) {
    const before = get().game;
    const pending = before?.pending[0];
    const event = pending ? eventById(pending.eventId) : undefined;
    const provider = providerFor(get().llm);
    if (before && pending && event && provider) {
      void skinOutcome(before, event, pending, choiceId, get().prose, provider).then((r) => {
        if (r) set({ prose: { ...get().prose, [r.key]: r.prose } });
      });
    }
    update(set, get, (game, r) => {
      const p = game.pending[0];
      if (!p) return game;
      return resolvePending(game, p, choiceId, r, depsFor(game));
    });
    set({ previous: null });
  },
  acknowledgeEvaluation() {
    update(set, get, (game) => ackEvaluation(game));
  },
  leaveSeminary() {
    update(set, get, (game) => leave(game));
    set({ running: false });
  },
  ordain() {
    update(set, get, (game, r) => doOrdain(game, r));
  },
  acceptAssignment() {
    update(set, get, (game, r) => startAssignment(doAcceptAssignment(game), r));
  },
  chooseAssignment(id) {
    update(set, get, (game, r) => doChooseAssignment(game, id, r.derive(`choose:${game.clock.week}`)));
  },
  setObligation(key, quality) {
    update(set, get, (game) => doSetObligation(game, key, quality));
  },
  setSeminaryActivity(id, ap) {
    update(set, get, (game) => doSetSeminaryActivity(game, id, ap));
  },
  setStudyActivity(id, ap) {
    update(set, get, (game) => doSetStudyActivity(game, id, ap));
  },
  setPreference(pref) {
    update(set, get, (game) => setPreference(game, pref));
  },
  setDiscretionary(actionId, ap) {
    update(set, get, (game) => doSetDiscretionary(game, actionId, ap));
  },
  foundGroup(type) {
    update(set, get, (game) => doStartFounding(game, type));
  },
  suppressGroup(groupId, suppressed) {
    update(set, get, (game) => doSuppress(game, groupId, suppressed));
  },
  focusGroup(groupId, focus) {
    update(set, get, (game) => doFocus(game, groupId, focus));
  },
  payDebt(amount) {
    update(set, get, (game) => doPayDebt(game, amount));
  },
  applyForOpening(openingId) {
    update(set, get, (game) => doApply(game, openingId));
  },
  setSettings(partial) {
    update(set, get, (game) => {
      const settings = { ...(game.settings ?? DEFAULT_SETTINGS), ...partial };
      if (!settings.hours) delete settings.hours;
      return { ...game, settings };
    });
  },
  readLetter() {
    update(set, get, (game) => doReadLetter(game));
  },
  haveAWord(npcId) {
    update(set, get, (game, r) => {
      const result = doHaveAWord(game, npcId, r.derive(`talk:${npcId}:${game.clock.week}`));
      set({ lastTalk: { npcId, text: result.text, week: game.clock.week } });
      return result.state;
    });
  },
  spend(id) {
    update(set, get, (game) => doSpend(game, id));
  },
  closeFund(id) {
    update(set, get, (game) => doCloseFund(game, id));
  },
  fundGroup(groupId, amount) {
    update(set, get, (game) => doFundGroup(game, groupId, amount));
  },
  invest(amount) {
    update(set, get, (game) => doInvest(game, amount));
  },
  withdraw(amount) {
    update(set, get, (game) => doWithdraw(game, amount));
  },
  joinClub(id) {
    update(set, get, (game, r) => doJoinClub(game, id, r.derive(`club:${id}:${game.clock.week}`)));
  },
  leaveClub(id) {
    update(set, get, (game) => doLeaveClub(game, id));
  },
  toggleSacrifice(id) {
    update(set, get, (game) => {
      if (!game.parish) return game;
      const have = game.parish.routine.sacrifices ?? [];
      const sacrifices = have.includes(id) ? have.filter((x) => x !== id) : [...have, id];
      return { ...game, parish: { ...game.parish, routine: { ...game.parish.routine, sacrifices } } };
    });
  },
  startWork() {
    update(set, get, (game) => doStartWork(game));
  },
  stopWork() {
    update(set, get, (game) => doStopWork(game));
  },
  replaceLeader(groupId) {
    update(set, get, (game, r) => {
      const result = doReplaceLeader(game, groupId, r.derive(`replace:${groupId}:${game.clock.week}`), yearOf(game.clock.startDay, game.clock.week));
      const last = result.state.digest[result.state.digest.length - 1];
      const digest = last && last.week === game.clock.week ? [...result.state.digest.slice(0, -1), { ...last, lines: [...last.lines, result.line] }] : [...result.state.digest, { week: game.clock.week, lines: [result.line] }];
      return { ...result.state, digest };
    });
  },
  startProject(type) {
    update(set, get, (game) => doStartProject(game, type));
  },
  pushProject(type, on) {
    update(set, get, (game) => doPushProject(game, type, on));
  },
  setDial(dial, option) {
    update(set, get, (game) => doSetDial(game, dial, option));
  },
  furnish(place, optionId) {
    update(set, get, (game) => {
      const r = doFurnish(game, place, optionId);
      set({ lastFurnishLine: r.line });
      return r.state;
    });
  },
  setHomily(topic) {
    update(set, get, (game) => doSetHomily(game, topic));
  },
  letGo(npcId) {
    update(set, get, (game) => doLetGo(game, npcId));
  },
  hire(candidateId) {
    update(set, get, (game) => doHire(game, candidateId));
  },
  goAway(placeId) {
    update(set, get, (game) => doGoAway(game, placeId));
  },
  petition(topic) {
    update(set, get, (game, r) => {
      const res = doPetition(game, topic, r);
      set({ lastFurnishLine: res.line });
      return res.state;
    });
  },
  acceptOffer(offerId) {
    const def = offerById(offerId);
    if (!def) return;
    update(set, get, (game, r) => {
      const result = doAccept(game, def, r);
      set({ lastOfferOutcome: result.failed && def.failure ? `${def.accept.outcome} ${def.failure.outcome}` : def.accept.outcome });
      const c = def.accept.commitment;
      const text = c?.away ? `Accepted: ${def.title}.` : c ? `Accepted: ${def.title}. ${c.label}, ${hoursOf(c.apPerWeek)} hours a week for ${Math.round(c.weeks / 52) || 1} ${c.weeks >= 78 ? 'years' : 'year'}, alongside the parish.` : `Accepted: ${def.title}.`;
      return { ...result.state, career: [...result.state.career, { week: game.clock.week, kind: 'offer', text }] };
    });
  },
  declineOffer(offerId) {
    const def = offerById(offerId);
    if (!def) return;
    update(set, get, (game) => {
      set({ lastOfferOutcome: def.decline.outcome });
      const next = doDecline(game, def);
      return { ...next, career: [...next.career, { week: game.clock.week, kind: 'offer', text: `Declined: ${def.title}.` }] };
    });
  },
}));
