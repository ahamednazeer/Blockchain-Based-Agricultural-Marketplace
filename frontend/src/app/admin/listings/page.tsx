"use client";

import React, { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatPriceSummary, formatQuantity, resolveAssetUrl } from "@/lib/format";

export default function AdminListings() {
  const [rows, setRows] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchRows = () => {
    api
      .getAdminCrops()
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

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await api.approveCrop(id);
      fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      await api.rejectCrop(id);
      fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Listing Approvals</p>
        <h2 className="text-xl font-semibold mt-2">Crop Compliance Queue</h2>
        <p className="text-sm text-slate-400 mt-2">Review quality, legality, and expiry rules before on-chain listing.</p>
      </div>

      {rows.length === 0 ? (
        <div className="hud-card text-sm text-slate-400">No listings submitted yet.</div>
      ) : (
        <DataTable
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: "id", label: "ID", render: (row) => row.id || row._id },
            { key: "name", label: "Crop" },
            { key: "category", label: "Category" },
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
                        onClick={(event) => event.stopPropagation()}
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
                        onClick={(event) => event.stopPropagation()}
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(row);
                    }}
                    className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/60 rounded-sm text-slate-200 hover:border-slate-400"
                  >
                    View
                  </button>
                  {row.status === "PENDING" || row.status === "Pending" ? (
                    <>
                      <button
                        disabled={busyId === (row.id || row._id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleApprove(row.id || row._id);
                        }}
                        className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/50 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === (row.id || row._id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleReject(row.id || row._id);
                        }}
                        className="px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] border border-red-600 rounded-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">Closed</span>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-10">
          <div className="w-full max-w-3xl bg-slate-950/95 border border-slate-700/60 rounded-sm p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="hud-label">Listing Details</p>
                <h3 className="text-2xl font-semibold mt-1">{selected.name}</h3>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em] mt-2">
                  {selected._id || selected.id}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/60 rounded-sm px-4 py-2 text-slate-200 hover:border-slate-400"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="hud-label">Category</p>
                <p className="text-slate-200 mt-1">{selected.category || "-"}</p>
              </div>
              <div>
                <p className="hud-label">Quantity</p>
                <p className="text-slate-200 mt-1">{formatQuantity(selected)}</p>
              </div>
              <div>
                <p className="hud-label">Price</p>
                <p className="text-slate-200 mt-1">{formatPriceSummary(selected)}</p>
              </div>
              <div>
                <p className="hud-label">Farmer Wallet</p>
                <p className="text-slate-200 mt-1">{selected.farmerWallet || "-"}</p>
              </div>
              <div>
                <p className="hud-label">Harvest Date</p>
                <p className="text-slate-200 mt-1">
                  {selected.harvestDate ? new Date(selected.harvestDate).toLocaleDateString() : "-"}
                </p>
              </div>
              <div>
                <p className="hud-label">Expiry Date</p>
                <p className="text-slate-200 mt-1">
                  {selected.expiryDate ? new Date(selected.expiryDate).toLocaleDateString() : "-"}
                </p>
              </div>
              <div>
                <p className="hud-label">Storage Type</p>
                <p className="text-slate-200 mt-1">{selected.storageType || "-"}</p>
              </div>
              <div>
                <p className="hud-label">Status</p>
                <p className="text-slate-200 mt-1">{selected.status || "-"}</p>
              </div>
            </div>

            <div>
              <p className="hud-label">Description</p>
              <p className="text-slate-300 mt-2">{selected.description || "-"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="hud-card">
                <p className="hud-label">Images</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(Array.isArray(selected.imageUrls) && selected.imageUrls.length > 0
                    ? selected.imageUrls
                    : selected.imageUrl
                      ? [selected.imageUrl]
                      : []
                  ).map((url: string, index: number) => (
                    <a key={url + index} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveAssetUrl(url)}
                        alt={`Crop asset ${index + 1}`}
                        className="h-24 w-full object-cover rounded-sm border border-slate-700/60"
                      />
                    </a>
                  ))}
                  {(!selected.imageUrls || selected.imageUrls.length === 0) && !selected.imageUrl && (
                    <p className="text-xs text-slate-500">No images uploaded.</p>
                  )}
                </div>
              </div>
              <div className="hud-card">
                <p className="hud-label">Certificate</p>
                <div className="mt-3">
                  {selected.certificateUrl ? (
                    <a
                      href={resolveAssetUrl(selected.certificateUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono uppercase tracking-[0.2em] text-green-400 underline"
                    >
                      View PDF
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">No certificate uploaded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
