import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { actionById, obligationDefs } from '@/content/parish';
import { seasonOf } from '@/engine/time';
import { planWeek } from '@/systems/week';
import type { Quality } from '@/types';
import SceneArt from './SceneArt';
import { CHANCERY_SCENE, SCENES, SEMINARY_SCENE, sceneById, type HotspotBinding, type SceneId } from './scenes';
import FurnishPanel from './FurnishPanel';
import type { DecorPlace } from '@/types';

const NEXT_QUALITY: Record<Quality, Quality> = { min: 'standard', standard: 'invested', invested: 'min' };

/**
 * The environment. Hotspots are read from the scene table and bound to the
 * actions, obligations, and panels the systems already expose, so clicking
 * the confessional is the same routine change as pressing "+" in the list.
 */
export default function SceneView({ onPanel }: { onPanel: (panel: string) => void }) {
  const game = useGameStore((s) => s.game);
  const setDiscretionary = useGameStore((s) => s.setDiscretionary);
  const setObligation = useGameStore((s) => s.setObligation);
  const inSeminary = !!game?.seminary && !game?.parish;
  const [sceneId, setSceneId] = useState<SceneId>(inSeminary ? 'seminary_room' : 'rectory');
  const [hover, setHover] = useState<string | null>(null);
  const [furnishing, setFurnishing] = useState<DecorPlace | null>(null);
  if (!game || (!game.parish && !game.seminary)) return null;
  const scene = sceneById(inSeminary ? 'seminary_room' : sceneId);
  const plan = game.parish ? planWeek(game) : null;
  const routine = game.parish?.routine ?? { obligations: {} as Record<string, never>, discretionary: {} as Record<string, number> };
  const hasChancery = Object.keys(game.flags).some((k) => k.startsWith('office:') && game.flags[k]);
  const rooms = inSeminary ? [SEMINARY_SCENE] : hasChancery ? [...SCENES, CHANCERY_SCENE] : SCENES;

  const describe = (binds: HotspotBinding): string => {
    switch (binds.kind) {
      case 'action': {
        const def = actionById(binds.actionId);
        const ap = routine.discretionary[binds.actionId] ?? 0;
        return def ? `${def.label}: ${ap} hour${ap === 1 ? '' : 's'} a week${ap >= def.maxAp ? ' (as much as does any good; click to clear)' : ' (click for one more)'}` : binds.actionId;
      }
      case 'obligation': {
        const def = obligationDefs.find((o) => o.key === binds.key)!;
        const q = (routine.obligations as Record<string, Quality>)[binds.key] ?? 'standard';
        const actual = plan?.obligations[binds.key] ?? q;
        return `${def.label}: ${q}${actual !== q ? `, cut to ${actual} this week` : ''}. ${def.blurb[q]} (click to change)`;
      }
      case 'panel':
        return `Open: ${binds.panel}`;
      case 'furnish':
        return binds.place === 'church' ? 'How the church looks. The pastor decides.' : 'How this room looks. Click to change it.';
      case 'scene':
        return sceneById(binds.scene).label;
    }
  };

  const act = (binds: HotspotBinding) => {
    switch (binds.kind) {
      case 'action': {
        const def = actionById(binds.actionId);
        if (!def) return;
        const ap = routine.discretionary[binds.actionId] ?? 0;
        setDiscretionary(binds.actionId, ap >= def.maxAp ? 0 : ap + 1);
        break;
      }
      case 'obligation': {
        const def = obligationDefs.find((o) => o.key === binds.key)!;
        let next = NEXT_QUALITY[(routine.obligations as Record<string, Quality>)[binds.key] ?? 'standard'];
        if (next === 'invested' && def.ap.invested === null) next = 'min';
        setObligation(binds.key, next);
        break;
      }
      case 'panel':
        onPanel(binds.panel);
        break;
      case 'furnish':
        setFurnishing(binds.place);
        break;
      case 'scene':
        setSceneId(binds.scene);
        setHover(null);
        break;
    }
  };

  const hovered = scene.hotspots.find((h) => h.id === hover);
  return (
    <div className="rounded border border-stone-800 bg-stone-900/60">
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-2">
        <span className="text-xs uppercase tracking-widest text-stone-400">{scene.label}</span>
        <nav className="flex gap-1">
          {rooms.map((s) => (
            <button
              key={s.id}
              onClick={() => setSceneId(s.id)}
              className={'rounded px-2 py-0.5 text-xs ' + (s.id === sceneId ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300')}
            >
              {s.label.replace('The ', '')}
            </button>
          ))}
        </nav>
      </div>
      <div className="relative aspect-[100/60] w-full overflow-hidden">
        <SceneArt scene={scene.id} season={seasonOf(game.clock)} state={game} />
        {scene.hotspots.map((h) => {
          const active = h.binds.kind === 'action' ? (routine.discretionary[h.binds.actionId] ?? 0) > 0 : h.binds.kind === 'obligation' ? (routine.obligations as Record<string, Quality>)[h.binds.key] !== 'standard' : false;
          return (
            <button
              key={h.id}
              aria-label={h.label}
              onMouseEnter={() => setHover(h.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(h.id)}
              onBlur={() => setHover(null)}
              onClick={() => act(h.binds)}
              style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
              className={
                'absolute rounded-sm border transition-colors ' +
                (hover === h.id ? 'border-amber-400/80 bg-amber-300/10' : active ? 'border-amber-700/50 bg-amber-900/10' : 'border-transparent hover:border-amber-400/60')
              }
            />
          );
        })}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-950/90 to-transparent px-4 py-2 text-sm text-stone-200">
          {hovered ? describe(hovered.binds) : inSeminary ? 'Your room. The shelf fills with what you give the year to.' : 'Everything in the room is something you could do with the week.'}
        </div>
      </div>
      {furnishing && <FurnishPanel place={furnishing} onClose={() => setFurnishing(null)} />}
    </div>
  );
}
