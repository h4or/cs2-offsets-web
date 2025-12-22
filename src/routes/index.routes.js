const express = require("express");
const { nowIso } = require("../utils/time");

function createIndexRouter(offsetsService) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({
      ok: true,
      timestamp: nowIso(),
      endpoints: {
        offsets: "/offsets",
      },
      cache: offsetsService.cacheInfo(),
    });
  });

  return router;
}

module.exports = { createIndexRouter };
