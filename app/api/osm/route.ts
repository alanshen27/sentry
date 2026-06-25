import { NextResponse } from "next/server";
import { getOsm } from "@/lib/sources";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bboxParam = searchParams.get("bbox");
  if (!bboxParam) return NextResponse.json({ error: "bbox required (minLng,minLat,maxLng,maxLat)" }, { status: 400 });
  const bbox = bboxParam.split(",").map(Number);
  const { data, status } = await getOsm(bbox);
  return NextResponse.json({ data, status, updatedAt: new Date().toISOString() });
}
