function createCacheStore() {
  return {
    payload: null,

    lastFetchAt: null,
    expiresAt: null,
    lastFetchMs: null,

    lastFetchStatus: "never", // "never" | "ok" | "error"
    lastError: null,

    fetchCount: 0,
    lastDurationMs: null,
  };
}

module.exports = { createCacheStore };
