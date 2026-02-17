"use client";

import React, { useEffect, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Leaf, WarningCircle, ChartLineUp, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";

export default function FarmerDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    api
      .getFarmerStats()
      .then((data) => setStats(data))
      .catch(() => {
        // fallback
      });

    api
      .getMyCrops()
      .then((data) => {
        if (Array.isArray(data)) {
          setRecent(data.slice(0, 3));
        }
      })
      .catch(() => {
        // leave empty
      });
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DataCard
          title="Active Listings"
          value={stats ? stats.listings?.active : "—"}
          icon={Leaf}
          meta={`${stats ? stats.listings?.pending ?? 0 : "—"} pending approval`}
        />
        <DataCard
          title="Total Revenue"
          value={stats ? `${Number(stats.revenueEth || 0).toFixed(2)} ETH` : "—"}
          icon={ChartLineUp}
          meta="Lifetime"
        />
        <DataCard
          title="Expiry Alerts"
          value={stats ? stats.listings?.expired : "—"}
          icon={WarningCircle}
          meta="Review within 48h"
        />
        <DataCard title="Admin Score" value="Verified" icon={ShieldCheck} meta="Last audit: 1 day ago" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="hud-label">Latest Listings</p>
              <h2 className="text-lg font-semibold mt-1">Recent Crop Submissions</h2>
            </div>
            <StatusBadge label="SYNCED" tone="active" />
          </div>
          <div className="space-y-3">
            {recent.length === 0 && (
              <div className="text-sm text-slate-400">No recent listings.</div>
            )}
            {recent.map((crop: any) => (
              <div key={crop.id || crop._id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-700/60 rounded-sm px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{crop.name}</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">{crop.id || crop._id} · {crop.category}</p>
                </div>
                <StatusBadge
                  label={crop.status}
                  tone={
                    crop.status === "APPROVED" || crop.status === "Active"
                      ? "active"
                      : crop.status === "PENDING" || crop.status === "Pending"
                        ? "pending"
                        : "info"
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hud-card">
            <p className="hud-label">Next Actions</p>
            <div className="mt-4 text-sm text-slate-400">
              No pending actions. Updates will appear after admin reviews or expiry alerts.
            </div>
          </div>
          <div className="hud-card">
            <p className="hud-label">Wallet Balance</p>
            <p className="text-2xl font-bold font-mono mt-2">—</p>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em] mt-2">Connect MetaMask to view balance</p>
          </div>
        </div>
      </section>
    </div>
  );
}
