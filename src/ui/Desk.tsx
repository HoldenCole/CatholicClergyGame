import { useGameStore } from '@/engine/store';
import { useUiStore, type Sheet } from './uiStore';
import RoutinePanel from './parish/RoutinePanel';
import SeminaryRoutinePanel from './seminary/SeminaryRoutinePanel';
import StudyRoutinePanel from './study/StudyRoutinePanel';
import ParishPanel from './parish/ParishPanel';
import GroupsPanel from './parish/GroupsPanel';
import ClassmatesPanel from './parish/ClassmatesPanel';
import PeoplePanel from './parish/PeoplePanel';
import SeePanel from './study/SeePanel';
import PlacePanel from './study/PlacePanel';
import ProjectsPanel from './parish/ProjectsPanel';
import OffersPanel from './seminary/OffersPanel';
import FormationPanel from './seminary/FormationPanel';
import DigestPanel from './DigestPanel';
import JobsPanel from './JobsPanel';
import ClubsPanel from './ClubsPanel';
import InterruptSettings from './InterruptSettings';
import SavePanel from './SavePanel';
import SettingsPanel from './SettingsPanel';
import FurnishPanel from './scenes/FurnishPanel';

const LABEL: Record<Sheet, string> = {
  week: 'Week',
  parish: 'Parish',
  see: 'The see',
  place: 'The work',
  people: 'People',
  jobs: 'Jobs',
  clubs: 'Clubs',
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
  const away = !!game.study;
  const tabs: Sheet[] = inParish ? ['week', 'parish', 'people', 'jobs', 'clubs', 'letters', 'record', 'settings'] : away ? (game.see ? ['week', 'see', 'jobs', 'letters', 'record', 'settings'] : game.study?.place ? ['week', 'place', 'jobs', 'letters', 'record', 'settings'] : ['week', 'jobs', 'letters', 'record', 'settings']) : ['week', 'formation', 'jobs', 'clubs', 'letters', 'record', 'settings'];
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
        {open === 'week' && (inParish ? <RoutinePanel /> : away ? <StudyRoutinePanel /> : <SeminaryRoutinePanel />)}
        {open === 'parish' && <ParishPanel />}
        {open === 'see' && <SeePanel />}
        {open === 'place' && <PlacePanel />}
        {open === 'people' && (
          <>
            <GroupsPanel />
            <PeoplePanel />
            <ProjectsPanel />
            <ClassmatesPanel />
          </>
        )}
        {open === 'jobs' && <JobsPanel />}
        {open === 'clubs' && <ClubsPanel />}
        {open === 'letters' && <OffersPanel />}
        {open === 'record' && <DigestPanel />}
        {open === 'formation' && <FormationPanel />}
        {open === 'settings' && (
          <>
            <SettingsPanel />
            <InterruptSettings />
            <SavePanel />
          </>
        )}
        {open === 'furnish' && furnishing && <FurnishPanel place={furnishing} />}
      </div>
    </div>
  );
}
