const express = require("express");
const { globalLimiter, offsetsLimiter } = require("./middleware/rateLimiters");
const { createCacheStore } = require("./services/cacheStore");
const { createOffsetsService } = require("./services/offsetsService");
const { createIndexRouter } = require("./routes/index.routes");
const { createOffsetsRouter } = require("./routes/offsets.routes");

function createApp() {
  const app = express();

  app.use(globalLimiter);

  const cache = createCacheStore();
  const offsetsService = createOffsetsService(cache);

  app.use(createIndexRouter(offsetsService));
  app.use(createOffsetsRouter(offsetsService, offsetsLimiter));

  return app;
}

module.exports = { createApp };
