"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { ProjectProvider } from "./_components/ProjectContext";

type SettingsSection = "general" | "appearance" | "billing" | "domains" | "api" | "tracking" | "webhooks" | "utm-templates";

interface Group {
  label: string;
  items: { id: SettingsSection; label: string; icon: string }[];
}

const GROUPS: Group[] = [
  {
    label: "Workspace",
    items: [
      { id: "general", label: "General", icon: "general" },
      { id: "appearance", label: "Appearance", icon: "moon" },
      { id: "billing", label: "Billing", icon: "billing" },
      { id: "domains", label: "Domains", icon: "domains" },
    ],
  },
  {
    label: "Developer",
    items: [
      { id: "api", label: "API Keys", icon: "api" },
      { id: "tracking", label: "Tracking", icon: "tracking" },
      { id: "utm-templates", label: "UTM Templates", icon: "links" },
      { id: "webhooks", label: "Webhooks", icon: "webhooks" },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const currentSection = (pathname.split("/")[3] ?? "general") as SettingsSection;

  return (
    <ProjectProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontSize: "13px",
            borderRadius: "10px",
            padding: "12px 16px",
            background: "#171717",
            color: "#fff",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
      <div className="flex h-full gap-3 p-0">
        <aside className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden rounded-xl bg-neutral-100 py-2 pr-2">
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col p-3">
              {/* Title — same as sidebar project name */}
              <div className="mb-5 px-1">
                <Link
                  href={`/${slug}/analytics`}
                  className="group flex w-full items-center rounded-lg px-2 py-1.5 text-[17px] font-semibold tracking-tight text-neutral-900 transition-colors hover:bg-neutral-200/70 dark:text-[#CDCCCC] dark:hover:bg-[#1e1e1d]"
                >
                  <span className="truncate">Settings</span>
                  <span className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-200 transition-colors group-hover:bg-neutral-300 dark:bg-[#1e1e1d] dark:text-[#656565] dark:group-hover:bg-[#2a2a29]">
                    <Icon name="arrow-right-01" size={14} className="rotate-180 text-neutral-500 dark:text-[#656565]" />
                  </span>
                </Link>
              </div>

              {/* Nav sections — same structure as sidebar */}
              <div className="flex flex-col gap-6">
                {GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1">
                    <div className="mb-2 px-3 text-[13px] text-neutral-400">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const active = currentSection === item.id;
                      return (
                        <Link
                          key={item.id}
                          href={`/${slug}/settings/${item.id}`}
                          className={`trell-nav-item group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] leading-none transition-all duration-100 ${
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
              </div>
            </div>
          </div>
        </aside>

        <main className="flex h-full min-w-0 flex-1">
          <div className="trell-main">
            <div className="trell-content">
              <div>{children}</div>
            </div>
          </div>
        </main>
      </div>
    </ProjectProvider>
  );
}
