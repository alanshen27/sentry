import { NextResponse } from "next/server";
import { getWeather } from "@/lib/sources";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  const { signal, status } = await getWeather(lat, lng);
  return NextResponse.json({ signal, status });
}
