import { describe, it, expect } from "vitest";
import { MemoryMembershipRepo, ProjectAccessService } from "@/lib/authz";

describe("ProjectAccessService (authorization)", () => {
  it("lets a user access only their own projects", async () => {
    const repo = new MemoryMembershipRepo();
    repo.add({ projectId: "p1", userId: "u1", role: "owner", name: "Site 1", slug: "site-1" });
    repo.add({ projectId: "p2", userId: "u2", role: "owner", name: "Site 2", slug: "site-2" });

    const svc = new ProjectAccessService(repo);
    expect(await svc.canAccessProject("u1", "p1")).toBe(true);
    expect(await svc.canAccessProject("u1", "p2")).toBe(false); // belonging to u2
    expect(await svc.canAccessProject("u2", "p1")).toBe(false);
  });

  it("lists only the projects the user belongs to", async () => {
    const repo = new MemoryMembershipRepo();
    repo.add({ projectId: "p1", userId: "u1", role: "owner", name: "Site 1", slug: "site-1" });
    repo.add({ projectId: "p2", userId: "u1", role: "member", name: "Site 2", slug: "site-2" });
    repo.add({ projectId: "p3", userId: "u2", role: "owner", name: "Site 3", slug: "site-3" });

    const svc = new ProjectAccessService(repo);
    const forU1 = await svc.listAccessibleProjects("u1");
    expect(forU1.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(forU1[0]!.role).toBe("owner");
    expect(forU1[1]!.role).toBe("member");
  });

  it("rejects unauthenticated (no user) accesses", async () => {
    const svc = new ProjectAccessService(new MemoryMembershipRepo());
    expect(await svc.canAccessProject("", "p1")).toBe(false);
  });

  it("returns the owner role for a rotating owner-only action", async () => {
    const repo = new MemoryMembershipRepo();
    repo.add({ projectId: "p1", userId: "u1", role: "owner", name: "S", slug: "s" });
    repo.add({ projectId: "p1", userId: "u2", role: "member", name: "S", slug: "s" });
    const svc = new ProjectAccessService(repo);
    expect(await svc.roleOf("p1", "u1")).toBe("owner");
    expect(await svc.roleOf("p1", "u2")).toBe("member");
    expect(await svc.roleOf("p1", "u3")).toBeNull();
  });
});
