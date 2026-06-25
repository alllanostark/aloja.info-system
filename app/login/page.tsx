import { LoginForm } from "@/components/auth/LoginForm";
import FloatingLines from "@/components/ui/FloatingLines/FloatingLines";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      {/* Background animado — linhas flutuantes Sparks.
          mixBlendMode "screen" anula o fundo preto do canvas WebGL,
          deixando só as linhas brilharem sobre o grafite. */}
      <div aria-hidden className="fixed inset-0 z-0 opacity-35">
        <FloatingLines
          linesGradient={["#fdb06a", "#f97316", "#ea6c0a"]}
          lineCount={4}
          lineDistance={9}
          animationSpeed={0.35}
          bendStrength={-0.3}
          interactive
          parallax
          mixBlendMode="screen"
        />
      </div>

      {/* Aurora atmosférico subtil */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 z-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, #f97316 0%, #1e293b 45%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <LoginForm />
      </div>
    </div>
  );
}
