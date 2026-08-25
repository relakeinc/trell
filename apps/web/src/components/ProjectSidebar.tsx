"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { Icon } from "./Icon";
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
      { label: "Events", href: "events", icon: "events" },
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
  const initial = userEmail.charAt(0).toUpperCase() || "U";
  const [usage, setUsage] = useState<{ events: number; limit: number; domains: number; domainLimit: number } | null>(null);
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
  const resetDate = nextBillingReset();

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
              className="flex w-full items-center rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-100"
            >
              <span className="text-[17px] font-semibold tracking-tight text-neutral-900 truncate">
                {projectName}
              </span>
              <span className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 transition-all duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
                <Icon
                  name="arrow-down-01"
                  size={14}
                  className="text-neutral-500"
                />
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
                    className={`group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] leading-none transition-all duration-100 ${
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
          <div className="flex flex-col gap-1">
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
    <CreateProjectModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onCreated={() => router.refresh()}
    />
    </>
  );
}

function nextBillingReset(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
