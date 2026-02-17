"use client";

import React from "react";
import { WarningCircle, ShieldCheck } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminEmergency() {
  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Emergency Controls</p>
        <h2 className="text-xl font-semibold mt-2">Pause & Blacklist</h2>
        <p className="text-sm text-slate-400 mt-2">
          Freeze marketplace activity during suspicious behavior or compliance violations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center gap-3">
            <WarningCircle size={20} className="text-amber-300" weight="duotone" />
            <div>
              <p className="text-sm font-semibold">Contract Status</p>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Ganache main contract</p>
            </div>
          </div>
          <StatusBadge label="Unpaused" tone="active" />
          <button className="w-full border border-yellow-600 text-amber-200 rounded-sm py-3 text-xs font-mono uppercase tracking-[0.2em] hover:bg-yellow-950/50">
            Pause Contract
          </button>
        </div>
        <div className="hud-card space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-rose-300" weight="duotone" />
            <div>
              <p className="text-sm font-semibold">Blacklist Wallet</p>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Restrict suspicious activity</p>
            </div>
          </div>
          <input
            className="w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="0x0000..."
          />
          <button className="w-full border border-red-600 text-rose-200 rounded-sm py-3 text-xs font-mono uppercase tracking-[0.2em] hover:bg-red-950/50">
            Add to Blacklist
          </button>
        </div>
      </div>
    </div>
  );
}
