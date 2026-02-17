"use client";

import React, { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUsers = () => {
    api
      .getAdminUsers()
      .then((data) => {
        if (Array.isArray(data)) {
          setRows(data);
        }
      })
      .catch(() => {
        // leave empty
      });
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject" | "suspend") => {
    setBusyId(id);
    try {
      if (action === "approve") {
        await api.approveUser(id);
      } else if (action === "reject") {
        await api.rejectUser(id);
      } else {
        await api.suspendUser(id);
      }
      fetchUsers();
    } finally {
      setBusyId(null);
    }
  };
  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">User Governance</p>
        <h2 className="text-xl font-semibold mt-2">Farmer & Buyer Registry</h2>
        <p className="text-sm text-slate-400 mt-2">Approve, suspend, or blacklist wallets from trading.</p>
      </div>

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No registered users yet.</div>
      ) : (
        <DataTable
          columns={[
            { key: "id", label: "ID", render: (row) => row.id || row._id },
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "wallet", label: "Wallet", render: (row) => row.wallet || row.walletAddress },
            { key: "location", label: "Location" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  label={row.status}
                  tone={
                    row.status === "ACTIVE" || row.status === "Active"
                      ? "active"
                      : row.status === "PENDING" || row.status === "Pending"
                        ? "pending"
                        : "critical"
                  }
                />
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center gap-2">
                  {row.status === "PENDING" || row.status === "Pending" ? (
                    <>
                      <button
                        disabled={busyId === (row.id || row._id)}
                        onClick={() => handleAction(row.id || row._id, "approve")}
                        className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/50 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === (row.id || row._id)}
                        onClick={() => handleAction(row.id || row._id, "reject")}
                        className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-red-600 rounded-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busyId === (row.id || row._id)}
                      onClick={() => handleAction(row.id || row._id, "suspend")}
                      className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-yellow-600 rounded-sm text-yellow-400 hover:bg-yellow-950/50 disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
