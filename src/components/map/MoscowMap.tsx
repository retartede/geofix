"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { getProblemMeta } from "@/lib/problems";
import type { MapFocus, RoadReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP_CENTER: L.LatLngExpression = [55.7558, 37.6173];
/** Карта ограничена Россией (+ небольшой запас) */
const RUSSIA_MAX_BOUNDS = L.latLngBounds(
  L.latLng(40.5, 18.5),
  L.latLng(82.5, 180),
);

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 4px ${color}40,0 2px 8px rgba(0,0,0,.45)"></span>`,
  });
}

function pickIcon() {
  return L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    html: `<span style="display:block;width:28px;height:28px;border-radius:9999px 9999px 9999px 4px;transform:rotate(-45deg);background:linear-gradient(145deg,#c4b5fd,#7c3aed);border:2px solid #ede9fe;box-shadow:0 4px 14px rgba(109,40,217,.55)"></span>`,
  });
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

interface Props {
  reports: RoadReport[];
  focus: MapFocus | null;
  userLocation: { lat: number; lng: number } | null;
  draftLocation?: { lat: number; lng: number } | null;
  /** Режим заявки: метка перетаскивается, клик по карте двигает точку */
  composeMode?: boolean;
  onSelectReport: (r: RoadReport) => void;
  onDraftMove?: (loc: { lat: number; lng: number }) => void;
}

export function MoscowMap({
  reports,
  focus,
  userLocation,
  draftLocation,
  composeMode = false,
  onSelectReport,
  onDraftMove,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userRef = useRef<L.CircleMarker | null>(null);
  const draftRef = useRef<L.Marker | null>(null);
  const selectRef = useRef(onSelectReport);
  const draftMoveRef = useRef(onDraftMove);
  const composeRef = useRef(composeMode);
  const [ready, setReady] = useState(false);
  selectRef.current = onSelectReport;
  draftMoveRef.current = onDraftMove;
  composeRef.current = composeMode;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const map = L.map(elRef.current, {
      center: MAP_CENTER,
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      maxBounds: RUSSIA_MAX_BOUNDS,
      maxBoundsViscosity: 0.85,
      minZoom: 3,
    });

    L.tileLayer(
      "https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}&ts=online_hd",
      {
        subdomains: "0123",
        maxZoom: 18,
        attribution: "© 2ГИС",
        className: "doroga-tiles",
      },
    ).addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      iconCreateFunction(c) {
        const n = c.getChildCount();
        const dim = n < 5 ? 36 : n < 15 ? 46 : 56;
        return L.divIcon({
          html: `<div class="cluster-bubble" style="width:${dim}px;height:${dim}px">${n}</div>`,
          className: "doroga-cluster",
          iconSize: L.point(dim, dim),
        });
      },
    });
    map.addLayer(cluster);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!composeRef.current) return;
      draftMoveRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    clusterRef.current = cluster;
    setReady(true);

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getContainer().style.cursor = composeMode ? "crosshair" : "";
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [composeMode, ready]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!ready || !cluster) return;
    cluster.clearLayers();
    for (const r of reports) {
      const meta = getProblemMeta(r.type);
      const m = L.marker([r.lat, r.lng], { icon: dotIcon(meta.color) });
      m.bindPopup(
        `<div style="min-width:150px"><div style="font-size:12px;font-weight:600;color:${meta.color};margin-bottom:4px">${meta.label}</div><div style="font-size:14px;color:#f5f3ff">${esc(r.description)}</div><div style="font-size:11px;color:#a78bfa;margin-top:4px">${esc(r.address)}</div></div>`,
      );
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (composeRef.current) return;
        selectRef.current(r);
      });
      cluster.addLayer(m);
    }
  }, [reports, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 15, { duration: 0.7 });
  }, [focus, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (userRef.current) {
      map.removeLayer(userRef.current);
      userRef.current = null;
    }
    if (!userLocation) return;
    userRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 9,
      color: "#ddd6fe",
      fillColor: "#8b5cf6",
      fillOpacity: 0.95,
      weight: 2,
    }).addTo(map);
  }, [userLocation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (!draftLocation) {
      if (draftRef.current) {
        map.removeLayer(draftRef.current);
        draftRef.current = null;
      }
      return;
    }

    const latlng: L.LatLngExpression = [draftLocation.lat, draftLocation.lng];

    if (!draftRef.current) {
      const marker = L.marker(latlng, {
        icon: pickIcon(),
        draggable: composeMode,
        zIndexOffset: 1000,
        autoPan: true,
      }).addTo(map);

      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        draftMoveRef.current?.({ lat: ll.lat, lng: ll.lng });
      });

      draftRef.current = marker;
      return;
    }

    const marker = draftRef.current;
    const cur = marker.getLatLng();
    if (
      Math.abs(cur.lat - draftLocation.lat) > 1e-7 ||
      Math.abs(cur.lng - draftLocation.lng) > 1e-7
    ) {
      marker.setLatLng(latlng);
    }
    if (marker.dragging) {
      if (composeMode) marker.dragging.enable();
      else marker.dragging.disable();
    }
  }, [draftLocation, composeMode, ready]);

  return (
    <div
      className={cn("relative h-full w-full", composeMode && "pick-mode-active")}
    >
      {/* className на этом div не меняем после init — иначе Leaflet теряет тайлы */}
      <div
        ref={elRef}
        className="moscow-map h-full w-full"
        role="application"
        aria-label="Карта проблем дорог России"
      />
    </div>
  );
}
