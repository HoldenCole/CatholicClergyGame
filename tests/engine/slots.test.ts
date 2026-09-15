import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { currentRng, resetAutosaveClock, setWeekDraw, useGameStore } from '@/engine/store';
import { noDraw } from '@/engine/clock';
import { buildSave, deserialize } from '@/engine/save';
import { createRng } from '@/engine/rng';
import {
  deleteSlot,
  describeSave,
  listSlots,
  loadSlot,
  nextSlotId,
  readSlot,
  renameSlot,
  SLOTS,
  SlotError,
  slotsAvailable,
  writeSlot,
} from '@/engine/slots';
import { parishState } from '../systems/week.test';
import type { GameState } from '@/types';

/** The browser's storage, in memory, so the shelf can be tested at all. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  /** Bytes it will hold before it refuses, as a real browser does. */
  constructor(private limit = Infinity) {}
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    const used = [...this.map.entries()].filter(([k]) => k !== key).reduce((n, [k, v]) => n + k.length + v.length, 0);
    if (used + key.length + value.length > this.limit) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
}

function install(limit?: number): MemoryStorage {
  const store = new MemoryStorage(limit);
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  return store;
}

function uninstall(): void {
  Reflect.deleteProperty(globalThis as unknown as Record<string, unknown>, 'localStorage');
}

const start = { year: 2010, month: 8, day: 20 };

function saveOf(state: GameState) {
  return buildSave(state, createRng(state.seed), null, {});
}

