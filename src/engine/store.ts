import { create } from 'zustand';
import type { HouseWorkId } from '@/types';
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
  OrderKey, ReligiousAnswers, HorariumKey,
} from '@/types';
import { SAVE_VERSION } from '@/types';
import { noDraw, noHook, runClock, type StopReason, type WeekDraw, type WeekHook } from './clock';
import { newGame as buildNewGame, type NewGameOptions } from './game';
import type { Rng } from './rng';
import { buildSave, deserialize, rngFromSave, SaveError, serialize } from './save';
import { deleteSlot as removeSlot, describeSave, listSlots, loadSlot as readSlotFile, preserveAutosave, SLOTS, SlotError, writeSlot, type SlotMeta } from './slots';
import { deleteRemote, listRemote, loadGithub, readRemote, saveGithub, writeRemote, type GithubConfig, type RemoteSave } from './github';
import { eventById, eventsForPhase } from '@/content';
import { offerById, offersForPhase } from '@/content/offers';
import { acceptOffer as doAccept, declineOffer as doDecline, deferOffer as doDefer } from './offers';
import { generateRun } from '@/generation';
import { generateCandidates, installWorld } from '@/generation/world';
import { generateProvinceCandidates } from '@/systems/religious/newGame';
import { setHorarium as setHorariumSys } from '@/systems/religious/horarium';
import { askPermission as askPermissionSys } from '@/systems/religious/poverty';
import { askDispensation as askDispensationSys } from '@/systems/religious/study';
import { befriend as befriendSys } from '@/systems/religious/friendship';
import { appointOffice } from '@/systems/religious/offices';
import { askHouseOffice as askHouseOfficeSys, endApostolate as endApostolateSys, fileRequest as fileFriarRequestSys, resignHouseOffice as resignHouseOfficeSys, withdrawRequest as withdrawFriarRequestSys } from '@/systems/religious/requests';
import { decideAssignment, receiveAssignment, statePreference as statePreferenceSys } from '@/systems/religious/obedience';
import { castVote, closeChapter, holdElection, resolveElection, returnToRanks, signalWillingness, speakFor, steerBloc } from '@/systems/religious/chapter';
import { fromDayNumber } from './calendar';
import { acceptAssignment as doAcceptAssignment } from './seminary';
import {
  acknowledgeEvaluation as ackEvaluation,
  chooseEmphasis as pickEmphasis,
  chooseSummer as pickSummer,
  leaveSeminary as leave,
  ordain as doOrdain,
} from './seminary';
import { parishWeekHook, friarWeekHook, resolvePending, seminaryWeekHook, studyWeekHook, type EventDeps } from './weekHook';
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
import { chooseDirector as doChooseDirector } from '@/systems/direction';
import { furnish as doFurnish, petition as doPetition } from '@/systems/decor';
import { setHomily as doSetHomily } from '@/systems/homily';
import { writeColumn as doWriteColumn } from '@/systems/press';
import { hire as doHire, letGo as doLetGo } from '@/systems/staff';
import { goAway as doGoAway } from '@/systems/away';
import { setCover as doSetCover } from '@/systems/deanery';
import { evaluateSeminarian as doEvaluate } from '@/systems/formed';
import { setSeminaryActivity as doSetSeminaryActivity } from '@/systems/seminaryWeek';
import { setStudyActivity as doSetStudyActivity } from '@/systems/studyWeek';
import { hoursOf } from '@/systems/week';
import { DEFAULT_SETTINGS } from '@/systems/workweek';
import type { GameSettings } from '@/types';
import { setPreference, type Preference } from '@/systems/assignment';
import { setInterest as doSetInterest } from '@/systems/interests';
import { fileRequest as doFileRequest, withdrawRequest as doWithdrawRequest } from '@/systems/request';
import { answerAsk as doAnswerAsk, askFavour as doAskFavour, doHouseWork as doWork } from '@/systems/houses';
import { askBrother as doAskBrother } from '@/systems/brothers';
import { dropWork as doDropSideWork, startWork as doStartSideWork } from '@/systems/sidework';
import { setLearning as doSetLearning } from '@/systems/languages';
import type { DecorPlace, HouseFavourId, LiturgicalTopic, RequestTarget } from '@/types';
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
  /** The religious campaign: the order, then a province from the rolled cards, then creation's additions. E3 §4. */
  chooseOrder(order: OrderKey): void;
  startReligious(answers: CreationAnswers, religious: ReligiousAnswers): void;
  /** The friar's house sheet. */
  setHorarium(key: HorariumKey, quality: Quality): void;
  askPermission(id: string): void;
  askDispensation(): void;
  befriend(npcId: string): void;
  acceptOffice(id: string): void;
  /** Asking for a work: an office of the house from the prior, a work beyond the house from the provincial. E3 §3.10. */
  askHouseOffice(id: string): void;
  resignHouseOffice(): void;
  fileFriarRequest(apostolateId: string, houseId?: string): void;
  withdrawFriarRequest(): void;
  endApostolate(): void;
  /** The consultation and the letter. E3 §3.1. */
  statePreference(houseId: string | null, objection: boolean): void;
  letProvincialDecide(): void;
  answerLetter(grace: 'good' | 'reluctant' | 'refused'): void;
  /** The chapter: actions before the vote, the ballots, the answer. E3 §3.6. */
  chapterAct(action: 'vote' | 'speak' | 'steer' | 'willing' | 'unwilling', id?: string): void;
  holdBallots(): void;
  answerElection(accept: boolean): void;
  endTerm(how: 'well' | 'badly'): void;
  /** What the prior said, for the sheet. */
  lastPriorLine: string | null;
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

  /** The saved games in this browser, newest first. */
  slots: SlotMeta[];
  /** Which slot this run was last written to, for the "saved" mark. */
  slotId: string | null;
  /** Read the shelf again (after another tab, or on the title screen). */
  refreshSlots(): void;
  /** Write the run to a slot: `id` overwrites, otherwise a new one is taken. */
  saveToSlot(opts?: { id?: string; name?: string }): void;
  /** Continue a saved game. */
  loadSlot(id: string): void;
  deleteSlot(id: string): void;
  /** Write the autosave now, whatever the throttle says. Called when the page is hidden or closed. */
  autosaveNow(): void;

  /** The repository this browser saves to, so a run crosses machines. Null until set up. */
  github: GithubConfig | null;
  /** Saves on the repository's branch, as last read. */
  repoSaves: RemoteSave[];
  repoBusy: boolean;
  repoError: string | null;
  repoNote: string | null;
  setGithub(cfg: GithubConfig | null): void;
  refreshRepoSaves(): Promise<void>;
  /** Commit this run to the repository. */
  pushToRepo(name?: string): Promise<void>;
  /** Take a run off the repository and play it here. */
  pullFromRepo(path: string): Promise<void>;
  /**
   * The page is closing: commit the run, if the repository is linked, the week has
   * moved since the last push, and a couple of minutes have passed. Quiet by design.
   */
  pushOnLeaving(): void;
  deleteRepoSave(path: string): Promise<void>;

  /** Pick one of the rolled dioceses, or 'surprise' for a blind roll with a small bonus. DESIGN §3.1a */
  chooseDiocese(presetId: string | 'surprise'): void;
  /** Character creation is done; generate the run and enter seminary. */
  startGame(answers: CreationAnswers): void;
  acceptAssignment(keepOffice?: boolean): void;
  /** The bishop laid out a choice; take one. */
  chooseAssignment(id: string): void;
  setObligation(key: ObligationKey, quality: Quality): void;
  /** Hours a week a seminarian gives an activity. */
  setSeminaryActivity(id: string, ap: number): void;
  /** A priest-student's free hours. */
  setStudyActivity(id: string, ap: number): void;
  /** What the man has asked the chancery for, read by the assignment algorithm. DESIGN §7.4 */
  setPreference(pref: Preference): void;
  /** Indicate interest: the Gregorian, a parish, the posts. */
  setInterest(key: string, on: boolean): void;
  /** Write to the vicar for clergy asking for one named parish or posting. DESIGN §7.6. */
  fileRequest(target: RequestTarget): void;
  withdrawRequest(): void;
  /** Ask a religious house of the diocese for one of its favours. DESIGN §9.4a. */
  askHouseFavour(houseId: string, favourId: HouseFavourId): void;
  /** Answer what a house has asked of the parish. */
  answerHouseAsk(houseId: string, yes: boolean): void;
  /** A work of growth for a house he is connected to: a wing, a foundation, a patronage. DESIGN §9.4c. */
  doHouseWork(houseId: string, id: HouseWorkId): void;
  /** The letter has been opened on the desk; it no longer lies over the scene. */
  markOfferRead(offerId: string): void;
  /** Take on, or put down, the thing he does besides the parish. DESIGN §8.8. */
  startSideWork(id: string): void;
  dropSideWork(): void;
  /** Call in a favour from a man he was ordained with. DESIGN §9.5. */
  askBrother(npcId: string, favourId: string): void;
  /** Take up a language in the routine's study hours, or put it down. */
  setLearning(id: string | null): void;
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
  /** A column in the diocesan paper: a topic and a stance, once a quarter. */
  writeColumn(topic: string, stance: string): void;
  letGo(npcId: string): void;
  hire(candidateId: string): void;
  goAway(placeId: string): void;
  setCover(npcId: string | null): void;
  evaluateSeminarian(verdict: 'strong' | 'reserved' | 'concerned'): void;
  lastFurnishLine: string | null;
  /** What the house said, for the sheet to print once. */
  lastHouseLine: string | null;

  /** The skinning layer. Off by default; the game is complete without it. */
  llm: LlmSettings;
  setLlm(patch: Partial<LlmSettings>): void;
  /** Called after the state changes: skins whatever is newly waiting, in the background. */
  requestSkins(): void;
  chooseEmphasis(emphasis: Record<Pillar, number>): void;
  /** Y1: take one of the men offered as spiritual director, and say whether he is confessor too. */
  chooseDirector(npcId: string, confessorToo: boolean): void;
  chooseSummer(id: SummerAssignment): void;
  /** Resolve the event at the head of the pending queue. */
  resolveEvent(choiceId: string): void;
  acknowledgeEvaluation(): void;
  leaveSeminary(): void;
  ordain(): void;
  acceptOffer(offerId: string): void;
  declineOffer(offerId: string): void;
  deferOffer(offerId: string): void;
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
  // An ordained friar without a parish loop: the house is his week. E3.
  if (state.religious) return friarWeekHook(depsFor(state));
  return noHook;
}

