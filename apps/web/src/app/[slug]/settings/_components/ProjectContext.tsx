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
  billingPeriodStart?: string;
}

interface ProjectContextValue {
  project: ProjectData | null;
  usage: UsageData | null;
  loading: boolean;
  refresh: () => void;
  saveProject: (updates: { name?: string; slug?: string; logoVariant?: number }) => Promise<ProjectData>;
  deleteProject: () => Promise<void>;
  setProject: (p: ProjectData) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  project: null,
  usage: null,
  loading: true,
  refresh: () => {},
  saveProject: async () => {
    throw new Error("not loaded");
  },
  deleteProject: async () => {
    throw new Error("not loaded");
  },
  setProject: () => {},
});

export function useProject() {
  return useContext(ProjectContext);
}

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  let message = "Request failed";
  try {
    const err = (await res.json()) as { message?: string; error?: string };
    message = err.message || err.error || message;
  } catch {}
  throw new Error(message);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Single round trip: resolve by slug server-side.
      const res = await fetch(`/api/projects/by-slug?slug=${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        setProject(null);
        setUsage(null);
        return;
      }
      await throwOnError(res);
      const data = await res.json();
      setProject(data.project);
      setUsage(data.usage);
    } catch {
      // network error: keep previous state (null on first load)
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const saveProject = useCallback(
    async (updates: { name?: string; slug?: string; logoVariant?: number }): Promise<ProjectData> => {
      if (!project) throw new Error("Workspace not loaded");
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await throwOnError(res);
      const data = await res.json();
      setProject(data.project);
      return data.project as ProjectData;
    },
    [project],
  );

  const deleteProject = useCallback(async (): Promise<void> => {
    if (!project) throw new Error("Workspace not loaded");
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    await throwOnError(res);
  }, [project]);

  useEffect(() => {
    setProject(null);
    setUsage(null);
    void fetchData();
  }, [fetchData]);

  return (
    <ProjectContext.Provider
      value={{ project, usage, loading, refresh: () => void fetchData(), saveProject, deleteProject, setProject }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
