"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DataCard } from "@/components/DataCard";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { ShoppingBag, Wallet, ClipboardText, ChartLineUp } from "@phosphor-icons/react";

export default function BuyerHome() {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    api
      .getBuyerStats()
      .then((data) => setStats(data))
      .catch(() => {
        // fallback
      });

    api
      .getTransactions()
      .then((rows) => {
        if (Array.isArray(rows)) {
          setOrders(rows.slice(0, 5));
        }
      })
      .catch(() => {
        // fallback
      });
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DataCard
          title="Active Listings"
          value={stats ? stats.activeListings : "—"}
          icon={ShoppingBag}
          meta="Ready for purchase"
        />
        <DataCard
          title="My Orders"
          value={stats ? stats.orders?.total : "—"}
          icon={ClipboardText}
          meta={`${stats ? stats.orders?.confirmed ?? 0 : "—"} confirmed`}
        />
        <DataCard
          title="Spent (ETH)"
          value={stats ? Number(stats.spentEth || 0).toFixed(3) : "—"}
          icon={ChartLineUp}
          meta="Confirmed only"
        />
        <DataCard
          title="DVU Balance"
          value={stats ? Number(stats.dvuBalance || 0).toLocaleString() : "—"}
          icon={Wallet}
          meta="Ledger value units"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="hud-label">Latest Purchases</p>
              <h2 className="text-lg font-semibold mt-1">Recent Transaction Flow</h2>
            </div>
            <StatusBadge label="LIVE" tone="active" />
          </div>
          <div className="space-y-2">
            {orders.length === 0 && <p className="text-sm text-slate-400">No orders placed yet.</p>}
            {orders.map((row: any) => (
              <div key={row._id || row.txHash} className="flex items-center justify-between text-sm border border-slate-700/60 rounded-sm px-4 py-3">
                <span>{row.cropName || "Crop"}</span>
                <StatusBadge
                  label={row.status || "PENDING"}
                  tone={
                    row.status === "CONFIRMED"
                      ? "active"
                      : row.status === "FAILED"
                        ? "critical"
                        : "pending"
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Link
            href="/marketplace"
            className="block px-4 py-3 rounded-sm border border-slate-700/60 hover:border-blue-600 text-sm"
          >
            Open Marketplace
          </Link>
          <Link
            href="/dashboard/buyer/orders"
            className="block px-4 py-3 rounded-sm border border-slate-700/60 hover:border-blue-600 text-sm"
          >
            View Full Orders
          </Link>
        </div>
      </section>
    </div>
  );
}