function update(set: (partial: Partial<GameStore>) => void, get: () => GameStore, fn: (game: GameState, rng: Rng) => GameState): void {
  const { game } = get();
  if (!game || !rng) return;
  try {
    set({ game: fn(game, rng), error: null });
    get().requestSkins();
    autosave(get, set);
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) });
  }
}

let lastAutosave = 0;
let lastPushWeek: number | null = null;
let lastPushAt = 0;

/** Tests reset the autosave and push throttles. */
export function resetAutosaveClock(): void {
  lastAutosave = 0;
  lastPushWeek = null;
  lastPushAt = 0;
}

/**
 * The autosave: the run as it stands, written to its own slot, so closing the
 * page loses nothing. Throttled while the clock runs; silent when the browser
 * refuses, because a failed save must never interrupt a week.
 */
function autosave(get: () => GameStore, set: (partial: Partial<GameStore>) => void, force = false): void {
  const { game, previous, prose } = get();
  if (!game || !rng || game.mode.kind === 'creation') return;
  const now = Date.now();
  if (!force && now - lastAutosave < SLOTS.autosaveMs) return;
  lastAutosave = now;
  try {
    writeSlot(buildSave(game, rng, previous, prose), { auto: true });
    set({ slots: listSlots() });
  } catch {
    /* no room, or no storage: the shelf and the file export are still there */
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
  lastPriorLine: null,
  lastTalk: null,
  lastFurnishLine: null,
  lastHouseLine: null,
  slots: typeof window === 'undefined' ? [] : listSlots(),
  slotId: null,
  github: typeof window === 'undefined' ? null : loadGithub(),
  repoSaves: [],
  repoBusy: false,
  repoError: null,
  repoNote: null,
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
    // The last run's autosave is about to be this one's: keep it, if it was another man.
    preserveAutosave(options.seed);
    const built = buildNewGame(options);
    rng = built.rng;
    const year = fromDayNumber(built.state.clock.startDay).year;
    const candidates = generateCandidates(rng.derive('world'), year);
    set({ game: { ...built.state, candidates }, previous: null, prose: {}, lastStop: null, running: false, error: null, lastOfferOutcome: null, slotId: null, slots: listSlots() });
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
    // The clock is the main way a week passes, and it does not go through update().
    autosave(get, set);
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
        slotId: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshSlots() {
    set({ slots: listSlots() });
  },

  saveToSlot(opts = {}) {
    const { game, previous, prose } = get();
    if (!game || !rng) {
      set({ error: 'no game to save' });
      return;
    }
    try {
      const meta = writeSlot(buildSave(game, rng, previous, prose), opts);
      set({ slots: listSlots(), slotId: meta.id, error: null });
    } catch (err) {
      set({ error: err instanceof SlotError ? err.message : err instanceof Error ? err.message : String(err) });
    }
  },

  loadSlot(id) {
    try {
      const save = readSlotFile(id);
      rng = rngFromSave(save);
      lastAutosave = Date.now();
      set({
        game: { ...save.state, speed: 'PAUSED' },
        previous: save.previous,
        prose: save.prose,
        lastStop: null,
        running: false,
        error: null,
        slotId: id === SLOTS.autoId ? null : id,
        slots: listSlots(),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  deleteSlot(id) {
    removeSlot(id);
    set({ slots: listSlots(), ...(get().slotId === id ? { slotId: null } : {}) });
  },

  autosaveNow() {
    autosave(get, set, true);
  },

  setGithub(cfg) {
    saveGithub(cfg);
    set({ github: cfg, repoSaves: cfg ? get().repoSaves : [], repoError: null, repoNote: cfg ? null : 'The repository is no longer linked here.' });
  },

  async refreshRepoSaves() {
    const cfg = get().github;
    if (!cfg) return;
    set({ repoBusy: true, repoError: null });
    try {
      set({ repoSaves: await listRemote(cfg), repoBusy: false });
    } catch (err) {
      set({ repoBusy: false, repoError: err instanceof Error ? err.message : String(err) });
    }
  },

  async pushToRepo(name) {
    const { game, previous, prose, github: cfg } = get();
    if (!cfg || !game || !rng) return;
    set({ repoBusy: true, repoError: null, repoNote: null });
    try {
      const json = serialize(buildSave(game, rng, previous, prose));
      const line = describeSave(game);
      await writeRemote(cfg, json, { name: name?.trim() || line, line, seed: game.seed, week: game.clock.week });
      lastPushWeek = game.clock.week;
      lastPushAt = Date.now();
      set({ repoSaves: await listRemote(cfg), repoBusy: false, repoNote: 'Committed to the repository.' });
    } catch (err) {
      set({ repoBusy: false, repoError: err instanceof Error ? err.message : String(err) });
    }
  },

  async pullFromRepo(path) {
    const cfg = get().github;
    if (!cfg) return;
    set({ repoBusy: true, repoError: null, repoNote: null });
    try {
      const json = await readRemote(cfg, path);
      const save = deserialize(json);
      rng = rngFromSave(save);
      lastAutosave = Date.now();
      set({
        game: { ...save.state, speed: 'PAUSED' },
        previous: save.previous,
        prose: save.prose,
        lastStop: null,
        running: false,
        error: null,
        slotId: null,
        repoBusy: false,
        repoNote: 'Taken off the repository.',
      });
    } catch (err) {
      set({ repoBusy: false, repoError: err instanceof Error ? err.message : String(err) });
    }
  },

  pushOnLeaving() {
    const { github: cfg, game } = get();
    // On unless it was turned off: a config written before the setting existed still commits.
    if (!cfg || cfg.autoPush === false || !game || get().repoBusy) return;
    if (game.clock.week === lastPushWeek || Date.now() - lastPushAt < 120_000) return;
    lastPushWeek = game.clock.week;
    lastPushAt = Date.now();
    void get().pushToRepo();
  },

  async deleteRepoSave(path) {
    const cfg = get().github;
    if (!cfg) return;
    set({ repoBusy: true, repoError: null, repoNote: null });
    try {
      await deleteRemote(cfg, path);
      set({ repoSaves: await listRemote(cfg), repoBusy: false, repoNote: 'Taken off the repository.' });
    } catch (err) {
      set({ repoBusy: false, repoError: err instanceof Error ? err.message : String(err) });
    }
  },

  clearError() {
    set({ error: null });
  },

  startGame(answers) {
    update(set, get, (game, r) => ({ ...generateRun(game, answers, r), candidates: null }));
  },
  chooseOrder(order) {
    update(set, get, (game, r) => {
      const year = fromDayNumber(game.clock.startDay).year;
      const candidates = generateProvinceCandidates(r.derive(`provinces:${order}`), order, year).map((c) => ({ id: c.province.id, visible: c.visible, gen: { province: c.province, houses: c.houses, friars: c.friars, dioceses: c.dioceses } }));
      return { ...game, campaign: 'religious', provinceCandidates: candidates };
    });
  },
  startReligious(answers, religious) {
    update(set, get, (game, r) => ({ ...generateRun(game, answers, r, religious), candidates: null, provinceCandidates: null }));
  },
  setHorarium(key, quality) {
    update(set, get, (game) => setHorariumSys(game, key, quality));
  },
  askPermission(id) {
    update(set, get, (game, r) => {
      const res = askPermissionSys(game, id, r.derive(`permission:${id}:${game.clock.week}`));
      set({ lastPriorLine: res.line });
      return res.state;
    });
  },
  askDispensation() {
    update(set, get, (game, r) => {
      const res = askDispensationSys(game, r.derive(`dispensation:${game.clock.week}`));
      set({ lastPriorLine: res.line });
      return res.state;
    });
  },
  befriend(npcId) {
    update(set, get, (game) => befriendSys(game, npcId));
  },
  acceptOffice(id) {
    update(set, get, (game) => appointOffice(game, id));
  },
  askHouseOffice(id) {
    update(set, get, (game, r) => {
      const res = askHouseOfficeSys(game, id, r.derive(`house-office:${id}:${game.clock.week}`));
      set({ lastPriorLine: res.line });
      return res.state;
    });
  },
  resignHouseOffice() {
    update(set, get, (game) => resignHouseOfficeSys(game));
  },
  fileFriarRequest(apostolateId, houseId) {
    update(set, get, (game) => fileFriarRequestSys(game, apostolateId, houseId));
  },
  withdrawFriarRequest() {
    update(set, get, (game) => withdrawFriarRequestSys(game));
  },
  endApostolate() {
    update(set, get, (game) => endApostolateSys(game, 'resigned'));
  },
  statePreference(houseId, objection) {
    update(set, get, (game) => statePreferenceSys(game, houseId, objection));
  },
  letProvincialDecide() {
    update(set, get, (game, r) => ({ ...decideAssignment(game, r.derive(`decide:${game.clock.week}`)), mode: { kind: 'obedience_letter' } }));
  },
  answerLetter(grace) {
    update(set, get, (game) => ({ ...receiveAssignment(game, grace), mode: { kind: 'clock' } }));
  },
  chapterAct(action, id) {
    update(set, get, (game, r) => {
      if (action === 'vote' && id) return castVote(game, id);
      if (action === 'speak' && id) return speakFor(game, id);
      if (action === 'steer' && id) return steerBloc(game, id, r.derive(`steer:${game.clock.week}`));
      if (action === 'willing' || action === 'unwilling') return signalWillingness(game, action);
      return game;
    });
  },
  holdBallots() {
    update(set, get, (game) => holdElection(game));
  },
  answerElection(accept) {
    update(set, get, (game, r) => ({ ...closeChapter(resolveElection(game, r.derive(`confirm:${game.clock.week}`), accept)), mode: { kind: 'clock' } }));
  },
  endTerm(how) {
    update(set, get, (game) => ({ ...returnToRanks(game, how), mode: { kind: 'clock' } }));
  },
  chooseEmphasis(emphasis) {
    update(set, get, (game, r) => pickEmphasis(game, emphasis, r));
  },
  chooseDirector(npcId, confessorToo) {
    update(set, get, (game) => ({ ...doChooseDirector(game, npcId, confessorToo), mode: { kind: 'clock' } }));
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
  acceptAssignment(keepOffice = true) {
    update(set, get, (game, r) => startAssignment(doAcceptAssignment(game, keepOffice), r));
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
  setInterest(key, on) {
    update(set, get, (game) => doSetInterest(game, key, on));
  },
  fileRequest(target) {
    update(set, get, (game) => doFileRequest(game, target));
  },
  withdrawRequest() {
    update(set, get, (game) => doWithdrawRequest(game));
  },
  askHouseFavour(houseId, favourId) {
    update(set, get, (game, r) => {
      const res = doAskFavour(game, houseId, favourId, r);
      set({ lastHouseLine: res.line });
      return res.state;
    });
  },
  doHouseWork(houseId, id) {
    update(set, get, (game, r) => {
      const res = doWork(game, houseId, id, r.derive(`house-work:${houseId}:${id}:${game.clock.week}`));
      set({ lastHouseLine: res.line });
      return res.state;
    });
  },
  markOfferRead(offerId) {
    update(set, get, (game) => ({ ...game, offers: game.offers.map((o) => (o.offerId === offerId ? { ...o, read: true } : o)) }));
  },
  answerHouseAsk(houseId, yes) {
    update(set, get, (game) => {
      const res = doAnswerAsk(game, houseId, yes);
      set({ lastHouseLine: res.line });
      return res.state;
    });
  },
  startSideWork(id) {
    update(set, get, (game) => doStartSideWork(game, id));
  },
  dropSideWork() {
    update(set, get, (game) => {
      const res = doDropSideWork(game);
      if (res.line) set({ lastHouseLine: res.line });
      return res.state;
    });
  },
  askBrother(npcId, favourId) {
    update(set, get, (game) => {
      const res = doAskBrother(game, npcId, favourId);
      set({ lastHouseLine: res.line });
      return res.state;
    });
  },
  setLearning(id) {
    update(set, get, (game) => doSetLearning(game, id));
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
  writeColumn(topic, stance) {
    update(set, get, (game) => doWriteColumn(game, topic, stance));
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
  setCover(npcId) {
    update(set, get, (game) => doSetCover(game, npcId));
  },
  evaluateSeminarian(verdict) {
    update(set, get, (game) => doEvaluate(game, verdict));
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
      const c = def.accept.commitment;
      set({ lastOfferOutcome: c?.away ? (def.from === '@bishop' ? 'You said yes. The bishop is the one asking, and his letter of appointment follows; nothing moves until it comes.' : 'You said yes. The request goes to the bishop, who will send you or keep you; nothing moves until his letter comes.') : result.failed && def.failure ? `${def.accept.outcome} ${def.failure.outcome}` : def.accept.outcome });
      const text = c?.away ? `Said yes to: ${def.title}. The bishop's letter will decide it.` : c ? `Accepted: ${def.title}. ${c.label}, ${hoursOf(c.apPerWeek)} hours a week for ${Math.round(c.weeks / 52) || 1} ${c.weeks >= 78 ? 'years' : 'year'}, alongside the parish.` : `Accepted: ${def.title}.`;
      return { ...result.state, career: [...result.state.career, { week: game.clock.week, kind: 'offer', text }] };
    });
  },
  deferOffer(offerId) {
    const def = offerById(offerId);
    if (!def) return;
    update(set, get, (game) => {
      set({ lastOfferOutcome: 'You say not now, and ask them to keep your name. They will; a request like that is remembered longer than a no, and the letter comes again.' });
      const next = doDefer(game, def);
      return { ...next, career: [...next.career, { week: game.clock.week, kind: 'offer', text: `Not now: ${def.title}. Your name is on file.` }] };
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
