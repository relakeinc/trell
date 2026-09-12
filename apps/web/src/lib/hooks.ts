"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useParams } from "next/navigation";

// ── Projects (slug → ID resolution, cached globally) ──────

interface ProjectListItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface ProjectsResponse {
  projects: ProjectListItem[];
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json() as Promise<ProjectsResponse>),
    staleTime: 5 * 60_000,
  });
}

export function useProjectId() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useProjects();
  const project = data?.projects?.find((p) => p.slug === slug);
  return { projectId: project?.id ?? null, slug, isLoading, isError };
}

// ── Project detail ────────────────────────────────────────

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    pk: string;
    domains: string[];
    logoVariant: number;
    createdAt: string;
  };
  usage: {
    events: number;
    limit: number;
    domains: number;
    domainLimit: number;
    billingPeriodStart?: string;
  };
}

export function useProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`).then((r) => r.json() as Promise<ProjectDetail>),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

// ── Analytics ─────────────────────────────────────────────

interface Metrics {
  events: number;
  views: number;
  starts: number;
  submits: number;
  successes: number;
  abandons: number;
  ctaClicks: number;
  fieldInteractions: number;
  sessions: number;
  visitors: number;
  conversionRate: number | null;
  startConversionRate: number | null;
  avgTimeToCompleteMs: number | null;
  bounceRate: number | null;
  pagesPerSession: number | null;
  avgScrollDepth: number | null;
  avgTimeOnPageMs: number | null;
}

interface StatsComparison {
  baseline: Record<string, number | null>;
  compare: Record<string, number | null>;
  deltas: Record<string, { absolute: number; percentage: number | null; direction: "up" | "down" | "flat" }>;
}

interface StatsResponse {
  metrics: Metrics;
  comparison?: StatsComparison;
  error?: { code?: string; message?: string };
}

export function useProjectStats(projectId: string | null, qs: string | null) {
  return useQuery({
    queryKey: ["stats", projectId, qs],
    queryFn: () => fetch(`/api/projects/${projectId}/stats?${qs}`).then((r) => r.json() as Promise<StatsResponse>),
    enabled: !!projectId && !!qs,
    staleTime: 60_000,
  });
}

interface TimelinePoint {
  date: string;
  views: number;
  starts: number;
  successes: number;
}

interface SeriesResponse {
  series: TimelinePoint[];
}

export function useProjectSeries(projectId: string | null, interval: string, qs: string | null) {
  return useQuery({
    queryKey: ["series", projectId, interval, qs],
    queryFn: () => fetch(`/api/projects/${projectId}/series?interval=${interval}&${qs}`).then((r) => r.json() as Promise<SeriesResponse>),
    enabled: !!projectId && !!qs,
  });
}

interface Row {
  key: string;
  count: number;
}

interface BreakdownResponse {
  rows: Row[];
}

export function fetchBreakdown(projectId: string, dim: string, qs: string): Promise<BreakdownResponse> {
  return fetch(`/api/projects/${projectId}/breakdown?dimension=${dim}&${qs}`).then((r) => r.json() as Promise<BreakdownResponse>);
}

export function useProjectBreakdown(projectId: string | null, dim: string, qs: string) {
  return useQuery({
    queryKey: ["breakdown", projectId, dim, qs],
    queryFn: () => fetchBreakdown(projectId!, dim, qs),
    enabled: !!projectId,
    staleTime: 60_000,
    // Keep the previous dimension's rows while the new one loads — no "no data" flash.
    placeholderData: keepPreviousData,
  });
}

interface FormRow {
  id: string;
  name: string | null;
  events: number;
  successes: number;
  conversionRate: number | null;
}

interface FormsResponse {
  forms: FormRow[];
}

export function useProjectForms(projectId: string | null, qs: string) {
  return useQuery({
    queryKey: ["forms", projectId, qs],
    queryFn: () => fetch(`/api/projects/${projectId}/forms?${qs}`).then((r) => r.json() as Promise<FormsResponse>),
    enabled: !!projectId,
  });
}

// ── Events ────────────────────────────────────────────────

export interface DrillEvent {
  eventId: string;
  type: string;
  ts: string;
  pagePath: string;
  formId: string | null;
  formName: string | null;
  deviceType: string;
  browser: string | null;
  os: string | null;
  sessionId: string;
  visitorId: string;
  utmSource: string | null;
  utmMedium: string | null;
}

interface EventsResponse {
  events: DrillEvent[];
}

export function useProjectEvents(projectId: string | null, qs: string, limit = 50) {
  return useQuery({
    queryKey: ["events", projectId, qs, limit],
    queryFn: () => fetch(`/api/projects/${projectId}/events?limit=${limit}&${qs}`).then((r) => r.json() as Promise<EventsResponse>),
    enabled: !!projectId,
  });
}

// ── Submissions ───────────────────────────────────────────

interface Submission {
  id: string;
  type: string;
  ts: string;
  formId: string;
  formName: string | null;
  page: string;
  url?: string | null;
  visitorId: string;
  fields: Record<string, unknown> | null;
  device: string;
  browser: string | null;
  os: string | null;
}

interface SubmissionsResponse {
  submissions: Submission[];
}

export function useProjectSubmissions(projectId: string | null) {
  return useQuery({
    queryKey: ["submissions", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/submissions`).then((r) => r.json() as Promise<SubmissionsResponse>),
    enabled: !!projectId,
  });
}

// ── Funnels ───────────────────────────────────────────────

interface SavedFunnel {
  id: string;
  name: string;
  steps: { eventType: string | null; formId: string | null; label: string | null; position: number }[];
}

interface FunnelsResponse {
  funnels: SavedFunnel[];
}

export function useProjectFunnels(projectId: string | null) {
  return useQuery({
    queryKey: ["funnels", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/funnels`).then((r) => r.json() as Promise<FunnelsResponse>),
    enabled: !!projectId,
  });
}

interface FunnelStep {
  position: number;
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  dropOff: number | null;
}

interface FunnelLiveResponse {
  totalSessions: number;
  steps: FunnelStep[];
}

export function useFunnelLive(projectId: string | null, funnelId: string | null, qs: string) {
  return useQuery({
    queryKey: ["funnel-live", projectId, funnelId, qs],
    queryFn: () => fetch(`/api/projects/${projectId}/funnel-live?funnelId=${funnelId}&${qs}`).then((r) => r.json() as Promise<FunnelLiveResponse>),
    enabled: !!projectId && !!funnelId,
  });
}

export function useFunnelMutations(projectId: string | null) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["funnels", projectId] });
    qc.invalidateQueries({ queryKey: ["funnel-live", projectId] });
  };

  const createFunnel = useMutation({
    mutationFn: (data: { name: string; steps: { eventType: string; formId?: string; label?: string; position: number }[] }) =>
      fetch(`/api/projects/${projectId}/funnels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  const updateFunnel = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; steps: { eventType: string; formId?: string; label?: string; position: number }[] }) =>
      fetch(`/api/projects/${projectId}/funnels/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  const deleteFunnel = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/funnels/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  return { createFunnel, updateFunnel, deleteFunnel };
}
