const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();

const URLS = {
  offsets: "https://raw.githubusercontent.com/a2x/cs2-dumper/refs/heads/main/output/offsets.json",
  clientDll: "https://raw.githubusercontent.com/a2x/cs2-dumper/refs/heads/main/output/client_dll.json",
};

const REQUIRED_KEYS = [
  "dwViewMatrix",
  "dwLocalPlayerPawn",
  "dwEntityList",
  "m_hPlayerPawn",
  "m_iHealth",
  "m_lifeState",
  "m_iTeamNum",
  "m_vOldOrigin",
  "m_pGameSceneNode",
  "m_modelState",
  "m_boneArray",
  "m_nodeToWorld",
  "m_sSanitizedPlayerName",
];

const DEFAULTS = {
  m_boneArray: 128,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again soon." },
});

const offsetsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Rate limit exceeded for /offsets." },
});

app.use(globalLimiter);

const http = axios.create({
  timeout: 15000,
  headers: { "User-Agent": "offset-server/1.0" },
});

const cache = {
  payload: null,

  lastFetchAt: null,
  expiresAt: null,
  lastFetchMs: null,

  lastFetchStatus: "never", // "never" | "ok" | "error"
  lastError: null,

  fetchCount: 0,
  lastDurationMs: null,
};

let inFlight = null;

async function fetchJson(url) {
  const res = await http.get(url);
  return res.data;
}

function flattenDllMap(obj) {
  const flat = {};
  for (const dll of Object.values(obj || {})) {
    if (dll && typeof dll === "object") Object.assign(flat, dll);
  }
  return flat;
}

function flattenClientJson(remoteData) {
  if (!remoteData || typeof remoteData !== "object") return {};
  if (!remoteData["client.dll"]) return {};

  const client = remoteData["client.dll"];
  if (!client || typeof client !== "object") return {};
  if (!client.classes || typeof client.classes !== "object") return {};

  const flat = {};
  for (const cls of Object.values(client.classes)) {
    if (cls?.fields && typeof cls.fields === "object") {
      Object.assign(flat, cls.fields);
    }
  }
  return flat;
}

function applyDefaults(resultObj, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in resultObj) || resultObj[k] == null) resultObj[k] = v;
  }
}

function pickRequiredKeys(merged) {
  const result = {};
  for (const key of REQUIRED_KEYS) {
    if (key in merged) result[key] = merged[key];
  }
  applyDefaults(result, DEFAULTS);

  const missingKeys = REQUIRED_KEYS.filter((k) => !(k in result));
  return { result, missingKeys };
}

function nowIso() {
  return new Date().toISOString();
}

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
    const { result, missingKeys } = pickRequiredKeys(merged);

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

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    timestamp: nowIso(),
    endpoints: {
      offsets: "/offsets",
      health: "/health",
    },
    cache: cacheInfo(),
  });
});

app.get("/offsets", offsetsLimiter, async (_req, res) => {
  try {
    const payload = await getPayloadWithCache();
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      ok: false,
      timestamp: nowIso(),
      error: err?.message || String(err),
      cache: cacheInfo(),
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: nowIso(), cache: cacheInfo() });
});

const PORT = process.env.PORT || 1337;
app.listen(PORT, () => {
  console.log(`Offset server running at http://localhost:${PORT}`);
  console.log(`GET  http://localhost:${PORT}/offsets`);
});
