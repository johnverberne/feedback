const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { parseFormMarkdown, validateAnswers } = require("./formParser");
const { buildIssueMarkdown, issueTitle } = require("./issueMarkdown");
const { createSessionStore } = require("./sessions");
const { createFeedbackIssue, uploadScreenshot } = require("./github");
const { createCodebergIssue } = require("./codeberg");
const { readIntegrations } = require("./env");
const { mongoStatus, saveFeedbackIssue, listFeedbackIssues } = require("./store");

function loadForm(formPath) {
  const markdown = fs.readFileSync(formPath, "utf8");
  return { markdown, form: parseFormMarkdown(markdown) };
}

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5055",
  "http://localhost:5173",
  "https://projects.captainjohn.nl",
  "https://projects-captainjohn-production.up.railway.app",
];

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowed) {
  if (!origin) return true;
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) return true;
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
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
  const { github, codeberg } = readIntegrations(options);
  const githubAssetsRepo =
    options.githubAssetsRepo ||
    process.env.GITHUB_ASSETS_REPO ||
    "johnverberne/feedback";
  const githubLabels = parseLabels(options.githubLabels || process.env.GITHUB_LABELS);
  const projectNumber =
    options.githubProjectNumber || process.env.GITHUB_PROJECT_NUMBER || "";
  const codebergUrl =
    options.codebergUrl || process.env.CODEBERG_URL || "https://codeberg.org";
  const postGithubIssue = options.createFeedbackIssue || createFeedbackIssue;
  const postCodebergIssue = options.createCodebergIssue || createCodebergIssue;
  const allowedOrigins = parseOrigins(
    options.allowedOrigins || process.env.ALLOWED_ORIGINS
  );

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, allowedOrigins));
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
      github: github.enabled,
      repo: github.enabled ? github.repo : "",
      codeberg: codeberg.enabled,
      codebergRepo: codeberg.enabled ? codeberg.repo : "",
      mongo: mongoStatus(),
    });
  });

  app.get("/api/issues", async (_req, res) => {
    try {
      const issues = await listFeedbackIssues();
      res.json(issues);
    } catch (err) {
      res.status(503).json({ error: err.message || "MongoDB niet beschikbaar" });
    }
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

    let screenshotUrl = session.hasScreenshot
      ? screenshotPublicUrl(req, session.id)
      : null;
    const screenshotBuffer = sessions.screenshotBuffer(session.id);

    try {
      if (github.enabled && screenshotBuffer) {
        screenshotUrl = await uploadScreenshot({
          repo: githubAssetsRepo,
          token: github.token,
          id: session.id,
          buffer: screenshotBuffer,
        });
      }

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

      const warnings = [];
      let posted = null;
      let codebergPosted = null;
      if (github.enabled) {
        try {
          posted = await postGithubIssue({
            repo: github.repo,
            token: github.token,
            title,
            body,
            labels: githubLabels,
            projectNumber,
          });
        } catch (err) {
          warnings.push(`GitHub: ${err.message}`);
        }
      }
      if (codeberg.enabled) {
        try {
          codebergPosted = await postCodebergIssue({
            baseUrl: codebergUrl,
            repo: codeberg.repo,
            token: codeberg.token,
            title,
            body,
            labels: githubLabels,
          });
        } catch (err) {
          warnings.push(`Codeberg: ${err.message}`);
        }
      }

      const record = {
        sessionId: session.id,
        title,
        body,
        answers: checked.answers,
        formTitle: form.title,
        pageUrl: session.pageUrl,
        pageTitle: session.pageTitle,
        userAgent: session.userAgent,
        viewport: session.viewport,
        screenshotUrl: screenshotUrl || "",
        githubUrl: posted?.url || "",
        githubNumber: posted?.number ?? null,
        codebergUrl: codebergPosted?.url || "",
        codebergNumber: codebergPosted?.number ?? null,
        submittedAt: new Date(session.createdAt || Date.now()),
      };
      if (typeof options.saveIssue === "function") {
        await options.saveIssue(record);
      } else if (mongoStatus() === "connected") {
        await saveFeedbackIssue(record);
      }

      const postedAnywhere = Boolean(posted || codebergPosted);
      const targets = [
        posted ? "GitHub" : null,
        codebergPosted ? "Codeberg" : null,
      ].filter(Boolean);
      const message = postedAnywhere
        ? `Je reactie is bewaard op ${targets.join(" en ")}.`
        : warnings.length
          ? warnings.join(" · ")
          : mongoStatus() === "connected"
            ? "Je reactie is bewaard."
            : "Je reactie is lokaal bewaard.";

      res.json({
        ok: true,
        dryRun: !postedAnywhere,
        title,
        body,
        url: posted?.url || codebergPosted?.url || "",
        number: posted?.number ?? codebergPosted?.number ?? null,
        githubUrl: posted?.url || "",
        githubNumber: posted?.number ?? null,
        codebergUrl: codebergPosted?.url || "",
        codebergNumber: codebergPosted?.number ?? null,
        screenshotUrl,
        warnings,
        message,
      });
    } catch (err) {
      console.error(err);
      res.status(502).json({
        error: err.message || "Feedback opslaan mislukt",
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

module.exports = {
  createApp,
  loadForm,
  isAllowedOrigin,
  DEFAULT_ALLOWED_ORIGINS,
};
