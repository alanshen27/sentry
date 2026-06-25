import { WorkspaceGate } from "@/components/workspace-gate";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  return <WorkspaceGate workspaceSlug={params.workspaceSlug}>{children}</WorkspaceGate>;
}
