import https from "https";

const COINBASE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=ETH";
const DEFAULT_CACHE_MS = 60000;

const cache = {
  rate: null,
  source: null,
  fetchedAt: 0,
};

function getCacheTtl() {
  const ttl = Number(process.env.ETH_RATE_CACHE_MS);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return DEFAULT_CACHE_MS;
  }
  return ttl;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "AgriChain/1.0" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Request failed with status ${res.statusCode || "unknown"}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error("Request timed out"));
    });
  });
}

function normalizeRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return rate;
}

export async function getEthInrRate() {
  const now = Date.now();
  const ttl = getCacheTtl();

  if (cache.rate && now - cache.fetchedAt < ttl) {
    return {
      rate: cache.rate,
      source: cache.source || "cache",
      cached: true,
      fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    };
  }

  try {
    const data = await fetchJson(COINBASE_URL);
    const rate = normalizeRate(data?.data?.rates?.INR);
    if (rate) {
      cache.rate = rate;
      cache.source = "coinbase";
      cache.fetchedAt = Date.now();
      return {
        rate,
        source: "coinbase",
        cached: false,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
      };
    }
  } catch (error) {
    console.warn("Live ETH/INR lookup failed:", error?.message || error);
  }

  const fallbackRate = normalizeRate(process.env.ETH_INR_RATE);
  if (fallbackRate) {
    return { rate: fallbackRate, source: "env", cached: false, fetchedAt: null };
  }

  return { rate: null, source: "unavailable", cached: false, fetchedAt: null };
}
