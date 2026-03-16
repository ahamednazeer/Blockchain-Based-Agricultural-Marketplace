import Crop from "../models/Crop.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { generateGroqWasteRecommendations, isGroqEnabled } from "./groq.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const HOUR_MS = 1000 * 60 * 60;
const FORECAST_WINDOW_DAYS = Number(process.env.FORECAST_WINDOW_DAYS || 14);
const NEAR_EXPIRY_HOURS = Number(process.env.NEAR_EXPIRY_HOURS || 48);
const ALERT_WINDOW_HOURS = Number(process.env.ALERT_WINDOW_HOURS || 72);
const DVU_PER_ETH = Number(process.env.DVU_PER_ETH || 1000);
const RISK_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const MAX_ALERTS = 12;

function safeFloor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.floor(numeric);
}

function safeRound(value, precision = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(precision));
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function getRiskRank(risk) {
  return RISK_RANK[String(risk || "").toUpperCase()] || 0;
}

function linearRegressionForecast(points) {
  const n = points.length;
  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return Math.max(0, points[0]);
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = Number(points[i]) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return Math.max(0, sumY / n);
  }
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const forecast = slope * n + intercept;
  return Math.max(0, forecast);
}

export function computeFreshness(expiryDate, now = new Date()) {
  const expiry = normalizeDate(expiryDate);
  if (!expiry) {
    return { status: "EXPIRED", hoursRemaining: 0, daysRemaining: 0 };
  }
  const diffMs = expiry.getTime() - now.getTime();
  const hoursRemaining = Math.floor(diffMs / HOUR_MS);
  const daysRemaining = Math.ceil(diffMs / DAY_MS);
  if (diffMs <= 0) {
    return { status: "EXPIRED", hoursRemaining, daysRemaining };
  }
  if (hoursRemaining <= NEAR_EXPIRY_HOURS) {
    return { status: "NEAR_EXPIRY", hoursRemaining, daysRemaining };
  }
  return { status: "ACTIVE", hoursRemaining, daysRemaining };
}

function classifyWasteRisk({ listedBaseQty, predictedBaseDemand }) {
  const listed = Math.max(0, Number(listedBaseQty) || 0);
  const predicted = Math.max(0, Number(predictedBaseDemand) || 0);
  const surplus = listed - predicted;
  if (surplus <= 0) {
    return { risk: "LOW", surplusBaseQty: surplus, surplusRatio: 0 };
  }
  if (predicted <= 0) {
    return { risk: listed > 0 ? "HIGH" : "LOW", surplusBaseQty: surplus, surplusRatio: 1 };
  }
  const ratio = surplus / predicted;
  if (ratio <= 0.2) {
    return { risk: "LOW", surplusBaseQty: surplus, surplusRatio: ratio };
  }
  if (ratio <= 0.6) {
    return { risk: "MEDIUM", surplusBaseQty: surplus, surplusRatio: ratio };
  }
  return { risk: "HIGH", surplusBaseQty: surplus, surplusRatio: ratio };
}

function buildRecommendation({ freshnessStatus, risk, hoursRemaining, category }) {
  if (freshnessStatus === "EXPIRED") {
    return `Expired ${category} inventory: route to redistribution, feed use, or compost stream immediately.`;
  }
  if (risk === "HIGH" && hoursRemaining <= 48) {
    return `High waste risk for ${category}: apply 20-30% discount and promote same-day clearance.`;
  }
  if (risk === "HIGH") {
    return `High waste risk for ${category}: prioritize early-sale bundles and bulk buyer outreach.`;
  }
  if (risk === "MEDIUM" && hoursRemaining <= ALERT_WINDOW_HOURS) {
    return `Medium risk for ${category}: trigger time-bound discount and notify repeat buyers.`;
  }
  if (freshnessStatus === "NEAR_EXPIRY") {
    return `Near-expiry ${category}: prefer local delivery and quick-turn fulfillment windows.`;
  }
  return `Healthy ${category} inventory: maintain standard pricing and monitor daily demand trend.`;
}

