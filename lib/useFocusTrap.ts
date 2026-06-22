"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Prende o foco de teclado dentro de um container (modal/dialog) enquanto
 * `active` for true: foca o primeiro elemento ao abrir, circula com Tab/
 * Shift+Tab, chama `onEscape` no Escape, e devolve o foco ao elemento de
 * origem ao fechar. WCAG 2.1.2 / 2.4.3.
 *
 * Passa um `onEscape` estável (ex: useCallback) para evitar re-execuções.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
) {
  useEffect(() => {
    if (!active) return;
    const node = containerRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

    // Foca o primeiro elemento focável ao abrir.
    focusables()[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", handleKeyDown);
    return () => {
      node.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [containerRef, active, onEscape]);
}
