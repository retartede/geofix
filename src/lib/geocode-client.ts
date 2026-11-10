/** Клиентский геокодер (Photon) — работает на статическом хостинге без API routes */

import { isInRussiaBounds } from "./spam";

export type GeoHit = { label: string; lat: number; lng: number };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

function labelFrom(p: PhotonFeature["properties"]): string {
  if (!p) return "";
  return (
    [p.name, p.street && [p.street, p.housenumber].filter(Boolean).join(" "), p.district, p.city || p.state]
      .filter(Boolean)
      .join(", ") || p.country || ""
  );
}

export async function searchRussiaAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeoHit[]> {
  const q = /росси/i.test(query) ? query : `${query}, Россия`;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "ru");
  // Центр России — смещение релевантности поиска
  url.searchParams.set("lat", "61.5");
  url.searchParams.set("lon", "99.0");
  // bbox: запад–юг–восток–север (без Чукотки за 180°, её отфильтруем отдельно)
  url.searchParams.set("bbox", "19.0,41.0,180.0,82.0");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };

  return (data.features ?? [])
    .map((f) => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [lng, lat] = coords;
      if (!isInRussiaBounds(lat, lng)) return null;
      const cc = f.properties?.countrycode?.toLowerCase();
      if (cc && cc !== "ru") return null;
      const label = labelFrom(f.properties) || `${lat}, ${lng}`;
      return { label, lat, lng };
    })
    .filter(Boolean) as GeoHit[];
}

/** @deprecated используйте searchRussiaAddress */
export const searchMoscowAddress = searchRussiaAddress;

export async function reverseRussiaAddress(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const url = new URL("https://photon.komoot.io/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("lang", "ru");
    const res = await fetch(url.toString());
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const label = labelFrom(data.features?.[0]?.properties);
    return label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

/** @deprecated используйте reverseRussiaAddress */
export const reverseMoscowAddress = reverseRussiaAddress;
