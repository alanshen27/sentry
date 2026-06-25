"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useAppStore } from "@/lib/store/useAppStore";
import { useWorkspace } from "@/components/workspace-provider";
import { workspacePath, isWorkspaceRoute } from "@/lib/workspaces/routes";
import { cn } from "@/lib/utils";
import { Plus, Layers, ChevronRight, LogOut, FolderKanban, Eye, EyeOff, Building2, Sun, Moon, Pencil, Trash2 } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { LayerColorPicker } from "@/components/layer-color-picker";
import { LAYER_COLOR_OPTIONS } from "@/lib/layers/colors";

interface Ws { id: string; name: string; slug: string }
interface Proj { id: string; name: string; defaultLat?: number; defaultLng?: number; defaultZoom?: number }
interface Layer { id: string; name: string; color: string; visible: boolean; type: string }

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, user, workspaces, reloadWorkspaces } = useWorkspace();
  const { theme, toggle: toggleTheme } = useTheme();
  const { activeWorkspaceId, activeProjectId, activeLayerId, setActive, setProjectLayers, layersNonce, logAction, bumpArtifacts } = useAppStore();
  const [projects, setProjects] = useState<Proj[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showProjectDlg, setShowProjectDlg] = useState(false);
  const [showLayerDlg, setShowLayerDlg] = useState(false);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [showWorkspaceDlg, setShowWorkspaceDlg] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<"workspace" | "project" | "done" | null>(null);

  async function loadProjects(wsId?: string | null) {
    const id = wsId ?? activeWorkspaceId;
    if (!id) { setProjects([]); return []; }
    const d = await fetch("/api/projects").then((r) => r.json()).catch(() => ({ projects: [] }));
    const list: Proj[] = d.projects ?? [];
    setProjects(list);
    const first = list[0];
    if (first && !activeProjectId) selectProject(first);
    else if (list.length === 0 && id) setOnboardingStep((s) => s ?? "project");
    return list;
  }

  useEffect(() => {
    if (!ready) return;
    if (workspaces.length === 0 && pathname !== "/setup") {
      setOnboardingStep("workspace");
    }
  }, [ready, workspaces.length, pathname]);

  useEffect(() => {
    if (!ready || !activeWorkspaceId) return;
    loadProjects(activeWorkspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeWorkspaceId]);

  // load layers when project changes
  useEffect(() => {
    if (!activeProjectId) { setLayers([]); setProjectLayers([]); return; }
    fetch(`/api/layers?projectId=${activeProjectId}`).then((r) => r.json()).then((d) => {
      const list: Layer[] = d.layers ?? [];
      setLayers(list);
      setProjectLayers(list.map((l) => ({ id: l.id, name: l.name, color: l.color, visible: l.visible })));
    }).catch(() => {});
  }, [activeProjectId, setProjectLayers, layersNonce]);

  function selectWorkspace(id: string) {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    const changed = id !== activeWorkspaceId;
    setActive(ws.id, null, null);
    document.cookie = `dos_workspace=${ws.id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    document.cookie = `dos_project=; path=/; max-age=0`;
    setMenuOpen(null);
    if (changed) logAction(`Switched workspace: ${ws.name}`);
    router.push(workspacePath(ws.slug));
  }
  function selectProject(p: Proj) {
    const changed = p.id !== activeProjectId;
    setActive(undefined, p.id, null);
    document.cookie = `dos_project=${p.id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    setMenuOpen(null);
    if (changed) logAction(`Switched project: ${p.name}`);
    router.refresh();
  }
  function selectLayer(id: string | null) {
    if (id !== activeLayerId) {
      const name = id ? (layers.find((l) => l.id === id)?.name ?? "layer") : "All layers";
      logAction(`Focused layer: ${name}`);
    }
    setActive(undefined, undefined, id);
    setMenuOpen(null);
  }
  async function toggleLayer(l: Layer) {
    const next = !l.visible;
    setLayers((ls) => {
      const updated = ls.map((x) => (x.id === l.id ? { ...x, visible: next } : x));
      setProjectLayers(updated.map((x) => ({ id: x.id, name: x.name, color: x.color, visible: x.visible })));
      return updated;
    });
    logAction(`Layer ${next ? "shown" : "hidden"}: ${l.name}`);
    await fetch(`/api/layers/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible: next }) });
  }
  async function updateLayer(id: string, patch: { name: string; color: string }): Promise<boolean> {
    const r = await fetch(`/api/layers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.layer) return false;
    setLayers((ls) => {
      const next = ls.map((x) => (x.id === id ? { ...x, ...d.layer } : x));
      setProjectLayers(next.map((x) => ({ id: x.id, name: x.name, color: x.color, visible: x.visible })));
      return next;
    });
    bumpArtifacts();
    logAction(`Layer updated: ${d.layer.name}`);
    return true;
  }
  async function deleteLayer(id: string): Promise<boolean> {
    const r = await fetch(`/api/layers/${id}`, { method: "DELETE" });
    if (!r.ok) return false;
    setLayers((ls) => {
      const next = ls.filter((x) => x.id !== id);
      setProjectLayers(next.map((x) => ({ id: x.id, name: x.name, color: x.color, visible: x.visible })));
      return next;
    });
    if (activeLayerId === id) setActive(undefined, undefined, null);
    bumpArtifacts();
    logAction("Layer deleted", { severity: "warning" });
    return true;
  }

  async function createWorkspace(name: string): Promise<Ws | null> {
    const r = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await r.json();
    if (!d.workspace) return null;
    await reloadWorkspaces();
    selectWorkspace(d.workspace.id);
    return d.workspace;
  }

  async function handleOnboardingWorkspace(name: string) {
    const ws = await createWorkspace(name);
    if (ws) setOnboardingStep("project");
    return !!ws;
  }

  async function handleOnboardingProject(name: string, description?: string) {
    const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
    const d = await r.json();
    if (!d.project) return false;
    setProjects((ps) => [d.project, ...ps]);
    selectProject(d.project);
    setOnboardingStep("done");
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (ws) router.push(workspacePath(ws.slug));
    return true;
  }

  function finishOnboarding() {
    setOnboardingStep(null);
  }

  const needsSetup = ready && (!activeWorkspaceId || !activeProjectId);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const commandHref = activeWorkspace ? workspacePath(activeWorkspace.slug) : "/";

  const navLinks = [
    { href: commandHref, label: "Command", match: (p: string) => isWorkspaceRoute(p) },
    { href: "/zones", label: "Zones", match: (p: string) => p === "/zones" || p.startsWith("/zones/") },
    { href: "/alerts", label: "Alerts", match: (p: string) => p === "/alerts" || p.startsWith("/alerts/") },
    { href: "/projects", label: "Projects", match: (p: string) => p === "/projects" || p.startsWith("/projects/") },
    { href: "/settings", label: "Settings", match: (p: string) => p === "/settings" || p.startsWith("/settings/") },
  ];

  return (
    <>
      <header className="shrink-0 border-b border-border bg-card/70">
        <div className="flex h-11 items-center gap-3 px-3">
          <div className="flex items-center gap-1.5 pr-1">
            <LogoMark size={18} className="text-slate-400" />
            <span className="text-sm font-semibold tracking-tight">Sentry</span>
          </div>
          <Separator />

          {/* Workspace → Project context picker */}
          <div className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
            needsSetup ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20" : "border-border/80 bg-background/40",
          )}>
            <ContextPicker
              label="Workspace"
              hint="Your org / team"
              value={activeWorkspace?.name ?? (ready ? "No workspace" : "Loading…")}
              icon={<Building2 className={cn("h-3.5 w-3.5", needsSetup && !activeWorkspaceId ? "text-amber-400" : "text-muted-foreground")} />}
              open={menuOpen === "ws"}
              onOpenChange={(o) => setMenuOpen(o ? "ws" : null)}
              highlight={needsSetup && !activeWorkspaceId}
            >
              {workspaces.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  <p className="mb-1.5">No workspace yet.</p>
                  <button onClick={() => { setMenuOpen(null); setOnboardingStep("workspace"); }} className="text-amber-400 hover:underline">Set up workspace →</button>
                </div>
              )}
              {workspaces.map((w) => (
                <MenuItem key={w.id} active={w.id === activeWorkspaceId} onClick={() => selectWorkspace(w.id)}>{w.name}</MenuItem>
              ))}
              {workspaces.length > 0 && (
                <>
                  <MenuDivider />
                  <MenuItem onClick={() => { setMenuOpen(null); setShowWorkspaceDlg(true); }}><Plus className="mr-1.5 h-3 w-3" />New workspace</MenuItem>
                </>
              )}
            </ContextPicker>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <ContextPicker
              label="Project"
              hint="Map & data scope"
              value={activeProject?.name ?? (activeWorkspaceId ? "No project" : "Pick workspace first")}
              icon={<FolderKanban className={cn("h-3.5 w-3.5", needsSetup && activeWorkspaceId && !activeProjectId ? "text-amber-400" : "text-muted-foreground")} />}
              open={menuOpen === "proj"}
              onOpenChange={(o) => setMenuOpen(o ? "proj" : null)}
              highlight={needsSetup && !!activeWorkspaceId && !activeProjectId}
              disabled={!activeWorkspaceId}
            >
              {!activeWorkspaceId && <div className="px-2 py-1.5 text-xs text-muted-foreground">Create a workspace first</div>}
              {activeWorkspaceId && projects.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  <p className="mb-1.5">No projects in this workspace.</p>
                  <button onClick={() => { setMenuOpen(null); setOnboardingStep("project"); }} className="text-amber-400 hover:underline">Create first project →</button>
                </div>
              )}
              {projects.map((p) => (
                <MenuItem key={p.id} active={p.id === activeProjectId} onClick={() => selectProject(p)}>{p.name}</MenuItem>
              ))}
              {activeWorkspaceId && (
                <>
                  <MenuDivider />
                  <MenuItem onClick={() => { setMenuOpen(null); setShowProjectDlg(true); }}><Plus className="mr-1.5 h-3 w-3" />New project</MenuItem>
                </>
              )}
            </ContextPicker>
          </div>

          <div className="ml-1 hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <button key={l.label} onClick={() => router.push(l.href)}
                className={cn("rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                  l.match(pathname) ? "bg-accent text-foreground" : "text-muted-foreground")}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {needsSetup && (
              <Button size="sm" variant="outline" className="h-7 border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20"
                onClick={() => setOnboardingStep(activeWorkspaceId ? "project" : "workspace")}>
                Complete setup
              </Button>
            )}
            {activeWorkspace && (
              <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</Badge>
            )}
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <div className="text-right">
                <div className="text-xs font-medium leading-tight">{user?.name ?? user?.email ?? "…"}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">{user?.email}</div>
              </div>
              <button onClick={() => { fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal layer tabs */}
        {activeProjectId && (
          <div className="flex h-8 items-center gap-2 border-t border-border/50 bg-muted/20 px-3">
            <div className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span>Layers</span>
            </div>
            <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
              <LayerTab
                active={!activeLayerId}
                onClick={() => selectLayer(null)}
              >
                All
              </LayerTab>
              {layers.map((l) => (
                <LayerTab
                  key={l.id}
                  active={l.id === activeLayerId}
                  color={l.color}
                  visible={l.visible}
                  onClick={() => selectLayer(l.id)}
                  onToggleVisibility={() => toggleLayer(l)}
                  onEdit={() => setEditingLayer(l)}
                >
                  {l.name}
                </LayerTab>
              ))}
              <button
                onClick={() => setShowLayerDlg(true)}
                className="ml-0.5 flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="New layer"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <OnboardingDialog
        open={onboardingStep !== null}
        step={onboardingStep ?? "workspace"}
        userName={user?.name}
        userEmail={user?.email}
        onCreateWorkspace={handleOnboardingWorkspace}
        onCreateProject={handleOnboardingProject}
        onComplete={finishOnboarding}
      />
      <WorkspaceDialog open={showWorkspaceDlg} onOpenChange={setShowWorkspaceDlg} onCreated={(w) => { logAction(`Workspace created: ${w.name}`); reloadWorkspaces(); selectWorkspace(w.id); }} />
      <ProjectDialog open={showProjectDlg} onOpenChange={setShowProjectDlg} onCreated={(p) => { logAction(`Project created: ${p.name}`); setProjects((ps) => [p, ...ps]); selectProject(p); }} />
      <LayerDialog open={showLayerDlg} onOpenChange={setShowLayerDlg} projectId={activeProjectId} onCreated={(l) => { logAction(`Layer created: ${l.name}`); setLayers((ls) => { const next = [...ls, l]; setProjectLayers(next.map((x) => ({ id: x.id, name: x.name, color: x.color, visible: x.visible }))); return next; }); }} />
      <LayerEditDialog layer={editingLayer} onOpenChange={(o) => { if (!o) setEditingLayer(null); }} onSave={updateLayer} onDelete={deleteLayer} />
    </>
  );
}

function Separator() { return <div className="h-5 w-px bg-border" />; }

function ContextPicker({ label, hint, value, icon, open, onOpenChange, highlight, disabled, children }: {
  label: string;
  hint: string;
  value: string;
  icon?: React.ReactNode;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  highlight?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && onOpenChange(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/60",
          highlight && "text-amber-200",
        )}
        title={hint}
      >
        {icon}
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">{label}</div>
          <div className="max-w-[140px] truncate text-xs font-medium leading-tight">{value}</div>
        </div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg animate-fade-in">{children}</div>
        </>
      )}
    </div>
  );
}

