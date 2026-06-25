import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/supabase";
import { getRepo } from "@/lib/db";
import { workspacePath } from "@/lib/workspaces/routes";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const repo = getRepo();
  await repo.upsertUser({ id: user.id, email: user.email, name: user.name });
  const workspaces = await repo.listWorkspaces(user.id);

  if (workspaces.length === 0) redirect("/setup");

  const cookieId = cookies().get("dos_workspace")?.value;
  const target = workspaces.find((w) => w.id === cookieId) ?? workspaces[0];
  redirect(workspacePath(target.slug));
}