function toBucketStart(date) {
  const bucket = new Date(date);
  bucket.setHours(0, 0, 0, 0);
  return bucket;
}

function buildDemandWindowQuery(lookbackStart, now = new Date()) {
  return {
    status: "CONFIRMED",
    $or: [
      { timestamp: { $gte: lookbackStart, $lte: now } },
      { timestamp: { $exists: false }, createdAt: { $gte: lookbackStart, $lte: now } },
      { timestamp: null, createdAt: { $gte: lookbackStart, $lte: now } },
    ],
  };
}

function isActiveListing(crop, now) {
  if (!crop || ["REJECTED", "SOLD"].includes(crop.status)) {
    return false;
  }
  const expiry = normalizeDate(crop.expiryDate);
  return Boolean(expiry && expiry > now);
}

function buildDemandSeriesByCategory(categories, transactions, lookbackStart) {
  const seriesByCategory = new Map();
  for (const category of categories) {
    seriesByCategory.set(category, new Array(FORECAST_WINDOW_DAYS).fill(0));
  }

  const dayZero = toBucketStart(lookbackStart).getTime();
  for (const tx of transactions) {
    const cropDoc = tx.cropId && typeof tx.cropId === "object" ? tx.cropId : null;
    const category = cropDoc?.category;
    if (!category || !seriesByCategory.has(category)) {
      continue;
    }

    const ts = normalizeDate(tx.timestamp || tx.createdAt);
    if (!ts) {
      continue;
    }

    const bucketIndex = Math.floor((toBucketStart(ts).getTime() - dayZero) / DAY_MS);
    if (bucketIndex < 0 || bucketIndex >= FORECAST_WINDOW_DAYS) {
      continue;
    }

    const baseUnits = safeFloor(tx.units) || 1;
    seriesByCategory.get(category)[bucketIndex] += baseUnits;
  }

  return seriesByCategory;
}

function buildCategoryCards({ categories, crops, txSeriesByCategory }) {
  return categories
    .map((category) => {
      const listedCrops = crops.filter((crop) => crop.category === category);
      const listedBaseQty = sum(listedCrops.map((crop) => safeFloor(crop.quantityBaseValue)));
      const points = txSeriesByCategory.get(category) || [];
      const observedBaseDemand = sum(points);
      const averageDemand = points.length ? observedBaseDemand / points.length : 0;
      const regressionDemand = linearRegressionForecast(points);
      const predictedBaseDemand = Math.max(
        0,
        Math.round((averageDemand + regressionDemand) / 2)
      );
      const gapBaseQty = listedBaseQty - predictedBaseDemand;
      const riskInfo = classifyWasteRisk({ listedBaseQty, predictedBaseDemand });
      const demandCoverageDays =
        predictedBaseDemand > 0 ? Math.ceil((listedBaseQty / predictedBaseDemand) * FORECAST_WINDOW_DAYS) : null;

      return {
        category,
        listedBaseQty,
        forecast: {
          averageBaseDemand: safeRound(averageDemand),
          regressionBaseDemand: safeRound(regressionDemand),
          predictedBaseDemand,
          observedBaseDemand,
          sampleDays: points.length,
        },
        gapBaseQty,
        demandCoverageDays,
        risk: riskInfo.risk,
        surplusBaseQty: riskInfo.surplusBaseQty,
        surplusRatio: safeRound(riskInfo.surplusRatio, 3),
      };
    })
    .sort((a, b) => {
      const riskDiff = getRiskRank(b.risk) - getRiskRank(a.risk);
      if (riskDiff !== 0) {
        return riskDiff;
      }
      return b.surplusBaseQty - a.surplusBaseQty;
    });
}

function getStorageDurationDays(crop, now) {
  const baseline = normalizeDate(crop?.harvestDate || crop?.createdAt);
  if (!baseline) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - baseline.getTime()) / DAY_MS));
}

