import type { DiocesePreset } from '@/types';

const modules = import.meta.glob<{ default: DiocesePreset }>('./*.json', { eager: true });

/** The five presets, in a fixed order so the preview is stable. */
export const diocesePresets: DiocesePreset[] = ['new_york', 'chicago', 'los_angeles', 'houston', 'washington']
  .map((id) => Object.values(modules).find((m) => m.default.id === id)?.default)
  .filter((p): p is DiocesePreset => !!p);

export function presetById(id: string): DiocesePreset | undefined {
  return diocesePresets.find((p) => p.id === id);
}
