"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";
import { isWorkspaceRoute, parseWorkspaceSlug, workspacePath } from "@/lib/workspaces/routes";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceContextValue {
  ready: boolean;
  user: { email: string; name: string | null } | null;
  workspaces: WorkspaceSummary[];
  urlSlug: string | null;
  isWorkspaceRoute: boolean;
  reloadWorkspaces: () => Promise<WorkspaceSummary[]>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspaceId, activeProjectId, setActive } = useAppStore();
  const urlSlug = parseWorkspaceSlug(pathname);
  const onWorkspaceRoute = isWorkspaceRoute(pathname);

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<WorkspaceContextValue["user"]>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);

  const applyWorkspace = useCallback(
    (ws: WorkspaceSummary, projectId?: string | null) => {
      setActive(ws.id, projectId ?? undefined, undefined);
      document.cookie = `dos_workspace=${ws.id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    },
    [setActive],
  );

  const reloadWorkspaces = useCallback(async () => {
    const d = await fetch("/api/workspaces").then((r) => r.json()).catch(() => ({ workspaces: [] }));
    const list: WorkspaceSummary[] = (d.workspaces ?? []).map((w: WorkspaceSummary) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
    }));
    setWorkspaces(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setReady(false);
      const [me, list] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
        reloadWorkspaces(),
      ]);
      if (cancelled) return;

      if (me.user) setUser(me.user);

      if (list.length === 0) {
        if (onWorkspaceRoute) router.replace("/setup");
        setReady(true);
        return;
      }

      const cookieWsId = readCookie("dos_workspace");
      const cookieProjId = readCookie("dos_project");

      if (onWorkspaceRoute && urlSlug) {
        let ws = list.find((w) => w.slug === urlSlug);
        if (!ws) {
          ws = list.find((w) => w.id === cookieWsId) ?? list[0];
          router.replace(workspacePath(ws.slug));
          return;
        }
        const switching = activeWorkspaceId !== ws.id;
        applyWorkspace(ws, switching ? null : (activeProjectId ?? cookieProjId));
        if (!cancelled) setReady(true);
        return;
      }

      const ws = list.find((w) => w.id === (activeWorkspaceId ?? cookieWsId)) ?? list[0];
      applyWorkspace(ws, activeProjectId ?? cookieProjId);
      if (!cancelled) setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
    // Re-run when URL slug changes (workspace switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug, onWorkspaceRoute, pathname]);

  const value = useMemo(
    () => ({ ready, user, workspaces, urlSlug, isWorkspaceRoute: onWorkspaceRoute, reloadWorkspaces }),
    [ready, user, workspaces, urlSlug, onWorkspaceRoute, reloadWorkspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
