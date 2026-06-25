"use client";

import type { RiskScore, RiskLevel } from "@/lib/types";
import { RISK_LEVEL_COLORS, HAZARD_LABELS, confidenceLabel, riskLevelFromScore } from "@/lib/types";
import { Card } from "@/components/ui/card";

export function RiskScoreCard({ score, confidence }: { score: number; confidence: number }) {
  const level = riskLevelFromScore(score);
  const color = RISK_LEVEL_COLORS[level];
  const confLabel = confidenceLabel(confidence);
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Risk</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Level</div>
          <div className="text-sm font-semibold" style={{ color }}>{level}</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Confidence {confLabel} ({Math.round(confidence * 100)}%)
      </div>
    </Card>
  );
}

export function HazardScoreList({ scores }: { scores: RiskScore[] }) {
  if (!scores.length) return <div className="px-1 text-xs text-muted-foreground">No hazard scores yet.</div>;
  return (
    <div className="space-y-1.5">
      {[...scores].sort((a, b) => b.score - a.score).map((s) => <HazardRow key={s.hazard} s={s} />)}
    </div>
  );
}

function HazardRow({ s }: { s: RiskScore }) {
  const level: RiskLevel = s.level;
  const color = RISK_LEVEL_COLORS[level];
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{HAZARD_LABELS[s.hazard]}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums" style={{ color }}>{s.score}</span>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: color + "22", color }}>{s.level}</span>
        </div>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full" style={{ width: `${s.score}%`, background: color }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>conf {Math.round(s.confidence * 100)}%</span>
        <span className="truncate pl-2 text-right">{s.drivers[0] ?? ""}</span>
      </div>
    </div>
  );
}
