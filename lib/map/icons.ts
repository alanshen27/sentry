import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";
import {
  Flame, Activity, Droplets, Sun, Tornado, Mountain, ThermometerSun, CloudFog,
  TriangleAlert, Waves, CloudLightning,
  Home, Building2, School, Cross, Stethoscope, Tent, Store, Factory, ShoppingBag,
  Church, Landmark, Eye, MapPin,
} from "lucide-react";
import { HAZARD_COLORS, type HazardType } from "@/lib/types";

/**
 * Phenomenon iconography. Colour alone is hard to read on a basemap, so each
 * hazard / marker category also carries a distinct line icon. Icons are shared
 * across the map (rendered to canvas images), popups and the sidebar legend so
 * everything stays visually consistent.
 */
export const HAZARD_ICON: Record<HazardType, LucideIcon> = {
  wildfire: Flame,
  earthquake: Activity,
  flood: Droplets,
  drought: Sun,
  cyclone: Tornado,
  landslide: Mountain,
  heat: ThermometerSun,
  air_quality: CloudFog,
  volcano: TriangleAlert,
  tsunami: Waves,
  severe_weather: CloudLightning,
};

export const MARKER_CATEGORY_ICON: Record<string, LucideIcon> = {
  house: Home,
  residential: Home,
  apartments: Building2,
  school: School,
  hospital: Cross,
  clinic: Stethoscope,
  shelter: Tent,
  commercial: Store,
  industrial: Factory,
  retail: ShoppingBag,
  church: Church,
  mosque: Landmark,
  observation: Eye,
  fire: Flame,
  flood: Droplets,
  custom: MapPin,
};

export function hazardIcon(type: string): LucideIcon {
  return HAZARD_ICON[type as HazardType] ?? TriangleAlert;
}

export function markerCategoryIcon(category: string): LucideIcon {
  return MARKER_CATEGORY_ICON[category] ?? MapPin;
}

/** Static SVG markup for a lucide icon — usable inside map popups / innerHTML. */
export function lucideMarkup(Icon: LucideIcon, opts?: { color?: string; size?: number; strokeWidth?: number }): string {
  return renderToStaticMarkup(
    createElement(Icon, { color: opts?.color ?? "currentColor", size: opts?.size ?? 16, strokeWidth: opts?.strokeWidth ?? 2 }),
  );
}

export function hazardIconSvg(type: string, color = "#e2e8f0", size = 15): string {
  return lucideMarkup(hazardIcon(type), { color, size, strokeWidth: 2.25 });
}

export function markerCategoryIconSvg(category: string, color = "#e2e8f0", size = 15): string {
  return lucideMarkup(markerCategoryIcon(category), { color, size, strokeWidth: 2.25 });
}

// ---- Map canvas images -----------------------------------------------------

type MapLike = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: ImageData, opts?: { pixelRatio?: number }) => void;
};

function svgDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = svgDataUrl(svg);
  });
}

const DISC = "#0b1220"; // dark pin disc — reads well on both light and dark basemaps

/** Self-contained pin: dark disc, coloured ring, white line icon. For hazard events. */
async function hazardBadge(Icon: LucideIcon, ring: string, ratio: number): Promise<ImageData> {
  const size = 40;
  const px = Math.round(size * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);
  const r = size / 2;
  const radius = r - 5;

  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(r, r, radius, 0, Math.PI * 2);
  ctx.fillStyle = DISC;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(r, r, radius, 0, Math.PI * 2);
  ctx.stroke();

  const iconSize = 20;
  const iconImg = await loadSvg(lucideMarkup(Icon, { color: "#ffffff", size: iconSize, strokeWidth: 2.25 }));
  ctx.drawImage(iconImg, (size - iconSize) / 2, (size - iconSize) / 2, iconSize, iconSize);

  return ctx.getImageData(0, 0, px, px);
}

/** Bare white line icon (transparent) — sits on the state-coloured circle for markers. */
async function markerGlyph(Icon: LucideIcon, ratio: number): Promise<ImageData> {
  const size = 22;
  const px = Math.round(size * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);

  const iconSize = 15;
  const iconImg = await loadSvg(lucideMarkup(Icon, { color: "#ffffff", size: iconSize, strokeWidth: 2.75 }));
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 2;
  ctx.drawImage(iconImg, (size - iconSize) / 2, (size - iconSize) / 2, iconSize, iconSize);

  return ctx.getImageData(0, 0, px, px);
}

/** Registers hazard (`haz-*`) and category (`cat-*`) images on a MapLibre map. */
export async function registerMapIcons(map: MapLike): Promise<void> {
  const ratio = Math.min(2, Math.max(1, Math.round((typeof window !== "undefined" && window.devicePixelRatio) || 1)));
  const add = (id: string, img: ImageData) => { if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: ratio }); };
  const tasks: Promise<void>[] = [];

  for (const [type, Icon] of Object.entries(HAZARD_ICON)) {
    tasks.push(hazardBadge(Icon, HAZARD_COLORS[type as HazardType], ratio).then((img) => add(`haz-${type}`, img)));
  }
  tasks.push(hazardBadge(TriangleAlert, "#f97316", ratio).then((img) => add("haz-unknown", img)));

  for (const [cat, Icon] of Object.entries(MARKER_CATEGORY_ICON)) {
    tasks.push(markerGlyph(Icon, ratio).then((img) => add(`cat-${cat}`, img)));
  }
  tasks.push(markerGlyph(MapPin, ratio).then((img) => add("cat-unknown", img)));

  await Promise.all(tasks);
}
