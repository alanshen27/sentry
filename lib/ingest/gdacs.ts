import type { HazardEvent, HazardType } from "@/lib/types";

// Parse GDACS public RSS into normalized HazardEvents.
// GDACS event types: EQ=earthquake, TC=cyclone, FL=flood, DR=drought, VO=volcano, WF=wildfire, SS=severe_weather
const TYPE_MAP: Record<string, HazardType> = {
  EQ: "earthquake", TC: "cyclone", FL: "flood", DR: "drought", VO: "volcano", WF: "wildfire", SS: "severe_weather", FI: "wildfire",
};
const ALERT_SEVERITY: Record<string, number> = { Green: 35, Orange: 65, Red: 88 };

export async function fetchGdacsLive(): Promise<HazardEvent[]> {
  const res = await fetch("https://www.gdacs.org/xml/rss.xml", { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`GDACS ${res.status}`);
  const xml = await res.text();
  return parseGdacs(xml);
}

function parseGdacs(xml: string): HazardEvent[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const out: HazardEvent[] = [];
  for (const item of items) {
    const end = item.indexOf("</item>");
    const block = end >= 0 ? item.slice(0, end) : item;
    const title = grab(block, "title");
    const link = grab(block, "link");
    const pubDate = grab(block, "pubDate");
    const point = grab(block, "georss:point") || grab(block, "geo:Point", "geo:lat", "geo:long");
    const eventType = grab(block, "gdacs:eventtype") || guessTypeFromTitle(title ?? "");
    const alertLevel = grab(block, "gdacs:alertlevel") || "Green";

    let lat: number | null = null, lng: number | null = null;
    if (point && point.includes(" ")) {
      const [la, ln] = point.trim().split(/\s+/).map(Number);
      lat = la; lng = ln;
    }
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const type = TYPE_MAP[eventType?.toUpperCase()] ?? "severe_weather";
    const sourceId = link || `${type}-${lat}-${lng}-${pubDate}`;
    out.push({
      id: sourceId,
      type,
      source: "GDACS",
      geometry: { type: "Point", coordinates: [lng, lat] },
      severity: ALERT_SEVERITY[alertLevel] ?? 40,
      confidence: 0.8,
      observedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      properties: { title, alertLevel, url: link, eventType },
    });
  }
  return out;
}

function grab(block: string, ...tags: string[]): string | null {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = block.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function guessTypeFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("earthquake") || t.includes("quake")) return "EQ";
  if (t.includes("cyclone") || t.includes("storm") || t.includes("typhoon") || t.includes("hurricane")) return "TC";
  if (t.includes("flood")) return "FL";
  if (t.includes("drought")) return "DR";
  if (t.includes("volcano")) return "VO";
  if (t.includes("fire") || t.includes("wildfire")) return "WF";
  return "SS";
}
