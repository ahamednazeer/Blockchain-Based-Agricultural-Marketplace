"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function FarmerResourcesPage() {
  const [data, setData] = useState<any>(null);
  const [category, setCategory] = useState("All");
  const [section, setSection] = useState("STORAGE_SUPPORT");

  useEffect(() => {
    api
      .getFarmerResources(category !== "All" ? category : undefined)
      .then((res) => setData(res))
      .catch(() => {
        // keep empty state
      });
  }, [category]);

  const categories = useMemo(
    () => ["All", ...(Array.isArray(data?.categories) ? data.categories : [])],
    [data]
  );
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const guidelines = Array.isArray(data?.storageGuidelines) ? data.storageGuidelines : [];
  const catalog = Array.isArray(data?.supportCatalog) ? data.supportCatalog : [];
  const links = Array.isArray(data?.externalPurchaseLinks) ? data.externalPurchaseLinks : [];
  const aiTips = Array.isArray(data?.aiTips) ? data.aiTips : [];
  const aiEngine = String(data?.aiEngine || "RULE_BASED");

  const visibleCatalog = catalog.filter((item: any) => item.section === section);

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Farmer Support</p>
        <h2 className="text-xl font-semibold mt-2">Storage Support and Recommended Tools</h2>
        <p className="text-sm text-slate-400 mt-2">
          Category-specific storage guidelines, recommended equipment, and external buy links designed to reduce spoilage and replace informal middleman advice.
        </p>
        {aiTips.length > 0 && (
          <div className="mt-4 border border-blue-700/60 bg-blue-900/20 rounded-sm p-3">
            <p className="text-xs uppercase tracking-wide text-blue-300">AI Tips ({aiEngine})</p>
            <ul className="mt-2 space-y-2 text-sm text-blue-100">
              {aiTips.map((tip: string) => (
                <li key={tip} className="border border-blue-700/40 rounded-sm p-2">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="hud-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {sections.map((item: any) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border rounded-sm ${
                  section === item.id
                    ? "border-blue-600 text-blue-300 bg-blue-950/40"
                    : "border-slate-700/60 text-slate-300 hover:border-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            className="input-modern w-48"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="hud-card">
          <p className="hud-label">Storage Guidelines</p>
          <div className="mt-3 space-y-3 text-sm">
            {guidelines.length === 0 && <p className="text-slate-400">No guidelines available.</p>}
            {guidelines.map((item: any) => (
              <div key={`${item.cropCategory}-${item.guidance}`} className="border border-slate-700/60 rounded-sm p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.cropCategory}</p>
                  <StatusBadge label="Storage" tone="info" />
                </div>
                <p className="text-slate-300 mt-2">{item.guidance}</p>
                <p className="text-xs text-slate-500 mt-3">
                  Temp: {item.temperature || "General"} · Humidity: {item.humidity || "Monitor"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hud-card">
            <p className="hud-label">
              {section === "STORAGE_SUPPORT" ? "Storage Support Catalog" : "Recommended Tools"}
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleCatalog.length === 0 && (
                <p className="text-slate-400 text-sm">No catalog items for this filter.</p>
              )}
              {visibleCatalog.map((item: any) => (
                <article
                  key={item.id}
                  className="border border-slate-700/60 rounded-sm overflow-hidden bg-slate-900/50"
                >
                  <div className="relative h-36 w-full border-b border-slate-700/60 bg-slate-950/60">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{item.provider}</p>
                      </div>
                      <StatusBadge label={item.priority} tone={item.priority === "HIGH" ? "critical" : "pending"} />
                    </div>
                    <p className="text-sm text-slate-300">{item.description}</p>
                    <div className="rounded-sm border border-slate-700/60 bg-slate-950/40 p-3">
                      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
                        Why Recommended
                      </p>
                      <p className="text-sm text-slate-300 mt-2">{item.whyRecommended}</p>
                    </div>
                    <a
                      href={item.buyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-blue-600 rounded-sm text-blue-300 hover:bg-blue-950/40"
                    >
                      {item.provider === "Amazon" ? "Buy on Amazon" : `Open ${item.provider}`}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="hud-card">
            <p className="hud-label">External Purchase Links</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {links.length === 0 && <p className="text-slate-400">No external links available.</p>}
              {links.map((item: any) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-slate-700/60 rounded-sm p-3 hover:border-blue-600"
                >
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-slate-400 mt-1">{item.provider}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
