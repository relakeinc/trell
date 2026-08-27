"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDone?: () => void;
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "checkCircle", iconColor: "text-emerald-500" },
  error: { bg: "bg-red-50", border: "border-red-200", icon: "close", iconColor: "text-red-500" },
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "info", iconColor: "text-blue-500" },
};

export function Toast({ message, type = "success", duration = 3000, onDone }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const s = TOAST_STYLES[type];

  useEffect(() => {
    const start = Date.now();
    let raf: number;
    function tick() {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) raf = requestAnimationFrame(tick);
      else onDone?.();
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onDone]);

  return (
    <div className={`trell-check-animate flex items-center gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3 shadow-lg`}>
      <Icon name={s.icon} size={18} className={s.iconColor} />
      <span className="text-sm font-medium text-trell-ink">{message}</span>
      <div className="absolute bottom-0 left-0 h-0.5 rounded-b-xl bg-current opacity-20" style={{ width: `${progress}%` }} />
    </div>
  );
}
