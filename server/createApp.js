const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { parseFormMarkdown, validateAnswers } = require("./formParser");
const { buildIssueMarkdown, issueTitle } = require("./issueMarkdown");
const { createSessionStore } = require("./sessions");
const { createFeedbackIssue } = require("./github");

function loadForm(formPath) {
  const markdown = fs.readFileSync(formPath, "utf8");
  return { markdown, form: parseFormMarkdown(markdown) };
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLabels(value) {
  const labels = String(value || "feedback")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return labels.length ? labels : ["feedback"];
}

function createApp(options = {}) {
  const root = options.root || path.join(__dirname, "..");
  const formPath = options.formPath || path.join(root, "forms", "default.md");
  const dataDir = options.dataDir || path.join(root, "data");
  const clientDist = path.join(root, "client", "dist");
  const hasClient = fs.existsSync(path.join(clientDist, "index.html"));
  const allowNoClient =
    options.allowNoClient === true || process.env.ALLOW_NO_CLIENT === "true";

  if (!hasClient && !allowNoClient) {
    throw new Error("Client-build ontbreekt in client/dist. Draai: npm run build");
  }

  const { form } = loadForm(formPath);
  const sessions = createSessionStore(dataDir);
  const publicUrl = (options.publicUrl || process.env.PUBLIC_URL || "").replace(
    /\/$/,
    ""
  );
  const githubRepo =
    options.githubRepo || process.env.GITHUB_REPO || "johnverberne/projects-captainjohn";
  const githubToken = options.githubToken || process.env.GITHUB_TOKEN || "";
  const githubLabels = parseLabels(options.githubLabels || process.env.GITHUB_LABELS);
  const projectNumber =
    options.githubProjectNumber || process.env.GITHUB_PROJECT_NUMBER || "";
  const allowedOrigins = parseOrigins(
    options.allowedOrigins || process.env.ALLOWED_ORIGINS
  );

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: "15mb" }));

  function screenshotPublicUrl(req, id) {
    const base = publicUrl || `${req.protocol}://${req.get("host")}`;
    return `${base}/api/screenshots/${id}.png`;
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      form: form.title,
      github: Boolean(githubToken),
      repo: githubRepo,
    });
  });

  app.get("/api/form", (_req, res) => {
    res.json(form);
  });

  app.post("/api/intake", (req, res) => {
    const session = sessions.create(req.body || {});
    res.status(201).json({
      id: session.id,
      hasScreenshot: session.hasScreenshot,
    });
  });

  app.get("/api/sessions/:id", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Sessie verlopen of onbekend" });
    }
    res.json({
      ...session,
      form,
      screenshotUrl: session.hasScreenshot
        ? screenshotPublicUrl(req, session.id)
        : null,
    });
  });

  app.get("/api/screenshots/:file", (req, res) => {
    const id = String(req.params.file || "").replace(/\.png$/i, "");
    const file = sessions.screenshotPath(id);
    if (!file) return res.status(404).json({ error: "Screenshot niet gevonden" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(path.resolve(file));
  });

  app.post("/api/sessions/:id/submit", async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Sessie verlopen of onbekend" });
    }
    const checked = validateAnswers(form, req.body?.answers);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.errors.join(" · "), errors: checked.errors });
    }

    const screenshotUrl = session.hasScreenshot
      ? screenshotPublicUrl(req, session.id)
      : null;

    try {
      const screenshotMarkdown = screenshotUrl
        ? `![Screenshot](${screenshotUrl})`
        : "";
      const title = issueTitle(form, checked.answers);
      const body = buildIssueMarkdown({
        form,
        answers: checked.answers,
        meta: session,
        screenshotMarkdown,
      });
      sessions.saveIssueMarkdown(session.id, body);

      if (!githubToken) {
        return res.json({
          ok: true,
          dryRun: true,
          title,
          body,
          screenshotUrl,
          message: "Geen GITHUB_TOKEN: issue lokaal bewaard, niet naar GitHub gestuurd.",
        });
      }

      const posted = await createFeedbackIssue({
        repo: githubRepo,
        token: githubToken,
        title,
        body,
        labels: githubLabels,
        projectNumber,
      });

      res.json({
        ok: true,
        dryRun: false,
        title,
        body,
        url: posted.url,
        number: posted.number,
        screenshotUrl,
      });
    } catch (err) {
      console.error(err);
      res.status(502).json({
        error: err.message || "GitHub-issue maken mislukt",
      });
    }
  });

  if (hasClient) {
    app.use(express.static(clientDist, { index: "index.html" }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "Niet gevonden" });
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}

module.exports = { createApp, loadForm };
