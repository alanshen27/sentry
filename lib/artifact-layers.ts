export interface ProjectLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

/** Whether an artifact should appear on map / in filtered sidebar lists. */
export function artifactMatchesLayerFilter(
  layerId: string | null | undefined,
  activeLayerId: string | null,
  projectLayers: ProjectLayer[],
): boolean {
  // Hard visibility (the eye toggle): a hidden layer never shows its artifacts,
  // even when that layer is the active/isolated tab.
  if (layerId) {
    const layer = projectLayers.find((l) => l.id === layerId);
    if (layer && !layer.visible) return false;
  }
  // Focus filter: a selected tab isolates to just that layer.
  if (activeLayerId) return (layerId ?? null) === activeLayerId;
  return true;
}

export function layerName(layerId: string | null | undefined, projectLayers: ProjectLayer[]): string {
  if (!layerId) return "Unassigned";
  return projectLayers.find((l) => l.id === layerId)?.name ?? "Unknown layer";
}

export function groupByLayer<T extends { layerId?: string | null }>(
  items: T[],
  projectLayers: ProjectLayer[],
): { layerId: string | null; label: string; color: string; items: T[] }[] {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.layerId ?? null;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const ordered: { layerId: string | null; label: string; color: string; items: T[] }[] = [];
  for (const layer of projectLayers) {
    const layerItems = groups.get(layer.id);
    if (layerItems?.length) {
      ordered.push({ layerId: layer.id, label: layer.name, color: layer.color, items: layerItems });
      groups.delete(layer.id);
    }
  }
  const unassigned = groups.get(null);
  if (unassigned?.length) {
    ordered.push({ layerId: null, label: "Unassigned", color: "#64748b", items: unassigned });
  }
  for (const [layerId, layerItems] of groups) {
    if (layerId && layerItems.length) {
      ordered.push({ layerId, label: layerName(layerId, projectLayers), color: "#64748b", items: layerItems });
    }
  }
  return ordered;
}
