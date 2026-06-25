"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

const ITEMS = [
  "Sentry is decision support, not an official warning system.",
  "Some regions lack ground sensors; satellite-first where needed.",
  "OSM / building footprint data may be incomplete.",
  "Satellite detections can be delayed or obscured by clouds.",
  "Earthquakes are monitored after detection — never predicted.",
  "Field verification is recommended for emergency decisions.",
];

export function LimitationsCard() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-1.5 text-xs"><TriangleAlert className="h-3.5 w-3.5 text-amber-400" />Limitations</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {ITEMS.map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-amber-500/60">•</span><span>{t}</span></li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
