"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { useTheme } from "@/lib/useTheme";
import { Icon } from "./Icon";
import { TrellLogo } from "./TrellLogo";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { CreateProjectModal } from "./CreateProjectModal";

interface SidebarProject {
  id: string;
  name: string;
  slug: string;
  role: string;
}

const NAV_SECTIONS: {
  label?: string;
  items: { label: string; href: string; icon: string }[];
}[] = [
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "analytics", icon: "analytics" },
      { label: "Funnels", href: "funnels", icon: "funnels" },
      { label: "Comparison", href: "comparison", icon: "comparison" },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Events", href: "events", icon: "events" },
      { label: "Submissions", href: "submissions", icon: "send" },
    ],
  },
];

export function ProjectSidebar({
  projectSlug,
  projectName,
  projects,
  userEmail,
  logoVariant = 0,
}: {
  projectSlug: string;
  projectName: string;
  projects: SidebarProject[];
  userEmail: string;
  logoVariant?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const initial = userEmail.charAt(0).toUpperCase() || "U";
  const [usage, setUsage] = useState<{ events: number; limit: number; domains: number; domainLimit: number; billingPeriodStart?: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const project = projects.find((p) => p.slug === projectSlug);
    if (!project) return;
    fetch(`/api/projects/${project.id}`)
      .then((r) => r.json())
      .then((d) => setUsage(d.usage))
      .catch(() => {});
  }, [projectSlug, projects]);

  const project = projects.find((p) => p.slug === projectSlug);
  const pid = project?.id;

  function prefetchPage(href: string) {
    if (!pid) return;
    const qs = "from=" + new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) + "&to=" + new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (href === "analytics") {
      queryClient.prefetchQuery({ queryKey: ["stats", pid, qs], queryFn: () => fetch(`/api/projects/${pid}/stats?${qs}`).then((r) => r.json()) });
      queryClient.prefetchQuery({ queryKey: ["series", pid, "day", qs], queryFn: () => fetch(`/api/projects/${pid}/series?interval=day&${qs}`).then((r) => r.json()) });
      queryClient.prefetchQuery({ queryKey: ["breakdown", pid, "page", qs], queryFn: () => fetch(`/api/projects/${pid}/breakdown?dimension=page&${qs}`).then((r) => r.json()) });
      queryClient.prefetchQuery({ queryKey: ["forms", pid, qs], queryFn: () => fetch(`/api/projects/${pid}/forms?${qs}`).then((r) => r.json()) });
      queryClient.prefetchQuery({ queryKey: ["events", pid, qs, 15], queryFn: () => fetch(`/api/projects/${pid}/events?limit=15&${qs}`).then((r) => r.json()) });
    } else if (href === "events") {
      queryClient.prefetchQuery({ queryKey: ["events", pid, qs, 50], queryFn: () => fetch(`/api/projects/${pid}/events?limit=50&${qs}`).then((r) => r.json()) });
    } else if (href === "submissions") {
      queryClient.prefetchQuery({ queryKey: ["submissions", pid], queryFn: () => fetch(`/api/projects/${pid}/submissions`).then((r) => r.json()) });
    } else if (href === "funnels") {
      queryClient.prefetchQuery({ queryKey: ["funnels", pid], queryFn: () => fetch(`/api/projects/${pid}/funnels`).then((r) => r.json()) });
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const usagePct = usage ? Math.min((usage.events / (usage.limit || 1)) * 100, 100) : 0;
  const domainPct = usage ? Math.min((usage.domains / (usage.domainLimit || 1)) * 100, 100) : 0;
  const resetDate = nextBillingReset(usage?.billingPeriodStart);

  return (
    <>
    <div className="flex h-full w-full flex-col">
      {/* Scrollable content */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col p-3">
          {/* ── Project dropdown ─────────────────────────── */}
          <div className="relative mb-5 px-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-100"
            >
              <TrellLogo className="h-5 w-auto shrink-0" />
              <span className="flex items-center gap-1.5">
                {/* <span className="text-[17px] font-semibold tracking-tight text-neutral-900 truncate">
                  {projectName}
                </span> */}
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-md bg-neutral-200 transition-all duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
                  <Icon name="arrow-down-01" size={12} className="text-neutral-500" />
                </span>
              </span>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[calc(100%-8px)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                <div className="p-1.5">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/${p.slug}/analytics`}
                      onClick={() => setDropdownOpen(false)}
                      className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors ${
                        p.slug === projectSlug
                          ? "bg-blue-50 font-medium text-blue-600"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                    >
                    <WorkspaceIcon name={p.name} variant={logoVariant} size={24} className="rounded-md" />
                      <span className="truncate">{p.name}</span>
                      {p.slug === projectSlug && (
                        <Icon name="chart-2" size={14} className="ml-auto text-blue-400" />
                      )}
                    </Link>
                  ))}
                </div>
                <div className="border-t border-neutral-100 p-1.5">
                  <button
                    onClick={() => { setCreateOpen(true); setDropdownOpen(false); }}
                    className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border border-dashed border-neutral-300 text-neutral-400">
                      <Icon name="arrow-down-01" size={12} className="rotate-[-90deg]" />
                    </div>
                    Create new project
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Nav sections ─────────────────────────────── */}
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className="mb-6 flex flex-col gap-1">
              {section.label && (
                <div className="mb-2 px-3 text-[13px] text-neutral-400">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const href = item.href.startsWith("settings/")
                  ? `/${projectSlug}/${item.href}`
                  : `/${projectSlug}/${item.href}`;
                const active = pathname === href || (item.href === "analytics" && pathname === `/${projectSlug}`);
                return (
                  <Link
                    key={item.href + item.label}
                    href={href}
                    onMouseEnter={() => prefetchPage(item.href)}
                    className={`trell-nav-item group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] leading-none ${
                      active
                        ? "bg-blue-50 font-medium text-blue-600"
                        : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      size={16}
                      strokeWidth={active ? 2 : 1.5}
                      className={active ? "text-blue-500" : "text-neutral-400 group-hover:text-neutral-600"}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Settings */}
          <div className="mb-6 flex flex-col gap-1">
            <div className="mb-2 px-3 text-[13px] text-neutral-400">
              Settings
            </div>
            <Link
              href={`/${projectSlug}/settings/general`}
              className={`group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] leading-none transition-all duration-100 ${
                pathname.startsWith(`/${projectSlug}/settings`)
                  ? "bg-blue-50 font-medium text-blue-600"
                  : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
              }`}
            >
              <Icon
                name="setting-2"
                size={16}
                strokeWidth={pathname.startsWith(`/${projectSlug}/settings`) ? 2 : 1.5}
                className={pathname.startsWith(`/${projectSlug}/settings`) ? "text-blue-500" : "text-neutral-400 group-hover:text-neutral-600"}
              />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom usage section ────────────────────────── */}
      <div className="flex flex-shrink-0 flex-col gap-2.5 border-t border-neutral-200 px-4 py-3">
        <Link
          href={`/${projectSlug}/settings/billing`}
          className="group flex items-center gap-1 text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          Usage
          <Icon name="arrow-right-01" size={12} className="text-neutral-400 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {usage && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-neutral-500">Events</span>
                <span className="tabular-nums text-neutral-400">
                  {usage.events.toLocaleString()}
                  <span className="text-neutral-300"> / {usage.limit.toLocaleString()}</span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-neutral-500">Domains</span>
                <span className="tabular-nums text-neutral-400">
                  {usage.domains}
                  <span className="text-neutral-300"> / {usage.domainLimit}</span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${domainPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-neutral-400">
          Resets {resetDate}
        </p>

        <Link
          href={`/${projectSlug}/settings/billing`}
          className="flex h-8 w-full items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Upgrade plan
        </Link>

        {/* User row */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-medium text-neutral-600">
              {initial}
            </div>
            <span className="max-w-[130px] truncate text-[13px] text-neutral-400">
              {userEmail}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => void signOutAction()}
              className="flex size-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              title="Sign out"
            >
              <Icon name="logout-01" size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
    <CreateProjectModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onCreated={() => router.refresh()}
    />
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`trell-theme-switch ${isDark ? "active" : ""}`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    />
  );
}

function nextBillingReset(start?: string): string {
  const base = start ? new Date(start) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
