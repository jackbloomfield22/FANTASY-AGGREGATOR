"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

/** Email/password auth via Supabase; degrades gracefully when unconfigured. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!supabase) {
    return (
      <div className="rounded-xl border border-dashed border-edge bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">Accounts aren&apos;t configured yet</p>
        <p className="mt-1 text-xs text-ink-dim">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable sign-up and
          login. You can use the full product without an account:
        </p>
        <a
          href="/api/demo/enter"
          className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent-ink hover:opacity-90"
        >
          Enter demo
        </a>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        track("signup_completed");
        if (data.session) {
          router.push("/onboarding");
        } else {
          setNotice("Check your email to confirm your account, then log in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="block text-xs font-semibold text-ink-dim">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none"
        />
      </label>
      <label className="block text-xs font-semibold text-ink-dim">
        Password
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none"
        />
      </label>
      {error ? <p role="alert" className="text-xs font-medium text-loss">{error}</p> : null}
      {notice ? <p className="text-xs font-medium text-win">{notice}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {mode === "signup" ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-xs text-ink-dim">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-accent hover:underline">
              Sign up
            </Link>
          </>
        )}{" "}
        · <a href="/api/demo/enter" className="font-semibold text-accent hover:underline">Enter demo</a>
      </p>
    </form>
  );
}
