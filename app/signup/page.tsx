"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowser } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/logo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowser();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name || undefined } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center grid-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <LogoMark size={22} className="text-slate-400" />
            <span className="text-sm font-semibold tracking-wide">Sentry</span>
          </div>
          <CardTitle className="text-base">Create an operator account</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">Check your email for a confirmation link, then <a href="/login" className="text-primary hover:underline">sign in</a>.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating…" : "Create account"}</Button>
            </form>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Have an account? <a href="/login" className="text-primary hover:underline">Sign in</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
