"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, ShieldCheck } from "@phosphor-icons/react";
import { DataTable } from "@/components/DataTable";
import { api } from "@/lib/api";

export default function LedgerPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api
      .getLedger()
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data);
        }
      })
      .catch(() => {
        // leave empty
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="hud-label">Public Ledger</p>
            <h1 className="text-3xl font-bold mt-2">On-Chain Event Stream</h1>
            <p className="text-slate-400 mt-2">Immutable records for every crop listing and purchase.</p>
          </div>
          <Link
            href="/marketplace"
            className="px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/60 rounded-sm hover:border-blue-600"
          >
            Back to Market
          </Link>
        </header>

        <div className="hud-card flex items-center gap-4">
          <div className="h-11 w-11 rounded-sm bg-slate-900 flex items-center justify-center">
            <BookOpenText size={20} className="text-blue-300" weight="duotone" />
          </div>
          <div>
            <p className="text-sm font-semibold">Ganache Event Feed</p>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Real-time log monitoring enabled</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-green-600 text-xs font-mono uppercase tracking-[0.2em] text-green-400">
              <ShieldCheck size={14} weight="duotone" />
              Verified
            </span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="hud-card text-sm text-slate-400">No ledger events yet.</div>
        ) : (
          <DataTable
            columns={[
              { key: "type", label: "Event Type" },
              { key: "cropId", label: "Crop" },
              { key: "actor", label: "Actor" },
              { key: "timestamp", label: "Timestamp" },
              { key: "value", label: "Value" },
              { key: "id", label: "Tx Hash" },
            ]}
            rows={events.map((event: any) => ({
              ...event,
              id: event.id || event.txHash,
              value: event.value || event.valueEth,
              timestamp: event.timestamp
                ? new Date(event.timestamp).toLocaleString()
                : event.blockTimestamp || "-",
            }))}
          />
        )}
    </div>
  );
}
