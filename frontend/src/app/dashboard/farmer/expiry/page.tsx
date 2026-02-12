"use client";

import React, { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function FarmerExpiry() {
  const [expiring, setExpiring] = useState<any[]>([]);

  useEffect(() => {
    api
      .getMyCrops()
      .then((data) => {
        if (!Array.isArray(data)) return;
        const now = new Date();
        const upcoming = data
          .filter((crop) => crop.expiryDate && (crop.status === "APPROVED" || crop.status === "PENDING"))
          .map((crop) => {
            const expiry = new Date(crop.expiryDate);
            const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: crop.id || crop._id,
              name: crop.name,
              expires: expiry.toLocaleDateString(),
              diffDays,
            };
          })
          .filter((crop) => crop.diffDays >= 0 && crop.diffDays <= 7)
          .sort((a, b) => a.diffDays - b.diffDays)
          .map((crop) => ({
            ...crop,
            action: crop.diffDays <= 2 ? "Priority buyer outreach" : "Discount suggested",
          }));
        setExpiring(upcoming);
      })
      .catch(() => {
        // leave empty
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Expiry Radar</p>
        <h2 className="text-xl font-semibold mt-2">Listings Approaching Expiry</h2>
        <p className="text-sm text-slate-400 mt-2">Admin monitors expiry to reduce waste and prevent sales after deadline.</p>
      </div>

      <div className="space-y-3">
        {expiring.length === 0 && (
          <div className="hud-card text-sm text-slate-400">No listings expiring in the next 7 days.</div>
        )}
        {expiring.map((item) => (
          <div key={item.id} className="hud-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">{item.id} · Expires {item.expires}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label="Expiring" tone="pending" />
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{item.action}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
