"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { SuccessCheck } from "@/components/SuccessCheck";
import { WorkspaceIcon, WORKSPACE_ICON_COUNT } from "@/components/WorkspaceIcon";
import { useProject } from "../_components/ProjectContext";

function getBaseDomain(): string {
  if (typeof window === "undefined") return "trell.co";
  const h = window.location.hostname;
  const parts = h.split(".");
  return parts.length > 2 ? parts.slice(1).join(".") : h;
}

export default function GeneralSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { project, loading, saveProject, deleteProject } = useProject();
  const [logoVariant, setLogoVariantState] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  const [nameSaved, setNameSaved] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);

  const nameValue = project ? (name ?? project.name) : "";
  const slugValue = project ? (slug ?? project.slug) : "";

  useEffect(() => {
    if (project) {
      setLogoVariantState(project.logoVariant);
      setName((prev) => (prev === null ? project.name : prev));
      setSlug((prev) => (prev === null ? project.slug : prev));
    }
  }, [project]);

  if (!project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  async function handleDelete() {
    if (deleteSlug !== project!.slug || deleting) return;
    setDeleting(true);
    try {
      await toast.promise(deleteProject(), {
        loading: "Deleting workspace…",
        success: "Workspace deleted",
        error: (e) => (e instanceof Error ? e.message : "Failed to delete workspace"),
      });
      router.replace("/");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">General</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">Manage your workspace settings and preferences.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nameValue.trim()) {
              toast.error("Name cannot be empty");
              return;
            }
            try {
              await toast.promise(saveProject({ name: nameValue.trim() }), {
                loading: "Saving…",
                success: "Name updated",
                error: (err) => (err instanceof Error ? err.message : "Failed to save"),
              });
              setName(null);
              setNameSaved(true);
            } catch {
              /* error toast already shown */
            }
          }}
        >
          <div className="p-5 pb-0">
            <div className="text-sm font-semibold text-trell-ink">Workspace Name</div>
            <div className="mt-1 text-sm text-trell-ink-muted">This is the name of your workspace on Trell.</div>
            <div className="mt-4">
              <input
                value={nameValue}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                className="trell-input h-10 max-w-md"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-trell-line bg-neutral-50/80 px-5 py-3">
            <span className="text-xs text-trell-ink-muted">Max 32 characters.</span>
            <div className="flex items-center gap-3">
              <SuccessCheck show={nameSaved} onDone={() => setNameSaved(false)} />
              <button type="submit" className="trell-btn-outline h-8 cursor-pointer px-3 text-xs">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!slugValue.trim()) {
              toast.error("Slug cannot be empty");
              return;
            }
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue.trim())) {
              toast.error("Slug must be lowercase with dashes only");
              return;
            }
            try {
              const updated = await toast.promise(saveProject({ slug: slugValue.trim() }), {
                loading: "Saving…",
                success: "Slug updated",
                error: (err) => (err instanceof Error ? err.message : "Failed to save"),
              });
              setSlug(null);
              setSlugSaved(true);
              // Keep the URL in sync — otherwise a refresh lands on the old slug.
              if (updated.slug !== project.slug) {
                const rest = pathname.split("/").slice(2).join("/");
                router.replace(`/${updated.slug}/${rest}`);
              }
            } catch {
              /* error toast already shown */
            }
          }}
        >
          <div className="p-5 pb-0">
            <div className="text-sm font-semibold text-trell-ink">Workspace Slug</div>
            <div className="mt-1 text-sm text-trell-ink-muted">This is your workspace&apos;s unique slug on Trell.</div>
            <div className="mt-4">
              <input
                value={slugValue}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                maxLength={48}
                className="trell-input h-10 max-w-md"
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-trell-ink-muted">
              <Icon name="globe" size={14} />
              <span>
                {getBaseDomain()}/<span className="font-medium text-trell-ink">{slugValue}</span>
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-trell-line bg-neutral-50/80 px-5 py-3">
            <span className="text-xs text-trell-ink-muted">
              Only lowercase letters, numbers, and dashes. Max 48 characters.
            </span>
            <div className="flex items-center gap-3">
              <SuccessCheck show={slugSaved} onDone={() => setSlugSaved(false)} />
              <button type="submit" className="trell-btn-outline h-8 cursor-pointer px-3 text-xs">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="p-5">
          <div className="text-sm font-semibold text-trell-ink">Workspace Logo</div>
          <div className="mt-1 text-sm text-trell-ink-muted">Choose a preset logo for your workspace.</div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <WorkspaceIcon name={project.name} variant={logoVariant} size={64} className="rounded-xl" />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: WORKSPACE_ICON_COUNT }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLogoVariantState(i)}
                    className={`cursor-pointer rounded-lg p-1 transition-all ${
                      logoVariant === i ? "bg-blue-100 ring-2 ring-blue-500" : "hover:bg-neutral-100"
                    }`}
                  >
                    <WorkspaceIcon name={project.name} variant={i} size={32} className="rounded-md" />
                  </button>
                ))}
              </div>
              <span className="text-xs text-trell-ink-muted">Click to select a logo variant.</span>
            </div>
          </div>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await toast.promise(saveProject({ logoVariant }), {
                loading: "Saving…",
                success: "Logo saved",
                error: (err) => (err instanceof Error ? err.message : "Failed to save"),
              });
              setLogoSaved(true);
            } catch {
              /* error toast already shown */
            }
          }}
          className="flex items-center justify-end border-t border-trell-line bg-neutral-50/80 px-5 py-3"
        >
          <div className="flex items-center gap-3">
            <SuccessCheck show={logoSaved} onDone={() => setLogoSaved(false)} />
            <button type="submit" className="trell-btn-outline h-8 cursor-pointer px-3 text-xs">
              Save changes
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
        <div className="p-5 pb-4">
          <div className="text-sm font-semibold text-red-600">Delete Workspace</div>
          <div className="mt-1 text-sm text-red-500/80">
            Permanently delete your workspace, custom domain, and all associated links + their stats. This action cannot
            be undone.
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-red-100 bg-red-50/50 px-5 py-3">
          {!deleteOpen ? (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex h-8 cursor-pointer items-center rounded-lg border border-red-300 bg-white px-4 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Delete Workspace
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-red-600">Type</span>
                <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  {project.slug}
                </code>
                <span className="text-xs text-red-600">to confirm:</span>
              </div>
              <input
                value={deleteSlug}
                onChange={(e) => setDeleteSlug(e.target.value)}
                placeholder={project.slug}
                className="h-8 w-40 rounded-lg border border-red-300 bg-white px-2 text-xs text-trell-ink focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteSlug !== project.slug || deleting}
                className="flex h-8 cursor-pointer items-center rounded-lg bg-red-600 px-4 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteSlug("");
                }}
                className="flex h-8 cursor-pointer items-center rounded-lg border border-trell-line bg-white px-3 text-xs font-medium text-trell-ink transition-colors hover:bg-neutral-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
