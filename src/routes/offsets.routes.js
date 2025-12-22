const express = require("express");
const { nowIso } = require("../utils/time");

function createOffsetsRouter(offsetsService, offsetsLimiter) {
  const router = express.Router();

  router.get("/offsets", offsetsLimiter, async (_req, res) => {
    try {
      const payload = await offsetsService.getPayloadWithCache();
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        ok: false,
        timestamp: nowIso(),
        error: err?.message || String(err),
        cache: offsetsService.cacheInfo(),
      });
    }
  });

  return router;
}

module.exports = { createOffsetsRouter };
