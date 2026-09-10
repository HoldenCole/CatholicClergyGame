import { useEffect } from 'react';
import { useGameStore } from '@/engine/store';

/** Milliseconds per week while the clock runs on a timer. */
const TICK_MS = { AUTO: 250, SKIP: 40 } as const;

/** Ticks the store one week at a time while `running` is set. */
export function useClockRunner(): void {
  const running = useGameStore((s) => s.running);
  const speed = useGameStore((s) => s.game?.speed);

  useEffect(() => {
    if (!running || (speed !== 'AUTO' && speed !== 'SKIP')) return;
    const id = window.setInterval(() => {
      useGameStore.getState().tick(1);
    }, TICK_MS[speed]);
    return () => window.clearInterval(id);
  }, [running, speed]);
}
