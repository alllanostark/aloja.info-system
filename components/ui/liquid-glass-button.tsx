"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─── Variantes CVA ─────────────────────────────────────────────────────── */

const liquidButtonVariants = cva(
  // Base: posição relativa para os layers de glass sobrepostos
  [
    "relative inline-flex items-center justify-center gap-2",
    "select-none cursor-pointer",
    "font-semibold leading-none whitespace-nowrap",
    "rounded-[var(--radius-md)]",
    "transition-all duration-200 ease-out",
    // Foco acessível — herda o :focus-visible do globals.css
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    // Isola o filtro SVG dentro do botão
    "isolate overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        // Variante principal: laranja Sparks com efeito liquid glass
        default: [
          "bg-orange-500 text-white",
          "shadow-[0_0_0_1px_var(--orange-border),0_2px_12px_var(--orange-glow),inset_0_1px_0_rgba(255,255,255,0.2)]",
          "hover:bg-orange-400 hover:shadow-[0_0_0_1px_var(--orange-border),0_4px_20px_var(--orange-glow)]",
          "active:scale-[0.98] active:brightness-95",
        ].join(" "),
        // Variante ghost para contextos onde o fundo já é laranja
        ghost: [
          "bg-[var(--orange-soft)] text-orange-400 border border-[var(--orange-border)]",
          "hover:bg-[var(--orange-soft-2)] hover:text-orange-300",
          "active:scale-[0.98]",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        xl: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/* ─── GlassFilter ───────────────────────────────────────────────────────── */
/*
 * Filtro SVG que cria o efeito "liquid" (distorção de vidro).
 * Aplicado via backdrop-filter: url("#sparks-glass-filter") — suportado
 * em Chrome 76+ e Edge 79+. Firefox ignora silenciosamente; Safari 18+
 * suporta parcialmente. Em browsers sem suporte, o botão renderiza
 * normalmente com as sombras/cores definidas no CVA (fallback visual).
 *
 * O SVG tem width/height=0 e aria-hidden para não ocupar espaço nem
 * aparecer para leitores de ecrã.
 */
function GlassFilter() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="sparks-glass-filter" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65 0.75"
            numOctaves="2"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feComposite in="displaced" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/* ─── Layers de glass sobrepostos ───────────────────────────────────────── */
/*
 * Dois pseudo-layers via divs absolutas:
 *   1. Inner highlight — simula a refração superior do vidro
 *   2. Noise layer    — textura sutil via backdrop-filter + SVG filter
 *
 * Ambos usam pointer-events:none para não interceptar cliques.
 * Fallback: se backdrop-filter não for suportado, a camada fica
 * invisível mas o botão permanece completamente funcional.
 */
function GlassLayers() {
  return (
    <>
      {/* Realce de refração no topo */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[var(--radius-md)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* Camada de distorção liquid glass */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)]"
        style={{
          // O backdrop-filter com url() aplica o SVG filter ao que está atrás do elemento.
          // Browsers sem suporte ignoram esta propriedade; o botão fica visível e clicável.
          backdropFilter: "url('#sparks-glass-filter') blur(0px)",
          WebkitBackdropFilter: "url('#sparks-glass-filter') blur(0px)",
          opacity: 0.6,
        }}
      />
    </>
  );
}

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidButtonVariants> {
  asChild?: boolean;
}

/* ─── Componente principal ──────────────────────────────────────────────── */

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <>
        {/*
         * GlassFilter é renderizado uma única vez por instância do botão.
         * Em uso múltiplo na mesma página, o id é partilhado — o SVG é
         * posicionado fora do fluxo (absolute, 0x0) e não duplica visualmente.
         * Para páginas com muitos LiquidButtons, extrair GlassFilter para
         * um Provider de topo é o caminho ideal (ver integrationNotes).
         */}
        <GlassFilter />
        <Comp
          ref={ref}
          className={cn(liquidButtonVariants({ variant, size, className }))}
          {...props}
        >
          <GlassLayers />
          {/* Conteúdo do botão acima dos layers */}
          <span className="relative z-10 inline-flex items-center gap-2">
            {children}
          </span>
        </Comp>
      </>
    );
  }
);

LiquidButton.displayName = "LiquidButton";

export { LiquidButton, liquidButtonVariants };
