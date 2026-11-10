"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LocateFixed, Plus, Layers, Loader2 } from "lucide-react";
import { AddressSearch } from "@/components/map/AddressSearch";
import { FilterBar } from "@/components/map/FilterBar";
import { ReportSheet } from "@/components/report/ReportSheet";
import { ReportDetail } from "@/components/report/ReportDetail";
import { Button } from "@/components/ui/button";
import { addReport, loadReports } from "@/lib/storage";
import type { SpamMeta } from "@/lib/spam";
import type { MapFocus, ProblemType, RoadReport } from "@/lib/types";

const MoscowMap = dynamic(
  () => import("@/components/map/MoscowMap").then((m) => m.MoscowMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#12101a] text-sm text-violet-200/70">
        Открываем карту России…
      </div>
    ),
  },
);

const MOSCOW_CENTER = { lat: 55.7558, lng: 37.6173 };

async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30_000 },
    );
  });
}

export function RoadApp() {
  const [reports, setReports] = useState<RoadReport[]>([]);
  const [filter, setFilter] = useState<Set<ProblemType> | "all">("all");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [draftLocation, setDraftLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState<RoadReport | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);

  const refreshReports = useCallback(async () => {
    try {
      const next = await loadReports();
      setReports(next);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refreshReports();
    const timer = window.setInterval(() => {
      void refreshReports();
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshReports();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshReports]);

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoHint(null);
    const loc = await getCurrentPosition();
    setLocating(false);
    if (!loc) {
      setGeoHint("Геолокация недоступна — разрешите доступ в браузере");
      window.setTimeout(() => setGeoHint(null), 4500);
      return null;
    }
    setUserLocation(loc);
    setFocus({ lat: loc.lat, lng: loc.lng, zoom: 15 });
    if (reportOpen) {
      setDraftLocation(loc);
    }
    setGeoHint("Местоположение определено");
    window.setTimeout(() => setGeoHint(null), 2200);
    return loc;
  }, [reportOpen]);

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((r) => filter.has(r.type));
  }, [reports, filter]);

  async function startCompose() {
    setSelected(null);
    setGeoHint(null);

    let loc = userLocation;
    if (!loc) {
      setLocating(true);
      loc = await getCurrentPosition();
      setLocating(false);
      if (loc) setUserLocation(loc);
    }

    const point = loc ?? MOSCOW_CENTER;
    setDraftLocation(point);
    setFocus({ lat: point.lat, lng: point.lng, zoom: loc ? 16 : 12 });
    setReportOpen(true);
    if (!loc) {
      setGeoHint("Перетащите метку или нажмите на карту");
      window.setTimeout(() => setGeoHint(null), 3500);
    }
  }

  function handleDraftMove(loc: { lat: number; lng: number }) {
    setDraftLocation(loc);
  }

  async function handleSubmitted(report: RoadReport, spam: SpamMeta) {
    try {
      const next = await addReport(report, spam);
      setReports(next);
      setFocus({ lat: report.lat, lng: report.lng, zoom: 16 });
      setDraftLocation(null);
      setSelected(report);
      setGeoHint("Заявка сохранена и видна на всех устройствах");
      window.setTimeout(() => setGeoHint(null), 2800);
    } catch (error) {
      setGeoHint(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить заявку. Попробуйте ещё раз.",
      );
      window.setTimeout(() => setGeoHint(null), 4500);
      throw error;
    }
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#12101a] text-zinc-50">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[2000] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-lg leading-none tracking-tight text-violet-300 sm:text-xl">
                Дорога.МСК
              </p>
              <p className="mt-1 truncate text-[11px] text-violet-200/50 sm:text-xs">
                Тёмная карта · точка на карте · заявка
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-[#1a1625]/85 px-2.5 py-1 text-[11px] text-violet-100 backdrop-blur-md">
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin text-violet-300" />
              ) : (
                <Layers className="size-3.5 text-violet-300" />
              )}
              {filtered.length} на карте
            </div>
          </div>

          {!reportOpen && (
            <>
              <AddressSearch
                onSelect={(r) => setFocus({ lat: r.lat, lng: r.lng, zoom: 15 })}
              />
              <FilterBar active={filter} onChange={setFilter} />
            </>
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <MoscowMap
          reports={filtered}
          focus={focus}
          userLocation={userLocation}
          draftLocation={reportOpen ? draftLocation : null}
          composeMode={reportOpen}
          onSelectReport={(r) => {
            if (reportOpen) return;
            setSelected(r);
          }}
          onDraftMove={handleDraftMove}
        />
      </main>

      {!reportOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2000] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-end justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-12 rounded-2xl border border-violet-400/20 bg-[#1a1625]/90 shadow-xl backdrop-blur-md hover:bg-violet-500/15"
              onClick={() => void locate()}
              disabled={locating}
              aria-label="Моя геолокация"
            >
              {locating ? (
                <Loader2 className="size-5 animate-spin text-violet-300" />
              ) : (
                <LocateFixed className="size-5 text-violet-300" />
              )}
            </Button>

            <Button
              type="button"
              className="h-14 flex-1 rounded-2xl bg-violet-400 text-base font-semibold text-violet-950 shadow-[0_10px_40px_rgba(139,92,246,0.35)] hover:bg-violet-300"
              onClick={() => void startCompose()}
            >
              <Plus className="size-5" />
              Сообщить о проблеме
            </Button>
          </div>

          {geoHint && (
            <p className="pointer-events-auto mx-auto mt-2 max-w-3xl rounded-xl border border-violet-400/25 bg-[#1a1625]/90 px-3 py-2 text-center text-xs text-violet-100 backdrop-blur-md">
              {geoHint}
            </p>
          )}
        </div>
      )}

      <ReportSheet
        open={reportOpen}
        onOpenChange={(open) => {
          setReportOpen(open);
          if (!open) setDraftLocation(null);
        }}
        location={draftLocation}
        locating={locating}
        onLocate={locate}
        onSubmitted={handleSubmitted}
      />

      {reportOpen && geoHint && (
        <p className="pointer-events-none absolute inset-x-0 top-[7.5rem] z-[1990] px-3 sm:px-4">
          <span className="mx-auto block max-w-3xl rounded-xl border border-violet-400/25 bg-[#1a1625]/90 px-3 py-2 text-center text-xs text-violet-100 backdrop-blur-md">
            {geoHint}
          </span>
        </p>
      )}

      <ReportDetail
        report={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}
