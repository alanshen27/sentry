"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { workspacePath } from "@/lib/workspaces/routes";
import { OnboardingDialog } from "@/components/onboarding-dialog";

export default function SetupPage() {
  const router = useRouter();
  const { ready, workspaces, reloadWorkspaces, user } = useWorkspace();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (ready && workspaces.length > 0) {
      router.replace(workspacePath(workspaces[0].slug));
    }
  }, [ready, workspaces, router]);

  async function createWorkspace(name: string) {
    const r = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await r.json();
    if (!d.workspace) return false;
    await reloadWorkspaces();
    router.replace(workspacePath(d.workspace.slug));
    return true;
  }

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <OnboardingDialog
        open={open}
        step="workspace"
        userName={user?.name}
        userEmail={user?.email}
        onCreateWorkspace={createWorkspace}
        onCreateProject={async () => false}
        onComplete={() => setOpen(false)}
      />
      <div className="flex h-full flex-col items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Create a workspace to start monitoring regions and hazards.
        </p>
      </div>
    </>
  );
}
