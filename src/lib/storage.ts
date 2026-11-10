import type { RoadReport } from "./types";
import type { SpamMeta } from "./spam";

const STORAGE_KEY = "doroga-msk-reports-v1";
const API_PATH = "/api/reports";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadLocalReports(): RoadReport[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoadReport[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLocalReports(reports: RoadReport[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export async function loadReports(): Promise<RoadReport[]> {
  try {
    const res = await fetch(API_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RoadReport[];
    if (!Array.isArray(data)) throw new Error("bad payload");
    saveLocalReports(data);
    return data;
  } catch {
    return loadLocalReports();
  }
}

function isLocalHost() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

export async function addReport(
  report: RoadReport,
  spam?: SpamMeta,
): Promise<RoadReport[]> {
  try {
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...report, spam }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error || `Не удалось сохранить (код ${res.status})`);
    }
    return loadReports();
  } catch (error) {
    // Локально без Netlify Functions — сохраняем только в этом браузере
    if (isLocalHost()) {
      const next = [
        report,
        ...loadLocalReports().filter((r) => r.id !== report.id),
      ];
      saveLocalReports(next);
      console.warn(
        "Общее хранилище недоступно локально — заявка сохранена только в этом браузере. На Netlify она будет общей.",
        error,
      );
      return next;
    }
    throw error instanceof Error
      ? error
      : new Error("Не удалось сохранить заявку");
  }
}
