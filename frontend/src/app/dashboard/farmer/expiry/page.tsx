"use client";

import React, { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

function toneForRisk(risk: string) {
  if (risk === "HIGH") return "critical";
  if (risk === "MEDIUM") return "pending";
  return "active";
}

export default function FarmerExpiry() {
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    api
      .getFarmerWasteInsights()
      .then((data) => setInsights(data))
      .catch(() => {
        // leave empty
      });
  }, []);

  const alerts = Array.isArray(insights?.alerts) ? insights.alerts : [];
  const categories = Array.isArray(insights?.categories) ? insights.categories : [];
  const alertSummary = insights?.alertSummary || {};
  const wasteRisk = String(insights?.wasteRisk || "LOW");

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Expiry Radar</p>
        <h2 className="text-xl font-semibold mt-2">Freshness, Forecast, and Waste Control</h2>
        <p className="text-sm text-slate-400 mt-2">
          Alerts are generated from remaining shelf-life and demand forecast gaps.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hud-card">
          <p className="hud-label">Freshness Summary</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Active</p>
              <p className="text-lg font-semibold">{insights?.freshness?.ACTIVE ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">Near Expiry</p>
              <p className="text-lg font-semibold">{insights?.freshness?.NEAR_EXPIRY ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">Expired</p>
              <p className="text-lg font-semibold">{insights?.freshness?.EXPIRED ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="hud-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="hud-label">Alert Engine</p>
              <p className="text-sm text-slate-400 mt-2">
                Expiry and surplus alerts are ranked from live freshness plus forecast gaps.
              </p>
            </div>
            <StatusBadge label={wasteRisk} tone={toneForRisk(wasteRisk)} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Total Alerts</p>
              <p className="text-lg font-semibold">{alertSummary.total ?? 0}</p>
            </div>
            <div>
              <p className="text-slate-400">Expiry Alerts</p>
              <p className="text-lg font-semibold">{alertSummary.expiry ?? 0}</p>
            </div>
            <div>
              <p className="text-slate-400">Surplus Alerts</p>
              <p className="text-lg font-semibold">{alertSummary.surplus ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="hud-card">
        <p className="hud-label">Production vs Demand</p>
        <div className="mt-3 space-y-3 text-sm">
          {categories.length === 0 && <p className="text-slate-400">No category forecast yet.</p>}
          {categories.slice(0, 6).map((item: any) => (
            <div
              key={item.category}
              className="flex flex-wrap items-center justify-between gap-3 border border-slate-700/60 rounded-sm px-4 py-3"
            >
              <div>
                <p className="font-semibold">{item.category}</p>
                <p className="font-mono text-xs text-slate-400">
                  Listed {item.listedBaseQty} vs Forecast {item.forecast?.predictedBaseDemand} over{" "}
                  {insights?.forecastWindowDays ?? 14} days
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={item.risk} tone={toneForRisk(item.risk)} />
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                  Surplus {item.surplusBaseQty}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <div className="hud-card text-sm text-slate-400">No listings in alert window.</div>
        )}
        {alerts.map((item: any) => (
          <div
            key={`${item.alertType}-${item.cropId || item.category}-${item.hoursRemaining ?? "na"}`}
            className="hud-card flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold">{item.cropName || item.category}</p>
              <p className="text-xs text-slate-400">{item.message}</p>
              <p className="text-xs text-slate-500 mt-1">{item.recommendation}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge
                label={item.alertType}
                tone={item.alertType === "SURPLUS" ? "info" : "pending"}
              />
              <StatusBadge
                label={item.freshnessStatus || item.severity}
                tone={
                  item.freshnessStatus
                    ? toneForRisk(
                        item.freshnessStatus === "EXPIRED"
                          ? "HIGH"
                          : item.freshnessStatus === "NEAR_EXPIRY"
                            ? "MEDIUM"
                            : "LOW"
                      )
                    : toneForRisk(item.severity || "LOW")
                }
              />
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                {item.alertType === "SURPLUS"
                  ? `surplus ${item.surplusBaseQty ?? 0}`
                  : `${item.hoursRemaining ?? 0}h left`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