function computeSpoilageIndicator({
  freshnessStatus,
  hoursRemaining,
  freshnessPeriodDays,
  storageDurationDays,
  wasteRisk,
}) {
  let score = 0;
  const spoilageSignals = [];

  if (freshnessStatus === "EXPIRED") {
    score += 4;
    spoilageSignals.push("expired");
  } else if (freshnessStatus === "NEAR_EXPIRY") {
    score += 2;
    spoilageSignals.push("near_expiry");
  }

  if (Number.isFinite(hoursRemaining) && hoursRemaining <= ALERT_WINDOW_HOURS) {
    score += 1;
    spoilageSignals.push("alert_window");
  }

  const freshnessDays = safeFloor(freshnessPeriodDays);
  let freshnessUsedPct = null;
  if (freshnessDays > 0) {
    freshnessUsedPct = Math.min(100, safeRound((storageDurationDays / freshnessDays) * 100, 1));
    if (storageDurationDays >= freshnessDays) {
      score += 2;
      spoilageSignals.push("freshness_window_exhausted");
    } else if (storageDurationDays / freshnessDays >= 0.75) {
      score += 1;
      spoilageSignals.push("freshness_window_low");
    }
  }

  if (wasteRisk === "HIGH") {
    score += 1;
    spoilageSignals.push("surplus_pressure");
  } else if (wasteRisk === "MEDIUM") {
    score += 0.5;
    spoilageSignals.push("surplus_watch");
  }

  const spoilageIndicator = score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";

  return {
    spoilageIndicator,
    spoilageScore: safeRound(score, 1),
    spoilageSignals,
    freshnessUsedPct,
  };
}

function buildFreshnessRows(crops, now, categoryCards) {
  const riskByCategory = new Map(categoryCards.map((card) => [card.category, card.risk]));

  return crops.map((crop) => {
    const freshness = computeFreshness(crop.expiryDate, now);
    const wasteRisk = riskByCategory.get(crop.category) || "LOW";
    const storageDurationDays = getStorageDurationDays(crop, now);
    const spoilage = computeSpoilageIndicator({
      freshnessStatus: freshness.status,
      hoursRemaining: freshness.hoursRemaining,
      freshnessPeriodDays: crop.freshnessPeriodDays,
      storageDurationDays,
      wasteRisk,
    });
    const severity =
      freshness.status === "EXPIRED"
        ? "HIGH"
        : freshness.status === "NEAR_EXPIRY"
          ? "MEDIUM"
          : spoilage.spoilageIndicator === "HIGH"
            ? "MEDIUM"
            : "LOW";

    return {
      cropId: crop._id,
      cropName: crop.name,
      category: crop.category,
      status: crop.status,
      freshnessStatus: freshness.status,
      hoursRemaining: freshness.hoursRemaining,
      daysRemaining: freshness.daysRemaining,
      expiryDate: crop.expiryDate,
      freshnessPeriodDays: safeFloor(crop.freshnessPeriodDays),
      storageDurationDays,
      wasteRisk,
      severity,
      alert:
        freshness.status !== "ACTIVE" || freshness.hoursRemaining <= ALERT_WINDOW_HOURS,
      recommendation: buildRecommendation({
        freshnessStatus: freshness.status,
        risk: wasteRisk,
        hoursRemaining: freshness.hoursRemaining,
        category: crop.category || "crop",
      }),
      ...spoilage,
    };
  });
}

function buildFreshnessSummary(rows) {
  return rows.reduce(
    (acc, row) => {
      acc[row.freshnessStatus] = (acc[row.freshnessStatus] || 0) + 1;
      return acc;
    },
    { ACTIVE: 0, NEAR_EXPIRY: 0, EXPIRED: 0 }
  );
}

