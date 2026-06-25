import { createBrowserClient } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

export async function createServerFromRequest(req: Request) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookie = req.headers.get("cookie") ?? "";
          return cookie.split(";").filter(Boolean).map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll() {
          // route handler; response cookies handled by caller
        },
      },
    }
  );
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const email = data.user.email ?? "";
  const name =
    (data.user.user_metadata?.full_name as string) ??
    (data.user.user_metadata?.name as string) ??
    null;
  return { id: data.user.id, email, name };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
