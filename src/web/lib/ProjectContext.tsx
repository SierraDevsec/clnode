import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, type Project } from "./api";

interface ProjectContextType {
  projects: Project[];
  selected: string | null;
  setSelected: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selected: null,
  setSelected: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.projects().then(setProjects);
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, selected, setSelected }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
