"use client";

import React, { useEffect, useMemo, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { ethers } from "ethers";
import { api } from "@/lib/api";
import { formatQuantityValue, getUnitMeta, parseToBaseUnits, stepForScale } from "@/lib/units";

const UNIT_OPTIONS = ["kg", "g", "mg", "L", "mL", "ton", "box", "crate", "pcs"];
const CATEGORY_OPTIONS = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Pulses",
  "Spices",
  "Dairy",
  "Oilseeds",
  "Flowers",
  "Herbs",
  "Other",
];

type UploadItem = { name: string; url: string };

export default function NewListing() {
  const [form, setForm] = useState({
    name: "",
    category: "Vegetables",
    quantityValue: "",
    quantityUnit: "kg",
    pricePerUnit: "",
    priceCurrency: "INR",
    harvestDate: "",
    expiryDate: "",
    storageType: "",
    description: "",
    imageUrl: "",
    imageUrls: [] as string[],
    certificateUrl: "",
  });
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [message, setMessage] = useState("");
  const [ethInrRate, setEthInrRate] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [imageError, setImageError] = useState("");
  const [certError, setCertError] = useState("");
  const [imageUploads, setImageUploads] = useState<UploadItem[]>([]);
  const [certificate, setCertificate] = useState<UploadItem | null>(null);

  useEffect(() => {
    api
      .getEthInrRate()
      .then((data) => {
        const rate = Number(data?.rate);
        setEthInrRate(Number.isFinite(rate) && rate > 0 ? rate : null);
        setRateSource(typeof data?.source === "string" ? data.source : null);
      })
      .catch(() => {
        setEthInrRate(null);
        setRateSource(null);
      });
  }, []);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const unitMeta = useMemo(() => getUnitMeta(form.quantityUnit), [form.quantityUnit]);
  const quantityParse = useMemo(
    () => parseToBaseUnits(form.quantityValue, unitMeta.scale, form.quantityUnit),
    [form.quantityValue, form.quantityUnit, unitMeta.scale]
  );

  const pricing = useMemo(() => {
    const perUnitValue = Number(form.pricePerUnit);
    const hasPrice = Number.isFinite(perUnitValue) && perUnitValue > 0;
    const rateAvailable = typeof ethInrRate === "number" && ethInrRate > 0;
    const hasQty = Number.isFinite(quantityParse.base) && Number(quantityParse.base) > 0;

    let perUnitEth: number | null = null;
    let perUnitInr: number | null = null;
    let perUnitEthStr: string | null = null;

    if (hasPrice) {
      if (form.priceCurrency === "INR") {
        perUnitInr = perUnitValue;
        if (rateAvailable) {
          perUnitEth = perUnitValue / ethInrRate;
          perUnitEthStr = perUnitEth.toFixed(18).replace(/\.?0+$/, "");
        }
      } else {
        perUnitEth = perUnitValue;
        perUnitEthStr = form.pricePerUnit.trim();
        if (rateAvailable) {
          perUnitInr = perUnitValue * ethInrRate;
        }
      }
    }

    let perUnitWei: bigint | null = null;
    if (perUnitEthStr) {
      try {
        perUnitWei = ethers.parseEther(perUnitEthStr);
      } catch {
        perUnitWei = null;
      }
    }

    let perBaseWei: bigint | null = null;
    let perBaseEth: string | null = null;
    if (perUnitWei !== null) {
      const scale = BigInt(unitMeta.scale);
      if (scale > 0n) {
        perBaseWei = perUnitWei / scale;
        perBaseEth = ethers.formatEther(perBaseWei);
      }
    }

    let totalWei: bigint | null = null;
    let totalEth: string | null = null;
    if (hasQty && perBaseWei !== null && quantityParse.base) {
      totalWei = perBaseWei * BigInt(quantityParse.base);
      totalEth = ethers.formatEther(totalWei);
    }

    const qtyValue = hasQty ? Number(quantityParse.base) / unitMeta.scale : 0;
    const totalInr = hasQty && perUnitInr !== null ? perUnitInr * qtyValue : null;
    const perBaseInr =
      perUnitInr !== null ? perUnitInr / unitMeta.scale : null;

    return {
      qtyValue,
      hasQty,
      hasPrice,
      rateAvailable,
      perUnitEth,
      perUnitEthStr,
      perUnitInr,
      perUnitWei,
      perBaseWei,
      perBaseEth,
      perBaseInr,
      totalEth,
      totalInr,
    };
  }, [form.pricePerUnit, form.priceCurrency, ethInrRate, quantityParse.base, unitMeta.scale]);

  const formatEth = (value: string | null) => {
    if (!value) return "-";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return numeric.toFixed(8);
  };
  const formatInr = (value: number | null) => (value === null ? "-" : value.toFixed(2));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setMessage("");

    if (!pricing.hasQty || !form.quantityUnit) {
      setStatus("error");
      setMessage(quantityParse.error || "Quantity and unit are required.");
      return;
    }

    if (!pricing.hasPrice) {
      setStatus("error");
      setMessage("Price per unit is required.");
      return;
    }

    if (form.priceCurrency === "INR" && !pricing.rateAvailable) {
      setStatus("error");
      setMessage("INR conversion rate unavailable. Set ETH_INR_RATE in the backend.");
      return;
    }

    if (!pricing.totalEth || !pricing.perBaseEth || !pricing.perBaseWei) {
      setStatus("error");
      setMessage("Unable to calculate per-base ETH price.");
      return;
    }

    const quantityLabel = `${formatQuantityValue(pricing.qtyValue)} ${form.quantityUnit}`;
    const payload = {
      name: form.name,
      category: form.category,
      quantity: quantityLabel,
      quantityValue: pricing.qtyValue,
      quantityUnit: form.quantityUnit,
      quantityBaseValue: quantityParse.base || undefined,
      quantityBaseUnit: unitMeta.baseUnit,
      unitScale: unitMeta.scale,
      priceEth: pricing.totalEth,
      pricePerUnitEth: pricing.perUnitEthStr || undefined,
      pricePerUnitInr: pricing.perUnitInr !== null ? formatInr(pricing.perUnitInr) : undefined,
      pricePerBaseUnitEth: pricing.perBaseEth || undefined,
      pricePerBaseUnitInr:
        pricing.perBaseInr !== null ? Number(pricing.perBaseInr.toFixed(6)).toString() : undefined,
      priceInr: pricing.totalInr !== null ? formatInr(pricing.totalInr) : undefined,
      priceCurrency: form.priceCurrency,
      harvestDate: form.harvestDate,
      expiryDate: form.expiryDate,
      storageType: form.storageType,
      description: form.description,
      imageUrl: form.imageUrl,
      imageUrls: form.imageUrls,
      certificateUrl: form.certificateUrl,
    };

    try {
      await api.createCrop(payload);
      setStatus("success");
      setMessage("Listing submitted. Await admin approval.");
      setForm({
        name: "",
        category: "Vegetables",
        quantityValue: "",
        quantityUnit: "kg",
        pricePerUnit: "",
        priceCurrency: "INR",
        harvestDate: "",
        expiryDate: "",
        storageType: "",
        description: "",
        imageUrl: "",
        imageUrls: [],
        certificateUrl: "",
      });
      setImageUploads([]);
      setCertificate(null);
      setImageError("");
      setCertError("");
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Failed to submit listing");
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingImages(true);
    setImageError("");

    try {
      const uploaded: UploadItem[] = [];
      for (const file of files) {
        const result = await api.uploadFile(file);
        if (result?.url) {
          uploaded.push({ name: file.name, url: result.url });
        }
      }

      if (uploaded.length > 0) {
        const combined = [...imageUploads, ...uploaded];
        setImageUploads(combined);
        const urls = combined.map((item) => item.url);
        setForm((prev) => ({
          ...prev,
          imageUrls: urls,
          imageUrl: urls[0] || "",
        }));
      }
    } catch (error: any) {
      setImageError(error.message || "Image upload failed");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleCertificateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCert(true);
    setCertError("");

    try {
      const result = await api.uploadFile(file);
      if (result?.url) {
        const item = { name: file.name, url: result.url };
        setCertificate(item);
        setForm((prev) => ({ ...prev, certificateUrl: item.url }));
      }
    } catch (error: any) {
      setCertError(error.message || "Certificate upload failed");
    } finally {
      setUploadingCert(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">New Listing</p>
        <h2 className="text-xl font-semibold mt-2">Submit Crop Details</h2>
        <p className="text-sm text-slate-400 mt-2">
          Data is stored in MongoDB first. Admin approval triggers the on-chain listing.
        </p>
      </div>

      <form className="hud-panel p-6 space-y-5" onSubmit={handleSubmit}>
        {status && (
          <div
            className={`rounded-sm border px-4 py-3 text-sm ${
              status === "success"
                ? "border-green-600 text-green-400 bg-green-950/50"
                : "border-rose-500/40 text-rose-200 bg-rose-500/10"
            }`}
          >
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="hud-label">Crop Name</label>
            <input
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              placeholder="Organic Basmati Rice"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>
          <div>
            <label className="hud-label">Category</label>
            <select
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="hud-label">Quantity</label>
            <input
              type="number"
              min="0"
              step={stepForScale(unitMeta.scale)}
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              placeholder="10"
              value={form.quantityValue}
              onChange={(e) => updateField("quantityValue", e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">
              1 {form.quantityUnit} = {unitMeta.scale} {unitMeta.baseUnit}. Smallest step {stepForScale(unitMeta.scale)} {form.quantityUnit}.
            </p>
            {quantityParse.error && (
              <p className="text-xs text-rose-200 mt-2">{quantityParse.error}</p>
            )}
          </div>
          <div>
            <label className="hud-label">Unit</label>
            <select
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              value={form.quantityUnit}
              onChange={(e) => updateField("quantityUnit", e.target.value)}
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="hud-label">Price per unit</label>
            <div className="mt-2 grid grid-cols-[1fr_120px] gap-3">
              <input
                type="number"
                min="0"
                step="0.0001"
                className="w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                placeholder={form.priceCurrency === "INR" ? "120" : "0.015"}
                value={form.pricePerUnit}
                onChange={(e) => updateField("pricePerUnit", e.target.value)}
              />
              <select
                className="bg-slate-950 border border-slate-700 rounded-sm px-3 py-3 text-sm"
                value={form.priceCurrency}
                onChange={(e) => updateField("priceCurrency", e.target.value)}
              >
                <option value="INR">INR</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-2">Per {form.quantityUnit}</p>
            {form.priceCurrency === "INR" && !pricing.rateAvailable && (
              <p className="text-xs text-amber-200 mt-2">Set ETH_INR_RATE in the backend to enable INR conversion.</p>
            )}
          </div>
          <div>
            <label className="hud-label">Harvest Date</label>
            <input
              type="date"
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              value={form.harvestDate}
              onChange={(e) => updateField("harvestDate", e.target.value)}
            />
          </div>
          <div>
            <label className="hud-label">Expiry Date</label>
            <input
              type="date"
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
              value={form.expiryDate}
              onChange={(e) => updateField("expiryDate", e.target.value)}
            />
          </div>
        </div>

        <div className="hud-card grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="hud-label">ETH/INR Rate</p>
            <p className="text-slate-200 mt-1">
              {pricing.rateAvailable ? `${ethInrRate?.toFixed(2)} INR per ETH` : "Not configured"}
            </p>
            {rateSource && pricing.rateAvailable && (
              <p className="text-xs text-slate-500 mt-1">Source: {rateSource}</p>
            )}
          </div>
          <div>
            <p className="hud-label">Per Unit</p>
            <p className="text-slate-200 mt-1">
              {formatInr(pricing.perUnitInr)} INR | {pricing.perUnitEth !== null ? pricing.perUnitEth.toFixed(8) : "-"} ETH
            </p>
          </div>
          <div>
            <p className="hud-label">Total Price</p>
            <p className="text-slate-200 mt-1">
              {formatInr(pricing.totalInr)} INR | {formatEth(pricing.totalEth)} ETH
            </p>
          </div>
        </div>

        <div>
          <label className="hud-label">Storage Type</label>
          <input
            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
            placeholder="Cold storage, humidity controlled"
            value={form.storageType}
            onChange={(e) => updateField("storageType", e.target.value)}
          />
        </div>
        <div>
          <label className="hud-label">Description</label>
          <textarea
            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
            rows={4}
            placeholder="Quality notes, certifications, logistics details."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-dashed border-slate-700/80 rounded-sm p-6 text-center">
            <label className="cursor-pointer block">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                disabled={uploadingImages}
              />
              <UploadSimple size={24} className="mx-auto text-slate-400" weight="duotone" />
              <p className="text-sm text-slate-300 mt-2">Upload crop images (multiple)</p>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">PNG, JPG · Max 10MB each</p>
            </label>
            {uploadingImages && <p className="text-xs text-blue-400 mt-2">Uploading images...</p>}
            {imageUploads.length > 0 && (
              <p className="text-xs text-slate-300 mt-2">{imageUploads.length} image(s) uploaded</p>
            )}
            {imageError && <p className="text-xs text-rose-200 mt-2">{imageError}</p>}
          </div>

          <div className="border border-dashed border-slate-700/80 rounded-sm p-6 text-center">
            <label className="cursor-pointer block">
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handleCertificateChange}
                disabled={uploadingCert}
              />
              <UploadSimple size={24} className="mx-auto text-slate-400" weight="duotone" />
              <p className="text-sm text-slate-300 mt-2">Upload compliance certificate (PDF)</p>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">PDF · Max 10MB</p>
            </label>
            {uploadingCert && <p className="text-xs text-blue-400 mt-2">Uploading certificate...</p>}
            {certificate && !uploadingCert && (
              <p className="text-xs text-slate-300 mt-2">Uploaded: {certificate.name}</p>
            )}
            {certError && <p className="text-xs text-rose-200 mt-2">{certError}</p>}
          </div>
        </div>

        <button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
          Submit for Admin Review
        </button>
      </form>
    </div>
  );
}
