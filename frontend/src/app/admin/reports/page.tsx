"use client";

import React, { useEffect, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { ChartLineUp, Leaf, WarningCircle, Coins, Star, ArrowCounterClockwise, SealCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";

export default function AdminReports() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = () => {
      api
        .getAdminStats()
        .then((data) => setStats(data))
        .catch(() => {
          // fallback
        });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const categories = stats?.reports?.categories || {};
  const categoryEntries = Object.entries(categories).map(([name, count]) => ({
    name,
    count: Number(count),
  }));
  const categoryTotal = categoryEntries.reduce((sum, item) => sum + item.count, 0);
  const trust = stats?.trust || {};
  const wasteReduction = stats
    ? Math.round((Number(stats.crops?.sold || 0) / Math.max(1, Number(stats.crops?.total || 0))) * 100)
    : 21;

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Analytics Hub</p>
        <h2 className="text-xl font-semibold mt-2">Marketplace Insights</h2>
        <p className="text-sm text-slate-400 mt-2">Measure revenue, waste reduction, and listing quality.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <DataCard
          title="Total Volume"
          value={stats ? `${Number(stats.transactions?.totalEth || 0).toFixed(2)} ETH` : "—"}
          icon={Coins}
          meta="Lifetime"
        />
        <DataCard
          title="Revenue (30d)"
          value={stats ? `${Number(stats.reports?.revenue30d || 0).toFixed(2)} ETH` : "—"}
          icon={ChartLineUp}
          meta="Rolling window"
        />
        <DataCard title="Waste Reduction" value={stats ? `${wasteReduction}%` : "—"} icon={Leaf} meta="Sell-through" />
        <DataCard
          title="Expired Listings"
          value={stats ? stats.crops?.expired : "—"}
          icon={WarningCircle}
          meta={stats ? `${stats.crops?.expiringSoon ?? 0} expiring soon` : "Awaiting data"}
        />
        <DataCard
          title="Buyer Rating"
          value={stats ? Number(trust.avgBuyerRating || 0).toFixed(2) : "—"}
          icon={Star}
          meta={`${trust.totalRatings ?? 0} ratings`}
        />
        <DataCard
          title="Return Rate"
          value={stats ? `${Math.round(Number(trust.returnRate || 0) * 100)}%` : "—"}
          icon={ArrowCounterClockwise}
          meta={`${trust.returnRequests ?? 0} requests`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="hud-card">
          <p className="hud-label">Top Categories</p>
          <div className="mt-4 space-y-3">
            {categoryEntries.length === 0 && (
              <p className="text-sm text-slate-400">No category data yet.</p>
            )}
            {categoryEntries.map((item) => {
              const percent = categoryTotal ? Math.round((item.count / categoryTotal) * 100) : 0;
              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{item.name}</span>
                    <span className="text-xs font-mono uppercase tracking-[0.2em]">{percent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-sm bg-slate-800/80">
                    <div
                      className="h-2 rounded-sm bg-blue-500/70"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="hud-card">
          <p className="hud-label">Quality & Trust</p>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Grade A Listings</span>
              <span className="text-xs font-mono uppercase tracking-[0.2em]">
                {trust.gradeAListings ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Grade B Listings</span>
              <span className="text-xs font-mono uppercase tracking-[0.2em]">
                {trust.gradeBListings ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Approved Returns</span>
              <span className="text-xs font-mono uppercase tracking-[0.2em]">
                {trust.approvedReturns ?? 0}
              </span>
            </div>
            <div className="h-2 w-full rounded-sm bg-slate-800/80">
              <div
                className="h-2 rounded-sm bg-emerald-500/70"
                style={{ width: `${Math.round(Number(trust.gradeAMix || 0) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Grade A mix: {Math.round(Number(trust.gradeAMix || 0) * 100)}%
            </p>
            <div className="flex items-center gap-3 rounded-sm border border-slate-700/60 px-3 py-3">
              <SealCheck size={18} className="text-blue-300" />
              <p className="text-xs text-slate-400">
                Ratings, returns, and quality grades now contribute to a visible trust layer for marketplace review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
