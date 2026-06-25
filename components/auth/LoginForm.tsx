"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, Loader2 } from "lucide-react";
import GlassSurface from "@/components/ui/GlassSurface/GlassSurface";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou password incorretos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--orange-soft)]">
          <Home size={24} strokeWidth={2} className="text-orange-500" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-display text-ink">
            Sparks Aloja
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Gestão de alojamento de trabalhadores
          </p>
        </div>
      </div>

      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={24}
        brightness={55}
        opacity={0.9}
        blur={11}
        backgroundOpacity={0.08}
        saturation={1.2}
        distortionScale={-150}
        className="w-full"
      >
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-[var(--radius-xl)] p-6"
        >
        <label className="mb-1.5 block text-sm font-medium text-ink-muted">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@sparks.es"
          className="mb-4 w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-[var(--orange-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--orange-soft)]"
        />

        <label className="mb-1.5 block text-sm font-medium text-ink-muted">
          Password
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-[var(--orange-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--orange-soft)]"
        />

        {error && (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-glass-accent mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "A entrar…" : "Entrar"}
        </button>
        </form>
      </GlassSurface>
    </div>
  );
}
