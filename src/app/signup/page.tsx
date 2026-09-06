"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PulseMark } from "@/components/PulseMark";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/primitives";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              <PulseMark size={48} animated={true} />
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Create your Pulse
            </h1>

            <p className="mt-1 text-sm text-white/50">
              Start tracking market movements and intelligent signals
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-pulse-500/30 bg-pulse-500/10 px-4 py-3 text-xs font-medium text-pulse-400"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                Name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="glass w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-signal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="glass w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-signal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="glass w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-signal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                Confirm Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="glass w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-signal-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00F3BB] hover:bg-[#33F7C9] px-4 py-3 text-sm font-bold text-ink-950 transition-all shadow-[0_0_24px_rgba(0,243,187,0.35)] hover:shadow-[0_0_32px_rgba(0,243,187,0.5)] disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950 border-t-transparent" />
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-white/50">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-white transition-colors hover:text-signal-400"
              >
                Log in
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
