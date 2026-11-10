import type { ProblemType, RoadReport } from "./types";
import { PROBLEM_TYPES } from "./problems";

/** Примерные границы России (включая Калининград и Чукотку за 180°) */
export const RUSSIA_BOUNDS = {
  minLat: 41.0,
  maxLat: 82.0,
  minLng: 19.0,
  maxLng: 180.0,
  /** Восточный край Чукотки (долгота к западу от 180°) */
  chukotkaMinLng: -180.0,
  chukotkaMaxLng: -168.0,
} as const;

const VALID_TYPES = new Set(PROBLEM_TYPES.map((p) => p.id));

const CLIENT_RATE_KEY = "doroga-msk-submit-times";
const CLIENT_MAX_PER_HOUR = 8;
const MIN_FILL_MS = 2200;

export type SpamMeta = {
  /** honeypot — должен остаться пустым */
  website?: string;
  /** когда открыли форму */
  openedAt?: number;
};

export function isInRussiaBounds(lat: number, lng: number) {
  if (lat < RUSSIA_BOUNDS.minLat || lat > RUSSIA_BOUNDS.maxLat) return false;
  if (lng >= RUSSIA_BOUNDS.minLng && lng <= RUSSIA_BOUNDS.maxLng) return true;
  if (
    lng >= RUSSIA_BOUNDS.chukotkaMinLng &&
    lng <= RUSSIA_BOUNDS.chukotkaMaxLng
  ) {
    return true;
  }
  return false;
}

export function validateReportPayload(
  report: Partial<RoadReport>,
  spam?: SpamMeta,
  opts?: { checkTiming?: boolean },
): string | null {
  if (spam?.website && spam.website.trim()) {
    return "Отклонено";
  }

  // Тайминг только на клиенте — часы браузера и сервера могут расходиться
  if (opts?.checkTiming && typeof spam?.openedAt === "number") {
    const elapsed = Date.now() - spam.openedAt;
    if (elapsed < MIN_FILL_MS || elapsed > 1000 * 60 * 60 * 6) {
      return "Подождите пару секунд и отправьте ещё раз";
    }
  }

  if (!report || typeof report !== "object") return "Некорректная заявка";
  if (!report.id || typeof report.id !== "string" || report.id.length > 80) {
    return "Некорректный id";
  }
  if (!VALID_TYPES.has(report.type as ProblemType)) {
    return "Неизвестный тип проблемы";
  }

  const description =
    typeof report.description === "string" ? report.description.trim() : "";
  if (description.length < 8) return "Опишите проблему чуть подробнее";
  if (description.length > 400) return "Слишком длинное описание";

  const lat = Number(report.lat);
  const lng = Number(report.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Некорректные координаты";
  }
  if (!isInRussiaBounds(lat, lng)) {
    return "Точка должна быть в пределах России";
  }

  if (typeof report.address !== "string" || report.address.length > 240) {
    return "Некорректный адрес";
  }

  if (report.photoDataUrl != null) {
    if (typeof report.photoDataUrl !== "string") return "Некорректное фото";
    if (!report.photoDataUrl.startsWith("data:image/")) {
      return "Нужен файл изображения";
    }
    if (report.photoDataUrl.length > 500_000) {
      return "Фото слишком большое";
    }
  }

  if (
    typeof report.createdAt !== "string" ||
    Number.isNaN(Date.parse(report.createdAt))
  ) {
    return "Некорректная дата";
  }

  return null;
}

/** Простой лимит на устройстве (до серверного) */
export function checkClientRateLimit(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CLIENT_RATE_KEY);
    const times: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = times.filter((t) => t > hourAgo);
    if (recent.length >= CLIENT_MAX_PER_HOUR) {
      return "Слишком много заявок с этого устройства. Попробуйте позже.";
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function rememberClientSubmit() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CLIENT_RATE_KEY);
    const times: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const next = [...times.filter((t) => t > hourAgo), Date.now()];
    window.localStorage.setItem(CLIENT_RATE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
