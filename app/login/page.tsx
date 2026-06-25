"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowser } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/logo";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-xs text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center grid-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <LogoMark size={22} className="text-slate-400" />
            <span className="text-sm font-semibold tracking-wide">Sentry</span>
          </div>
          <CardTitle className="text-base">Sign in to operations console</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="analyst@ops.org" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No account? <a href="/signup" className="text-primary hover:underline">Create one</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
