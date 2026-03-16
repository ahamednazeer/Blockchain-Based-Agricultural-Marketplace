"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { Database, ChartLineUp, Timer, MapPin } from "@phosphor-icons/react";

function toneForRisk(risk: string) {
  if (risk === "HIGH") return "critical";
  if (risk === "MEDIUM") return "pending";
  return "active";
}

export default function AdminWasteDataPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getWasteDatasets()
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load waste datasets.");
      });
  }, []);

  const summary = data?.summary || {};
  const alerts = useMemo(() => (Array.isArray(data?.alerts) ? data.alerts : []), [data]);
  const historicalDemand = useMemo(
    () => (Array.isArray(data?.historicalDemand) ? data.historicalDemand : []),
    [data]
  );
  const productListings = useMemo(
    () => (Array.isArray(data?.productListings) ? data.productListings : []),
    [data]
  );
  const expiryFreshness = useMemo(
    () => (Array.isArray(data?.expiryFreshness) ? data.expiryFreshness : []),
    [data]
  );
  const geoLocations = useMemo(
    () => (Array.isArray(data?.geoLocations) ? data.geoLocations : []),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Waste Data Layer</p>
        <h2 className="text-xl font-semibold mt-2">Predictive Waste Datasets and Alert Feeds</h2>
        <p className="text-sm text-slate-400 mt-2">
          Historical demand, live inventory freshness, spoilage indicators, and geo signals backing the waste intelligence module.
        </p>
      </div>

      {error && (
        <div className="hud-card border border-rose-500/40 text-rose-200 text-sm">{error}</div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DataCard
          title="Demand Rows"
          value={summary.demandRows ?? historicalDemand.length}
          icon={ChartLineUp}
          meta="Historical confirmed orders"
        />
        <DataCard
          title="Listing Rows"
          value={summary.listingRows ?? productListings.length}
          icon={Database}
          meta={`${summary.highRiskCategories ?? 0} high-risk categories`}
        />
        <DataCard
          title="Waste Alerts"
          value={(summary.expiryAlerts ?? 0) + (summary.surplusAlerts ?? 0)}
          icon={Timer}
          meta={`${summary.expiryAlerts ?? 0} expiry · ${summary.surplusAlerts ?? 0} surplus`}
        />
        <DataCard
          title="Geo Records"
          value={summary.geoRows ?? geoLocations.length}
          icon={MapPin}
          meta={`${summary.highSpoilage ?? 0} high spoilage listings`}
        />
      </section>

      <div className="hud-card">
        <p className="hud-label">Alert Feed</p>
        <div className="mt-3">
          <DataTable
            emptyMessage="No waste alerts available."
            rows={alerts.slice(0, 15)}
            columns={[
              {
                key: "alertType",
                label: "Type",
                render: (row: any) => (
                  <StatusBadge
                    label={row.alertType}
                    tone={row.alertType === "SURPLUS" ? "info" : "pending"}
                  />
                ),
              },
              { key: "category", label: "Category" },
              {
                key: "severity",
                label: "Severity",
                render: (row: any) => (
                  <StatusBadge label={row.severity || "LOW"} tone={toneForRisk(row.severity || "LOW")} />
                ),
              },
              { key: "message", label: "Message" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="hud-card">
          <p className="hud-label">Historical Demand Dataset</p>
          <div className="mt-3">
            <DataTable
              emptyMessage="No demand rows available."
              rows={historicalDemand.slice(0, 15)}
              columns={[
                { key: "date", label: "Date" },
                { key: "crop", label: "Crop" },
                { key: "category", label: "Category" },
                { key: "buyerRegion", label: "Buyer Region" },
                { key: "quantity", label: "Base Qty" },
                {
                  key: "hyperlocalMatch",
                  label: "Hyperlocal",
                  render: (row: any) => (
                    <StatusBadge label={row.hyperlocalMatch ? "YES" : "NO"} tone={row.hyperlocalMatch ? "active" : "info"} />
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="hud-card">
          <p className="hud-label">Product Listing Dataset</p>
          <div className="mt-3">
            <DataTable
              emptyMessage="No listing rows available."
              rows={productListings.slice(0, 15)}
              columns={[
                { key: "cropType", label: "Crop" },
                { key: "category", label: "Category" },
                { key: "quantityBaseValue", label: "Base Qty" },
                { key: "freshnessPeriodDays", label: "Freshness Days" },
                {
                  key: "wasteRisk",
                  label: "Waste Risk",
                  render: (row: any) => (
                    <StatusBadge label={row.wasteRisk || "LOW"} tone={toneForRisk(row.wasteRisk || "LOW")} />
                  ),
                },
                {
                  key: "spoilageIndicator",
                  label: "Spoilage",
                  render: (row: any) => (
                    <StatusBadge
                      label={row.spoilageIndicator || "LOW"}
                      tone={toneForRisk(row.spoilageIndicator || "LOW")}
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="hud-card">
          <p className="hud-label">Expiry & Freshness Dataset</p>
          <div className="mt-3">
            <DataTable
              emptyMessage="No freshness rows available."
              rows={expiryFreshness.slice(0, 15)}
              columns={[
                { key: "cropType", label: "Crop" },
                {
                  key: "freshnessStatus",
                  label: "Status",
                  render: (row: any) => (
                    <StatusBadge
                      label={row.freshnessStatus || "UNKNOWN"}
                      tone={
                        row.freshnessStatus === "EXPIRED"
                          ? "critical"
                          : row.freshnessStatus === "NEAR_EXPIRY"
                            ? "pending"
                            : "active"
                      }
                    />
                  ),
                },
                { key: "daysRemaining", label: "Days Left" },
                { key: "storageDurationDays", label: "Storage Days" },
                {
                  key: "spoilageIndicator",
                  label: "Spoilage",
                  render: (row: any) => (
                    <StatusBadge
                      label={row.spoilageIndicator || "LOW"}
                      tone={toneForRisk(row.spoilageIndicator || "LOW")}
                    />
                  ),
                },
                {
                  key: "expiryDate",
                  label: "Expiry Date",
                  render: (row: any) =>
                    row.expiryDate ? new Date(row.expiryDate).toLocaleString() : "-",
                },
              ]}
            />
          </div>
        </div>

        <div className="hud-card">
          <p className="hud-label">Geo-Location Dataset</p>
          <div className="mt-3">
            <DataTable
              emptyMessage="No geo rows available."
              rows={geoLocations.slice(0, 15)}
              columns={[
                { key: "role", label: "Role" },
                { key: "walletAddress", label: "Wallet" },
                { key: "pincode", label: "Pincode" },
                { key: "activeListings", label: "Active Listings" },
                { key: "lat", label: "Latitude" },
                { key: "lng", label: "Longitude" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
