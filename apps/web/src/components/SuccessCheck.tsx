"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function SuccessCheck({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => { setVisible(false); onDone?.(); }, 1500);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);

  if (!visible) return null;

  return (
    <span className="trell-check-animate inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
      <Icon name="checkCircle" size={16} />
      Saved
    </span>
  );
}