describe('engine/slots', () => {
  beforeEach(() => install());
  afterEach(() => uninstall());

  it('says who and where in one line, at every stage of a life', () => {
    const parish = parishState('line');
    expect(describeSave(parish)).toMatch(/^Fr\. \w+, (parochial vicar|administrator|pastor) of .+, \d{4}$/);
    const seminarian: GameState = { ...parish, phase: 'seminary', parish: null, assignment: null, seminary: { ...(parish.seminary ?? ({} as never)), year: 3 } as never };
    expect(describeSave(seminarian)).toMatch(/year 3 of seminary, \d{4}$/);
    const student: GameState = { ...parish, study: { label: 'A licentiate in theology' } as never };
    expect(describeSave(student)).toMatch(/a licentiate in theology, \d{4}$/);
    const bishop: GameState = { ...parish, see: { see: 'Duluth' } as never };
    expect(describeSave(bishop)).toMatch(/Bishop of Duluth, \d{4}$/);
    const ended: GameState = { ...parish, mode: { kind: 'ended', ending: 'retired', summary: { lines: [] } } as never };
    expect(describeSave(ended)).toMatch(/at the end of it, \d{4}$/);
    const nobody: GameState = { ...parish, character: null };
    expect(describeSave(nobody)).toMatch(/^A man not yet made, \d{4}$/);
  });

  it('writes, lists, overwrites, renames and deletes, newest first', () => {
    const state = parishState('shelf');
    expect(slotsAvailable()).toBe(true);
    expect(listSlots()).toEqual([]);
    const first = writeSlot(saveOf(state), { name: 'Before Rome' });
    expect(first.id).toBe('slot1');
    expect(first.name).toBe('Before Rome');
    expect(first.seed).toBe(state.seed);
    expect(first.week).toBe(state.clock.week);
    expect(first.bytes).toBeGreaterThan(1000);
    expect(nextSlotId()).toBe('slot2');
    const second = writeSlot(saveOf({ ...state, clock: { ...state.clock, week: state.clock.week + 52 } }));
    expect(second.id).toBe('slot2');
    // The unnamed one is called after the man himself.
    expect(second.name).toBe(second.line);
    expect(listSlots().map((m) => m.id)).toEqual(['slot2', 'slot1']);

    // Overwriting keeps the slot and takes the new week.
    const over = writeSlot(saveOf({ ...state, clock: { ...state.clock, week: 900 } }), { id: 'slot1', name: 'Before Rome' });
    expect(over.id).toBe('slot1');
    expect(listSlots().length).toBe(2);
    expect(listSlots().find((m) => m.id === 'slot1')!.week).toBe(900);

    renameSlot('slot1', 'The hard parish');
    expect(listSlots().find((m) => m.id === 'slot1')!.name).toBe('The hard parish');

    deleteSlot('slot1');
    expect(listSlots().map((m) => m.id)).toEqual(['slot2']);
    expect(readSlot('slot1')).toBeNull();
    expect(() => loadSlot('slot1')).toThrow(SlotError);
  });

  it('the autosave is its own slot, and never one of the shelf', () => {
    const state = parishState('auto');
    const auto = writeSlot(saveOf(state), { auto: true });
    expect(auto.id).toBe(SLOTS.autoId);
    expect(auto.auto).toBe(true);
    expect(auto.name).toBe('Autosave');
    expect(nextSlotId()).toBe('slot1');
    // Writing it again overwrites, never accumulates.
    writeSlot(saveOf({ ...state, clock: { ...state.clock, week: 300 } }), { auto: true });
    expect(listSlots().filter((m) => m.auto).length).toBe(1);
    expect(listSlots()[0]!.week).toBe(300);
  });

  it('a save comes back the state it was, and the shelf holds its limit', () => {
    const state = parishState('round');
    writeSlot(saveOf(state), { name: 'x' });
    const back = loadSlot('slot1');
    expect(back.state.seed).toBe(state.seed);
    expect(back.state.clock).toEqual(state.clock);
    expect(back.state.world!.parishes.length).toBe(state.world!.parishes.length);
    expect(Object.keys(back.state.npcs).length).toBe(Object.keys(state.npcs).length);
    // The compact JSON on the shelf parses to the same save a downloaded file would.
    expect(deserialize(readSlot('slot1')!).state.character!.name).toEqual(state.character!.name);

    for (let i = 2; i <= SLOTS.max; i++) writeSlot(saveOf(state));
    expect(listSlots().filter((m) => !m.auto).length).toBe(SLOTS.max);
    expect(() => nextSlotId()).toThrow(SlotError);
    expect(() => writeSlot(saveOf(state))).toThrow(/delete one/);
    // An overwrite is still allowed when the shelf is full.
    expect(writeSlot(saveOf(state), { id: 'slot3' }).id).toBe('slot3');
  });

  it('a browser out of room says so, and one that refuses storage is simply without a shelf', () => {
    install(5_000);
    expect(() => writeSlot(saveOf(parishState('tight')))).toThrow(/out of room/);
    expect(listSlots()).toEqual([]);
    uninstall();
    expect(slotsAvailable()).toBe(false);
    expect(listSlots()).toEqual([]);
    expect(readSlot('slot1')).toBeNull();
    expect(() => writeSlot(saveOf(parishState('none')))).toThrow(/will not keep saves/);
    // Deleting without storage is a no-op, not a crash.
    expect(() => deleteSlot('slot1')).not.toThrow();
  });
});

