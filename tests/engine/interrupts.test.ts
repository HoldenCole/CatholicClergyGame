import { describe, it, expect } from 'vitest';
import { defaultInterruptConfig, shouldInterrupt } from '@/engine/interrupts';
import { EVENT_CATEGORIES } from '@/types';

describe('engine/interrupts', () => {
  const config = defaultInterruptConfig();

  it('defaults to stopping on everything except routine finance and admin', () => {
    for (const category of EVENT_CATEGORIES) {
      const routineStops = shouldInterrupt(config, { severity: 'ROUTINE', category });
      expect(routineStops).toBe(category !== 'finance' && category !== 'admin');
      expect(shouldInterrupt(config, { severity: 'NOTABLE', category })).toBe(true);
    }
  });

  it('CRITICAL always stops, even when a category is set to never', () => {
    const muted = { ...config, scandal: 'never' as const };
    expect(shouldInterrupt(muted, { severity: 'MAJOR', category: 'scandal' })).toBe(false);
    expect(shouldInterrupt(muted, { severity: 'CRITICAL', category: 'scandal' })).toBe(true);
  });

  it('treats the level as a minimum severity', () => {
    const cfg = { ...config, group: 'MAJOR' as const };
    expect(shouldInterrupt(cfg, { severity: 'ROUTINE', category: 'group' })).toBe(false);
    expect(shouldInterrupt(cfg, { severity: 'NOTABLE', category: 'group' })).toBe(false);
    expect(shouldInterrupt(cfg, { severity: 'MAJOR', category: 'group' })).toBe(true);
  });
});
