import React from "react";

interface DataCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  meta?: string;
  className?: string;
}

export function DataCard({ title, value, icon: Icon, meta, className = "" }: DataCardProps) {
  return (
    <div className={`hud-card ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="hud-label mb-2">{title}</p>
          <p className="text-3xl font-bold font-mono text-slate-100">{value}</p>
          {meta && <p className="mt-2 text-xs text-slate-400 font-mono uppercase tracking-wider">{meta}</p>}
        </div>
        {Icon && (
          <div className="text-sky-300/80">
            <Icon size={28} weight="duotone" />
          </div>
        )}
      </div>
    </div>
  );
}
