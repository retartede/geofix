"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Crosshair,
  Loader2,
  MapPin,
  Trash2,
  ImagePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PROBLEM_TYPES } from "@/lib/problems";
import {
  checkClientRateLimit,
  rememberClientSubmit,
  validateReportPayload,
  type SpamMeta,
} from "@/lib/spam";
import type { ProblemType, RoadReport } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: { lat: number; lng: number } | null;
  locating?: boolean;
  onLocate: () => Promise<{ lat: number; lng: number } | null>;
  onSubmitted: (
    report: RoadReport,
    spam: SpamMeta,
  ) => void | Promise<void>;
}

async function reverseGeocode(lat: number, lng: number) {
  const { reverseRussiaAddress } = await import("@/lib/geocode-client");
  return reverseRussiaAddress(lat, lng);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Ужимаем снимок с телефона, чтобы заявка доезжала по мобильной сети */
async function compressImage(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let url = canvas.toDataURL("image/jpeg", 0.72);
    if (url.length > 450_000) url = canvas.toDataURL("image/jpeg", 0.5);
    return url;
  } catch {
    return readFileAsDataUrl(file);
  }
}

export function ReportSheet({
  open,
  onOpenChange,
  location,
  locating = false,
  onLocate,
  onSubmitted,
}: ReportSheetProps) {
  const [type, setType] = useState<ProblemType>("asphalt");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  // Сброс полей только при открытии формы — смена точки на карте категорию не трогает
  useEffect(() => {
    if (open && !wasOpen.current) {
      setType("asphalt");
      setDescription("");
      setPhoto(undefined);
      setError(null);
      setSubmitting(false);
      setWebsite("");
      setOpenedAt(Date.now());
      setAddress("");
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !location) {
      if (!location) setAddress("");
      return;
    }
    let cancelled = false;
    setAddressLoading(true);
    void reverseGeocode(location.lat, location.lng).then((addr) => {
      if (!cancelled) {
        setAddress(addr);
        setAddressLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, location?.lat, location?.lng]);

  async function handleLocateClick() {
    setError(null);
    const loc = await onLocate();
    if (!loc) {
      setError("Не удалось определить геолокацию. Разрешите доступ в браузере.");
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Нужен файл изображения");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Фото слишком большое (макс. 12 МБ)");
      return;
    }
    setError(null);
    const dataUrl = await compressImage(file);
    if (dataUrl.length > 500_000) {
      setError("Не удалось сжать фото. Попробуйте другое.");
      return;
    }
    setPhoto(dataUrl);
  }

  async function handleSubmit() {
    if (location == null) {
      setError("Укажите точку на карте");
      return;
    }
    if (!description.trim()) {
      setError("Кратко опишите проблему");
      return;
    }

    const rateErr = checkClientRateLimit();
    if (rateErr) {
      setError(rateErr);
      return;
    }

    const report: RoadReport = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      description: description.trim(),
      lat: location.lat,
      lng: location.lng,
      address: address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      photoDataUrl: photo,
      createdAt: new Date().toISOString(),
    };

    const spam: SpamMeta = { website, openedAt };
    const invalid = validateReportPayload(report, spam, { checkTiming: true });
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmitted(report, spam);
      rememberClientSubmit();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отправить заявку",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[2000] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      role="dialog"
      aria-modal="false"
      aria-labelledby="report-sheet-title"
    >
      <div className="pointer-events-auto mx-auto max-h-[min(58vh,520px)] max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950/95 shadow-[0_-12px_40px_rgba(0,0,0,.45)] backdrop-blur-md">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/5 bg-zinc-950/90 px-4 pt-3 pb-2 backdrop-blur-md">
          <div className="min-w-0">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:mx-0" />
            <h2
              id="report-sheet-title"
              className="font-[family-name:var(--font-display)] text-lg tracking-tight"
            >
              Новая заявка
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Двигайте метку на карте — форма остаётся открытой
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-3 pb-5">
          {/* honeypot — скрыто от людей */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
          >
            <label htmlFor="company_website">Сайт</label>
            <input
              id="company_website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block text-zinc-300">Тип проблемы</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROBLEM_TYPES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setType(p.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs transition",
                    type === p.id
                      ? "border-violet-400/70 bg-violet-400/15 text-violet-50"
                      : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-white/20",
                  )}
                >
                  <span
                    className="mb-1.5 block size-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-medium">{p.short}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-zinc-300">Точка на карте</Label>
            <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-violet-300" />
                <div className="min-w-0 flex-1">
                  {locating || addressLoading ? (
                    <span className="inline-flex items-center gap-2 text-zinc-400">
                      <Loader2 className="size-3.5 animate-spin" />
                      {locating
                        ? "Определяем местоположение…"
                        : "Уточняем адрес…"}
                    </span>
                  ) : address ? (
                    <span className="text-zinc-100">{address}</span>
                  ) : (
                    <span className="text-zinc-500">
                      Перетащите метку или нажмите на карту
                    </span>
                  )}
                  {location && (
                    <div className="mt-1 font-mono text-[11px] text-zinc-500">
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-9 w-full rounded-lg border-violet-400/25"
                onClick={() => void handleLocateClick()}
                disabled={locating}
              >
                <Crosshair className="size-3.5" />
                Моя геолокация
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-zinc-300">Фото</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handlePhoto(e.target.files?.[0])}
            />
            {photo ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt="Фото проблемы"
                  className="h-36 w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 rounded-lg bg-zinc-950/80 p-2 text-zinc-200"
                  onClick={() => setPhoto(undefined)}
                  aria-label="Удалить фото"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 flex-1 rounded-xl bg-zinc-900"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="size-4" />
                  Сфотографировать
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-white/15"
                  onClick={() => {
                    if (fileRef.current) {
                      fileRef.current.removeAttribute("capture");
                      fileRef.current.click();
                      fileRef.current.setAttribute("capture", "environment");
                    }
                  }}
                >
                  <ImagePlus className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="desc" className="mb-2 block text-zinc-300">
              Краткое описание
            </Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: грузовики постоянно ломают асфальт у съезда, образуются ямы и затор…"
              className="min-h-[88px] rounded-xl border-white/10 bg-zinc-900 text-sm"
              maxLength={400}
            />
            <div className="mt-1 text-right text-[11px] text-zinc-500">
              {description.length}/400
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-violet-400 text-violet-950 hover:bg-violet-300"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Отправка…
              </>
            ) : (
              "Отправить на карту"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
