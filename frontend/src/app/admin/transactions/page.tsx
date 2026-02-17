"use client";

import React, { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatQuantityValue } from "@/lib/units";

export default function AdminTransactions() {
  const [rows, setRows] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRows = () => {
    api
      .getAdminTransactions()
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
    fetchRows();
    const interval = setInterval(fetchRows, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatWallet = (wallet?: string) => {
    if (!wallet) return "-";
    if (wallet.length <= 12) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const rowsWithDetails = useMemo(() => {
      const map = new Map<string, any>();
      rows.forEach((row) => {
        const cropKey =
          row.cropId && typeof row.cropId === "object"
            ? row.cropId._id || row.cropId.id || ""
            : row.cropId || row.cropName || "";
        const key = `${row.txHash || row.hash || ""}-${cropKey}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, row);
          return;
        }
        if (existing.status !== "CONFIRMED" && row.status === "CONFIRMED") {
          map.set(key, row);
        }
      });

      return Array.from(map.values()).map((row) => {
        const cropMeta = row.cropId && typeof row.cropId === "object" ? row.cropId : null;
        const cropKey =
          row.cropId && typeof row.cropId === "object"
            ? row.cropId._id || row.cropId.id || ""
            : row.cropId || row.cropName || "";
        const unitScale = Number(cropMeta?.unitScale) > 0 ? Number(cropMeta.unitScale) : 1;
        const quantityUnit = cropMeta?.quantityUnit || row.quantityUnit || "unit";
        const unitsBase = Number(row.units);
        const displayUnits =
          Number.isFinite(unitsBase) && unitScale > 0 ? unitsBase / unitScale : unitsBase;
        const unitsLabel =
          Number.isFinite(displayUnits) && displayUnits > 0
            ? `${formatQuantityValue(displayUnits)} ${quantityUnit}`
            : "-";

        return {
          ...row,
          rowKey: row._id || `${row.txHash || row.hash || ""}-${cropKey}`,
          crop: row.crop || cropMeta?.name || row.cropName,
          farmer: row.farmer || row.farmerWallet,
          buyer: row.buyer || row.buyerWallet,
          farmerShort: formatWallet(row.farmer || row.farmerWallet),
          buyerShort: formatWallet(row.buyer || row.buyerWallet),
          hashLabel: row.hash || row.txHash || "-",
          unitsLabel,
          paymentStatus: row.status,
          fulfillmentStatus: row.fulfillmentStatus || "PENDING",
          timeLabel: row.time || (row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"),
          valueLabel: row.value || (row.valueEth ? `${row.valueEth} ETH` : "-"),
          shippingAddress: row.shippingAddress || null,
        };
      });
    }, [rows]);

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Transaction Monitor</p>
        <h2 className="text-xl font-semibold mt-2">Blockchain Activity</h2>
        <p className="text-sm text-slate-400 mt-2">Track purchases, escrow, and wallet transfers.</p>
      </div>

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No transactions yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-slate-700/60 bg-slate-800/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/40">
              <tr>
                {[
                  "Tx Hash",
                  "Crop",
                  "Farmer",
                  "Buyer",
                  "Qty",
                  "Value",
                  "Payment",
                  "Delivery",
                  "Timestamp",
                  "",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWithDetails.map((row) => {
                const isOpen = expandedId === row.rowKey;
                const address = row.shippingAddress;
                const paymentDone = row.paymentStatus === "CONFIRMED";
                const paymentTone =
                  row.paymentStatus === "CONFIRMED"
                    ? "active"
                    : row.paymentStatus === "FAILED"
                      ? "critical"
                      : "pending";
                const shipped = row.fulfillmentStatus === "SHIPPED" || row.fulfillmentStatus === "DELIVERED";
                const delivered = row.fulfillmentStatus === "DELIVERED";
                return (
                  <React.Fragment key={row.rowKey}>
                    <tr className="border-t border-slate-700/60 text-slate-200">
                      <td className="px-4 py-3">
                        <span title={row.hashLabel} className="text-xs font-mono">
                          {formatWallet(row.hashLabel)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.crop}</td>
                      <td className="px-4 py-3">
                        <span title={row.farmer}>{row.farmerShort}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span title={row.buyer}>{row.buyerShort}</span>
                      </td>
                      <td className="px-4 py-3">{row.unitsLabel}</td>
                      <td className="px-4 py-3">{row.valueLabel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={row.paymentStatus} tone={paymentTone} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={row.fulfillmentStatus}
                          tone={
                            row.fulfillmentStatus === "DELIVERED"
                              ? "active"
                              : row.fulfillmentStatus === "SHIPPED"
                                ? "info"
                                : "pending"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">{row.timeLabel}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : row.rowKey)}
                          className="text-xs font-mono uppercase tracking-[0.2em] text-blue-400 hover:text-blue-300"
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-slate-700/60 bg-slate-950/60">
                        <td colSpan={10} className="px-6 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
                            <div className="space-y-3">
                              <p className="hud-label">Shipping Address</p>
                              {address ? (
                                <div className="text-sm text-slate-300 space-y-1">
                                  <p className="font-semibold">{address.recipientName}</p>
                                  <p>{address.phone}</p>
                                  <p>
                                    {address.line1}
                                    {address.line2 ? `, ${address.line2}` : ""}
                                  </p>
                                  <p>
                                    {address.city}, {address.state} {address.postalCode}
                                  </p>
                                  <p>{address.country}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">No address saved for this order.</p>
                              )}
                            </div>
                            <div className="space-y-3">
                              <p className="hud-label">Order Timeline</p>
                              <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-sm ${paymentDone ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <span className={paymentDone ? "text-green-400" : ""}>Payment</span>
                                </div>
                                <span className={`h-[1px] w-10 ${paymentDone ? "bg-emerald-400/60" : "bg-slate-700"}`} />
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-sm ${shipped ? "bg-blue-400" : "bg-slate-600"}`} />
                                  <span className={shipped ? "text-blue-400" : ""}>Shipped</span>
                                </div>
                                <span className={`h-[1px] w-10 ${delivered ? "bg-emerald-400/60" : "bg-slate-700"}`} />
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-sm ${delivered ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <span className={delivered ? "text-green-400" : ""}>Delivered</span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500">
                                Status updates are based on on-chain confirmation and fulfillment.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
