"use client";

import { useEffect, useState } from "react";
import { format } from "@/lib/format";
import { getProblemMeta } from "@/lib/problems";
import type { RoadReport } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface ReportDetailProps {
  report: RoadReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDetail({ report, open, onOpenChange }: ReportDetailProps) {
  const meta = report ? getProblemMeta(report.type) : null;
  const [photo, setPhoto] = useState<string | undefined>();

  useEffect(() => {
    if (!open || !report) {
      setPhoto(undefined);
      return;
    }
    if (report.photoDataUrl) {
      setPhoto(report.photoDataUrl);
      return;
    }
    if (!report.hasPhoto) {
      setPhoto(undefined);
      return;
    }
    let cancelled = false;
    void fetch(`/api/reports?photo=${encodeURIComponent(report.id)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { photoDataUrl?: string } | null) => {
        if (!cancelled) setPhoto(data?.photoDataUrl);
      })
      .catch(() => {
        if (!cancelled) setPhoto(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [open, report]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-white/10 bg-zinc-950 px-4 pb-8"
      >
        {report && meta && (
          <>
            <SheetHeader className="px-0 text-left">
              <div className="mb-1">
                <Badge
                  className="border-0 text-zinc-950"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.label}
                </Badge>
              </div>
              <SheetTitle className="font-[family-name:var(--font-display)] text-xl leading-snug tracking-tight">
                {report.description}
              </SheetTitle>
              <SheetDescription className="flex items-start gap-1.5 text-zinc-400">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
                {report.address}
              </SheetDescription>
            </SheetHeader>

            {photo && (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt="Фото заявки"
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                <div className="text-[11px] tracking-wide text-zinc-500 uppercase">
                  Дата
                </div>
                <div className="mt-1 text-zinc-100">
                  {format(report.createdAt)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                <div className="text-[11px] tracking-wide text-zinc-500 uppercase">
                  Координаты
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-100">
                  {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
