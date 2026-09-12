import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { actionById, obligationDefs } from '@/content/parish';
import { seminaryActivity } from '@/content/seminary';
import { routineHours, routineOf, seminaryBudget } from '@/systems/seminaryWeek';
import { studyActivity } from '@/content/study';
import { studyActivitiesFor, studyBudget, studyHours } from '@/systems/studyWeek';
import { seasonOf } from '@/engine/time';
import { hoursOf, planWeek } from '@/systems/week';
import { previewState } from '@/systems/decor';
import type { DecorPlace, Quality } from '@/types';
import SceneArt from './SceneArt';
import { CHANCERY_SCENE, SCENES, SEMINARY_HALL, SEMINARY_SCENE, sceneById, type HotspotBinding, type SceneId } from './scenes';
import { useUiStore, type Sheet } from '../uiStore';

const NEXT_QUALITY: Record<Quality, Quality> = { min: 'standard', standard: 'invested', invested: 'min' };
const PANEL_SHEET: Record<string, Sheet> = { routine: 'week', groups: 'people', projects: 'people', offers: 'letters', digest: 'record', parish: 'parish', formation: 'formation', clubs: 'clubs' };
const PLACE_SCENE: Record<DecorPlace, SceneId> = { church: 'church', chapel: 'chapel', office: 'office', rectory: 'rectory', seminary_room: 'seminary_room', chancery: 'chancery' };

/**
 * The room. Hotspots are read from the scene table and bound to the
 * actions, obligations, and sheets the systems already expose, so clicking
 * the confessional is the same routine change as pressing "+" on the sheet.
 */
