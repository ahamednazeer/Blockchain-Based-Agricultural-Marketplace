"use client";

import React, { useEffect, useState } from "react";
import { DataCard } from "@/components/DataCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, Leaf, ChartLineUp, WarningCircle, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchPendingUsers = () => {
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
  };

  useEffect(() => {
    api
      .getAdminStats()
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        // fallback to static
      });

    fetchPendingUsers();
  }, []);

  const handleUserDecision = async (id: string, action: "approve" | "reject") => {
    setBusyUserId(id);
    setActionError("");
    try {
      if (action === "approve") {
        await api.approveUser(id);
      } else {
        await api.rejectUser(id);
      }
      fetchPendingUsers();
      api
        .getAdminStats()
        .then((data) => {
          setStats(data);
        })
        .catch(() => {
          // ignore
        });
    } catch (error: any) {
      setActionError(error?.message || `Failed to ${action} user`);
    } finally {
      setBusyUserId(null);
    }
  };

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
            {actionError && (
              <div className="rounded-sm border px-3 py-2 text-xs border-rose-500/40 text-rose-200 bg-rose-500/10">
                {actionError}
              </div>
            )}
            {pending.length === 0 && (
              <div className="text-sm text-slate-400">No pending users.</div>
            )}
            {pending.map((user) => (
              <div key={user.id || user._id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-700/60 rounded-sm px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">{user.role} · {user.location || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUserDecision(user.id || user._id, "approve")}
                    disabled={busyUserId === (user.id || user._id)}
                    className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/50 disabled:opacity-50"
                  >
                    {busyUserId === (user.id || user._id) ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleUserDecision(user.id || user._id, "reject")}
                    disabled={busyUserId === (user.id || user._id)}
                    className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-red-600 rounded-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                  >
                    {busyUserId === (user.id || user._id) ? "..." : "Reject"}
                  </button>
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
              <ShieldCheck size={20} className="text-blue-300" weight="duotone" />
              <div>
                <p className="text-sm font-semibold">Emergency Controls</p>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Pause or blacklist wallets</p>
              </div>
            </div>
            <button className="mt-4 w-full border border-yellow-600 text-amber-200 rounded-sm py-2 text-xs font-mono uppercase tracking-[0.2em] hover:bg-yellow-950/50">
              Pause Contract
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
