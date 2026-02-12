"use client";

import React, { useEffect, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, Leaf, ChartLineUp, WarningCircle, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);

  useEffect(() => {
    api
      .getAdminStats()
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        // fallback to static
      });

    api
      .getAdminUsers()
      .then((data) => {
        if (Array.isArray(data)) {
          setPending(data.filter((user) => user.status === "PENDING").slice(0, 3));
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
          title="Pending Users"
          value={stats ? stats.users?.pending : "—"}
          icon={Users}
          meta="Awaiting approval"
        />
        <DataCard
          title="Listings Pending"
          value={stats ? stats.crops?.pending : "—"}
          icon={Leaf}
          meta="Admin review"
        />
        <DataCard
          title="Total Volume"
          value={stats ? `${Number(stats.transactions?.totalEth || 0).toFixed(2)} ETH` : "—"}
          icon={ChartLineUp}
          meta="All-time"
        />
        <DataCard
          title="Expiry Alerts"
          value={stats ? stats.crops?.expired : "—"}
          icon={WarningCircle}
          meta="Critical in 48h"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="hud-label">Approvals</p>
              <h2 className="text-lg font-semibold mt-1">Users Awaiting Review</h2>
            </div>
            <StatusBadge label="Priority" tone="pending" />
          </div>
          <div className="space-y-3">
            {pending.length === 0 && (
              <div className="text-sm text-slate-400">No pending users.</div>
            )}
            {pending.map((user) => (
              <div key={user.id || user._id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-800/70 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">{user.role} · {user.location || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-emerald-400/60 rounded-full text-emerald-200 hover:bg-emerald-500/10">Approve</button>
                  <button className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-rose-400/60 rounded-full text-rose-200 hover:bg-rose-500/10">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hud-card">
            <p className="hud-label">Blockchain Monitoring</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Live Ganache Node</span>
                <StatusBadge label="Online" tone="active" />
              </div>
              <div className="flex items-center justify-between">
                <span>Smart Contract Status</span>
                <StatusBadge label="Unpaused" tone="active" />
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Tx</span>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{stats ? stats.transactions?.pending : "—"}</span>
              </div>
            </div>
          </div>
          <div className="hud-card">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-sky-300" weight="duotone" />
              <div>
                <p className="text-sm font-semibold">Emergency Controls</p>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Pause or blacklist wallets</p>
              </div>
            </div>
            <button className="mt-4 w-full border border-amber-400/60 text-amber-200 rounded-lg py-2 text-xs font-mono uppercase tracking-[0.2em] hover:bg-amber-500/10">
              Pause Contract
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
