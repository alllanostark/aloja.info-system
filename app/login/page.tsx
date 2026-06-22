import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      {/* Aurora atmosférico subtil */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
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
