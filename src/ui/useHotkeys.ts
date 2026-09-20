import { useEffect } from 'react';
import { useGameStore } from '@/engine/store';
import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';

/** Keys a typing field should keep for itself. */
function inField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * The keys: N or Space for the next week (or Go/Hold when the clock runs on
 * its own), 1–9 for the choices on a scene, Z to take the week back. Nothing
 * here decides anything the buttons do not; a key is a button pressed sooner.
 */
export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      const st = useGameStore.getState();
      const game = st.game;
      if (!game || game.mode.kind === 'creation' || game.mode.kind === 'ended') return;
      const pending = game.pending[0];
      if (/^[1-9]$/.test(e.key)) {
        if (!pending) return;
        const event = eventById(pending.eventId);
        if (!event) return;
        const open = visibleChoices(event, game, pending.bindings).filter((v) => v.available);
        const pick = open[Number(e.key) - 1];
        if (pick) {
          e.preventDefault();
          st.resolveEvent(pick.choice.id);
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'n' || key === ' ') {
        // A decision on the table holds the clock; the key does not push past it.
        if (pending || game.mode.kind !== 'clock' || game.offers.some((o) => !o.read)) return;
        e.preventDefault();
        if (game.speed === 'MANUAL') st.tick();
        else if (game.speed === 'AUTO' || game.speed === 'SKIP') st.setRunning(!st.running);
        return;
      }
      if (key === 'z') {
        if (st.previous && !pending) {
          e.preventDefault();
          st.rewind();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
