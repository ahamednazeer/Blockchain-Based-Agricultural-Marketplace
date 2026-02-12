"use client";

import React, { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatQuantityValue } from "@/lib/units";

export default function BuyerOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRows = () => {
    api
      .getTransactions()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRows(data);
        }
      })
      .catch(() => {
        // fallback to static data
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

        const unitPriceInr = Number(cropMeta?.pricePerUnitInr);
        const unitPriceEth = Number(cropMeta?.pricePerUnitEth);
        const unitPriceLabel =
          Number.isFinite(unitPriceInr) && unitPriceInr > 0
            ? `${unitPriceInr.toFixed(2)} INR`
            : Number.isFinite(unitPriceEth) && unitPriceEth > 0
              ? `${unitPriceEth} ETH`
              : "-";

        const totalInr =
          Number.isFinite(unitPriceInr) && unitPriceInr > 0 && Number.isFinite(displayUnits)
            ? unitPriceInr * displayUnits
            : null;
        const totalLabel =
          totalInr !== null ? `${totalInr.toFixed(2)} INR` : row.valueEth ? `${row.valueEth} ETH` : "-";

        return {
          ...row,
          rowKey: row._id || `${row.txHash || row.hash || ""}-${cropKey}`,
          crop: row.crop || cropMeta?.name || row.cropName,
          farmer: row.farmer || row.farmerWallet,
          farmerShort: formatWallet(row.farmer || row.farmerWallet),
          unitsLabel,
          unitPriceLabel,
          totalLabel,
          paymentStatus: row.status,
          fulfillmentStatus: row.fulfillmentStatus || "PENDING",
          timeLabel: row.time || (row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"),
          hashLabel: row.hash || row.txHash || "-",
          shipTo: row.shippingAddress
            ? `${row.shippingAddress.recipientName || ""} · ${row.shippingAddress.city || ""} ${row.shippingAddress.state || ""} ${row.shippingAddress.postalCode || ""}`.trim()
            : "-",
          shippingAddress: row.shippingAddress || null,
        };
      });
    }, [rows]);

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Order Ledger</p>
        <h2 className="text-xl font-semibold mt-2">Purchasing History</h2>
        <p className="text-sm text-slate-400 mt-2">Track escrow, delivery, and blockchain confirmations.</p>
      </div>

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No orders yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800/70 bg-slate-900/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                {[
                  "Crop",
                  "Farmer",
                  "Qty",
                  "Unit Price",
                  "Total",
                  "Payment",
                  "Delivery",
                  "Timestamp",
                  "Tx Hash",
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
                    <tr className="border-t border-slate-800/60 text-slate-200">
                      <td className="px-4 py-3">{row.crop}</td>
                      <td className="px-4 py-3">
                        <span title={row.farmer}>{row.farmerShort}</span>
                      </td>
                      <td className="px-4 py-3">{row.unitsLabel}</td>
                      <td className="px-4 py-3">{row.unitPriceLabel}</td>
                      <td className="px-4 py-3">{row.totalLabel}</td>
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
                        <span title={row.hashLabel} className="text-xs font-mono">
                          {formatWallet(row.hashLabel)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : row.rowKey)}
                          className="text-xs font-mono uppercase tracking-[0.2em] text-sky-200 hover:text-sky-100"
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-slate-800/60 bg-slate-950/60">
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
                                  <span className={`h-2 w-2 rounded-full ${paymentDone ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <span className={paymentDone ? "text-emerald-200" : ""}>Payment</span>
                                </div>
                                <span className={`h-[1px] w-10 ${paymentDone ? "bg-emerald-400/60" : "bg-slate-700"}`} />
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${shipped ? "bg-sky-400" : "bg-slate-600"}`} />
                                  <span className={shipped ? "text-sky-200" : ""}>Shipped</span>
                                </div>
                                <span className={`h-[1px] w-10 ${delivered ? "bg-emerald-400/60" : "bg-slate-700"}`} />
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${delivered ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <span className={delivered ? "text-emerald-200" : ""}>Delivered</span>
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
