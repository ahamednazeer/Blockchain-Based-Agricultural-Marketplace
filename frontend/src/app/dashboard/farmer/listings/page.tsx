"use client";

import React, { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatPriceSummary, formatQuantity, resolveAssetUrl } from "@/lib/format";

export default function FarmerListings() {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchRows = () => {
    api
      .getMyCrops()
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
  }, []);

  const updateStock = async (row: any) => {
    const next = window.prompt("Enter new available quantity:", String(row.quantityValue || ""));
    if (next === null) return;
    const quantityValue = Number(next);
    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      setMessage({ type: "err", text: "Invalid quantity value." });
      return;
    }
    try {
      await api.updateCropStock(row._id || row.id, { quantityValue });
      setMessage({ type: "ok", text: "Stock updated." });
      fetchRows();
    } catch (error: any) {
      setMessage({ type: "err", text: error.message || "Failed to update stock." });
    }
  };

  const removeExpired = async (row: any) => {
    if (!window.confirm("Remove this expired listing?")) return;
    try {
      await api.removeExpiredCrop(row._id || row.id);
      setMessage({ type: "ok", text: "Expired listing removed." });
      fetchRows();
    } catch (error: any) {
      setMessage({ type: "err", text: error.message || "Failed to remove listing." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Inventory Control</p>
        <h2 className="text-xl font-semibold mt-2">Crop Listings</h2>
        <p className="text-sm text-slate-400 mt-2">
          Listings are synced on-chain only after admin approval.
        </p>
      </div>
      {message && (
        <div
          className={`hud-card text-sm ${
            message.type === "ok"
              ? "border border-green-600 text-green-400"
              : "border border-rose-500/40 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No listings yet.</div>
      ) : (
        <DataTable
          columns={[
            { key: "id", label: "ID", render: (row) => row.id || row._id },
            { key: "name", label: "Crop" },
            {
              key: "qualityGrade",
              label: "Grade",
              render: (row) => row.qualityGrade || "B",
            },
            { key: "quantity", label: "Quantity", render: (row) => formatQuantity(row) },
            {
              key: "price",
              label: "Price",
              render: (row) => formatPriceSummary(row),
            },
            {
              key: "assets",
              label: "Assets",
              render: (row) => {
                const images = Array.isArray(row.imageUrls) && row.imageUrls.length > 0
                  ? row.imageUrls
                  : row.imageUrl
                    ? [row.imageUrl]
                    : [];
                const imageUrl = images[0] ? resolveAssetUrl(images[0]) : "";
                const certUrl = row.certificateUrl ? resolveAssetUrl(row.certificateUrl) : "";

                return (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {imageUrl ? (
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Images ({images.length})
                      </a>
                    ) : (
                      <span className="text-slate-500">No images</span>
                    )}
                    {certUrl ? (
                      <a
                        href={certUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-400 hover:text-green-300 underline"
                      >
                        Certificate
                      </a>
                    ) : (
                      <span className="text-slate-500">No PDF</span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "expiry",
              label: "Expiry",
              render: (row) =>
                row.expiry ||
                (row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : "-"),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  label={row.status}
                  tone={
                    row.status === "APPROVED" || row.status === "Active"
                      ? "active"
                      : row.status === "PENDING" || row.status === "Pending"
                        ? "pending"
                        : "info"
                  }
                />
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {row.status !== "EXPIRED" && row.status !== "REJECTED" ? (
                    <button
                      onClick={() => updateStock(row)}
                      className="px-2 py-1 border border-blue-700 text-blue-300 rounded-sm hover:bg-blue-950/40"
                    >
                      Update Stock
                    </button>
                  ) : null}
                  {row.status === "EXPIRED" ? (
                    <button
                      onClick={() => removeExpired(row)}
                      className="px-2 py-1 border border-rose-700 text-rose-300 rounded-sm hover:bg-rose-950/40"
                    >
                      Remove
                    </button>
                  ) : null}
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
