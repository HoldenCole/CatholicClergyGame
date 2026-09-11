import { create } from 'zustand';
import type { DecorPlace } from '@/types';
import type { SceneId } from './scenes/scenes';

/** The sheets on the desk. One is open at a time. */
export type Sheet = 'week' | 'parish' | 'people' | 'jobs' | 'clubs' | 'letters' | 'record' | 'formation' | 'settings' | 'furnish';

interface UiState {
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