describe('the store keeps the run in the browser', () => {
  beforeEach(() => {
    install();
    resetAutosaveClock();
    setWeekDraw(noDraw);
    useGameStore.getState().newGame({ seed: 'slots-store', start });
    useGameStore.setState((s) => ({ game: { ...s.game!, mode: { kind: 'clock' } }, slots: [], slotId: null }));
  });
  afterEach(() => uninstall());

  it('autosaves as the weeks pass, and the title screen can continue from it', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    // The clock alone writes it: no button, no other action.
    s.tick();
    const slots = useGameStore.getState().slots;
    expect(slots.map((m) => m.id)).toEqual([SLOTS.autoId]);
    // The test store has no character yet; the line still says where the clock stands.
    expect(slots[0]!.line).toMatch(/\d{4}$/);
    const week = useGameStore.getState().game!.clock.week;

    // Play on, then continue from the autosave: the week comes back. (The throttle holds the
    // autosave at the first week, which is the point of it: one write, not one a week.)
    useGameStore.getState().tick();
    useGameStore.getState().tick();
    expect(useGameStore.getState().slots[0]!.week).toBe(week);
    expect(useGameStore.getState().game!.clock.week).toBe(week + 2);
    useGameStore.getState().loadSlot(SLOTS.autoId);
    expect(useGameStore.getState().game!.clock.week).toBe(week);
    expect(useGameStore.getState().game!.speed).toBe('PAUSED');
    expect(useGameStore.getState().error).toBeNull();

    // And the RNG comes back with it: the same week replays identically.
    const after = () => {
      useGameStore.getState().setSpeed('MANUAL');
      useGameStore.getState().tick();
      return JSON.stringify(useGameStore.getState().game);
    };
    const once = after();
    useGameStore.getState().loadSlot(SLOTS.autoId);
    expect(after()).toBe(once);
    expect(currentRng()!.seed).toBe('slots-store');

    // And the page being closed writes it wherever the run stands, throttle or no.
    useGameStore.getState().tick();
    useGameStore.getState().tick();
    useGameStore.getState().autosaveNow();
    expect(useGameStore.getState().slots[0]!.week).toBe(useGameStore.getState().game!.clock.week);
  });

  it('a named save is written, listed, loaded and deleted from the sheet', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    s.tick();
    s.saveToSlot({ name: 'Second year' });
    const saved = useGameStore.getState();
    expect(saved.slotId).toBe('slot1');
    expect(saved.slots.find((m) => m.id === 'slot1')!.name).toBe('Second year');
    expect(saved.error).toBeNull();

    useGameStore.getState().tick();
    useGameStore.getState().saveToSlot({ id: 'slot1', name: 'Second year' });
    expect(useGameStore.getState().slots.filter((m) => !m.auto).length).toBe(1);

    useGameStore.getState().newGame({ seed: 'another', start });
    expect(useGameStore.getState().slotId).toBeNull();
    // Beginning another man set the first one aside as well; the named save is untouched.
    const setAside = useGameStore.getState().slots.find((m) => m.name.startsWith('Set aside:'))!;
    expect(setAside.seed).toBe('slots-store');
    useGameStore.getState().loadSlot('slot1');
    expect(useGameStore.getState().game!.seed).toBe('slots-store');
    expect(useGameStore.getState().slotId).toBe('slot1');

    useGameStore.getState().deleteSlot('slot1');
    useGameStore.getState().deleteSlot(setAside.id);
    expect(useGameStore.getState().slots.filter((m) => !m.auto)).toEqual([]);
    expect(useGameStore.getState().slotId).toBeNull();
  });

  it('beginning a new man sets the last run aside instead of writing over it', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    s.tick();
    const week = useGameStore.getState().game!.clock.week;
    expect(useGameStore.getState().slots.map((m) => m.id)).toEqual([SLOTS.autoId]);

    useGameStore.getState().newGame({ seed: 'a-second-man', start });
    const after = useGameStore.getState().slots;
    const kept = after.find((m) => !m.auto)!;
    expect(kept.seed).toBe('slots-store');
    expect(kept.week).toBe(week);
    expect(kept.name).toMatch(/^Set aside: /);
    // The old run comes back whole.
    useGameStore.getState().loadSlot(kept.id);
    expect(useGameStore.getState().game!.seed).toBe('slots-store');
    expect(useGameStore.getState().game!.clock.week).toBe(week);

    // Beginning the same man again sets nothing aside twice.
    useGameStore.getState().newGame({ seed: 'a-second-man', start });
    useGameStore.getState().newGame({ seed: 'a-third-man', start });
    expect(useGameStore.getState().slots.filter((m) => !m.auto).length).toBe(1);
  });

  it('a shelf that is full says so, and the week goes on', () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    for (let i = 0; i < SLOTS.max; i++) useGameStore.getState().saveToSlot({});
    useGameStore.getState().saveToSlot({});
    expect(useGameStore.getState().error).toMatch(/delete one/);
    expect(useGameStore.getState().slots.filter((m) => !m.auto).length).toBe(SLOTS.max);
    // The error does not stop the clock.
    useGameStore.getState().tick();
    expect(useGameStore.getState().game!.clock.week).toBeGreaterThan(0);
  });
});
