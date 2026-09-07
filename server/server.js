require("./loadEnv");
const { createApp } = require("./createApp");
const { readIntegrations } = require("./env");
const { connectMongo, mongoUriFromEnv } = require("./store");

const PORT = process.env.PORT || 5065;

async function start() {
  const uri = mongoUriFromEnv();
  if (uri) {
    await connectMongo(uri);
    console.log("MongoDB verbonden");
  } else {
    console.warn("Geen MONGODB_URI: issues worden niet in MongoDB bewaard");
  }

  const { github, codeberg } = readIntegrations();
  console.log(
    `GitHub: ${github.enabled ? "aan" : "uit"} · Codeberg: ${codeberg.enabled ? "aan" : "uit"}`
  );

  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Feedback-app op http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
