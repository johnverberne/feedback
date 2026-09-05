require("./loadEnv");
const { createApp } = require("./createApp");

const PORT = process.env.PORT || 5065;
const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Feedback-app op http://localhost:${PORT}`);
});

module.exports = { app };
