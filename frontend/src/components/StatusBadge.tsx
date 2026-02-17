import React from "react";

interface StatusBadgeProps {
  label: string;
  tone?: "active" | "pending" | "critical" | "info";
  className?: string;
}

export function StatusBadge({ label, tone = "info", className = "" }: StatusBadgeProps) {
  const text = String(label ?? "").replace(/_/g, " ");
  const toneClass =
    tone === "active"
      ? "status-active"
      : tone === "pending"
        ? "status-pending"
        : tone === "critical"
          ? "status-failed"
          : "text-blue-400 bg-blue-950/50 border-blue-800";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${toneClass} ${className}`}
    >
      {text}
    </span>
  );
}
