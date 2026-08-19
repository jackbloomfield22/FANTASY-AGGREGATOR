import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-black text-accent-ink">
            FA
          </span>
          <span className="text-sm font-bold text-ink">Fantasy Aggregator</span>
        </Link>
        <h1 className="mb-4 text-center text-lg font-black uppercase tracking-wide text-ink">
          Create your account
        </h1>
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
