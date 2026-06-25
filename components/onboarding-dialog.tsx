"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, FolderKanban, Map, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "workspace" | "project" | "done";

interface Props {
  open: boolean;
  step: Step;
  userName?: string | null;
  userEmail?: string | null;
  onCreateWorkspace: (name: string) => Promise<boolean>;
  onCreateProject: (name: string, description?: string) => Promise<boolean>;
  onComplete: () => void;
}

export function OnboardingDialog({ open, step, userName, userEmail, onCreateWorkspace, onCreateProject, onComplete }: Props) {
  const [wsName, setWsName] = useState("");
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firstName = userName?.split(" ")[0] ?? userEmail?.split("@")[0] ?? "there";

  useEffect(() => {
    if (open && step === "workspace" && userEmail && !wsName) {
      const local = userEmail.split("@")[0].replace(/[._]/g, " ");
      setWsName(`${local.charAt(0).toUpperCase()}${local.slice(1)}'s workspace`);
    }
  }, [open, step, userEmail, wsName]);

  async function submitWorkspace() {
    if (!wsName.trim()) return;
    setLoading(true);
    setError("");
    const ok = await onCreateWorkspace(wsName.trim());
    setLoading(false);
    if (!ok) setError("Could not create workspace — try again.");
  }

  async function submitProject() {
    if (!projName.trim()) return;
    setLoading(true);
    setError("");
    const ok = await onCreateProject(projName.trim(), projDesc.trim() || undefined);
    setLoading(false);
    if (ok) onComplete();
    else setError("Could not create project — try again.");
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* required setup — no dismiss */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Map className="h-5 w-5 text-sky-400" />}
            {step === "workspace" && "Welcome to Sentry"}
            {step === "project" && "Create your first project"}
            {step === "done" && "You're all set"}
          </DialogTitle>
          <DialogDescription>
            {step === "workspace" && `Hi ${firstName} — set up your team workspace to start mapping hazards and running analysis.`}
            {step === "project" && "Projects hold your map layers, markers, watch zones, and analysis for a specific operation or region."}
            {step === "done" && "Your workspace and project are ready. Draw a region on the map or pick a demo area to begin."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <StepDot active={step === "workspace"} done={step !== "workspace"} label="Workspace" icon={Building2} />
          <div className="h-px flex-1 bg-border" />
          <StepDot active={step === "project"} done={step === "done"} label="Project" icon={FolderKanban} />
        </div>

        {step === "workspace" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              A <strong className="text-foreground">workspace</strong> is your org or team — it owns projects, alerts, and team data. Most people need just one.
            </div>
            <div className="space-y-1">
              <Label>Workspace name</Label>
              <Input
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="Acme Disaster Response"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submitWorkspace()}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <DialogFooter>
              <Button disabled={!wsName.trim() || loading} onClick={submitWorkspace} className="w-full">
                {loading ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "project" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              A <strong className="text-foreground">project</strong> scopes your map — layers, drawn regions, markers, and watch zones all live inside one project.
            </div>
            <div className="space-y-1">
              <Label>Project name</Label>
              <Input value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="East Africa Response" autoFocus onKeyDown={(e) => e.key === "Enter" && submitProject()} />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={projDesc} onChange={(e) => setProjDesc(e.target.value)} placeholder="Monitoring drought + wildfire in the Horn" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <DialogFooter>
              <Button disabled={!projName.trim() || loading} onClick={submitProject} className="w-full">
                {loading ? "Creating…" : "Create project & start"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <DialogFooter>
            <Button onClick={onComplete} className="w-full">Go to command center</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDot({ active, done, label, icon: Icon }: { active: boolean; done: boolean; label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
        done ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : active ? "border-sky-400 bg-sky-400/20 text-sky-300" : "border-border bg-muted/40 text-muted-foreground",
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <span className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}