export default function SceneView() {
  const game = useGameStore((s) => s.game);
  const setDiscretionary = useGameStore((s) => s.setDiscretionary);
  const setObligation = useGameStore((s) => s.setObligation);
  const setSeminaryActivity = useGameStore((s) => s.setSeminaryActivity);
  const setStudyActivity = useGameStore((s) => s.setStudyActivity);
  const chosenScene = useUiStore((s) => s.scene);
  const setScene = useUiStore((s) => s.setScene);
  const openSheet = useUiStore((s) => s.openSheet);
  const furnish = useUiStore((s) => s.furnish);
  const hoverPreview = useUiStore((s) => s.preview);
  const selected = useUiStore((s) => s.selected);
  const preview = selected ?? hoverPreview;
  const [hover, setHover] = useState<string | null>(null);
  const hints = useUiStore((s) => s.prefs.hints);
  if (!game || (!game.parish && !game.seminary && !game.study)) return null;
  const away = !!game.study;
  const inSeminary = !away && !!game.seminary && !game.parish;
  const seminaryScenes: SceneId[] = ['seminary_room', 'seminary_hall'];
  const studyScenes: SceneId[] = ['study_room', 'study_city'];
  const sceneId: SceneId = away
    ? (chosenScene && studyScenes.includes(chosenScene) ? chosenScene : 'study_room')
    : inSeminary ? (chosenScene && seminaryScenes.includes(chosenScene) ? chosenScene : 'seminary_room') : chosenScene && !seminaryScenes.includes(chosenScene) && !studyScenes.includes(chosenScene) ? chosenScene : 'rectory';
  const scene = sceneById(sceneId, game.study?.city ?? 'rome');
  const studyRoutine = game.study?.routine ?? {};
  const plan = game.parish ? planWeek(game) : null;
  const routine = game.parish?.routine ?? { obligations: {} as Record<string, never>, discretionary: {} as Record<string, number> };
  const hasChancery = Object.keys(game.flags).some((k) => k.startsWith('office:') && game.flags[k]);
  const rooms = away ? [sceneById('study_room', game.study?.city ?? 'rome'), sceneById('study_city', game.study?.city ?? 'rome')] : inSeminary ? [SEMINARY_SCENE, SEMINARY_HALL] : hasChancery ? [...SCENES, CHANCERY_SCENE] : SCENES;
  const semRoutine = game.seminary ? routineOf(game.seminary) : {};
  const shown = preview ? previewState(game, preview.place, preview.optionId) : game;

  const describe = (binds: HotspotBinding): string => {
    switch (binds.kind) {
      case 'action': {
        const def = actionById(binds.actionId);
        const ap = routine.discretionary[binds.actionId] ?? 0;
        return def ? `${def.label}: ${hoursOf(ap)} hours a week${ap >= def.maxAp ? ' (as much as does any good; click to clear)' : ' (click for four more)'}` : binds.actionId;
      }
      case 'seminary_action': {
        const def = seminaryActivity(binds.activityId);
        if (!def || !game.seminary) return binds.activityId;
        const ap = semRoutine[binds.activityId] ?? 0;
        const left = seminaryBudget(game) - routineHours(game.seminary);
        return `${def.label}: ${ap} hour${ap === 1 ? '' : 's'} a week. ${def.blurb} (${ap >= def.maxAp ? 'click to clear' : left > 0 ? 'click for one more' : 'no hours left; take one from something else'})`;
      }
      case 'study_action': {
        const def = studyActivity(binds.activityId);
        if (!def || !game.study) return binds.activityId;
        const ap = studyRoutine[binds.activityId] ?? 0;
        const av = studyActivitiesFor(game).find((a) => a.def.id === binds.activityId);
        const left = studyBudget(game) - studyHours(game.study);
        if (av && !av.available) return `${def.label}: not yet; it needs ${av.why}. ${def.blurb}`;
        return `${def.label}: ${ap} hour${ap === 1 ? '' : 's'} a week. ${def.blurb} (${ap >= def.maxAp ? 'click to clear' : left > 0 ? 'click for one more' : 'no hours left; take one from something else'})`;
      }
      case 'obligation': {
        const def = obligationDefs.find((o) => o.key === binds.key)!;
        const q = (routine.obligations as Record<string, Quality>)[binds.key] ?? 'standard';
        const actual = plan?.obligations[binds.key] ?? q;
        return `${def.label}: ${q}${actual !== q ? `, cut to ${actual} this week` : ''}. ${def.blurb[q]} (click to change)`;
      }
      case 'panel':
        return `Open the sheet: ${binds.panel}`;
      case 'furnish':
        return binds.place === 'church' ? 'How the church looks. The pastor decides; the bishop has a say.' : 'How this room looks. Click to change it.';
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
        openSheet('week');
        break;
      }
      case 'seminary_action': {
        const def = seminaryActivity(binds.activityId);
        if (!def) return;
        const ap = semRoutine[binds.activityId] ?? 0;
        setSeminaryActivity(binds.activityId, ap >= def.maxAp ? 0 : ap + 1);
        openSheet('week');
        break;
      }
      case 'study_action': {
        const def = studyActivity(binds.activityId);
        if (!def) return;
        const av = studyActivitiesFor(game).find((a) => a.def.id === binds.activityId);
        if (av && !av.available) { openSheet('week'); return; }
        const ap = studyRoutine[binds.activityId] ?? 0;
        setStudyActivity(binds.activityId, ap >= def.maxAp ? 0 : ap + 1);
        openSheet('week');
        break;
      }
      case 'obligation': {
        const def = obligationDefs.find((o) => o.key === binds.key)!;
        let next = NEXT_QUALITY[(routine.obligations as Record<string, Quality>)[binds.key] ?? 'standard'];
        if (next === 'invested' && def.ap.invested === null) next = 'min';
        setObligation(binds.key, next);
        openSheet('week');
        break;
      }
      case 'panel':
        openSheet(PANEL_SHEET[binds.panel] ?? 'week');
        break;
      case 'furnish':
        furnish(binds.place);
        if (!inSeminary) setScene(PLACE_SCENE[binds.place]);
        break;
      case 'scene':
        setScene(binds.scene);
        setHover(null);
        break;
    }
  };

  const hovered = scene.hotspots.find((h) => h.id === hover);
  return (
    <div className="overflow-hidden rounded-sm border border-[#3a2a18] shadow-[0_18px_40px_rgba(0,0,0,0.6)]">
      <div className="plate flex items-center justify-between px-4 py-1.5">
        <span className="heading" style={{ color: '#e6c25a' }}>{scene.label}</span>
        <nav className="flex gap-0.5">
          {rooms.map((s) => (
            <button
              key={s.id}
              onClick={() => setScene(s.id)}
              className={'rounded px-2 py-0.5 text-xs ' + (s.id === sceneId ? 'bg-[#c9a24a] text-[#2b2116]' : 'text-[#cbbfa4] hover:text-[#f1e8d3]')}
            >
              {s.label.replace('The ', '').replace('Your ', '')}
            </button>
          ))}
        </nav>
      </div>
      <div className="relative aspect-[100/60] w-full overflow-hidden bg-[#1a120c]">
        <SceneArt scene={scene.id} season={seasonOf(game.clock)} state={shown} />
        {preview && <div className="pointer-events-none absolute left-3 top-3 rounded bg-[#2b2116]/80 px-2 py-1 text-xs text-[#e6c25a]">As it would look</div>}
        {scene.hotspots.map((h) => {
          const active = h.binds.kind === 'action' ? (routine.discretionary[h.binds.actionId] ?? 0) > 0 : h.binds.kind === 'seminary_action' ? (semRoutine[h.binds.activityId] ?? 0) > 0 : h.binds.kind === 'study_action' ? (studyRoutine[h.binds.activityId] ?? 0) > 0 : h.binds.kind === 'obligation' ? (routine.obligations as Record<string, Quality>)[h.binds.key] !== 'standard' : false;
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
              className={'hotspot ' + (active ? 'hotspot-active' : '')}
            />
          );
        })}
      </div>
      <div className="plate px-4 py-2">
        {hovered ? describe(hovered.binds) : hints ? `Here: ${scene.hotspots.map((h) => h.label.split(':')[0]!.toLowerCase()).join(', ')}.` : away ? 'A room in a city that does not know you. The hours are yours; the years are the diocese\'s.' : inSeminary ? 'Your room. The shelf fills with what you give the year to.' : 'Everything in the room is something you could do with the week.'}
      </div>
    </div>
  );
}
