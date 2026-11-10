"use client";

import { PROBLEM_TYPES } from "@/lib/problems";
import type { ProblemType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  active: Set<ProblemType> | "all";
  onChange: (next: Set<ProblemType> | "all") => void;
}

export function FilterBar({ active, onChange }: FilterBarProps) {
  const isAll = active === "all";

  function toggle(type: ProblemType) {
    if (active === "all") {
      onChange(new Set([type]));
      return;
    }
    const next = new Set(active);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (next.size === 0 || next.size === PROBLEM_TYPES.length) {
      onChange("all");
    } else {
      onChange(next);
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
          isAll
            ? "border-violet-400/50 bg-violet-400/20 text-violet-100"
            : "border-violet-400/15 bg-[#1a1625]/75 text-violet-100/80 hover:border-violet-400/30",
        )}
      >
        Все
      </button>
      {PROBLEM_TYPES.map((p) => {
        const selected = active === "all" ? false : active.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              selected
                ? "border-transparent text-zinc-950"
                : "border-violet-400/15 bg-[#1a1625]/75 text-violet-100/80 hover:border-violet-400/30",
            )}
            style={
              selected
                ? { backgroundColor: p.color, borderColor: p.color }
                : undefined
            }
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: selected ? "#18181b" : p.color }}
            />
            {p.short}
          </button>
        );
      })}
    </div>
  );
}
