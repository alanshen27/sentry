"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataSourceStatus } from "@/components/data-source-status";
import { LimitationsCard } from "@/components/limitations-card";
import { Server } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">Live data feed status.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5 text-sm"><Server className="h-4 w-4" />Data Feeds</CardTitle></CardHeader>
          <CardContent><DataSourceStatus hideInfra /></CardContent>
        </Card>

        <LimitationsCard />

        <p className="pb-4 text-center text-[10px] text-muted-foreground">
          Draw any region. Monitor every disaster signal. · Confidence-aware intelligence.
        </p>
      </div>
    </div>
  );
}
