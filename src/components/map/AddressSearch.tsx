"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchRussiaAddress } from "@/lib/geocode-client";
import { cn } from "@/lib/utils";

export interface SearchResult {
  label: string;
  lat: number;
  lng: number;
}

interface AddressSearchProps {
  onSelect: (result: SearchResult) => void;
  className?: string;
}

export function AddressSearch({ onSelect, className }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await searchRussiaAddress(
          query.trim(),
          controller.signal,
        );
        setResults(hits);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div ref={boxRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Поиск адреса в России…"
          className="h-11 rounded-xl border-violet-400/20 bg-[#1a1625]/85 pr-10 pl-10 text-sm shadow-lg backdrop-blur-md placeholder:text-violet-200/40"
          aria-label="Поиск адреса в России"
        />
        {loading ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-violet-300" />
        ) : query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-100"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            aria-label="Очистить поиск"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute top-[calc(100%+6px)] z-[2100] max-h-64 w-full overflow-auto rounded-xl border border-violet-400/20 bg-[#1a1625]/97 py-1 shadow-2xl backdrop-blur-md">
          {results.map((item) => (
            <li key={`${item.lat}-${item.lng}-${item.label}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-violet-50 transition hover:bg-violet-500/15"
                onClick={() => {
                  onSelect(item);
                  setQuery(item.label.split(",").slice(0, 2).join(","));
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-violet-300" />
                <span className="line-clamp-2 leading-snug">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
