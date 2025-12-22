const { fetchJson } = require("./httpClient");
const { flattenDllMap, flattenClientJson } = require("../utils/flatten");
const { pickRequiredKeys } = require("../utils/pick");
const { nowIso } = require("../utils/time");
const { URLS, REQUIRED_KEYS, DEFAULTS, CACHE_TTL_MS } = require("../../config/constants");

function createOffsetsService(cache) {
  let inFlight = null;

  function msUntilExpiry() {
    if (!cache.lastFetchMs) return 0;
    const ageMs = Date.now() - cache.lastFetchMs;
    return Math.max(0, CACHE_TTL_MS - ageMs);
  }

  function cacheInfo() {
    const remainingMs = msUntilExpiry();
    return {
      ttlMs: CACHE_TTL_MS,
      status: cache.lastFetchStatus,
      fetchCount: cache.fetchCount,
      lastFetchAt: cache.lastFetchAt,
      expiresAt: cache.expiresAt,
      ageMs: cache.lastFetchMs ? Date.now() - cache.lastFetchMs : null,
      remainingMs,
      remainingSeconds: remainingMs != null ? Math.floor(remainingMs / 1000) : null,
      lastDurationMs: cache.lastDurationMs,
      lastError: cache.lastError,
    };
  }

  async function refreshCache() {
    const start = Date.now();
    try {
      const [offsetsRaw, clientDllRaw] = await Promise.all([
        fetchJson(URLS.offsets),
        fetchJson(URLS.clientDll),
      ]);

      const offsetsFlat = flattenDllMap(offsetsRaw);
      const clientFlat = flattenClientJson(clientDllRaw);

      const merged = { ...offsetsFlat, ...clientFlat };
      const { result, missingKeys } = pickRequiredKeys(merged, REQUIRED_KEYS, DEFAULTS);

      const fetchedAt = nowIso();
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

      cache.payload = {
        ok: true,
        timestamp: fetchedAt,
        offsets: result,
        missingKeys,
        cache: {},
      };

      cache.lastFetchAt = fetchedAt;
      cache.expiresAt = expiresAt;
      cache.lastFetchMs = Date.now();

      cache.lastFetchStatus = "ok";
      cache.lastError = null;
      cache.fetchCount += 1;
      cache.lastDurationMs = Date.now() - start;

      cache.payload.cache = cacheInfo();

      return cache.payload;
    } catch (err) {
      cache.lastFetchStatus = "error";
      cache.lastError = err?.message || String(err);
      cache.fetchCount += 1;
      cache.lastDurationMs = Date.now() - start;

      // Serve stale cache if available
      if (cache.payload) {
        return {
          ...cache.payload,
          ok: true,
          timestamp: nowIso(),
          stale: true,
          error: cache.lastError,
          cache: cacheInfo(),
        };
      }

      throw err;
    }
  }

  async function getPayloadWithCache() {
    if (cache.payload && cache.lastFetchMs && Date.now() - cache.lastFetchMs < CACHE_TTL_MS) {
      return {
        ...cache.payload,
        timestamp: nowIso(),
        cache: cacheInfo(),
      };
    }

    if (!inFlight) {
      inFlight = (async () => {
        try {
          return await refreshCache();
        } finally {
          inFlight = null;
        }
      })();
    }

    return await inFlight;
  }

  return { getPayloadWithCache, cacheInfo };
}

module.exports = { createOffsetsService };
