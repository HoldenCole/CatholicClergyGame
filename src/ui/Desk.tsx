import { useGameStore } from '@/engine/store';
import { useUiStore, type Sheet } from './uiStore';
import RoutinePanel from './parish/RoutinePanel';
import SeminaryRoutinePanel from './seminary/SeminaryRoutinePanel';
import StudyRoutinePanel from './study/StudyRoutinePanel';
import ParishPanel from './parish/ParishPanel';
import MapPanel from './parish/MapPanel';
import DeaneryPanel from './parish/DeaneryPanel';
import GroupsPanel from './parish/GroupsPanel';
import ClassmatesPanel from './parish/ClassmatesPanel';
import PeoplePanel from './parish/PeoplePanel';
import HousesPanel from './parish/HousesPanel';
import WorkPanel from './parish/WorkPanel';
import SideWorkPanel from './parish/SideWorkPanel';
import SeePanel from './study/SeePanel';
import PlacePanel from './study/PlacePanel';
import ProjectsPanel from './parish/ProjectsPanel';
import OffersPanel from './seminary/OffersPanel';
import FormationPanel from './seminary/FormationPanel';
import DigestPanel from './DigestPanel';
import JobsPanel from './JobsPanel';
import ProfilePanel from './ProfilePanel';
import ClubsPanel from './ClubsPanel';
import InterruptSettings from './InterruptSettings';
import SavePanel from './SavePanel';
import SettingsPanel from './SettingsPanel';
import FurnishPanel from './scenes/FurnishPanel';
import HousePanel from './religious/HousePanel';
import HouseAsksPanel from './religious/HouseAsksPanel';
import FriarWeekPanel from './religious/FriarWeekPanel';

const LABEL: Record<Sheet, string> = {
  week: 'Week',
  house: 'House',
  profile: 'You',
  parish: 'Parish',
  map: 'Map',
  deanery: 'Deanery',
  see: 'The see',
  place: 'The work',
  people: 'People',
  jobs: 'Jobs',
  clubs: 'Clubs',
  letters: 'Letters',
  record: 'Record',
  formation: 'Formation',
  settings: 'Saves & settings',
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
  const friar = !!game.religious && !!game.flags.ordained && !inParish && !away;
  const tabs: Sheet[] = friar ? ['week', 'jobs', 'profile', 'clubs', 'letters', 'record', 'settings'] : inParish ? ['week', 'parish', 'people', 'deanery', 'map', 'jobs', 'profile', 'clubs', 'letters', 'record', 'settings'] : away ? (game.see ? ['week', 'see', 'jobs', 'profile', 'letters', 'record', 'settings'] : game.study?.place ? ['week', 'place', 'jobs', 'profile', 'letters', 'record', 'settings'] : ['week', 'jobs', 'profile', 'letters', 'record', 'settings']) : ['week', 'formation', 'jobs', 'profile', 'clubs', 'letters', 'record', 'settings'];
  // A friar lives in a house: its sheet sits beside the week. E3 §3.2.
  if (game.religious) tabs.splice(1, 0, 'house');
  if (furnishing) tabs.push('furnish');
  const open = sheet ?? 'week';
  const letters = game.offers.length;
  // A house of the diocese has asked the parish for something, and silence answers it in six weeks.
  const asks = Object.values(game.houses ?? {}).filter((s) => s.ask).length;

  return (
    <div className="desk flex h-[calc(100vh-88px)] min-h-[560px] flex-col">
      <div className="flex flex-wrap gap-1 px-2">
        {tabs.map((t) => (
          <button key={t} className={'tab ' + (t === open ? 'tab-active' : '')} onClick={() => openSheet(t)}>
            {LABEL[t]}
            {t === 'letters' && letters > 0 && <span className="tab-dot" aria-label={`${letters} waiting`} />}
            {t === 'people' && asks > 0 && <span className="tab-dot" aria-label={`${asks} asked of the parish`} />}
          </button>
        ))}
      </div>
      <div className="scroll-paper paper flex-1 overflow-y-auto">
        {open === 'week' && (inParish ? <RoutinePanel /> : away ? <StudyRoutinePanel /> : game.religious && game.flags.ordained ? <FriarWeekPanel /> : <SeminaryRoutinePanel />)}
        {open === 'house' && (
          <>
            <HousePanel />
            <HouseAsksPanel />
          </>
        )}
        {open === 'parish' && <ParishPanel />}
        {open === 'map' && <MapPanel />}
        {open === 'deanery' && <DeaneryPanel />}
        {open === 'see' && <SeePanel />}
        {open === 'place' && <PlacePanel />}
        {open === 'people' && (
          <>
            <GroupsPanel />
            <HousesPanel />
            <PeoplePanel />
            <ProjectsPanel />
            <WorkPanel />
            <ClassmatesPanel />
          </>
        )}
        {open === 'jobs' && <JobsPanel />}
        {open === 'profile' && (
          <>
            <ProfilePanel />
            <SideWorkPanel />
          </>
        )}
        {open === 'clubs' && <ClubsPanel />}
        {open === 'letters' && <OffersPanel />}
        {open === 'record' && <DigestPanel />}
        {open === 'formation' && <FormationPanel />}
        {open === 'settings' && (
          <>
            <SavePanel />
            <SettingsPanel />
            <InterruptSettings />
          </>
        )}
        {open === 'furnish' && furnishing && <FurnishPanel place={furnishing} />}
      </div>
    </div>
  );
}
