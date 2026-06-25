"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { WorkspaceProvider } from "@/components/workspace-provider";

const BARE_ROUTES = ["/login", "/signup", "/configure", "/mobile"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (bare) return <>{children}</>;
  return (
    <WorkspaceProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </WorkspaceProvider>
  );
}