function buildExpiryAlerts(freshnessRows) {
  return freshnessRows
    .filter((row) => row.alert)
    .map((row) => ({
      alertType: "EXPIRY",
      alertCode: row.freshnessStatus === "EXPIRED" ? "EXPIRED_STOCK" : "NEAR_EXPIRY_STOCK",
      cropId: row.cropId,
      cropName: row.cropName,
      category: row.category,
      freshnessStatus: row.freshnessStatus,
      severity: row.severity,
      hoursRemaining: row.hoursRemaining,
      daysRemaining: row.daysRemaining,
      spoilageIndicator: row.spoilageIndicator,
      message:
        row.freshnessStatus === "EXPIRED"
          ? `${row.cropName} is expired. Stop sale and trigger salvage flow.`
          : `${row.cropName} expires in ${Math.max(0, row.hoursRemaining)} hour(s).`,
      recommendation: row.recommendation,
    }));
}

function buildSurplusAlerts(categoryCards) {
  return categoryCards
    .filter((card) => card.surplusBaseQty > 0 && getRiskRank(card.risk) >= getRiskRank("MEDIUM"))
    .map((card) => ({
      alertType: "SURPLUS",
      alertCode: "SURPLUS_STOCK",
      cropId: null,
      cropName: `${card.category} inventory`,
      category: card.category,
      freshnessStatus: null,
      severity: card.risk,
      hoursRemaining: null,
      daysRemaining: null,
      spoilageIndicator: card.risk,
      risk: card.risk,
      listedBaseQty: card.listedBaseQty,
      predictedBaseDemand: card.forecast.predictedBaseDemand,
      surplusBaseQty: card.surplusBaseQty,
      surplusRatio: card.surplusRatio,
      message: `${card.category} has surplus stock: ${card.listedBaseQty} listed vs ${card.forecast.predictedBaseDemand} predicted demand over ${FORECAST_WINDOW_DAYS} days.`,
      recommendation: buildRecommendation({
        freshnessStatus: "ACTIVE",
        risk: card.risk,
        hoursRemaining: ALERT_WINDOW_HOURS,
        category: card.category,
      }),
    }));
}

function sortAlerts(alerts) {
  return alerts
    .slice()
    .sort((a, b) => {
      const severityDiff = getRiskRank(b.severity) - getRiskRank(a.severity);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const aIsExpiry = a.alertType === "EXPIRY";
      const bIsExpiry = b.alertType === "EXPIRY";
      if (aIsExpiry && bIsExpiry) {
        return (a.hoursRemaining ?? Number.POSITIVE_INFINITY) - (b.hoursRemaining ?? Number.POSITIVE_INFINITY);
      }
      if (aIsExpiry !== bIsExpiry) {
        return aIsExpiry ? -1 : 1;
      }

      return (b.surplusBaseQty || 0) - (a.surplusBaseQty || 0);
    })
    .slice(0, MAX_ALERTS);
}

function buildAlertSummary(alerts) {
  return alerts.reduce(
    (acc, alert) => {
      acc.total += 1;
      acc[alert.alertType === "SURPLUS" ? "surplus" : "expiry"] += 1;
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    },
    { total: 0, expiry: 0, surplus: 0, LOW: 0, MEDIUM: 0, HIGH: 0 }
  );
}

function getHighestRisk(categoryCards) {
  return categoryCards.reduce(
    (result, card) => {
      const rank = getRiskRank(card.risk);
      if (rank > result.rank) {
        return { rank, risk: card.risk };
      }
      return result;
    },
    { rank: 0, risk: "LOW" }
  );
}

function buildFallbackRecommendations(alerts, categoryCards) {
  return Array.from(
    new Set(
      [
        ...alerts.map((alert) => alert.recommendation).filter(Boolean),
        ...categoryCards.slice(0, 4).map((item) =>
          buildRecommendation({
            freshnessStatus: "ACTIVE",
            risk: item.risk,
            hoursRemaining: ALERT_WINDOW_HOURS,
            category: item.category,
          })
        ),
      ].filter(Boolean)
    )
  ).slice(0, 6);
}

