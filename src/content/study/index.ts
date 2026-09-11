import type { StudyActivityDef, StudyProgramDef } from '@/types';
import programs from './programs.json';
import activities from './activities.json';

export const studyPrograms = programs as StudyProgramDef[];
export const studyActivities = activities as StudyActivityDef[];

export function studyProgram(id: string): StudyProgramDef | undefined {
  return studyPrograms.find((p) => p.id === id);
}

export function studyActivity(id: string): StudyActivityDef | undefined {
  return studyActivities.find((a) => a.id === id);
}
