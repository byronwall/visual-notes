import { createEffect, createSignal, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import type { UmapDetailData } from "~/features/umap/detail-types";

type UseUmapCanvasProps = {
  detail: Accessor<UmapDetailData | null | undefined>;
};

export function useUmapCanvas(props: UseUmapCanvasProps) {
  const [canvasWidth, setCanvasWidth] = createSignal(800);
  const [canvasHeight, setCanvasHeight] = createSignal(420);

  let canvasEl: HTMLCanvasElement | undefined;
  let canvasContainerEl: HTMLDivElement | undefined;
  let ro: ResizeObserver | undefined;

  onMount(() => {
    if (!canvasContainerEl || typeof window === "undefined") return;

    ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.max(320, Math.floor(entry.contentRect.width));
        const heightRaw = Math.max(200, Math.floor(entry.contentRect.height || 0));
        const height = heightRaw > 0 ? heightRaw : Math.floor(width / 2);
        setCanvasWidth(width);
        setCanvasHeight(height);
      }
    });

    ro.observe(canvasContainerEl);
    return () => ro?.disconnect();
  });

  createEffect(() => {
    const detail = props.detail();
    const points = detail?.points ?? [];
    const dims = detail?.dims ?? 2;
    const regions = detail?.meta.regions ?? null;
    const width = canvasWidth();
    const height = canvasHeight();

    if (!canvasEl || !width || !height) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvasEl.width = Math.floor(width * dpr);
    canvasEl.height = Math.floor(height * dpr);
    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;
    ctx.reset?.();
    if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("No points to display", 12, 20);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
      if (point.z != null) {
        if (point.z < minZ) minZ = point.z;
        if (point.z > maxZ) maxZ = point.z;
      }
    }

    if (!Number.isFinite(minZ)) {
      minZ = 0;
      maxZ = 1;
    }

    const pad = 12;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const sx = (width - pad * 2) / rangeX;
    const sy = (height - pad * 2) / rangeY;

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    if (regions) {
      ctx.save();
      ctx.font = "600 12px ui-sans-serif, system-ui, -apple-system";
      ctx.textAlign = "center";
      // Islands removed from display per current plan
      for (const region of regions.regions) {
        const px = pad + (region.centroid.x - minX) * sx;
        const py = height - pad - (region.centroid.y - minY) * sy;
        const radius = Math.max(
          8,
          Math.max(region.radius * sx, region.radius * sy)
        );
        ctx.fillStyle = "rgba(37, 99, 235, 0.06)";
        ctx.strokeStyle = "rgba(37, 99, 235, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1e3a8a";
        ctx.fillText(region.title, px, py - radius - 6);
      }
      ctx.restore();
    }

    for (const point of points) {
      const px = pad + (point.x - minX) * sx;
      const py = height - pad - (point.y - minY) * sy;

      let color = "#2563eb";
      if (dims === 3 && point.z != null && Number.isFinite(point.z)) {
        const t = (point.z - minZ) / (maxZ - minZ || 1);
        const light = 40 + Math.floor(t * 40);
        color = `hsl(220 90% ${light}%)`;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return {
    setCanvasEl: (el: HTMLCanvasElement) => {
      canvasEl = el;
    },
    setCanvasContainerEl: (el: HTMLDivElement) => {
      canvasContainerEl = el;
    },
  };
}
