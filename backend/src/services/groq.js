const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim();
const GROQ_API_URL = String(process.env.GROQ_API_URL || DEFAULT_GROQ_API_URL).trim();
const GROQ_TIMEOUT_MS = Math.max(1000, Number(process.env.GROQ_TIMEOUT_MS || 3500));
const GROQ_RECOMMENDATION_CACHE_MS = Math.max(
  60 * 1000,
  Number(process.env.GROQ_RECOMMENDATION_CACHE_MS || 5 * 60 * 1000)
);
const GROQ_LOG_ERRORS = String(process.env.GROQ_LOG_ERRORS || "").toLowerCase() === "true";

const recommendationCache = new Map();

function dedupe(values) {
  return Array.from(new Set(values));
}

function cleanLine(value) {
  return String(value || "")
    .replace(/^\s*[-*•\d.)]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRecommendationArray(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return dedupe(
    items
      .map((item) => cleanLine(item))
      .filter((item) => item.length >= 8 && item.length <= 220)
      .slice(0, 6)
  );
}

function tryParseJson(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    // Continue with substring parsing.
  }

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const objectSlice = text.slice(objectStart, objectEnd + 1);
    try {
      return JSON.parse(objectSlice);
    } catch {
      // Continue with array parsing.
    }
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const arraySlice = text.slice(arrayStart, arrayEnd + 1);
    try {
      return JSON.parse(arraySlice);
    } catch {
      return null;
    }
  }

  return null;
}

function extractRecommendations(rawContent) {
  const parsed = tryParseJson(rawContent);
  if (Array.isArray(parsed)) {
    return normalizeRecommendationArray(parsed);
  }
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.recommendations)) {
      return normalizeRecommendationArray(parsed.recommendations);
    }
    if (Array.isArray(parsed.tips)) {
      return normalizeRecommendationArray(parsed.tips);
    }
  }

  return normalizeRecommendationArray(
    String(rawContent || "")
      .split(/\r?\n/)
      .map((line) => cleanLine(line))
  );
}

function getCachedRecommendations(cacheKey) {
  const cached = recommendationCache.get(cacheKey);
  if (!cached) {
    return [];
  }
  if (cached.expiresAt < Date.now()) {
    recommendationCache.delete(cacheKey);
    return [];
  }
  return Array.isArray(cached.value) ? cached.value : [];
}

function setCachedRecommendations(cacheKey, recommendations) {
  if (recommendationCache.size > 500) {
    recommendationCache.clear();
  }
  recommendationCache.set(cacheKey, {
    value: recommendations,
    expiresAt: Date.now() + GROQ_RECOMMENDATION_CACHE_MS,
  });
}

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 380,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (GROQ_LOG_ERRORS) {
        console.warn(`Groq request failed with status ${response.status}`);
      }
      return "";
    }

    const payload = await response.json();
    return String(payload?.choices?.[0]?.message?.content || "").trim();
  } catch (error) {
    if (GROQ_LOG_ERRORS) {
      console.warn("Groq request error:", error?.message || error);
    }
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

export function isGroqEnabled() {
  return Boolean(GROQ_API_KEY);
}

export function getGroqModel() {
  return GROQ_MODEL;
}

export async function generateGroqWasteRecommendations(context) {
  if (!isGroqEnabled()) {
    return [];
  }

  const payload = {
    scope: context?.scope || "marketplace",
    summary: context?.summary || {},
    categories: Array.isArray(context?.categories) ? context.categories.slice(0, 6) : [],
    alerts: Array.isArray(context?.alerts) ? context.alerts.slice(0, 6) : [],
  };

  const cacheKey = `waste:${JSON.stringify(payload)}`;
  const cached = getCachedRecommendations(cacheKey);
  if (cached.length) {
    return cached;
  }

  const messages = [
    {
      role: "system",
      content:
        "You optimize agricultural marketplace operations. Return only JSON with key recommendations as an array of concise actions (max 6).",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Generate actionable waste-mitigation recommendations.",
        constraints: [
          "Focus on discounting, hyperlocal routing, redistribution, and freshness-sensitive logistics.",
          "Each recommendation must be one short sentence.",
        ],
        data: payload,
        output: { recommendations: ["string"] },
      }),
    },
  ];

  const content = await callGroq(messages);
  const recommendations = extractRecommendations(content);
  if (recommendations.length) {
    setCachedRecommendations(cacheKey, recommendations);
  }
  return recommendations;
}

export async function generateGroqResourceTips(context) {
  if (!isGroqEnabled()) {
    return [];
  }

  const payload = {
    category: context?.category || "General",
    storageGuidelines: Array.isArray(context?.storageGuidelines)
      ? context.storageGuidelines.slice(0, 6)
      : [],
    recommendedEquipment: Array.isArray(context?.recommendedEquipment)
      ? context.recommendedEquipment.slice(0, 6)
      : [],
  };

  const cacheKey = `resources:${JSON.stringify(payload)}`;
  const cached = getCachedRecommendations(cacheKey);
  if (cached.length) {
    return cached;
  }

  const messages = [
    {
      role: "system",
      content:
        "You are a farm operations assistant. Return only JSON with key tips as an array named tips, max 6 concise items.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Generate practical farm storage and handling tips.",
        constraints: [
          "Use only information grounded in the provided context.",
          "Prioritize low-cost, high-impact actions.",
          "Each tip must be one short sentence.",
        ],
        data: payload,
        output: { tips: ["string"] },
      }),
    },
  ];

  const content = await callGroq(messages);
  const tips = extractRecommendations(content);
  if (tips.length) {
    setCachedRecommendations(cacheKey, tips);
  }
  return tips;
}
