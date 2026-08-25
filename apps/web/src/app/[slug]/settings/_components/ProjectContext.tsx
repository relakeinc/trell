"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

export interface ProjectData {
  id: string;
  name: string;
  slug: string;
  plan: string;
  pk: string;
  domains: string[];
  logoVariant: number;
  createdAt: string;
}

export interface UsageData {
  events: number;
  limit: number;
  domains: number;
  domainLimit: number;
}

interface ProjectContextValue {
  project: ProjectData | null;
  usage: UsageData | null;
  loading: boolean;
  refresh: () => void;
  saveProject: (updates: { name?: string; slug?: string; logoVariant?: number }) => Promise<boolean>;
  setProject: (p: ProjectData) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  project: null,
  usage: null,
  loading: true,
  refresh: () => {},
  saveProject: async () => false,
  setProject: () => {},
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const listRes = await fetch("/api/projects");
      const listData = await listRes.json();
      const match = (listData.projects ?? []).find((p: { slug: string }) => p.slug === slug);
      if (!match) { setLoading(false); return; }

      const detailRes = await fetch(`/api/projects/${match.id}`);
      const detailData = await detailRes.json();
      setProject(detailData.project);
      setUsage(detailData.usage);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const saveProject = useCallback(async (updates: { name?: string; slug?: string; logoVariant?: number }): Promise<boolean> => {
    if (!project) return false;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save");
      }
      const data = await res.json();
      setProject((prev) => prev ? { ...prev, ...data.project } : prev);
      return true;
    } catch {
      return false;
    }
  }, [project]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <ProjectContext.Provider value={{ project, usage, loading, refresh: fetchData, saveProject, setProject }}>
      {children}
    </ProjectContext.Provider>
  );
}