async function generateRecommendations(scope, summary, categoryCards, alerts) {
  const groqRecommendations = await generateGroqWasteRecommendations({
    scope,
    summary,
    categories: categoryCards.slice(0, 6).map((item) => ({
      category: item.category,
      risk: item.risk,
      listedBaseQty: item.listedBaseQty,
      predictedBaseDemand: item.forecast?.predictedBaseDemand || 0,
      surplusBaseQty: item.surplusBaseQty,
    })),
    alerts: alerts.slice(0, 6).map((alert) => ({
      cropName: alert.cropName,
      category: alert.category,
      alertType: alert.alertType,
      freshnessStatus: alert.freshnessStatus,
      severity: alert.severity,
      hoursRemaining: alert.hoursRemaining,
      surplusBaseQty: alert.surplusBaseQty,
    })),
  });

  return {
    recommendations:
      groqRecommendations.length > 0
        ? groqRecommendations
        : buildFallbackRecommendations(alerts, categoryCards),
    recommendationEngine:
      groqRecommendations.length > 0 && isGroqEnabled() ? "GROQ" : "RULE_BASED",
  };
}

async function loadDemandTransactions(lookbackStart) {
  return Transaction.find(buildDemandWindowQuery(lookbackStart)).populate(
    "cropId",
    "name category farmerPincode quantityBaseUnit"
  );
}

export function toDvu(valueEth) {
  const eth = Number(valueEth || 0);
  if (!Number.isFinite(eth) || eth <= 0) {
    return 0;
  }
  return Math.round(eth * DVU_PER_ETH);
}

export async function buildFarmerWasteInsights(userId) {
  const now = new Date();
  const farmer = await User.findById(userId).select("dvuBalance");
  if (!farmer) {
    return null;
  }

  const farmerCrops = await Crop.find({ farmerId: userId }).sort({ createdAt: -1 });
  const activeInventory = farmerCrops.filter((crop) => isActiveListing(crop, now));
  const categories = Array.from(new Set(activeInventory.map((crop) => crop.category).filter(Boolean)));

  const lookbackStart = new Date(now.getTime() - FORECAST_WINDOW_DAYS * DAY_MS);
  const relatedMarketTx = await loadDemandTransactions(lookbackStart);
  const txSeriesByCategory = buildDemandSeriesByCategory(
    categories,
    relatedMarketTx,
    lookbackStart
  );
  const categoryCards = buildCategoryCards({
    categories,
    crops: activeInventory,
    txSeriesByCategory,
  });

  const monitorableCrops = farmerCrops.filter((crop) => !["SOLD", "REJECTED"].includes(crop.status));
  const freshnessRows = buildFreshnessRows(monitorableCrops, now, categoryCards);
  const freshnessSummary = buildFreshnessSummary(freshnessRows);
  const alerts = sortAlerts([
    ...buildExpiryAlerts(freshnessRows),
    ...buildSurplusAlerts(categoryCards),
  ]);
  const alertSummary = buildAlertSummary(alerts);
  const highestRisk = getHighestRisk(categoryCards);
  const { recommendations, recommendationEngine } = await generateRecommendations(
    "farmer",
    {
      wasteRisk: highestRisk.risk,
      dvuBalance: safeFloor(farmer.dvuBalance),
      freshness: freshnessSummary,
      alertSummary,
      forecastWindowDays: FORECAST_WINDOW_DAYS,
    },
    categoryCards,
    alerts
  );

  return {
    generatedAt: now.toISOString(),
    dvuBalance: safeFloor(farmer.dvuBalance),
    forecastWindowDays: FORECAST_WINDOW_DAYS,
    freshness: freshnessSummary,
    alertSummary,
    alerts,
    recommendations,
    recommendationEngine,
    categories: categoryCards,
    wasteRisk: highestRisk.risk,
  };
}

