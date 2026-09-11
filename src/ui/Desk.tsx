import { useGameStore } from '@/engine/store';
import { useUiStore, type Sheet } from './uiStore';
import RoutinePanel from './parish/RoutinePanel';
import SeminaryRoutinePanel from './seminary/SeminaryRoutinePanel';
import ParishPanel from './parish/ParishPanel';
import GroupsPanel from './parish/GroupsPanel';
import ProjectsPanel from './parish/ProjectsPanel';
import OffersPanel from './seminary/OffersPanel';
import FormationPanel from './seminary/FormationPanel';
import DigestPanel from './DigestPanel';
import JobsPanel from './JobsPanel';
import InterruptSettings from './InterruptSettings';
import SavePanel from './SavePanel';
import SettingsPanel from './SettingsPanel';
import FurnishPanel from './scenes/FurnishPanel';

const LABEL: Record<Sheet, string> = {
  week: 'Week',
  parish: 'Parish',
  people: 'People',
  jobs: 'Jobs',
  letters: 'Letters',
  record: 'Record',
  formation: 'Formation',
  settings: 'Settings',
  furnish: 'Furnish',
};

/**
 * The desk: one sheet open at a time, chosen by the tabs or by clicking
 * something in the room. Fewer menus, more paper.
 */
export default function Desk() {
  const game = useGameStore((s) => s.game);
  const sheet = useUiStore((s) => s.sheet);
  const openSheet = useUiStore((s) => s.openSheet);
  const furnishing = useUiStore((s) => s.furnishing);
  if (!game) return null;
  const inParish = !!game.parish;
  const tabs: Sheet[] = inParish ? ['week', 'parish', 'people', 'jobs', 'letters', 'record', 'settings'] : ['week', 'formation', 'jobs', 'letters', 'record', 'settings'];
  if (furnishing) tabs.push('furnish');
  const open = sheet ?? 'week';
  const letters = game.offers.length;

  return (
    <div className="desk flex h-[calc(100vh-88px)] min-h-[560px] flex-col">
      <div className="flex flex-wrap gap-1 px-2">
        {tabs.map((t) => (
          <button key={t} className={'tab ' + (t === open ? 'tab-active' : '')} onClick={() => openSheet(t)}>
            {LABEL[t]}
            {t === 'letters' && letters > 0 && <span className="tab-dot" aria-label={`${letters} waiting`} />}
          </button>
        ))}
      </div>
      <div className="scroll-paper paper flex-1 overflow-y-auto">
        {open === 'week' && (inParish ? <RoutinePanel /> : <SeminaryRoutinePanel />)}
        {open === 'parish' && <ParishPanel />}
        {open === 'people' && (
          <>
            <GroupsPanel />
            <ProjectsPanel />
          </>
        )}
        {open === 'jobs' && <JobsPanel />}
        {open === 'letters' && <OffersPanel />}
        {open === 'record' && <DigestPanel />}
        {open === 'formation' && <FormationPanel />}
        {open === 'settings' && (
          <>
            <InterruptSettings />
            <SavePanel />
            <SettingsPanel />
          </>
        )}
        {open === 'furnish' && furnishing && <FurnishPanel place={furnishing} />}
      </div>
    </div>
  );
}
