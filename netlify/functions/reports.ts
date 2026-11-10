import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { RoadReport } from "../../src/lib/types";
import { validateReportPayload, type SpamMeta } from "../../src/lib/spam";

const STORE = "doroga-msk-reports";
const KEY = "all";
const RATE_STORE = "doroga-msk-rate";
const MAX_REPORTS = 5000;
const MAX_PER_IP_HOUR = 6;

type RateBucket = { hits: number[] };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function clientIp(req: Request, context: Context) {
  const fromCtx = (context as { ip?: string }).ip;
  if (fromCtx) return fromCtx;
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function withoutInlinePhoto(report: RoadReport): RoadReport {
  if (!report.photoDataUrl) return report;
  const { photoDataUrl: _photo, ...rest } = report;
  return { ...rest, hasPhoto: true };
}

async function loadReports(): Promise<RoadReport[]> {
  const store = getStore(STORE);
  const raw = await store.get(KEY, { type: "json" });
  if (!raw || !Array.isArray(raw)) {
    await store.setJSON(KEY, []);
    return [];
  }
  const reports = raw as RoadReport[];
  if (reports.some((r) => r.photoDataUrl)) {
    for (const report of reports) {
      if (report.photoDataUrl) {
        await store.set(`photo:${report.id}`, report.photoDataUrl);
      }
    }
    const slim = reports.map(withoutInlinePhoto);
    await store.setJSON(KEY, slim);
    return slim;
  }
  return reports;
}

async function checkRateLimit(ip: string): Promise<string | null> {
  const store = getStore(RATE_STORE);
  const key = encodeURIComponent(ip).slice(0, 120);
  const bucket = ((await store.get(key, { type: "json" })) as RateBucket | null) ?? {
    hits: [],
  };
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const hits = (bucket.hits ?? []).filter((t) => t > hourAgo);
  if (hits.length >= MAX_PER_IP_HOUR) {
    return "Слишком много заявок. Попробуйте через час.";
  }
  hits.push(Date.now());
  await store.setJSON(key, { hits });
  return null;
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method === "GET") {
    try {
      const photoId = new URL(req.url).searchParams.get("photo");
      if (photoId) {
        if (!/^r-[\w-]{4,80}$/.test(photoId)) {
          return json(400, { error: "Некорректный id" });
        }
        const store = getStore(STORE);
        const photo = await store.get(`photo:${photoId}`);
        if (!photo) return json(404, { error: "Фото не найдено" });
        return json(200, { photoDataUrl: photo });
      }
      const reports = await loadReports();
      return json(200, reports.map(withoutInlinePhoto));
    } catch (err) {
      console.error(err);
      return json(500, { error: "Не удалось загрузить заявки" });
    }
  }

  if (req.method === "POST") {
    try {
      const payload = (await req.json()) as RoadReport & { spam?: SpamMeta };
      const { spam, ...report } = payload;
      const invalid = validateReportPayload(report, spam);
      if (invalid) return json(400, { error: invalid });

      const rateErr = await checkRateLimit(clientIp(req, context));
      if (rateErr) return json(429, { error: rateErr });

      const reports = await loadReports();
      if (reports.some((r) => r.id === report.id)) {
        return json(200, { ok: true });
      }

      const store = getStore(STORE);
      if (report.photoDataUrl) {
        await store.set(`photo:${report.id}`, report.photoDataUrl);
      }

      const cleaned: RoadReport = {
        id: report.id,
        type: report.type,
        description: report.description.trim(),
        lat: Number(report.lat),
        lng: Number(report.lng),
        address: report.address.trim() || `${report.lat}, ${report.lng}`,
        createdAt: report.createdAt,
        ...(report.photoDataUrl ? { hasPhoto: true } : {}),
      };

      const next = [cleaned, ...reports.map(withoutInlinePhoto)].slice(0, MAX_REPORTS);
      await store.setJSON(KEY, next);
      return json(201, { ok: true, id: cleaned.id });
    } catch (err) {
      console.error(err);
      return json(500, { error: "Не удалось сохранить заявку" });
    }
  }

  return json(405, { error: "Method not allowed" });
};
