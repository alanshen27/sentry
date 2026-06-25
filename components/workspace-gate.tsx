"use client";

import { useWorkspace } from "@/components/workspace-provider";

export function WorkspaceGate({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const { ready, workspaces } = useWorkspace();
  const ws = workspaces.find((w) => w.slug === workspaceSlug);

  if (!ready || !ws) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <p className="text-xs text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
}
