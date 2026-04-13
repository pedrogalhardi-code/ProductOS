import { create } from 'zustand';
import type { ProjectDto } from '@shared/types';

interface ProjectState {
  projects: ProjectDto[];
  currentProject: ProjectDto | null;
  setProjects: (projects: ProjectDto[]) => void;
  setCurrentProject: (project: ProjectDto | null) => void;
  addProject: (project: ProjectDto) => void;
  updateProject: (project: ProjectDto) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  updateProject: (project) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === project.id ? project : p)),
      currentProject: s.currentProject?.id === project.id ? project : s.currentProject,
    })),
}));
