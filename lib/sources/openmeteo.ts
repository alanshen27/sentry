import type { WeatherSignal, SourceStatus } from "@/lib/types";
import { getCache } from "@/lib/cache";
import { loadDemo } from "./demo";

const URL = (lat: number, lng: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation&hourly=temperature_2m,precipitation,wind_speed_10m&forecast_hours=24`;

export async function getWeather(lat: number, lng: number): Promise<{ signal: WeatherSignal; status: SourceStatus }> {
  const cache = getCache();
  const key = `weather:${lat.toFixed(2)},${lng.toFixed(2)}`;
  try {
    const cached = await cache.get<WeatherSignal>(key);
    if (cached) return { signal: cached, status: mkStatus("connected") };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(URL(lat, lng), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const j = await res.json();
    const signal: WeatherSignal = {
      lat, lng,
      temperatureC: j.current?.temperature_2m ?? 0,
      humidity: j.current?.relative_humidity_2m ?? 0,
      windSpeedKmh: j.current?.wind_speed_10m ?? 0,
      windDirection: j.current?.wind_direction_10m ?? 0,
      precipitationMm: j.current?.precipitation ?? 0,
      forecastHours: (j.hourly?.time ?? []).slice(0, 24).map((time: string, i: number) => ({
        time, tempC: j.hourly.temperature_2m[i], precipMm: j.hourly.precipitation[i], windKmh: j.hourly.wind_speed_10m[i],
      })),
      updatedAt: new Date().toISOString(),
    };
    await cache.set(key, signal, 600);
    return { signal, status: mkStatus("connected") };
  } catch (e: any) {
    const demo = await loadDemo<WeatherSignal>("weather_somalia_sample.json");
    return { signal: { ...demo, lat, lng }, status: { ...mkStatus("cached_fallback"), detail: e.message } };
  }
}

function mkStatus(state: SourceStatus["state"] = "connected"): SourceStatus {
  return { id: "openmeteo", name: "Open-Meteo", state, lastUpdated: new Date().toISOString() };
}
