"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Leaf, WarningCircle, ChartLineUp, Wallet, TrendUp } from "@phosphor-icons/react";
import { api } from "@/lib/api";

function toneForRisk(risk: string) {
  if (risk === "HIGH") return "critical";
  if (risk === "MEDIUM") return "pending";
  return "active";
}

export default function FarmerDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);

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
          setRecent(data.slice(0, 5));
        }
      })
      .catch(() => {
        // leave empty
      });

    api
      .getFarmerWasteInsights()
      .then((data) => setInsights(data))
      .catch(() => {
        // leave empty
      });
  }, []);

  const alertTone = useMemo(() => {
    const risk = insights?.wasteRisk || stats?.wasteRisk || "LOW";
    return toneForRisk(risk);
  }, [insights?.wasteRisk, stats?.wasteRisk]);

  const alerts = Array.isArray(insights?.alerts) ? insights.alerts.slice(0, 6) : [];
  const alertSummary = insights?.alertSummary || {};
  const recommendations = Array.isArray(insights?.recommendations)
    ? insights.recommendations.slice(0, 6)
    : [];
  const recommendationEngine = String(insights?.recommendationEngine || "RULE_BASED");

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <DataCard
          title="Active Listings"
          value={stats ? stats.listings?.active : "—"}
          icon={Leaf}
          meta={`${stats ? stats.listings?.pending ?? 0 : "—"} pending approval`}
        />
        <DataCard
          title="Revenue (ETH)"
          value={stats ? Number(stats.revenueEth || 0).toFixed(3) : "—"}
          icon={ChartLineUp}
          meta="Confirmed sales"
        />
        <DataCard
          title="DVU Balance"
          value={stats ? Number(stats.dvuBalance || 0).toLocaleString() : "—"}
          icon={Wallet}
          meta="Ledger-based value units"
        />
        <DataCard
          title="Near Expiry"
          value={stats ? Number(stats.nearExpiryCount || 0) : "—"}
          icon={WarningCircle}
          meta={`${alertSummary.surplus ?? 0} surplus alerts`}
        />
        <DataCard
          title="Waste Risk"
          value={insights?.wasteRisk || stats?.wasteRisk || "LOW"}
          icon={TrendUp}
          meta={`${alertSummary.total ?? 0} active predictive alerts`}
        />
        <DataCard
          title="Reliability"
          value={
            stats?.trust?.reliabilityScore !== undefined
              ? `${Number(stats.trust.reliabilityScore).toFixed(1)}%`
              : "—"
          }
          icon={ChartLineUp}
          meta={`Ratings: ${stats?.trust?.totalRatings ?? "—"}`}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="hud-label">Predictive Alert Engine</p>
              <h2 className="text-lg font-semibold mt-1">Expiry + Surplus Signals</h2>
            </div>
            <StatusBadge label={insights?.wasteRisk || "LOW"} tone={alertTone} />
          </div>
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="text-sm text-slate-400">No active waste alerts.</div>
            )}
            {alerts.map((alert: any) => (
              <div
                key={`${alert.alertType}-${alert.cropId || alert.category}-${alert.hoursRemaining ?? "na"}`}
                className="flex flex-wrap items-center justify-between gap-3 border border-slate-700/60 rounded-sm px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{alert.cropName || alert.category}</p>
                  <p className="text-xs text-slate-400">{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{alert.recommendation}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={alert.alertType}
                    tone={alert.alertType === "SURPLUS" ? "info" : "pending"}
                  />
                  <StatusBadge
                    label={alert.freshnessStatus || alert.severity}
                    tone={
                      alert.freshnessStatus
                        ? toneForRisk(
                            alert.freshnessStatus === "EXPIRED"
                              ? "HIGH"
                              : alert.freshnessStatus === "NEAR_EXPIRY"
                                ? "MEDIUM"
                                : "LOW"
                          )
                        : toneForRisk(alert.severity || "LOW")
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hud-card">
            <p className="hud-label">Mitigation Suggestions</p>
            <p className="text-xs text-slate-500 mt-1">Engine: {recommendationEngine}</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              {recommendations.length === 0 && <p className="text-slate-400">No recommendations yet.</p>}
              {recommendations.map((rec: string, idx: number) => (
                <p key={`${idx}-${rec}`}>{rec}</p>
              ))}
            </div>
          </div>
          <div className="hud-card">
            <p className="hud-label">Recent Listings</p>
            <div className="mt-3 space-y-2">
              {recent.length === 0 && <p className="text-sm text-slate-400">No recent listings.</p>}
              {recent.map((crop: any) => (
                <div key={crop._id} className="flex items-center justify-between text-sm">
                  <span>{crop.name}</span>
                  <StatusBadge
                    label={crop.status}
                    tone={
                      crop.status === "APPROVED"
                        ? "active"
                        : crop.status === "PENDING"
                          ? "pending"
                          : crop.status === "EXPIRED"
                            ? "critical"
                            : "info"
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