export async function buildMarketplaceWasteInsights() {
  const now = new Date();
  const activeCrops = await Crop.find({ status: "APPROVED", expiryDate: { $gt: now } });
  const categories = Array.from(new Set(activeCrops.map((crop) => crop.category).filter(Boolean)));

  const lookbackStart = new Date(now.getTime() - FORECAST_WINDOW_DAYS * DAY_MS);
  const relatedMarketTx = await loadDemandTransactions(lookbackStart);
  const txSeriesByCategory = buildDemandSeriesByCategory(
    categories,
    relatedMarketTx,
    lookbackStart
  );
  const categoryCards = buildCategoryCards({
    categories,
    crops: activeCrops,
    txSeriesByCategory,
  });

  const freshnessRows = buildFreshnessRows(activeCrops, now, categoryCards);
  const freshnessSummary = buildFreshnessSummary(freshnessRows);
  const alerts = sortAlerts([
    ...buildExpiryAlerts(freshnessRows),
    ...buildSurplusAlerts(categoryCards),
  ]);
  const alertSummary = buildAlertSummary(alerts);

  const summary = {
    activeListings: activeCrops.length,
    nearExpiry: freshnessSummary.NEAR_EXPIRY,
    highRiskCategories: categoryCards.filter((item) => item.risk === "HIGH").length,
    mediumRiskCategories: categoryCards.filter((item) => item.risk === "MEDIUM").length,
    lowRiskCategories: categoryCards.filter((item) => item.risk === "LOW").length,
    expiryAlerts: alertSummary.expiry,
    surplusAlerts: alertSummary.surplus,
  };

  const { recommendations, recommendationEngine } = await generateRecommendations(
    "marketplace",
    {
      ...summary,
      alertSummary,
      forecastWindowDays: FORECAST_WINDOW_DAYS,
    },
    categoryCards,
    alerts
  );

  return {
    generatedAt: now.toISOString(),
    forecastWindowDays: FORECAST_WINDOW_DAYS,
    freshness: freshnessSummary,
    alertSummary,
    summary,
    categories: categoryCards,
    alerts,
    recommendations,
    recommendationEngine,
  };
}

