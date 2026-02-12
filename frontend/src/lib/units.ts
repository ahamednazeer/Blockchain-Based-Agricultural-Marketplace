export type UnitMeta = {
  unit: string;
  baseUnit: string;
  scale: number;
};

const UNIT_META: Record<string, UnitMeta> = {
  kg: { unit: "kg", baseUnit: "mg", scale: 1_000_000 },
  g: { unit: "g", baseUnit: "mg", scale: 1_000 },
  mg: { unit: "mg", baseUnit: "mg", scale: 1 },
  ton: { unit: "ton", baseUnit: "mg", scale: 1_000_000_000 },
  L: { unit: "L", baseUnit: "mL", scale: 1_000 },
  mL: { unit: "mL", baseUnit: "mL", scale: 1 },
  pcs: { unit: "pcs", baseUnit: "pcs", scale: 1 },
  box: { unit: "box", baseUnit: "box", scale: 1 },
  crate: { unit: "crate", baseUnit: "crate", scale: 1 },
};

export function getUnitMeta(unit: string): UnitMeta {
  if (unit && UNIT_META[unit]) {
    return UNIT_META[unit];
  }
  return { unit: unit || "unit", baseUnit: unit || "unit", scale: 1 };
}

export function stepForScale(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 1) {
    return "1";
  }
  const scaleStr = String(scale);
  if (/^1[0]+$/.test(scaleStr)) {
    return `0.${"0".repeat(scaleStr.length - 1)}1`;
  }
  const numeric = 1 / scale;
  return Number.isFinite(numeric) ? String(numeric) : "0.01";
}

export function formatQuantityValue(value: number, maxDecimals = 6): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, "");
}

export function parseToBaseUnits(value: string, scale: number, unitLabel = "unit") {
  const step = stepForScale(scale);
  const trimmed = value.trim();
  if (!trimmed) {
    return { base: null, baseBig: null, error: null, step };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { base: null, baseBig: null, error: "Enter a valid quantity.", step };
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const scaleBig = BigInt(scale);
  let baseBig = BigInt(whole || "0") * scaleBig;

  if (fraction) {
    const denom = 10n ** BigInt(fraction.length);
    if (scaleBig % denom !== 0n) {
      return {
        base: null,
        baseBig: null,
        error: `Use increments of ${step} ${unitLabel}.`,
        step,
      };
    }
    baseBig += BigInt(fraction) * (scaleBig / denom);
  }

  if (baseBig <= 0n) {
    return { base: null, baseBig: null, error: "Quantity must be greater than zero.", step };
  }

  if (baseBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { base: null, baseBig: null, error: "Quantity too large.", step };
  }

  return { base: Number(baseBig), baseBig, error: null, step };
}
