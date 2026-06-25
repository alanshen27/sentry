"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "default" | "success" | "warning" | "destructive";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastCtx {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return { toast: () => {}, dismiss: () => {} };
  }
  return ctx;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-sky-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  destructive: <AlertTriangle className="h-4 w-4 text-red-400" />,
};

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  );
}

function ToastViewport() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-card p-3 shadow-lg animate-fade-in",
            t.variant === "destructive" && "border-red-500/40"
          )}
        >
          {ICONS[t.variant ?? "default"]}
          <div className="flex-1 min-w-0">
            {t.title && <div className="text-sm font-medium">{t.title}</div>}
            {t.description && (
              <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
            )}
          </div>
          <button
            onClick={() => ctx.dismiss(t.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
