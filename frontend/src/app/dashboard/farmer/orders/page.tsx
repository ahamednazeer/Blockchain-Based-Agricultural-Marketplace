"use client";

import React, { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatQuantityValue } from "@/lib/units";

export default function FarmerOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const fetchRows = () => {
    api
      .getTransactions()
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
          buyer: row.buyer || row.buyerWallet,
          buyerShort: formatWallet(row.buyer || row.buyerWallet),
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
          returnStatus: row.returnStatus || "NONE",
          ratingScore: row.rating?.score || null,
          ratingFeedback: row.rating?.feedback || "",
          courierName: row.courier?.partnerName || "",
          courierTrackingId: row.courier?.trackingId || "",
          pickupStatus: row.pickupStatus || "PENDING",
          transitStatus: row.transitStatus || "PENDING",
          slaBreached: Boolean(row.slaBreached),
        };
      });
    }, [rows]);

  const updateFulfillment = async (id: string, status: "SHIPPED" | "DELIVERED") => {
    setBusyId(id);
    try {
      await api.updateFulfillmentStatus(id, status);
      fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  const assignCourier = async (row: any) => {
    const partnerName = window.prompt("Courier partner name:", row.courierName || "Local Courier");
    if (!partnerName) return;
    const trackingId = window.prompt("Tracking ID (optional):", row.courierTrackingId || "") || "";
    setBusyId(row._id);
    try {
      await api.assignCourier(row._id, { partnerName, trackingId });
      setActionMessage({ type: "ok", text: "Courier assigned." });
      fetchRows();
    } catch (error: any) {
      setActionMessage({ type: "err", text: error.message || "Failed to assign courier." });
    } finally {
      setBusyId(null);
    }
  };

  const updateCourier = async (
    row: any,
    payload: { pickupStatus?: "PENDING" | "PICKED_UP"; transitStatus?: "PENDING" | "IN_TRANSIT" | "DELIVERED" }
  ) => {
    setBusyId(row._id);
    try {
      await api.updateCourierStatus(row._id, payload);
      setActionMessage({ type: "ok", text: "Delivery status updated." });
      fetchRows();
    } catch (error: any) {
      setActionMessage({ type: "err", text: error.message || "Failed to update delivery status." });
    } finally {
      setBusyId(null);
    }
  };

  const reviewReturn = async (row: any, decision: "APPROVED" | "REJECTED" | "COMPLETED") => {
    setBusyId(row._id);
    try {
      await api.reviewReturn(row._id, decision);
      setActionMessage({ type: "ok", text: `Return ${decision.toLowerCase()}.` });
      fetchRows();
    } catch (error: any) {
      setActionMessage({ type: "err", text: error.message || "Failed to update return decision." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Settlement Desk</p>
        <h2 className="text-xl font-semibold mt-2">Recent Purchases</h2>
        <p className="text-sm text-slate-400 mt-2">Track ETH transfers and buyer confirmations.</p>
      </div>
      {actionMessage && (
        <div
          className={`hud-card text-sm ${
            actionMessage.type === "ok"
              ? "border border-green-600 text-green-400"
              : "border border-rose-500/40 text-rose-200"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No purchases yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-slate-700/60 bg-slate-800/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/40">
              <tr>
                {[
                  "Crop",
                  "Buyer",
                  "Qty",
                  "Unit Price",
                  "Total",
                  "Payment",
                  "Delivery",
                  "Timestamp",
                  "Tx Hash",
                  "Actions",
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
                      <td className="px-4 py-3">{row.crop}</td>
                      <td className="px-4 py-3">
                        <span title={row.buyer}>{row.buyerShort}</span>
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
                        {row.fulfillmentStatus === "DELIVERED" ? (
                          <span className="text-xs text-slate-500">Delivered</span>
                        ) : row.fulfillmentStatus === "SHIPPED" ? (
                          <button
                            disabled={busyId === row._id}
                            onClick={() => updateFulfillment(row._id, "DELIVERED")}
                            className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/50 disabled:opacity-50"
                          >
                            Mark Delivered
                          </button>
                        ) : (
                          <button
                            disabled={busyId === row._id}
                            onClick={() => updateFulfillment(row._id, "SHIPPED")}
                            className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-blue-600 rounded-sm text-blue-400 hover:bg-blue-950/50 disabled:opacity-50"
                          >
                            Mark Shipped
                          </button>
                        )}
                      </td>
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
                        <td colSpan={11} className="px-6 py-5">
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
                              <div className="pt-2 space-y-2 text-xs text-slate-400">
                                <p>Courier: {row.courierName || "Not assigned"}</p>
                                {row.courierTrackingId ? <p>Tracking: {row.courierTrackingId}</p> : null}
                                <p>Pickup: {row.pickupStatus} · Transit: {row.transitStatus}</p>
                                <p>Return: {row.returnStatus}</p>
                                <p>
                                  Buyer Rating: {row.ratingScore ? `${row.ratingScore}/5` : "Not rated"}
                                  {row.ratingFeedback ? ` — ${row.ratingFeedback}` : ""}
                                </p>
                                <p>SLA: {row.slaBreached ? "Breached" : "On track"}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <button
                                  disabled={busyId === row._id}
                                  onClick={() => assignCourier(row)}
                                  className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-blue-700 rounded-sm text-blue-300 hover:bg-blue-950/40 disabled:opacity-50"
                                >
                                  Assign Courier
                                </button>
                                <button
                                  disabled={busyId === row._id}
                                  onClick={() => updateCourier(row, { pickupStatus: "PICKED_UP" })}
                                  className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-slate-600 rounded-sm text-slate-300 hover:bg-slate-900/60 disabled:opacity-50"
                                >
                                  Picked Up
                                </button>
                                <button
                                  disabled={busyId === row._id}
                                  onClick={() => updateCourier(row, { transitStatus: "IN_TRANSIT" })}
                                  className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-slate-600 rounded-sm text-slate-300 hover:bg-slate-900/60 disabled:opacity-50"
                                >
                                  In Transit
                                </button>
                                <button
                                  disabled={busyId === row._id}
                                  onClick={() => updateCourier(row, { transitStatus: "DELIVERED" })}
                                  className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/40 disabled:opacity-50"
                                >
                                  Delivered
                                </button>
                                {row.returnStatus === "REQUESTED" ? (
                                  <>
                                    <button
                                      disabled={busyId === row._id}
                                      onClick={() => reviewReturn(row, "APPROVED")}
                                      className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-amber-600 rounded-sm text-amber-300 hover:bg-amber-950/40 disabled:opacity-50"
                                    >
                                      Approve Return
                                    </button>
                                    <button
                                      disabled={busyId === row._id}
                                      onClick={() => reviewReturn(row, "REJECTED")}
                                      className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-rose-600 rounded-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                                    >
                                      Reject Return
                                    </button>
                                  </>
                                ) : null}
                              </div>
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
