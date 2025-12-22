const { createApp } = require("./app");

const PORT = process.env.PORT || 1337;

const app = createApp();
app.listen(PORT, () => {
  console.log(`Offset server running at http://localhost:${PORT}`);
  console.log(`GET  http://localhost:${PORT}/offsets`);
});
