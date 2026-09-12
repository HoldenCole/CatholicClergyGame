import { create } from 'zustand';
import type { DecorPlace } from '@/types';
import type { SceneId } from './scenes/scenes';

/** The sheets on the desk. One is open at a time. */
export type Sheet = 'week' | 'parish' | 'see' | 'place' | 'people' | 'jobs' | 'clubs' | 'letters' | 'record' | 'formation' | 'settings' | 'furnish';

/** Reading preferences: kept in the browser, never in the save. */
export interface Prefs {
  fontScale: 'small' | 'normal' | 'large';
  reducedMotion: boolean;
  /** One-line hints under each room naming what can be clicked. */
  hints: boolean;
  /** The note left for the man on his first week in each phase. */
  briefings: boolean;
  seen: string[];
}

const DEFAULT_PREFS: Prefs = { fontScale: 'normal', reducedMotion: false, hints: true, briefings: true, seen: [] };
const PREFS_KEY = 'vocation:prefs';

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...parsed, seen: Array.isArray(parsed.seen) ? parsed.seen : [] };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* a private window, or storage refused: the prefs live for the session */
  }
}

interface UiState {
  prefs: Prefs;
  setPrefs(partial: Partial<Prefs>): void;
  sheet: Sheet | null;
  scene: SceneId | null;
  /** The place being furnished while the furnish sheet is open. */
  furnishing: DecorPlace | null;
  /** An option hovered on the furnish sheet, shown in the scene before it is bought. */
  preview: { place: DecorPlace; optionId: string } | null;
  /** An option picked on the furnish sheet, held in the scene until bought or dismissed. */
  selected: { place: DecorPlace; optionId: string } | null;
  openSheet(sheet: Sheet | null): void;
  setScene(scene: SceneId): void;
  furnish(place: DecorPlace | null): void;
  setPreview(preview: UiState['preview']): void;
  select(selected: UiState['selected']): void;
}

/** Layout state that is not part of the game and never saved. */
export const useUiStore = create<UiState>((set) => ({
  prefs: loadPrefs(),
  setPrefs: (partial) =>
    set((s) => {
      const prefs = { ...s.prefs, ...partial };
      savePrefs(prefs);
      return { prefs };
    }),
  sheet: null,
  scene: null,
  furnishing: null,
  preview: null,
  selected: null,
  openSheet: (sheet) => set((s) => ({ sheet, furnishing: sheet === 'furnish' ? s.furnishing : null, preview: null, selected: sheet === 'furnish' ? s.selected : null })),
  setScene: (scene) => set({ scene, preview: null }),
  furnish: (place) => set({ furnishing: place, sheet: place ? 'furnish' : null, preview: null, selected: null }),
  setPreview: (preview) => set({ preview }),
  select: (selected) => set({ selected, preview: null }),
}));
