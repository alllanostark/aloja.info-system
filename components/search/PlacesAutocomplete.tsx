"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Prediction {
  description: string;
  place_id: string;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const inputCls =
  "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-[var(--orange-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--orange-soft)]";

/** ID de sessão resiliente. crypto.randomUUID só existe em secure context
 *  (HTTPS/localhost); o VPS acedido por IP em HTTP rebentaria no render. */
function genSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PlacesAutocomplete({
  value,
  onChange,
  placeholder = "Rua, número, cidade",
  className,
  id,
}: Props) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<string>("");
  if (!sessionRef.current) sessionRef.current = genSessionId();
  const suppressFetch = useRef(false);
  const latestReqRef = useRef(0);

  const fetchPredictions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const reqId = ++latestReqRef.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}`
      );
      if (!res.ok) throw new Error("fetch error");
      const data: { predictions: Prediction[] } = await res.json();
      if (reqId !== latestReqRef.current) return; // resposta fora de ordem — descarta
      setPredictions(data.predictions);
      setOpen(data.predictions.length > 0);
    } catch {
      if (reqId !== latestReqRef.current) return;
      setPredictions([]);
      setOpen(false);
    } finally {
      if (reqId === latestReqRef.current) setLoading(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setQuery(text);
    onChange(text);
    setActiveIndex(-1);
    suppressFetch.current = false;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!suppressFetch.current) fetchPredictions(text);
    }, 300);
  }

  function selectPrediction(prediction: Prediction) {
    suppressFetch.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(prediction.description);
    onChange(prediction.description);
    setPredictions([]);
    setOpen(false);
    setActiveIndex(-1);
    sessionRef.current = genSessionId();
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && predictions[activeIndex]) {
        e.preventDefault();
        selectPrediction(predictions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery((prev) => (prev !== value ? value : prev));
  }, [value]);

  // Cancela o debounce pendente ao desmontar (evita setState/fetch órfãos).
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          size={15}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `places-option-${activeIndex}` : undefined
          }
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(inputCls, "pl-9 pr-9")}
        />
        {loading && (
          <Loader2
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-subtle"
          />
        )}
      </div>

      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Sugestões de endereço"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-medium)] bg-surface-2 py-1 shadow-[var(--shadow-lg)]"
        >
          {predictions.map((p, i) => (
            <li
              key={p.place_id}
              id={`places-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPrediction(p);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-sm transition-colors",
                i === activeIndex
                  ? "bg-[var(--orange-soft)] text-ink"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              )}
            >
              <MapPin
                size={14}
                strokeWidth={1.5}
                className={cn(
                  "mt-0.5 shrink-0",
                  i === activeIndex ? "text-orange-400" : "text-ink-subtle"
                )}
              />
              <span className="line-clamp-2 leading-snug">{p.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
