import React from "react";

interface StatusBadgeProps {
  label: string;
  tone?: "active" | "pending" | "critical" | "info";
}

export function StatusBadge({ label, tone = "info" }: StatusBadgeProps) {
  const toneClass =
    tone === "active"
      ? "status-active"
      : tone === "pending"
        ? "status-pending"
        : tone === "critical"
          ? "status-critical"
          : "text-sky-300 bg-sky-950/50 border-sky-800/60";

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs uppercase tracking-[0.2em] font-mono ${toneClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
