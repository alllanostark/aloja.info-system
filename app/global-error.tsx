"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="pt">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Erro inesperado - Sparks Aloja</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
              body{
                background:#07080a;
                color:#f4f4f6;
                font-family:system-ui,-apple-system,sans-serif;
                -webkit-font-smoothing:antialiased;
                min-height:100dvh;
                display:flex;
                align-items:center;
                justify-content:center;
                padding:1rem;
              }
              .card{
                width:100%;
                max-width:400px;
                background:#111318;
                border:1px solid rgba(239,68,68,0.25);
                border-radius:16px;
                padding:2rem;
                text-align:center;
                display:flex;
                flex-direction:column;
                align-items:center;
                gap:1.25rem;
              }
              .icon{
                width:52px;
                height:52px;
                border-radius:12px;
                background:rgba(239,68,68,0.12);
                display:flex;
                align-items:center;
                justify-content:center;
              }
              svg{stroke:#f87171;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
              h1{font-size:1.0625rem;font-weight:600;letter-spacing:-0.02em}
              p{font-size:0.875rem;color:#a1a5b0;line-height:1.55}
              .digest{font-family:monospace;font-size:0.75rem;color:#62666d;margin-top:0.25rem}
              button{
                width:100%;
                background:#f97316;
                color:#fff;
                border:none;
                border-radius:8px;
                padding:0.625rem 1rem;
                font-size:0.875rem;
                font-weight:500;
                cursor:pointer;
                transition:background 0.15s;
              }
              button:hover{background:#ea6c0a}
              button:active{background:#c2550a}
              button:focus-visible{
                outline:2px solid #f97316;
                outline-offset:2px;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="card" style={{ width: "100%", maxWidth: "400px", background: "#111318", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "16px", padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div>
            <h1 style={{ fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Erro inesperado
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#a1a5b0", lineHeight: "1.55", marginTop: "0.5rem" }}>
              Ocorreu um erro crítico na aplicação. Por favor, recarrega a página.
            </p>
            {error.digest && (
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#62666d", marginTop: "0.375rem" }}>
                ref: {error.digest}
              </p>
            )}
          </div>

          <button onClick={reset}>
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
