import React from "react";

export default function BuyerCompliance() {
  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Compliance Center</p>
        <h2 className="text-xl font-semibold mt-2">Admin-approved Procurement</h2>
        <p className="text-sm text-slate-400 mt-2">Ensure every purchase aligns with marketplace policies.</p>
      </div>

      <div className="hud-card text-sm text-slate-400">
        No compliance alerts yet. Updates will appear after admin reviews and procurement checks.
      </div>
    </div>
  );
}
