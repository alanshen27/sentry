/** Named layer colors — no hex input required. */
export const LAYER_COLOR_OPTIONS = [
  { id: "sky", label: "Sky", value: "#38bdf8" },
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "purple", label: "Purple", value: "#a78bfa" },
  { id: "yellow", label: "Yellow", value: "#eab308" },
  { id: "cyan", label: "Cyan", value: "#06b6d4" },
  { id: "pink", label: "Pink", value: "#fb7185" },
  { id: "indigo", label: "Indigo", value: "#818cf8" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "slate", label: "Slate", value: "#64748b" },
] as const;

export function layerColorLabel(hex: string): string {
  return LAYER_COLOR_OPTIONS.find((c) => c.value === hex)?.label ?? "Custom";
}

export function autoLayerColor(seed: string, index = 0): string {
  let h = index;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return LAYER_COLOR_OPTIONS[Math.abs(h) % LAYER_COLOR_OPTIONS.length].value;
}