export async function buildWasteDatasets(limit = 300) {
  const now = new Date();
  const normalizedLimit = Math.min(1000, Math.max(50, Number(limit || 300)));
  const lookbackStart = new Date(now.getTime() - FORECAST_WINDOW_DAYS * DAY_MS);

  const [transactions, crops, users] = await Promise.all([
    Transaction.find({ status: "CONFIRMED" })
      .populate("cropId", "name category farmerPincode quantityBaseUnit")
      .sort({ createdAt: -1 })
      .limit(normalizedLimit),
    Crop.find().sort({ createdAt: -1 }).limit(normalizedLimit),
    User.find().sort({ createdAt: -1 }).limit(normalizedLimit),
  ]);

  const activeCrops = crops.filter((crop) => isActiveListing(crop, now));
  const categories = Array.from(new Set(activeCrops.map((crop) => crop.category).filter(Boolean)));
  const demandTransactions = transactions.filter((tx) => {
    const ts = normalizeDate(tx.timestamp || tx.createdAt);
    return Boolean(ts && ts >= lookbackStart && ts <= now);
  });
  const txSeriesByCategory = buildDemandSeriesByCategory(
    categories,
    demandTransactions,
    lookbackStart
  );
  const categoryCards = buildCategoryCards({
    categories,
    crops: activeCrops,
    txSeriesByCategory,
  });
  const riskByCategory = new Map(categoryCards.map((card) => [card.category, card.risk]));
  const freshnessRows = buildFreshnessRows(crops, now, categoryCards);
  const freshnessByCropId = new Map(freshnessRows.map((row) => [String(row.cropId), row]));
  const alerts = sortAlerts([
    ...buildExpiryAlerts(freshnessRows),
    ...buildSurplusAlerts(categoryCards),
  ]);
  const alertSummary = buildAlertSummary(alerts);
  const activeListingCounts = crops.reduce((acc, crop) => {
    const key = String(crop.farmerId || "");
    if (!key || !isActiveListing(crop, now)) {
      return acc;
    }
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const historicalDemand = transactions.map((tx) => {
    const crop = tx.cropId && typeof tx.cropId === "object" ? tx.cropId : null;
    const date = tx.timestamp || tx.createdAt;
    const buyerRegion =
      tx.shippingAddress?.postalCode || tx.shippingAddress?.city || "UNKNOWN";
    const farmerRegion = crop?.farmerPincode || "UNKNOWN";

    return {
      txId: tx._id,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
      crop: crop?.name || tx.cropName || "Unknown",
      category: crop?.category || "Unknown",
      region: buyerRegion,
      buyerRegion,
      farmerRegion,
      quantity: Number(tx.units || 1),
      quantityUnit: crop?.quantityBaseUnit || "base_unit",
      hyperlocalMatch: buyerRegion !== "UNKNOWN" && buyerRegion === farmerRegion,
    };
  });

  const productListings = crops.map((crop) => {
    const freshness = freshnessByCropId.get(String(crop._id));
    return {
      cropId: crop._id,
      cropType: crop.name,
      category: crop.category,
      quantityBaseValue: Number(crop.quantityBaseValue || 0),
      quantityBaseUnit: crop.quantityBaseUnit || "base_unit",
      listingDate: crop.createdAt,
      freshnessPeriodDays: Number(crop.freshnessPeriodDays || 0),
      freshnessStatus: freshness?.freshnessStatus || "EXPIRED",
      wasteRisk: riskByCategory.get(crop.category) || "LOW",
      spoilageIndicator: freshness?.spoilageIndicator || "LOW",
      freshnessUsedPct: freshness?.freshnessUsedPct ?? null,
      farmerPincode: crop.farmerPincode,
      qualityGrade: crop.qualityGrade || "B",
    };
  });

  const expiryFreshness = freshnessRows.map((row) => ({
    cropId: row.cropId,
    cropType: row.cropName,
    category: row.category,
    expiryDate: row.expiryDate,
    freshnessStatus: row.freshnessStatus,
    hoursRemaining: row.hoursRemaining,
    daysRemaining: row.daysRemaining,
    storageDurationDays: row.storageDurationDays,
    freshnessPeriodDays: row.freshnessPeriodDays,
    freshnessUsedPct: row.freshnessUsedPct,
    spoilageIndicator: row.spoilageIndicator,
    spoilageScore: row.spoilageScore,
    spoilageSignals: row.spoilageSignals,
    wasteRisk: row.wasteRisk,
  }));

  const geoLocations = users.map((user) => ({
    userId: user._id,
    role: user.role,
    walletAddress: user.walletAddress,
    pincode: user.pincode,
    lat: Number(user.geoLocation?.lat || 0) || null,
    lng: Number(user.geoLocation?.lng || 0) || null,
    hasCoordinates: Boolean(
      Number.isFinite(Number(user.geoLocation?.lat)) &&
        Number.isFinite(Number(user.geoLocation?.lng))
    ),
    activeListings: activeListingCounts.get(String(user._id)) || 0,
  }));

  return {
    generatedAt: now.toISOString(),
    summary: {
      demandRows: historicalDemand.length,
      listingRows: productListings.length,
      geoRows: geoLocations.length,
      nearExpiry: freshnessRows.filter((row) => row.freshnessStatus === "NEAR_EXPIRY").length,
      expired: freshnessRows.filter((row) => row.freshnessStatus === "EXPIRED").length,
      highSpoilage: freshnessRows.filter((row) => row.spoilageIndicator === "HIGH").length,
      highRiskCategories: categoryCards.filter((item) => item.risk === "HIGH").length,
      expiryAlerts: alertSummary.expiry,
      surplusAlerts: alertSummary.surplus,
    },
    alerts,
    historicalDemand,
    productListings,
    expiryFreshness,
    geoLocations,
  };
}