function LayerTab({ active, color, visible = true, onClick, onToggleVisibility, onEdit, children }: {
  active: boolean;
  color?: string;
  visible?: boolean;
  onClick: () => void;
  onToggleVisibility?: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "group flex shrink-0 items-center rounded-sm border transition-colors",
      active ? "border-border bg-background shadow-sm" : "border-transparent hover:bg-accent/60",
      visible === false && "opacity-50",
    )}>
      <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium">
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className={cn("max-w-[120px] truncate", active ? "text-foreground" : "text-muted-foreground")}>{children}</span>
      </button>
      {onToggleVisibility && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          className="px-1 py-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          title={visible ? "Hide layer" : "Show layer"}
        >
          {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
      )}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded-r-sm pl-0.5 pr-1.5 py-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          title="Edit layer"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return <button onClick={onClick} className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent", active && "bg-accent text-primary")}>{children}</button>;
}

function MenuDivider() { return <div className="my-1 h-px bg-border" />; }

function WorkspaceDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (w: Ws) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  async function create() {
    setLoading(true);
    const r = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await r.json();
    setLoading(false);
    if (d.workspace) { onCreated(d.workspace); setName(""); onOpenChange(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New workspace</DialogTitle><DialogDescription>A workspace is your org or team — it contains projects, alerts, and members.</DialogDescription></DialogHeader>
        <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Disaster Response" /></div>
        <DialogFooter><Button disabled={!name || loading} onClick={create}>{loading ? "Creating…" : "Create workspace"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (p: Proj) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  async function create() {
    setLoading(true);
    const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: desc }) });
    const d = await r.json();
    setLoading(false);
    if (d.project) { onCreated(d.project); setName(""); setDesc(""); onOpenChange(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New project</DialogTitle><DialogDescription>A project groups layers, segments, markers and watch zones.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Horn of Africa Response" /></div>
          <div className="space-y-1"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter><Button disabled={!name || loading} onClick={create}>{loading ? "Creating…" : "Create project"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LayerEditDialog({ layer, onOpenChange, onSave, onDelete }: {
  layer: Layer | null;
  onOpenChange: (o: boolean) => void;
  onSave: (id: string, patch: { name: string; color: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LAYER_COLOR_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (layer) { setName(layer.name); setColor(layer.color); setConfirmDelete(false); }
  }, [layer]);
  if (!layer) return null;
  async function save() {
    if (!layer) return;
    setLoading(true);
    const ok = await onSave(layer.id, { name: name.trim() || layer.name, color });
    setLoading(false);
    if (ok) onOpenChange(false);
  }
  async function remove() {
    if (!layer) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    const ok = await onDelete(layer.id);
    setLoading(false);
    if (ok) onOpenChange(false);
  }
  return (
    <Dialog open={!!layer} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit layer</DialogTitle><DialogDescription>Rename, recolor, or delete this layer.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Layer name" onKeyDown={(e) => { if (e.key === "Enter") save(); }} /></div>
          <div className="space-y-1"><Label>Color</Label><LayerColorPicker value={color} onChange={setColor} /></div>
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button type="button" variant="ghost" disabled={loading} onClick={remove} className={cn("gap-1.5", confirmDelete ? "text-red-300" : "text-red-400 hover:text-red-300")}>
            <Trash2 className="h-3.5 w-3.5" />{confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
          <Button type="button" disabled={!name.trim() || loading} onClick={save}>{loading ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LayerDialog({ open, onOpenChange, projectId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string | null; onCreated: (l: Layer) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LAYER_COLOR_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  async function create() {
    if (!projectId) return;
    setLoading(true);
    const r = await fetch("/api/layers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, name, color }) });
    const d = await r.json();
    setLoading(false);
    if (d.layer) { onCreated(d.layer); setName(""); setColor(LAYER_COLOR_OPTIONS[0].value); onOpenChange(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New layer</DialogTitle><DialogDescription>Pick a name and color for this layer.</DialogDescription></DialogHeader>
        {!projectId ? <p className="text-xs text-amber-400">Select or create a project first.</p> : (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Damage Assessment" /></div>
            <div className="space-y-1"><Label>Color</Label><LayerColorPicker value={color} onChange={setColor} /></div>
          </div>
        )}
        <DialogFooter><Button disabled={!name || !projectId || loading} onClick={create}>{loading ? "Creating…" : "Create layer"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
