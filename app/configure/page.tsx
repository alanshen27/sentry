import { supabaseConfigured } from "@/lib/auth/client";
import { ShieldAlert, KeyRound, Database, Cpu } from "lucide-react";

export default function ConfigurePage() {
  const configured = supabaseConfigured();
  if (configured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center grid-bg p-6">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card/80 p-8 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-400" />
          <h1 className="text-lg font-semibold">Authentication Required</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Sentry is gated behind Supabase Auth and runs on Postgres + Redis in production.
          No bypass or local fallback is enabled. Add the following environment variables and
          restart the server to continue.
        </p>
        <pre className="mb-6 overflow-x-auto rounded-md border border-border bg-background/60 p-4 text-xs text-emerald-300"><code>{`# .env.local  (required)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://...        # Prisma + Postgres
REDIS_URL=rediss://...               # Redis cache
OPENAI_API_KEY=sk-...                # or OPENROUTER_API_KEY

# Optional — live wildfire feed (cached snapshot used if absent)
FIRMS_MAP_KEY=...`}</code></pre>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" /> Without Supabase env, every route redirects here.</div>
          <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Postgres (Prisma) is required — no local store.</div>
          <div className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" /> An LLM key is required — no mock brief.</div>
        </div>
      </div>
    </div>
  );
}
