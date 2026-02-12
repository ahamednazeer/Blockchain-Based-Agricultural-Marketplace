import { formatQuantityValue } from "./units";

export function formatQuantity(crop: any) {
  const unit = crop?.quantityUnit || crop?.baseUnit || "";
  const value = Number(crop?.quantityValue);
  if (Number.isFinite(value) && value > 0) {
    return `${formatQuantityValue(value)}${unit ? ` ${unit}` : ""}`;
  }

  const baseValue = Number(crop?.quantityBaseValue);
  const scale = Number(crop?.unitScale);
  if (Number.isFinite(baseValue) && baseValue > 0 && Number.isFinite(scale) && scale > 0) {
    const display = baseValue / scale;
    return `${formatQuantityValue(display)}${unit ? ` ${unit}` : ""}`;
  }

  if (crop?.quantity) {
    return String(crop.quantity);
  }
  return "-";
}

export function formatPriceTotal(crop: any) {
  if (crop?.priceEth) {
    return `${crop.priceEth} ETH`;
  }
  if (crop?.price) {
    return String(crop.price);
  }
  return "-";
}

export function formatPricePerUnit(crop: any) {
  const unit = crop?.quantityUnit || crop?.priceUnit || "";
  const parts: string[] = [];

  if (crop?.pricePerUnitInr) {
    parts.push(`${crop.pricePerUnitInr} INR${unit ? ` / ${unit}` : ""}`);
  }
  if (crop?.pricePerUnitEth) {
    parts.push(`${crop.pricePerUnitEth} ETH${unit ? ` / ${unit}` : ""}`);
  }

  if (parts.length === 0) {
    return "-";
  }

  return parts.join(" | ");
}

export function formatPriceSummary(crop: any) {
  const perUnit = formatPricePerUnit(crop);
  const total = formatPriceTotal(crop);

  if (perUnit !== "-" && total !== "-") {
    return `${perUnit} (Total ${total})`;
  }

  if (perUnit !== "-") {
    return perUnit;
  }

  return total;
}

export function resolveAssetUrl(path?: string) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${base}${path}`;
}
