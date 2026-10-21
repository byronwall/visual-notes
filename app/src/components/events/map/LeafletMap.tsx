import "leaflet/dist/leaflet.css";
import { useNavigate } from "@solidjs/router";
import type * as Leaflet from "leaflet";
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { css } from "styled-system/css";
import { token } from "styled-system/tokens";
import type { MapPoint } from "./mapPoints";

// Downtown Indianapolis, where the date-night places cluster.
const DEFAULT_CENTER: [number, number] = [39.7684, -86.1581];

const frame = css({
  position: "relative",
  w: "full",
  h: "full",
  minH: "0",
  borderRadius: "l2",
  overflow: "hidden",
  bg: "bg.subtle",
  zIndex: "0",
  "& .leaflet-popup-content": { m: "2.5" },
  "& .vn-pop strong": { display: "block", fontSize: "sm" },
  "& .vn-pop small": { display: "block", color: "fg.muted", fontSize: "xs" },
  "& .vn-pop ul": { mt: "1.5", display: "grid", gap: "1" },
  "& .vn-pop a": { fontSize: "sm", fontWeight: "medium", color: "fg.default" },
});

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// leaflet.css is unlayered, so it beats Panda's layered rules for the same
// properties (container font, link color); those go inline instead.
const linkStyle = `color: ${token.var("colors.fg.default")}; text-decoration: none`;
const frameStyle = {
  "font-family": token.var("fonts.sans"),
  "font-size": token.var("fontSizes.sm"),
};

const popupHtml = (p: MapPoint) => `<div class="vn-pop">
  <strong>${escape(p.name)}</strong>
  ${p.address ? `<small>${escape(p.address)}</small>` : ""}
  ${
    p.links.length
      ? `<ul>${p.links
          .map(
            (l) =>
              `<li><a href="${escape(l.href)}" style="${linkStyle}" data-nav>${escape(l.text)}</a>${
                l.meta ? `<small>${escape(l.meta)}</small>` : ""
              }</li>`,
          )
          .join("")}</ul>`
      : ""
  }
</div>`;

/**
 * OSM map with one circle marker per point. Leaflet touches `window` when it
 * loads, so it is imported and mounted on the client only; the server renders
 * the same-size empty frame so nothing shifts when tiles appear.
 */
export function LeafletMap(props: {
  points: MapPoint[];
  /** Pan to and open this point; `seq` lets the same point refocus. */
  focus: { id: string; seq: number } | null;
  onSelect: (id: string) => void;
}) {
  let el!: HTMLDivElement;
  const navigate = useNavigate();
  let map: Leaflet.Map | undefined;
  let layer: Leaflet.LayerGroup | undefined;
  let L: typeof Leaflet | undefined;
  const markers = new Map<string, Leaflet.CircleMarker>();

  const draw = () => {
    if (!map || !layer || !L) return;
    layer.clearLayers();
    markers.clear();
    for (const p of props.points) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "white",
        weight: 2,
        fillColor: p.ink,
        fillOpacity: 0.95,
      })
        .bindTooltip(p.name, { direction: "top", offset: [0, -6] })
        .bindPopup(popupHtml(p), { maxWidth: 280 })
        .on("click", () => props.onSelect(p.id));
      marker.addTo(layer);
      markers.set(p.id, marker);
    }
    if (props.points.length) {
      map.fitBounds(L.latLngBounds(props.points.map((p) => [p.lat, p.lng])), {
        padding: [32, 32],
        maxZoom: 14,
      });
    }
  };

  onMount(async () => {
    L = await import("leaflet");
    if (!el.isConnected) return;
    map = L.map(el, { scrollWheelZoom: true }).setView(DEFAULT_CENTER, 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    draw();
    console.debug("[events-map] mounted", { points: props.points.length });
  });

  createEffect(on(() => props.points, draw, { defer: true }));

  createEffect(
    on(
      () => props.focus,
      (focus) => {
        const marker = focus ? markers.get(focus.id) : undefined;
        if (!map || !marker) return;
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
        marker.openPopup();
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    map?.remove();
    map = undefined;
  });

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[data-nav]",
    );
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(a.getAttribute("href")!);
  };

  return (
    <div
      ref={el}
      class={frame}
      style={frameStyle}
      data-events-map
      role="region"
      aria-label="Map"
      onClick={onClick}
    />
  );
}
